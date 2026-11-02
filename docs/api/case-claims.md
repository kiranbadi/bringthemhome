# Case claims and verified contributions — Angular integration

## Routing and deployment

The Angular client uses **`{environment.apiUrl}{environment.apiBaseUrl}/api`**, currently `http://localhost:8000/bringthemhome/api`, per the requested context path. All eight claim routes below use that prefix. The Python router declares `/api`, and `main.py` includes it with `app_settings.context_path`; configure that context as `/bringthemhome`. Any gateway must preserve or consistently map the same context. Angular's development proxy forwards paths unchanged; it does not strip the context prefix. Backend database migrations and storage infrastructure have not been changed by this frontend implementation.

Before deployment, apply the backend's `sql/case_claims.sql` using the backend's normal migration process and configure its existing private discussion-media storage. Those operations are backend deployment prerequisites, not frontend configuration. Do not put AWS credentials, bucket names or object keys in Angular.

| Method | Path relative to `/bringthemhome/api` | Access |
| --- | --- | --- |
| POST | `/cases/{case_id}/claims` | Signed in |
| GET | `/users/me/case-claims?page=1&page_size=100` | Own private claims |
| GET | `/admin/case-claims?status=PENDING&page=1&page_size=20` | ADMIN / ADMINISTRATOR |
| PATCH | `/admin/case-claims/{claim_id}` | Staff, never own claim |
| POST | `/cases/{case_id}/claim-photos/presign` | Approved claimant |
| POST | `/cases/{case_id}/claim-photos/complete` | Approved claimant |
| POST | `/cases/{case_id}/contributions` | Approved claimant |
| GET | `/cases/{case_id}/contributions?page=1&page_size=20` | Public |

Every list response is `{ "items": [], "total": 0, "page": 1, "page_size": 20 }`. Own-claim lookup uses pages of 100 and continues until it finds an exact `missing_person_id` match or reaches the total. A failed page never becomes "no claim". Case IDs come from backend `_id` and are URL-encoded in the path, with the original unencoded ID preserved in request bodies.

Staff queue and review headings resolve the missing person’s full name using the existing case-detail API, caching successful lookups and preserving queue order. Lookup failures show “Name unavailable” and do not prevent review. View case opens a new tab with noopener/noreferrer protections.

The staff UI is `/admin/case-claims`, linked from My Account only for server-supplied `ADMIN` or `ADMINISTRATOR` roles. Client guards aid navigation; the backend must enforce authorization for every request. Login return URLs are limited to local case-detail pages and the staff queue; arbitrary external URLs are rejected.

## Authentication and isolation

Authenticated application calls use `withCredentials: true`. Existing application CSRF handling covers `/bringthemhome/*` and `/api/*` only at the configured API origin. Mutations send `X-CSRF-Token` when the session provides it. Both prefixes are configured in the development proxy. Backend CORS must permit `PATCH` in addition to GET/POST/PUT/DELETE/OPTIONS; claim approval uses PATCH and the browser first sends OPTIONS with Access-Control-Request-Method: PATCH. The missing PATCH allowlist entry was fixed in `core/cors.py` with an authentication preflight regression test. Restart/reload the backend to activate CORS configuration changes. In production, credentialed CORS must name the frontend origin and permit the CSRF header; session cookies must cover the deployed application context.

Storage PUTs use a dedicated HttpClient created from HttpBackend, bypassing every application interceptor. They send `withCredentials: false`, `credentials: 'omit'`, raw File bytes and exactly the returned signed headers. Unsafe tickets (non-HTTPS, application-origin URLs, embedded credentials, or application authentication headers) are rejected. Signed URLs are never rewritten or constructed from bucket information.

401 and explicit CSRF/session-related 403 responses offer "Sign in again" through the existing logout/login session workflow with a safe return URL. Other permission-related 403 responses refresh claim state and public contributions; contribution controls remain disabled while status is unknown. Recoverable failures retain draft text. No mutating request is automatically retried.

## Claim and contribution behavior

- Anonymous visitors can read public contributions and sign in to claim, returning to the current case.
- No claim: submit a private explanation of 10–3000 trimmed characters and FAMILY, SELF or LEGAL_GUARDIAN relationship. No document upload or self-approval exists.
- PENDING: independent verification pending; no contribution controls.
- APPROVED: verified access with Add information and Add photos actions.
- REJECTED / REVOKED: explain the status and link to staff. Revoked controls are disabled.
- Status-load errors show Retry claim status rather than a new-claim action.
- Duplicate claim 409 reloads own claims. Approval is never inferred from registration or the response to a submitted explanation.

Contributions are append-only and support text-only, photo-only or combined submissions. Content is limited to 10,000 characters; at least nonblank text or one ready photo is required. Up to three unique JPEG/PNG/WebP photos of 5 MiB each are supported. No editing, deletion or changes to original case facts/status are offered. Public content is rendered by Angular text interpolation, never innerHTML. Entries show date and relationship and are labeled "Provided by a verified claimant"; no author name is invented from the returned user_id. Private explanations and staff notes are never rendered in public or claimant contribution views.

