import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from backend.resources import Base, Location, Principal, create_app, get_principal


@pytest.fixture()
def api():
    database = os.getenv("RESOURCE_TEST_DATABASE_URL")
    engine = (
        create_engine(database)
        if database
        else create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    )
    # RESOURCE_TEST_DATABASE_URL must point to a disposable test database.
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app = create_app(engine)
    with app.state.session_factory() as db:
        db.add_all(
            [
                Location(
                    key="state:36", kind="state", code="36", name="New York", parent=""
                ),
                Location(
                    key="county:36061",
                    kind="county",
                    code="36061",
                    name="New York County",
                    parent="36",
                ),
                Location(
                    key="city:3651000:36061",
                    kind="city",
                    code="3651000",
                    name="New York",
                    parent="36061",
                ),
            ]
        )
        db.commit()
    app.dependency_overrides[get_principal] = lambda: Principal("author", False)
    with TestClient(app) as client:
        yield client, app
    Base.metadata.drop_all(engine)
    engine.dispose()


def payload(**kw):
    return dict(
        name="Family assistance",
        description="Public family support",
        category="FAMILY_SUPPORT",
        scope="NATIONAL",
        state=None,
        county=None,
        city=None,
        phone=None,
        email=None,
        website="https://example.org",
        address=None,
        source_url="https://example.org/about",
        **kw,
    )


