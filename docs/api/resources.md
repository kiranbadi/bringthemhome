# Community Resources API and curl guide

This feature includes a new FastAPI implementation in `backend/resources.py` and an Angular client. The original backend is not in this repository: include the router in that application and connect its validated account dependency before deployment, or run this API separately. Nothing has been deployed.

## Existing application: current creation contract (2026-10-28)

The Angular creation client targets the existing application's contract supplied by the backend owner:
`state_code`, `county_name`, `city_name`, `website_url`, and required `public_contact_confirmed`.
It converts selected Census IDs into postal state codes and county/city names before POST.
The form requires explicit public-contact confirmation. Angular uses `withCredentials: true`;
the browser attaches the `bth_session` cookie according to its domain, path, SameSite and Secure settings.
JavaScript must not manually set a Cookie header. The existing CSRF interceptor sends X-CSRF-Token.

```bash
curl -i 'http://localhost:8000/api/resources' \
  -X POST \
  -H 'Cookie: bth_session=YOUR_SESSION_VALUE' \
  -H 'X-CSRF-Token: YOUR_CSRF_TOKEN' \
  -H 'Content-Type: application/json' \
  --data '{
    "name": "Family Search Assistance",
    "description": "Public organization supporting families with searches.",
    "category": "FAMILY_SUPPORT",
    "scope": "NATIONAL",
    "state_code": null,
    "county_name": null,
    "city_name": null,
    "phone": null,
    "email": null,
    "website_url": "https://example.org",
    "address": null,
    "source_url": "https://example.org/about",
    "public_contact_confirmed": true
  }'
```

The remaining sections describe the original standalone Python API, which still uses
`state`, `county`, `city`, and `website`. That standalone contract is different from the current
Angular creation request; its backend and authentication adapter require alignment to use it with this client.
Read, correction and assessment contracts have not been changed based on the creation example.

## Run the backend

Use Python 3.11+ and an existing PostgreSQL database dedicated to the application. From the repository root:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
export DATABASE_URL='postgresql+psycopg://USER:PASSWORD@localhost:5432/bringthemhome'
backend/.venv/bin/python -m backend.manage init-db
export RESOURCE_ALLOWED_ORIGINS='http://localhost:4200'
backend/.venv/bin/uvicorn backend.resources:create_app --factory --port 8000
```

`init-db` creates only the new tables; it does not drop or modify existing tables. For an existing production database, register these models with the application's normal migration process instead of relying on schema creation at startup. No accounts, login endpoint, or S3 storage is added by this module. Resources contain text and public links only.

Swagger UI: `http://localhost:8000/docs`; machine-readable schemas: `http://localhost:8000/openapi.json`. Input and output models are declared in FastAPI and matched by `src/app/resources/resource.models.ts`.

### Integrating authentication with the existing server

The Angular client reuses `AccountManagementService`, credentialed HTTP requests and the existing CSRF interceptor. This project currently uses a cookie session plus CSRF, so resources extend that interceptor's backend allowlist.

Use the existing backend's validated user/session dependency (including account revocation and CSRF enforcement), never a caller-supplied user ID. An integration adapter looks like:

```python
from fastapi import Depends
from backend.resources import router, get_principal, get_db, Principal

# require_current_account must validate your real session, active account and CSRF
# on mutations. Adapt this example to your existing server's actual dependency.
def resource_principal(account=Depends(require_current_account)):
    return Principal(id=str(account.id), is_admin=account.role == 'ADMIN')

app.include_router(router)
app.dependency_overrides[get_principal] = resource_principal
app.dependency_overrides[get_db] = existing_sqlalchemy_session_dependency
```

For public directory reads with optional session context, make the adapter optional for guests; return `None` when there are no credentials. `require_user` and `require_admin` enforce mutation/account permissions. An adapter that always requires login will also protect public reads, which is not the intended directory behavior.

The standalone app instead validates HS256 JWTs using `RESOURCE_JWT_SECRET` (at least 32 characters), `RESOURCE_JWT_ISSUER`, and `RESOURCE_JWT_AUDIENCE`. Tokens must contain `sub`, `exp`, `iss`, and `aud`. A signed `role: "ADMIN"` enables moderation. Cookie JWT mutations also require a signed `csrf` claim matching `X-CSRF-Token`. Bearer authentication does not require CSRF. Missing authentication configuration fails closed. Configure these variables only if the standalone token contract matches your real identity provider; otherwise use the integration adapter. Do not embed signing secrets in Angular.

## Load authoritative location reference data

No handwritten state/county/city list is shipped. Use the U.S. Census Bureau's national subcounty population-estimates CSV and state reference file. The importer reads official `SUMLEV` 040 (state), 050 (county), 157 (county/place part), and 162 (incorporated place). County/place parts preserve cities that cross county boundaries. Names and FIPS codes are sourced from the file; optional state postal aliases come from `state.txt`.

