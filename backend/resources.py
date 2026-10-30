"""Includable resources router. No existing account or authentication tables are replaced."""

from __future__ import annotations

import os
import hmac
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Generic, Literal, TypeVar
from uuid import uuid4
from urllib.parse import urlparse
from dataclasses import dataclass

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    and_,
    create_engine,
    func,
    or_,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

Category = Literal[
    "LAW_ENFORCEMENT",
    "MISSING_PERSON_ORGANIZATION",
    "SEARCH_AND_RESCUE",
    "FAMILY_SUPPORT",
    "COMMUNITY_AWARENESS",
    "GOVERNMENT_RESOURCE",
]
Scope = Literal["NATIONAL", "STATE", "COUNTY", "CITY"]
Status = Literal[
    "UNVERIFIED", "COMMUNITY_CONFIRMED", "NEEDS_REVIEW", "OFFICIALLY_VERIFIED"
]
AssessmentValue = Literal["ACCURATE", "INACCURATE"]


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Location(Base):
    __tablename__ = "resource_locations"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)
    code: Mapped[str] = mapped_column(String(10), index=True)
    name: Mapped[str] = mapped_column(String(200))
    parent: Mapped[str] = mapped_column(String(10), index=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)


class Resource(Base):
    __tablename__ = "community_resources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    creator_id: Mapped[str] = mapped_column(String(200), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    official: Mapped[bool] = mapped_column(Boolean, default=False)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Assessment(Base):
    __tablename__ = "resource_assessments"
    __table_args__ = (UniqueConstraint("resource_id", "user_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("community_resources.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(200), index=True)
    assessment: Mapped[str] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Correction(Base):
    __tablename__ = "resource_corrections"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("community_resources.id"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(200), index=True)
    explanation: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    proposed_changes: Mapped[dict] = mapped_column(JSON)
    is_dispute: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewer_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class StatusAudit(Base):
    __tablename__ = "resource_status_audit"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    resource_id: Mapped[str] = mapped_column(ForeignKey("community_resources.id"))
    reviewer_id: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ResourceInput(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=3000)
    category: Category
    scope: Scope
    state: str | None = Field(default=None, pattern=r"^\d{2}$")
    county: str | None = Field(default=None, pattern=r"^\d{5}$")
    city: str | None = Field(default=None, pattern=r"^\d{7}$")
    phone: str | None = Field(
        default=None, min_length=3, max_length=50, pattern=r"^[+\d\s().xX#-]+$"
    )
    email: str | None = Field(
        default=None, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    website: str | None = Field(default=None, max_length=2048)
    address: str | None = Field(default=None, max_length=500)
    source_url: str = Field(min_length=1, max_length=2048)

    @field_validator("website", "source_url")
    @classmethod
    def public_url(cls, value):
        if value is None:
            return value
        parsed = urlparse(value)
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or any(c.isspace() for c in value)
        ):
            raise ValueError("Use a public HTTP or HTTPS URL without credentials")
        return value

    @model_validator(mode="after")
    def coverage_and_contact(self):
        if not any((self.phone, self.email, self.website)):
            raise ValueError("At least one public contact method is required")
        required = {
            "NATIONAL": (),
            "STATE": ("state",),
            "COUNTY": ("state", "county"),
            "CITY": ("state", "county", "city"),
        }[self.scope]
        for key in ("state", "county", "city"):
            if key in required and not getattr(self, key):
                raise ValueError(f"{key} is required for {self.scope}")
            if key not in required and getattr(self, key):
                raise ValueError(f"{key} must be null for {self.scope}")
        return self


class CorrectionInput(StrictModel):
    explanation: str = Field(min_length=1, max_length=3000)
    source_url: str = Field(min_length=1, max_length=2048)
    proposed_changes: dict
    _url = field_validator("source_url")(ResourceInput.public_url.__func__)


class AssessmentInput(StrictModel):
    assessment: AssessmentValue
    reason: str | None = Field(default=None, min_length=1, max_length=3000)
    source_url: str | None = Field(default=None, max_length=2048)
    proposed_changes: dict = Field(default_factory=dict)
    _url = field_validator("source_url")(ResourceInput.public_url.__func__)

    @model_validator(mode="after")
    def require_reason(self):
        if self.assessment == "INACCURATE" and not self.reason:
            raise ValueError("An inaccuracy report requires a reason")
        if self.assessment == "ACCURATE" and (
            self.reason or self.source_url or self.proposed_changes
        ):
            raise ValueError("ACCURATE accepts only the assessment field")
        return self


class ReviewInput(StrictModel):
    status: Literal["APPROVED", "REJECTED"]
    review_note: str = Field(min_length=1, max_length=3000)


class StatusInput(StrictModel):
    status: Literal["UNVERIFIED", "NEEDS_REVIEW", "OFFICIALLY_VERIFIED"]
    reason: str = Field(min_length=1, max_length=3000)


class ResourceOutput(ResourceInput):
    id: str
    status: Status
    state_name: str | None
    county_name: str | None
    city_name: str | None
    is_owner: bool
    confirmation_count: int
    dispute_count: int
    current_user_assessment: AssessmentValue | None
    last_confirmed_at: datetime | None
    last_verified_at: datetime | None
    created_at: datetime


T = TypeVar("T")


class PageOutput(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class LocationOutput(BaseModel):
    id: str
    name: str


class ResolvedLocationOutput(BaseModel):
    state: str
    county: str | None
    city: str | None


class CorrectionOutput(BaseModel):
    id: str
    resource_id: str
    explanation: str
    source_url: str | None
    proposed_changes: dict
    status: Literal["PENDING", "APPROVED", "REJECTED"]
    created_at: datetime
    reviewed_at: datetime | None
    review_note: str | None


class AssessmentOutput(BaseModel):
    resource_id: str
    resource_name: str
    assessment: AssessmentValue
    updated_at: datetime


class ContributionsOutput(BaseModel):
    assessments: PageOutput[AssessmentOutput]
    corrections: PageOutput[CorrectionOutput]


class DuplicatesOutput(BaseModel):
    items: list[ResourceOutput]


@dataclass(frozen=True)
class Principal:
    id: str
    is_admin: bool = False


def get_principal(request: Request) -> Principal | None:
    """Override with the host app's validated account/session dependency when integrating.

    Standalone accepts HS256 JWTs only with configured secret, issuer and audience.
    Cookie mutations also require the CSRF claim to match the header.
    """
    auth = request.headers.get("authorization", "")
    bearer = auth.startswith("Bearer ")
    token = auth[7:] if bearer else request.cookies.get("bth_session")
    if not token:
        return None
    secret = os.getenv("RESOURCE_JWT_SECRET", "")
    issuer, audience = os.getenv("RESOURCE_JWT_ISSUER"), os.getenv(
        "RESOURCE_JWT_AUDIENCE"
    )
    if len(secret) < 32 or not issuer or not audience:
        raise HTTPException(401, "Configure authentication or override get_principal")
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["sub", "exp", "iss", "aud"]},
        )
        if not isinstance(claims["sub"], str) or not claims["sub"]:
            raise ValueError("Invalid subject")
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Invalid or expired session")
    if not bearer and request.method not in ("GET", "HEAD", "OPTIONS"):
        expected = claims.get("csrf", "")
        supplied = request.headers.get("x-csrf-token", "")
        if (
            not isinstance(expected, str)
            or not expected
            or not hmac.compare_digest(expected, supplied)
        ):
            raise HTTPException(403, "Invalid CSRF token")
    return Principal(claims["sub"], claims.get("role") == "ADMIN")