Photos proceed through uploading, validating, ready, rejected and failed states. Only ready **attachment IDs returned by completion** enter photo_ids; the upload ticket ID is not assumed to equal the attachment ID. Upload retry never submits a contribution. Pending validation can be checked again; failed uploads can be retried or removed. Unfinished/rejected files block publication. Preview object URLs are released on removal/destruction; leaving or losing access cancels active requests. Completion alone does not publish. Unpublished uploads expire after 24 hours. Public Refresh requests obtain new signed display URLs when links expire.

Staff transitions exactly mirror the backend: PENDING → APPROVED/REJECTED, APPROVED → REVOKED, REJECTED/REVOKED → APPROVED. All decisions require 10–3000 trimmed review-note characters; approval additionally requires acknowledgement of completed independent verification. No "request more information" action is present.

## Executable cURL examples

Set real session values; use the actual original document ID in JSON and its URL-encoded equivalent in CASE_ID. Replace API_ORIGIN with the deployed HTTPS host for production.

```bash
API_ORIGIN='http://localhost:8000'
API="$API_ORIGIN/bringthemhome/api"
CASE_ID='YOUR_URL_ENCODED_CASE_ID'
SESSION='YOUR_SESSION_COOKIE'
CSRF='YOUR_CSRF_TOKEN'
ADMIN_SESSION='YOUR_ADMIN_SESSION_COOKIE'
ADMIN_CSRF='YOUR_ADMIN_CSRF_TOKEN'
CLAIM_ID='CLAIM_UUID'

curl --fail-with-body "$API/cases/$CASE_ID/claims" \
  --cookie "bth_session=$SESSION" --header "X-CSRF-Token: $CSRF" \
  --header 'Content-Type: application/json' \
  --data '{"relationship":"FAMILY","explanation":"I am a family member. Please verify my relationship independently with the investigating agency."}'

curl --fail-with-body "$API/users/me/case-claims?page=1&page_size=100" \
  --cookie "bth_session=$SESSION"

curl --fail-with-body "$API/admin/case-claims?status=PENDING&page=1&page_size=20" \
  --cookie "bth_session=$ADMIN_SESSION"

curl --fail-with-body --request PATCH "$API/admin/case-claims/$CLAIM_ID" \
  --cookie "bth_session=$ADMIN_SESSION" --header "X-CSRF-Token: $ADMIN_CSRF" \
  --header 'Content-Type: application/json' \
  --data '{"status":"APPROVED","review_notes":"Relationship independently verified with the investigating agency."}'

# Replace size_bytes with the actual file size and missing_person_id with the original ID.
curl --fail-with-body "$API/cases/$CASE_ID/claim-photos/presign" \
  --cookie "bth_session=$SESSION" --header "X-CSRF-Token: $CSRF" \
  --header 'Content-Type: application/json' \
  --data '{"missing_person_id":"YOUR_ORIGINAL_CASE_ID","filename":"photo.jpg","content_type":"image/jpeg","size_bytes":12345}'

# Copy upload_url and upload_id from the presign response.
UPLOAD_URL='PRESIGNED_HTTPS_URL'
UPLOAD_ID='UPLOAD_UUID'
# Use all returned signed headers exactly; this example assumes Content-Type only.
# No application Cookie or CSRF header belongs on this storage request.
curl --fail-with-body --request PUT "$UPLOAD_URL" \
  --header 'Content-Type: image/jpeg' --upload-file '/absolute/path/photo.jpg'

curl --fail-with-body "$API/cases/$CASE_ID/claim-photos/complete" \
  --cookie "bth_session=$SESSION" --header "X-CSRF-Token: $CSRF" \
  --header 'Content-Type: application/json' --data "{\"upload_id\":\"$UPLOAD_ID\"}"

# Copy id from the completion response only when status == ready.
PHOTO_ID='COMPLETED_ATTACHMENT_ID'
curl --fail-with-body "$API/cases/$CASE_ID/contributions" \
  --cookie "bth_session=$SESSION" --header "X-CSRF-Token: $CSRF" \
  --header 'Content-Type: application/json' \
  --data "{\"content\":\"Additional public case information.\",\"photo_ids\":[\"$PHOTO_ID\"]}"

# Text-only: photo_ids []; photo-only: content "".
curl --fail-with-body "$API/cases/$CASE_ID/contributions?page=1&page_size=20"
```

## Verification and limitations

Tests cover anonymous and all four claim states, later own-claim pages, duplicate claims, input validation, staged upload failure/rejection, ready-photo IDs, text/photo/combined contributions, revocation, safe rendering, public pagination, staff restrictions, safe login return URLs, and credential isolation on storage requests. HTTP 401/403/404/409/413/422/429/503 have user-facing messages. An interrupted publication can have committed on the backend before the client receives a response; check the refreshed public list before manually submitting the same content again. No backend idempotency endpoint is assumed.

Live approval, migrations, S3 configuration and API deployment must be verified against the backend environment. No claims, reviews or publications were sent to a live service while implementing the frontend.