Sources: [Census city and town datasets](https://www.census.gov/programs-surveys/popest/data/data-sets.html), [SUB-EST2024 record layout](https://www2.census.gov/programs-surveys/popest/technical-documentation/file-layouts/2020-2024/SUB-EST2024.pdf), [state reference](https://www2.census.gov/geo/docs/reference/state.txt).

```bash
curl -fL 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv' -o /tmp/sub-est2024.csv
curl -fL 'https://www2.census.gov/geo/docs/reference/state.txt' -o /tmp/census-state.txt
backend/.venv/bin/python -m backend.manage import-census \
  --file /tmp/sub-est2024.csv --states-file /tmp/census-state.txt
```

Refresh with an audited newer release using the same layout. Re-imports upsert rows; they do not delete locations already referenced by resources. This MVP covers incorporated cities/places in that dataset. Unincorporated locations use county-level coverage; Census-designated places are not all present in population-estimates files. The UI labels the control “City / Census place.” Do not synthesize county/place relationships from Gazetteer coordinates.

States use 2-digit FIPS, counties use 5-digit full GEOIDs, and cities use 7-digit state+place GEOIDs; always preserve leading zeros. The UI displays names. If reference data is not loaded, the location controls display an availability message; national submissions can still be made.

## Endpoint inventory

All paths below are relative to the API host. Public reads return personalized `is_owner` and `current_user_assessment` when a valid session is supplied, but never contributors' IDs or email addresses. Resource `email` means the public organization email supplied in the form.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/api/resources` | Public | Filtered, paginated resource list |
| GET | `/api/resources/duplicates` | Public | Up to 10 likely duplicates |
| GET | `/api/resources/{resource_id}` | Public | Resource details and server assessment state |
| POST | `/api/resources` | Signed in | Create resource; 201 |
| POST | `/api/resources/{resource_id}/verifications` | Signed in, not creator | Upsert assessment; updated resource |
| DELETE | `/api/resources/{resource_id}/verifications` | Signed in | Withdraw current assessment; updated resource |
| POST | `/api/resources/{resource_id}/corrections` | Signed in | Pending correction; 201 |
| GET | `/api/users/me/resources` | Signed in | Own resources page |
| GET | `/api/users/me/resource-contributions` | Signed in | Assessments and corrections pages |
| GET | `/api/locations/states` | Public | State options |
| GET | `/api/locations/counties?state=36` | Public | County options |
| GET | `/api/locations/cities?state=36&county=36061` | Public | City options |
| GET | `/api/locations/resolve` | Public | Resolve public case location names/IDs |
| GET | `/api/admin/resource-corrections` | Admin | Moderation queue |
| PATCH | `/api/admin/resource-corrections/{correction_id}` | Admin | Approve/apply or reject suggestion |
| PATCH | `/api/admin/resources/{resource_id}/status` | Admin | Official verification or review flag |

## JSON contracts and rules

Resource creation accepts exactly the following fields. Unknown fields, including ownership and verification status, are rejected:

```json
{
  "name": "Family Search Assistance",
  "description": "Public organization assisting families with searches.",
  "category": "FAMILY_SUPPORT",
  "scope": "COUNTY",
  "state": "36",
  "county": "36061",
  "city": null,
  "phone": "+1 212 555 0100",
  "email": "public@example.org",
  "website": "https://example.org",
  "address": "Public office address",
  "source_url": "https://example.org/about"
}
```

- `name`: 1–200 trimmed characters; `description`: 1–3000 trimmed characters.
- Category: `LAW_ENFORCEMENT`, `MISSING_PERSON_ORGANIZATION`, `SEARCH_AND_RESCUE`, `FAMILY_SUPPORT`, `COMMUNITY_AWARENESS`, `GOVERNMENT_RESOURCE`.
- Scope: `NATIONAL`, `STATE`, `COUNTY`, `CITY`. National has null locations; state requires only state; county requires state and county; city requires all three. Unused descendants must be null. Parent relationships are validated against the imported reference data.
- At least one of phone/email/website is required. Phone max 50, email max 254, address max 500, URLs max 2048. Website/source URLs must use HTTP or HTTPS without embedded credentials. URL values are never fetched by the server.
- `source_url` is required. Submit only publicly available organization contact details.
- A resource response extends the input with `id`, `state_name`, `county_name`, `city_name`, `status`, `is_owner`, `confirmation_count`, `dispute_count`, `current_user_assessment`, `last_confirmed_at`, `last_verified_at`, `created_at`. Dates are ISO 8601; unavailable dates and absent assessments are null.
- Status labels: `UNVERIFIED` = Not Yet Verified; `COMMUNITY_CONFIRMED` = Community Confirmed; `NEEDS_REVIEW` = Information Disputed; `OFFICIALLY_VERIFIED` = Officially Verified.
- New resources are unverified. At least one current accurate assessment yields community-confirmed status, which is not official verification. An active inaccurate assessment, unresolved issue report, or admin review flag takes precedence. Only an admin can assign official verification, with an audit reason.
- One current assessment per user/resource, protected by a unique constraint and a resource row lock. The creator cannot assess their own submission, including assigning official verification through the admin endpoint. Repeated submissions replace the assessment; they never increment a separate counter. Withdrawal removes the current assessment; already-submitted issue reports remain pending for review.
- An inaccurate assessment requires `reason`, permits optional `source_url` and `proposed_changes`, and atomically creates/updates a pending dispute correction. An accurate assessment accepts only `assessment`.
- A normal correction requires a nonempty `proposed_changes`, `explanation` and `source_url`. Allowed changes: name, description, category, scope, state, county, city, phone, email, website, address. It never overwrites the published resource on submission.
- Correction response: `id`, `resource_id`, `explanation`, `source_url` (may be null for an issue report), `proposed_changes`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `created_at`, `reviewed_at`, `review_note`.
- Admin approval validates the proposal against the current resource and applies only proposed fields in a transaction. If published fields change, previous accuracy assessments and official verification are cleared because they referred to the old version. Reviewing a dispute retires its reporter's current inaccurate assessment; other pending disputes remain active. Reviewed corrections cannot be reviewed again (409). Audit records preserve reviewer ID, review time and note, without exposing the reviewer ID publicly.

### List filtering and pagination

`GET /api/resources` accepts `search`, `state`, `county`, `city`, `category`, `scope`, `page` (default 1) and `page_size` (default 20, maximum 100). Name/description keyword search is case-insensitive literal substring matching. With a city selected, national, matching statewide, matching countywide, and matching city resources are included. Scope/category filters are additional restrictions. County/city filters require valid ancestors.

Paged responses:

```json
{"items": [], "total": 0, "page": 1, "page_size": 20}
```

Own contributions return `{"assessments": <page>, "corrections": <page>}` using the requested page/page_size independently for each collection. Assessment items contain `resource_id`, `resource_name`, `assessment`, and `updated_at`. Withdrawn or retired assessments are omitted. Duplicates return `{"items": [...]}`; fuzzy suggestions are advisory, bounded to candidates containing the first name token, and never prevent resource submission.

Location options return arrays of `{"id":"36","name":"New York"}`. Resolve accepts `state` (required), `county`, `city` as IDs or names, including imported state postal aliases. It resolves names within known parents, returns `{"state":"36","county":"36061","city":"3651000"}`, and leaves unmatched descendants null. Unknown state returns 422. It does not geocode addresses or coordinates.

The case-detail integration passes only structured last-seen geography with `circumstances.lastKnownLocation.visibility: "PUBLIC"`. The existing backend must populate this marker only for locations safe to expose. Missing/private/restricted visibility opens the unfiltered directory. Human-readable names are resolved through the location API; unresolved names produce a visible fallback message.

Errors use FastAPI's `{"detail": ...}` format: 401 missing/expired authentication, 403 self-assessment/non-admin/CSRF, 404 missing resource/correction, 409 already reviewed correction, 422 invalid fields/contacts/locations. The Angular UI maps these to actionable messages. Deploy behind the existing application's TLS, account controls and request rate limits.

## curl requests for every endpoint

Use a real bearer JWT issued by your server whose claims match the configured verifier. `TOKEN` is an ordinary contributor; `ADMIN_TOKEN` is an administrator. Creating a resource and assessing it require different accounts.

```bash
export BASE='http://localhost:8000'
export TOKEN='REPLACE_WITH_CONTRIBUTOR_JWT'
export ADMIN_TOKEN='REPLACE_WITH_ADMIN_JWT'
export RESOURCE_ID='REPLACE_WITH_RESOURCE_UUID'
export CORRECTION_ID='REPLACE_WITH_CORRECTION_UUID'
```

### 1. List/search resources (includes inherited coverage)

```bash
curl -fsS --get "$BASE/api/resources" \
  --data-urlencode 'search=family' \
  --data-urlencode 'state=36' --data-urlencode 'county=36061' --data-urlencode 'city=3651000' \
  --data-urlencode 'category=FAMILY_SUPPORT' \
  --data-urlencode 'page=1' --data-urlencode 'page_size=20'
# Add --data-urlencode 'scope=STATE' to restrict to statewide resources.
```

### 2. Check likely duplicates

```bash
curl -fsS --get "$BASE/api/resources/duplicates" --data-urlencode 'name=Family Search Assistance'
```

### 3. Get details

```bash
curl -fsS "$BASE/api/resources/$RESOURCE_ID" -H "Authorization: Bearer $TOKEN"
```

### 4. Submit a resource

```bash
curl -fsS -X POST "$BASE/api/resources" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "Family Search Assistance",
  "description": "Public organization assisting families with searches.",
  "category": "FAMILY_SUPPORT",
  "scope": "NATIONAL",
  "state": null, "county": null, "city": null,
  "phone": null, "email": null,
  "website": "https://example.org",
  "address": null,
  "source_url": "https://example.org/about"
}
JSON
# Copy the returned id to RESOURCE_ID. It starts UNVERIFIED.
```

### 5. Confirm accurate (use a different contributor account)

```bash
curl -fsS -X POST "$BASE/api/resources/$RESOURCE_ID/verifications" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"assessment":"ACCURATE"}'
```

### 6. Change to inaccurate and submit an issue/correction atomically

```bash
curl -fsS -X POST "$BASE/api/resources/$RESOURCE_ID/verifications" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"assessment":"INACCURATE","reason":"The public phone number has changed.","source_url":"https://example.org/contact","proposed_changes":{"phone":"+1 212 555 0101"}}'
# source_url is optional for this endpoint; proposed_changes may be {} for a reason-only issue.
```

### 7. Withdraw an assessment

```bash
curl -fsS -X DELETE "$BASE/api/resources/$RESOURCE_ID/verifications" -H "Authorization: Bearer $TOKEN"
```

### 8. Suggest a correction without changing published data

```bash
curl -fsS -X POST "$BASE/api/resources/$RESOURCE_ID/corrections" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"explanation":"The organization updated its public website.","source_url":"https://example.org/announcement","proposed_changes":{"website":"https://example.org/contact"}}'
# Copy the returned id to CORRECTION_ID. Status is PENDING.
```

### 9. My submitted resources

```bash
curl -fsS "$BASE/api/users/me/resources?page=1&page_size=20" -H "Authorization: Bearer $TOKEN"
```

### 10. My assessments and corrections

```bash
curl -fsS "$BASE/api/users/me/resource-contributions?page=1&page_size=20" -H "Authorization: Bearer $TOKEN"
```

### 11–14. Cascading locations and case-location resolution

```bash
curl -fsS "$BASE/api/locations/states"
curl -fsS "$BASE/api/locations/counties?state=36"
curl -fsS "$BASE/api/locations/cities?state=36&county=36061"
curl -fsS --get "$BASE/api/locations/resolve" \
  --data-urlencode 'state=New York' --data-urlencode 'county=New York County' --data-urlencode 'city=New York city'
```

### 15. Admin correction queue

```bash
curl -fsS "$BASE/api/admin/resource-corrections?status=PENDING&page=1&page_size=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 16. Admin review a correction

```bash
curl -fsS -X PATCH "$BASE/api/admin/resource-corrections/$CORRECTION_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"APPROVED","review_note":"Confirmed against the official organization website."}'
# To reject a still-pending suggestion: {"status":"REJECTED","review_note":"Explain why."}
```

### 17. Admin verification status

```bash
curl -fsS -X PATCH "$BASE/api/admin/resources/$RESOURCE_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"OFFICIALLY_VERIFIED","reason":"Official contact information checked against the agency website."}'
# Also accepts UNVERIFIED or NEEDS_REVIEW. Active unresolved disputes still display NEEDS_REVIEW.
```

### Cookie-session equivalent

For your existing login flow, use its cookie jar and CSRF token instead of the bearer header:

```bash
export CSRF='REPLACE_WITH_SESSION_CSRF_TOKEN'
curl -fsS -X POST "$BASE/api/resources/$RESOURCE_ID/verifications" \
  -b /path/to/session-cookies.txt -H "X-CSRF-Token: $CSRF" \
  -H 'Content-Type: application/json' -d '{"assessment":"ACCURATE"}'
```

Do not send both bearer and cookie credentials in these examples. In the standalone verifier, a supplied bearer token takes precedence over a cookie.

## Verification

```bash
backend/.venv/bin/python -m pytest backend/tests -q
npm test -- --watch=false
npm run build
```

By default, backend tests use an isolated SQLite database for API behavior. To also test PostgreSQL row locking and concurrent assessment upserts, set `RESOURCE_TEST_DATABASE_URL` to a disposable PostgreSQL database before running pytest. Tests create and drop the feature tables in that database; never use a production database. The feature was verified against PostgreSQL 17 in an isolated container, including concurrent upserts. The Angular CLI requires Node >=22.22.3, >=24.15.0, or 26+. On machines with the observed native LMDB cache crash, `CI=true` disables local disk caching for verification without changing project configuration.