def require_user(user=Depends(get_principal)) -> Principal:
    if user is None:
        raise HTTPException(401, "Sign in to contribute")
    return user


def require_admin(user=Depends(require_user)) -> Principal:
    if not user.is_admin:
        raise HTTPException(403, "Administrator access required")
    return user


def get_db(request: Request):
    with request.app.state.session_factory() as db:
        yield db


router = APIRouter(prefix="/api", tags=["Community resources"])


def find_resource(db, resource_id, lock=False):
    stmt = select(Resource).where(Resource.id == resource_id)
    if lock:
        stmt = stmt.with_for_update()
    resource = db.scalar(stmt)
    if resource is None:
        raise HTTPException(404, "Resource not found")
    return resource


def validate_location(db, data):
    for kind, parent in [
        ("state", ""),
        ("county", data.get("state")),
        ("city", data.get("county")),
    ]:
        code = data.get(kind)
        if code and not db.scalar(
            select(Location).where(
                Location.kind == kind, Location.code == code, Location.parent == parent
            )
        ):
            raise HTTPException(422, f"Unknown {kind} or invalid parent location")


def validate_changes(db, resource, changes):
    # No status, ownership, source or timestamps may be changed through this endpoint.
    allowed = set(ResourceInput.model_fields) - {"source_url"}
    if set(changes) - allowed:
        raise HTTPException(422, "Unsupported correction fields")
    try:
        data = ResourceInput.model_validate({**resource.data, **changes}).model_dump()
    except ValueError as error:
        raise HTTPException(422, str(error))
    validate_location(db, data)
    return data