def create(client, **kw):
    body = payload()
    body.update(kw)
    response = client.post("/api/resources", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_submission_validation_duplicates_and_no_private_identity(api):
    c, _ = api
    r = create(c)
    assert r["status"] == "UNVERIFIED"
    assert "email" in r and "creator_email" not in r
    assert (
        c.get("/api/resources/duplicates", params={"name": "Family assistance"}).json()[
            "items"
        ][0]["id"]
        == r["id"]
    )
    body = payload()
    body["website"] = None
    assert c.post("/api/resources", json=body).status_code == 422
    body = payload()
    body["source_url"] = "javascript:alert(1)"
    assert c.post("/api/resources", json=body).status_code == 422


def test_coverage_inherits_national_state_county(api):
    c, _ = api
    for scope, location in [
        ("NATIONAL", {}),
        ("STATE", {"state": "36"}),
        ("COUNTY", {"state": "36", "county": "36061"}),
        ("CITY", {"state": "36", "county": "36061", "city": "3651000"}),
    ]:
        create(c, name=scope, scope=scope, **location)
    page = c.get(
        "/api/resources", params={"state": "36", "county": "36061", "city": "3651000"}
    ).json()
    assert page["total"] == 4
    assert c.get("/api/resources", params={"city": "3651000"}).status_code == 422
    assert (
        c.get(
            "/api/locations/cities", params={"state": "36", "county": "36061"}
        ).json()[0]["id"]
        == "3651000"
    )
    assert (
        c.post(
            "/api/resources",
            json={
                **payload(),
                "scope": "CITY",
                "state": "36",
                "county": "99999",
                "city": "3651000",
            },
        ).status_code
        == 422
    )


def test_assessments_switch_withdraw_and_prevent_self_confirmation(api):
    c, app = api
    r = create(c)
    url = f"/api/resources/{r['id']}/verifications"
    assert c.post(url, json={"assessment": "ACCURATE"}).status_code == 403
    app.dependency_overrides[get_principal] = lambda: Principal("helper", False)
    assert (
        c.post(url, json={"assessment": "ACCURATE"}).json()["confirmation_count"] == 1
    )
    assert (
        c.post(url, json={"assessment": "ACCURATE"}).json()["confirmation_count"] == 1
    )
    assert c.post(url, json={"assessment": "INACCURATE"}).status_code == 422
    result = c.post(
        url,
        json={
            "assessment": "INACCURATE",
            "reason": "Phone is disconnected",
            "source_url": "https://example.org",
            "proposed_changes": {},
        },
    ).json()
    assert result["confirmation_count"] == 0 and result["status"] == "NEEDS_REVIEW"
    assert (
        c.get("/api/users/me/resource-contributions").json()["corrections"]["total"]
        == 1
    )
    assert c.delete(url).json()["current_user_assessment"] is None


def test_correction_is_pending_until_admin_review(api):
    c, app = api
    r = create(c)
    app.dependency_overrides[get_principal] = lambda: Principal("helper", False)
    result = c.post(
        f"/api/resources/{r['id']}/corrections",
        json={
            "explanation": "Official name changed",
            "source_url": "https://example.org",
            "proposed_changes": {"name": "New name"},
        },
    )
    assert result.status_code == 201, result.text
    correction = result.json()
    assert correction["status"] == "PENDING"
    assert c.get(f"/api/resources/{r['id']}").json()["name"] == r["name"]
    assert c.get("/api/admin/resource-corrections").status_code == 403
    app.dependency_overrides[get_principal] = lambda: Principal("admin", True)
    assert (
        c.patch(
            f"/api/admin/resource-corrections/{correction['id']}",
            json={"status": "APPROVED", "review_note": "Checked official source"},
        ).status_code
        == 200
    )
    assert c.get(f"/api/resources/{r['id']}").json()["name"] == "New name"
    assert (
        c.patch(
            f"/api/admin/resource-corrections/{correction['id']}",
            json={"status": "REJECTED", "review_note": "Again"},
        ).status_code
        == 409
    )


def test_anonymous_reads_and_authentication_required(api):
    c, app = api
    app.dependency_overrides.clear()
    assert c.get("/api/resources").status_code == 200
    assert c.post("/api/resources", json=payload()).status_code == 401
    assert c.get("/api/resources/missing").status_code == 404


def test_location_resolution_and_invalid_state(api):
    c, _ = api
    r = c.get(
        "/api/locations/resolve",
        params={"state": "New York", "county": "New York County", "city": "New York"},
    )
    assert r.status_code == 200 and r.json()["city"] == "3651000"
    assert (
        c.get("/api/locations/resolve", params={"state": "Unknown"}).status_code == 422
    )


def test_correction_cannot_change_status_or_ownership(api):
    c, _ = api
    r = create(c)
    for changes in [
        {"official": True},
        {"creator_id": "attacker"},
        {"source_url": "https://evil.example"},
    ]:
        assert (
            c.post(
                f"/api/resources/{r['id']}/corrections",
                json={
                    "explanation": "Try",
                    "source_url": "https://example.org",
                    "proposed_changes": changes,
                },
            ).status_code
            == 422
        )


def test_official_status_requires_admin_and_is_preserved_after_confirmation(api):
    c, app = api
    r = create(c)
    url = f"/api/admin/resources/{r['id']}/status"
    assert (
        c.patch(
            url, json={"status": "OFFICIALLY_VERIFIED", "reason": "Reviewed"}
        ).status_code
        == 403
    )
    app.dependency_overrides[get_principal] = lambda: Principal("admin", True)
    assert c.patch(
        url,
        json={"status": "OFFICIALLY_VERIFIED", "reason": "Reviewed official source"},
    ).json()["last_verified_at"]
    app.dependency_overrides[get_principal] = lambda: Principal("helper", False)
    assert (
        c.post(
            f"/api/resources/{r['id']}/verifications", json={"assessment": "ACCURATE"}
        ).json()["status"]
        == "OFFICIALLY_VERIFIED"
    )


def test_census_import_preserves_county_place_relationship(tmp_path):
    from backend.manage import import_census
    from sqlalchemy.orm import Session

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    csv = tmp_path / "census.csv"
    csv.write_text(
        "SUMLEV,STATE,COUNTY,PLACE,NAME,STNAME\n040,36,000,00000,New York,New York\n050,36,061,00000,New York County,New York\n157,36,061,51000,New York city (part),New York\n162,36,000,51000,New York city,New York\n"
    )
    with Session(engine) as db:
        import_census(db, csv)
        city = db.get(Location, "city:3651000:36061")
        assert city.name == "New York city" and city.parent == "36061"


def test_admin_can_resolve_a_rejected_inaccuracy_report(api):
    c, app = api
    r = create(c)
    app.dependency_overrides[get_principal] = lambda: Principal("helper", False)
    c.post(
        f"/api/resources/{r['id']}/verifications",
        json={"assessment": "INACCURATE", "reason": "Suspected problem"},
    )
    correction = c.get("/api/users/me/resource-contributions").json()["corrections"][
        "items"
    ][0]
    app.dependency_overrides[get_principal] = lambda: Principal("admin", True)
    c.patch(
        f"/api/admin/resource-corrections/{correction['id']}",
        json={
            "status": "REJECTED",
            "review_note": "Official listing confirms the original information",
        },
    )
    assert c.get(f"/api/resources/{r['id']}").json()["status"] == "UNVERIFIED"


def test_signed_session_auth_csrf_and_admin_claims(api, monkeypatch):
    import jwt
    from datetime import datetime, timezone, timedelta

    c, app = api
    app.dependency_overrides.clear()
    monkeypatch.setenv("RESOURCE_JWT_SECRET", "test-only-secret-at-least-32-characters")
    monkeypatch.setenv("RESOURCE_JWT_ISSUER", "test-issuer")
    monkeypatch.setenv("RESOURCE_JWT_AUDIENCE", "test-audience")
    token = jwt.encode(
        {
            "sub": "helper",
            "role": "GENERAL_PUBLIC",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "iss": "test-issuer",
            "aud": "test-audience",
            "csrf": "test-csrf",
        },
        "test-only-secret-at-least-32-characters",
        algorithm="HS256",
    )
    c.cookies.set("bth_session", token)
    assert c.post("/api/resources", json=payload()).status_code == 403
    assert (
        c.post(
            "/api/resources", json=payload(), headers={"X-CSRF-Token": "test-csrf"}
        ).status_code
        == 201
    )
    assert c.get("/api/admin/resource-corrections").status_code == 403
    c.cookies.clear()
    assert (
        c.post(
            "/api/resources",
            json=payload(),
            headers={"Authorization": f"Bearer {token}"},
        ).status_code
        == 201
    )
    assert (
        c.post(
            "/api/resources",
            json=payload(),
            headers={"Authorization": "Bearer invalid"},
        ).status_code
        == 401
    )


def test_pagination_and_search_are_bounded(api):
    c, _ = api
    create(c, name="Search assistance")
    create(c, name="Family support")
    assert c.get("/api/resources", params={"search": "Search"}).json()["total"] == 1
    p = c.get("/api/resources", params={"page_size": 1, "page": 2}).json()
    assert p["total"] == 2 and len(p["items"]) == 1
    assert c.get("/api/resources", params={"page_size": 101}).status_code == 422
    assert c.get("/api/resources", params={"page": 0}).status_code == 422
    assert c.get("/api/resources", params={"search": "%"}).json()["total"] == 0


def test_census_import_accepts_census_windows_encoding(tmp_path):
    from backend.manage import import_census
    from sqlalchemy.orm import Session

    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    csv = tmp_path / "census.csv"
    csv.write_bytes(
        "SUMLEV,STATE,COUNTY,PLACE,NAME,STNAME\n040,35,000,00000,New Mexico,New Mexico\n050,35,013,00000,Doña Ana County,New Mexico\n".encode(
            "cp1252"
        )
    )
    with Session(engine) as db:
        import_census(db, csv)
        assert db.get(Location, "county:35013").name == "Doña Ana County"


def test_concurrent_assessments_do_not_double_count(api):
    from concurrent.futures import ThreadPoolExecutor

    c, app = api
    if app.state.session_factory.kw["bind"].dialect.name != "postgresql":
        pytest.skip("Row locking requires PostgreSQL")
    r = create(c)
    app.dependency_overrides[get_principal] = lambda: Principal("helper", False)
    with ThreadPoolExecutor(max_workers=4) as workers:
        responses = list(
            workers.map(
                lambda _: c.post(
                    f"/api/resources/{r['id']}/verifications",
                    json={"assessment": "ACCURATE"},
                ),
                range(8),
            )
        )
    assert all(result.status_code == 200 for result in responses)
    assert c.get(f"/api/resources/{r['id']}").json()["confirmation_count"] == 1


def test_admin_cannot_officially_verify_own_resource(api):
    c, app = api
    app.dependency_overrides[get_principal] = lambda: Principal("admin", True)
    r = create(c)
    assert (
        c.patch(
            f"/api/admin/resources/{r['id']}/status",
            json={"status": "OFFICIALLY_VERIFIED", "reason": "Own resource"},
        ).status_code
        == 403
    )


def test_duplicate_search_rejects_whitespace_names(api):
    c, _ = api
    assert c.get("/api/resources/duplicates", params={"name": "   "}).status_code == 422