def resource_json(db, resource, user):
    assessments = db.scalars(
        select(Assessment).where(Assessment.resource_id == resource.id)
    ).all()
    count = sum(a.assessment == "ACCURATE" for a in assessments)
    last = max(
        (a.updated_at for a in assessments if a.assessment == "ACCURATE"), default=None
    )
    disputes = sum(a.assessment == "INACCURATE" for a in assessments)
    pending_issue = db.scalar(
        select(Correction.id)
        .where(
            Correction.resource_id == resource.id,
            Correction.is_dispute.is_(True),
            Correction.status == "PENDING",
        )
        .limit(1)
    )
    status = (
        "NEEDS_REVIEW"
        if disputes or pending_issue or resource.flagged
        else (
            "OFFICIALLY_VERIFIED"
            if resource.official
            else "COMMUNITY_CONFIRMED" if count else "UNVERIFIED"
        )
    )
    labels = {}
    for kind in ("state", "county", "city"):
        code = resource.data.get(kind)
        parent = {
            "state": "",
            "county": resource.data.get("state"),
            "city": resource.data.get("county"),
        }[kind]
        labels[f"{kind}_name"] = (
            db.scalar(
                select(Location.name).where(
                    Location.kind == kind,
                    Location.code == code,
                    Location.parent == parent,
                )
            )
            if code
            else None
        )
    return {
        **resource.data,
        **labels,
        "id": resource.id,
        "status": status,
        "is_owner": bool(user and user.id == resource.creator_id),
        "confirmation_count": count,
        "dispute_count": disputes,
        "last_confirmed_at": last,
        "last_verified_at": resource.last_verified_at,
        "created_at": resource.created_at,
        "current_user_assessment": next(
            (a.assessment for a in assessments if user and a.user_id == user.id), None
        ),
    }


def correction_json(row):
    return {
        k: getattr(row, k)
        for k in (
            "id",
            "resource_id",
            "explanation",
            "source_url",
            "proposed_changes",
            "status",
            "created_at",
            "reviewed_at",
            "review_note",
        )
    }


def paged(db, stmt, page, page_size, transform):
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": [transform(row) for row in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def location_match(db, kind, value, parent):
    import re

    if not value:
        return None

    def normalized(text):
        return re.sub(
            r"\s+(city|town|village|municipality|cdp)$", "", text.casefold().strip()
        )

    rows = db.scalars(
        select(Location).where(Location.kind == kind, Location.parent == parent)
    ).all()
    matches = [
        row
        for row in rows
        if value == row.code
        or any(
            normalized(value) == normalized(label)
            for label in [row.name, *(row.aliases or [])]
        )
    ]
    return matches[0] if len(matches) == 1 else None


@router.get("/locations/resolve", response_model=ResolvedLocationOutput)
def resolve_location(
    state: str, county: str = "", city: str = "", db: Session = Depends(get_db)
):
    s = location_match(db, "state", state, "")
    if not s:
        raise HTTPException(422, "State could not be resolved")
    c = location_match(db, "county", county, s.code) if county else None
    p = location_match(db, "city", city, c.code) if c and city else None
    return {
        "state": s.code,
        "county": c.code if c else None,
        "city": p.code if p else None,
    }


@router.get("/locations/states", response_model=list[LocationOutput])
def states(db: Session = Depends(get_db)):
    return [
        {"id": r.code, "name": r.name}
        for r in db.scalars(
            select(Location).where(Location.kind == "state").order_by(Location.name)
        )
    ]


@router.get("/locations/counties", response_model=list[LocationOutput])
def counties(state: str, db: Session = Depends(get_db)):
    validate_location(db, {"state": state})
    return [
        {"id": r.code, "name": r.name}
        for r in db.scalars(
            select(Location)
            .where(Location.kind == "county", Location.parent == state)
            .order_by(Location.name)
        )
    ]


@router.get("/locations/cities", response_model=list[LocationOutput])
def cities(state: str, county: str, db: Session = Depends(get_db)):
    validate_location(db, {"state": state, "county": county})
    return [
        {"id": r.code, "name": r.name}
        for r in db.scalars(
            select(Location)
            .where(Location.kind == "city", Location.parent == county)
            .order_by(Location.name)
        )
    ]


@router.get("/resources/duplicates", response_model=DuplicatesOutput)
def duplicates(
    name: str = Query(min_length=1, max_length=200),
    db: Session = Depends(get_db),
    user=Depends(get_principal),
):
    # Database prefilter bounds fuzzy work; exact matches and leading-word candidates.
    name = name.strip()
    if not name:
        raise HTTPException(422, "Resource name must not be blank")
    term = name.casefold().split()[0]
    candidates = db.scalars(
        select(Resource)
        .where(
            func.lower(Resource.data["name"].as_string()).contains(
                term, autoescape=True
            )
        )
        .limit(100)
    ).all()
    matches = sorted(
        candidates,
        key=lambda r: SequenceMatcher(
            None, name.casefold(), r.data["name"].casefold()
        ).ratio(),
        reverse=True,
    )
    items = [
        resource_json(db, r, user)
        for r in matches
        if SequenceMatcher(None, name.casefold(), r.data["name"].casefold()).ratio()
        >= 0.55
    ][:10]
    return {"items": items}


@router.get("/resources", response_model=PageOutput[ResourceOutput])
def list_resources(
    search: str = Query(default="", max_length=200),
    state: str | None = None,
    county: str | None = None,
    city: str | None = None,
    category: Category | None = None,
    scope: Scope | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(get_principal),
):
    if (county and not state) or (city and not county):
        raise HTTPException(422, "Location filters require their parent locations")
    validate_location(db, {"state": state, "county": county, "city": city})
    data = Resource.data
    stmt = select(Resource)
    if search:
        stmt = stmt.where(
            or_(
                func.lower(data["name"].as_string()).contains(
                    search.casefold(), autoescape=True
                ),
                func.lower(data["description"].as_string()).contains(
                    search.casefold(), autoescape=True
                ),
            )
        )
    if category:
        stmt = stmt.where(data["category"].as_string() == category)
    if scope:
        stmt = stmt.where(data["scope"].as_string() == scope)
    if state:
        coverage = [data["scope"].as_string() == "NATIONAL"]
        # All scopes within a state; successively restrict descendants while keeping ancestors.
        local = [data["state"].as_string() == state]
        if county:
            local.append(
                or_(
                    data["scope"].as_string() == "STATE",
                    data["county"].as_string() == county,
                )
            )
        if city:
            local.append(
                or_(
                    data["scope"].as_string().in_(["STATE", "COUNTY"]),
                    data["city"].as_string() == city,
                )
            )
        coverage.append(and_(*local))
        stmt = stmt.where(or_(*coverage))
    return paged(
        db,
        stmt.order_by(Resource.created_at.desc(), Resource.id),
        page,
        page_size,
        lambda r: resource_json(db, r, user),
    )


@router.post("/resources", status_code=201, response_model=ResourceOutput)
def create_resource(
    body: ResourceInput, db: Session = Depends(get_db), user=Depends(require_user)
):
    data = body.model_dump()
    validate_location(db, data)
    row = Resource(creator_id=user.id, data=data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return resource_json(db, row, user)


@router.get("/resources/{resource_id}", response_model=ResourceOutput)
def detail_resource(
    resource_id: str, db: Session = Depends(get_db), user=Depends(get_principal)
):
    return resource_json(db, find_resource(db, resource_id), user)


@router.post("/resources/{resource_id}/verifications", response_model=ResourceOutput)
def assess_resource(
    resource_id: str,
    body: AssessmentInput,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    resource = find_resource(db, resource_id, lock=True)
    if resource.creator_id == user.id:
        raise HTTPException(403, "Creators cannot assess their own resources")
    if body.assessment == "INACCURATE":
        validate_changes(db, resource, body.proposed_changes)
    row = db.scalar(
        select(Assessment).where(
            Assessment.resource_id == resource_id, Assessment.user_id == user.id
        )
    )
    if not row:
        row = Assessment(resource_id=resource_id, user_id=user.id)
        db.add(row)
    # Repeated identical reports update the pending issue instead of creating duplicates.
    row.assessment, row.updated_at = body.assessment, now()
    if body.assessment == "INACCURATE":
        issue = db.scalar(
            select(Correction).where(
                Correction.resource_id == resource_id,
                Correction.user_id == user.id,
                Correction.is_dispute.is_(True),
                Correction.status == "PENDING",
            )
        )
        if issue is None:
            issue = Correction(
                resource_id=resource_id, user_id=user.id, is_dispute=True
            )
            db.add(issue)
        issue.explanation, issue.source_url, issue.proposed_changes = (
            body.reason,
            body.source_url,
            body.proposed_changes,
        )
    db.commit()
    return resource_json(db, resource, user)


@router.delete("/resources/{resource_id}/verifications", response_model=ResourceOutput)
def withdraw_resource(
    resource_id: str, db: Session = Depends(get_db), user=Depends(require_user)
):
    resource = find_resource(db, resource_id, lock=True)
    row = db.scalar(
        select(Assessment).where(
            Assessment.resource_id == resource_id, Assessment.user_id == user.id
        )
    )
    if row:
        db.delete(row)
    db.commit()
    return resource_json(db, resource, user)


@router.post(
    "/resources/{resource_id}/corrections",
    status_code=201,
    response_model=CorrectionOutput,
)
def correct_resource(
    resource_id: str,
    body: CorrectionInput,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    resource = find_resource(db, resource_id, lock=True)
    if not body.proposed_changes:
        raise HTTPException(422, "Propose at least one changed field")
    validate_changes(db, resource, body.proposed_changes)
    row = Correction(resource_id=resource_id, user_id=user.id, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return correction_json(row)


@router.get("/users/me/resources", response_model=PageOutput[ResourceOutput])
def own_resources(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return paged(
        db,
        select(Resource)
        .where(Resource.creator_id == user.id)
        .order_by(Resource.created_at.desc(), Resource.id),
        page,
        page_size,
        lambda r: resource_json(db, r, user),
    )


@router.get("/users/me/resource-contributions", response_model=ContributionsOutput)
def contributions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    assessments = paged(
        db,
        select(Assessment)
        .where(Assessment.user_id == user.id)
        .order_by(Assessment.updated_at.desc(), Assessment.id),
        page,
        page_size,
        lambda a: {
            "resource_id": a.resource_id,
            "resource_name": find_resource(db, a.resource_id).data["name"],
            "assessment": a.assessment,
            "updated_at": a.updated_at,
        },
    )
    corrections = paged(
        db,
        select(Correction)
        .where(Correction.user_id == user.id)
        .order_by(Correction.created_at.desc(), Correction.id),
        page,
        page_size,
        correction_json,
    )
    return {"assessments": assessments, "corrections": corrections}


@router.get("/admin/resource-corrections", response_model=PageOutput[CorrectionOutput])
def admin_corrections(
    status: Literal["PENDING", "APPROVED", "REJECTED"] = "PENDING",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    return paged(
        db,
        select(Correction)
        .where(Correction.status == status)
        .order_by(Correction.created_at, Correction.id),
        page,
        page_size,
        correction_json,
    )


@router.patch(
    "/admin/resource-corrections/{correction_id}", response_model=CorrectionOutput
)
def review_correction(
    correction_id: str,
    body: ReviewInput,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    # Lock resources before corrections consistently with assessment submission.
    candidate = db.get(Correction, correction_id)
    if not candidate:
        raise HTTPException(404, "Correction not found")
    resource = find_resource(db, candidate.resource_id, lock=True)
    row = db.scalar(
        select(Correction)
        .where(Correction.id == correction_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row.status != "PENDING":
        raise HTTPException(409, "Correction already reviewed")
    if body.status == "APPROVED" and row.proposed_changes:
        resource.data = validate_changes(db, resource, row.proposed_changes)
        resource.official = False
        resource.last_verified_at = None
        # Old confirmations apply to the previous published version.
        for a in db.scalars(
            select(Assessment).where(Assessment.resource_id == resource.id)
        ):
            db.delete(a)
    if row.is_dispute:
        assessment = db.scalar(
            select(Assessment).where(
                Assessment.resource_id == resource.id,
                Assessment.user_id == row.user_id,
                Assessment.assessment == "INACCURATE",
            )
        )
        if assessment is not None:
            db.delete(assessment)
    row.status, row.review_note, row.reviewer_id, row.reviewed_at = (
        body.status,
        body.review_note,
        user.id,
        now(),
    )
    db.commit()
    return correction_json(row)


@router.patch("/admin/resources/{resource_id}/status", response_model=ResourceOutput)
def update_status(
    resource_id: str,
    body: StatusInput,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    resource = find_resource(db, resource_id, lock=True)
    if resource.creator_id == user.id and body.status == "OFFICIALLY_VERIFIED":
        raise HTTPException(403, "Creators cannot verify their own resources")
    resource.official = body.status == "OFFICIALLY_VERIFIED"
    resource.flagged = body.status == "NEEDS_REVIEW"
    resource.last_verified_at = now() if resource.official else None
    db.add(
        StatusAudit(resource_id=resource_id, reviewer_id=user.id, **body.model_dump())
    )
    db.commit()
    return resource_json(db, resource, user)


def create_app(engine=None):
    app = FastAPI(title="Community Resources API", version="1.0.0")
    engine = engine or create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
    app.state.session_factory = sessionmaker(engine, expire_on_commit=False)
    origins = [
        o.strip()
        for o in os.getenv("RESOURCE_ALLOWED_ORIGINS", "").split(",")
        if o.strip()
    ]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "PATCH"],
            allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
        )
    app.include_router(router)
    return app
