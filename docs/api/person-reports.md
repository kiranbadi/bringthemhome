# Missing person report workflow — proposed backend contract

**Create Missing Person Report** reuses `_id`, `report_id`, and `user_id` from a readable browser session cookie when the email matches the signed-in account. The UI supports a URL-encoded JSON cookie named `bth_report_context` or three individual cookies named for the fields. Cookies must be visible to the Angular page (use `Path=/`).

Without matching context, the UI calls `POST /bringthemhome/api/v2/person-reports` with `{ "user_id": "<signed-in email>" }`, the session cookie, and `X-CSRF-Token`. After a successful create, the UI writes the returned context to `bth_report_context` for reuse during the browser session. Section APIs must verify ownership against the authenticated session.

The v1 routes below describe the separate report workflow proposal. The current UI still leaves section saving and submission unavailable.

## UI integration boundary

`MissingPersonReport` accepts `workflow: ReportWorkflow | null`, `administrator: boolean` and `integrationReady: boolean` (default false). After authentication and loading the server response, call `loadPayload(response.payload)` and set workflow. Listen to `actionRequested`, execute the appropriate API request, and update the UI only from a successful response. Use `getPayload()` to inspect the exact JSON. The action event includes `{ action, report_id, version, payload }`. No lifecycle value, owner ID or administrator role in this event authorizes an action: authenticate and authorize each operation on the backend.

During integration, also wire loading/error/pending states into the page; disable concurrent mutations, retain draft values on failures, and map 422 field paths back to their sections. Do not enable `integrationReady` before the requests and file uploads are connected. The UI does not store sensitive report details in localStorage/sessionStorage or log the payload.

## Lifecycle

`status`: DRAFT | SUBMITTED | REJECTED | PUBLISHED | ARCHIVED.
`person_status`: MISSING | FOUND_PENDING_REVIEW | FOUND.
`revision_status`: null | DRAFT | SUBMITTED | REJECTED.

Initial draft → submit → administrator approve/publish OR reject with required reason → owner revises same report → resubmit. Submitted versions are read-only for owners. Persist administrator feedback and an audit history.

Published edits create a separate draft revision; public data remains the last approved revision. Rejecting a revision must not unpublish the currently approved version. Approval atomically replaces it. Published found reports cannot be edited through the ordinary missing-person revision action.

Owner reports found with a date and optional reason/notes → administrator confirms or rejects the update. Only confirmed found cases leave active missing-person results. Once found, the owner may archive. Archive retains the record, version history, access controls and a public found/archived notice at the existing canonical URL; it is not deletion. Update PostgreSQL, OpenSearch, galleries and active sitemap entries consistently (use a durable outbox/retry process for index updates).

## Proposed endpoints

Base: `https://www.missinglives.com/bringthemhome/api/v1/person-reports` (local: `http://localhost:8000/bringthemhome/api/v1/person-reports`). All require authenticated session cookies; mutations require `X-CSRF-Token`.

| Method/path | Body | Result |
|---|---|---|
| POST base | `{ "payload": ... }` | 201 new DRAFT; partial information permitted |
| GET base?scope=mine&status=DRAFT&page=1&page_size=20 | — | Owner list; includes archived filter |
| GET /{id} | — | Private owner/admin record and current editable payload |
| PATCH /{id} | `{ "version": 1, "payload": ... }` | Save draft or draft/rejected revision, no full submission validation |
| POST /{id}/submit | `{ "version": 2 }` | Validate full report and attachments; DRAFT/REJECTED → SUBMITTED |
| POST /{id}/revisions | `{ "version": 3 }` | PUBLISHED/MISSING → new draft revision |
| POST /{id}/found | `{ "version": 4, "found_at": "2026-11-02", "reason": "Optional notes" }` | FOUND_PENDING_REVIEW |
| POST /{id}/archive | `{ "version": 5 }` | Confirmed FOUND → ARCHIVED |
| GET /admin/review?status=SUBMITTED&page=1&page_size=20 | — | Administrator queue, including submitted revisions and found updates |
| POST /{id}/review | `{ "version": 2, "decision": "APPROVE" }` or `{ "version": 2, "decision": "REJECT", "reason": "Required explanation" }` | Administrator publishes/rejects submitted version |
| POST /{id}/found/review | `{ "version": 5, "decision": "CONFIRM" }` or `{ "version": 5, "decision": "REJECT", "reason": "Required explanation" }` | Administrator confirms/rejects found update |

Response envelope:

```json
{
  "id": "report-uuid",
  "version": 2,
  "status": "SUBMITTED",
  "person_status": "MISSING",
  "revision_status": null,
  "rejection_reason": null,
  "updated_at": "2026-11-02T15:00:00Z",
  "canonical_path": null,
  "payload": {}
}
```

Replace the empty example `payload` above with the complete structure below. Do not replace a draft's private payload with a stripped public case representation. Fetch private report data only for its owner or an administrator. Public publishing must explicitly allowlist safe fields; reporter contact details, medical history, student IDs and supervisor information must not become public automatically.

## Payload structure

The existing camelCase field names are preserved. Changed fields are `identity.aliases` (array instead of singular nickname), `employmentHistory` and `caseAndReporterContact` (arrays instead of single objects), and the two Other detail strings. Existing stored values require server migration/wrapping into one-element arrays.

See [person-report-payload.example.json](person-report-payload.example.json) for a complete executable request fixture. All form text fields are strings, including ages and coordinates, matching the existing form. The backend should validate/coerce safely and return field-specific errors; do not silently discard fields. Dates are YYYY-MM-DD, times HH:mm. Empty optional strings are allowed on drafts.

Limits: employmentHistory ≤25; possibleSightingLocations ≤25; caseAndReporterContact ≤10. Aliases are nonempty trimmed strings; no arbitrary alias-count limit was requested. Each added contact requires reporterName, reporterPhone and valid reporterEmail for submission. Race or hair color = Other requires the matching detail string. Unselected Other details are excluded as empty strings. Submission additionally requires first/last name, last-seen date/location and media-use consent; keep other fields optional unless a separate backend policy is agreed.

## Media upload contract

The UI retains actual `File` objects in memory keyed by `client_id`. Its JSON contains only descriptors: `client_id`, `name`, `size` (display string), `size_bytes`, `type`, optional server `attachment_id`. Never treat a filename or client-generated ID as an uploaded file.

Proposed POST /{id}/attachments multipart fields: `client_id`, `kind` (photo/video), `file`. Response 201 `{ "client_id": "...", "attachment_id": "server-uuid", "status": "READY" }`. Add that ID to the corresponding descriptor, then save the report. DELETE /{id}/attachments/{attachment_id} removes unused draft attachments. Validate size, count, MIME content, access rights and scan status server-side; return upload limits from configuration. Submission must verify every referenced attachment belongs to this report and has completed upload/validation. On reopening a saved draft, descriptors with attachment_id remain usable without re-uploading; unsent browser files cannot survive refresh.

### Section 1 file size limits

The frontend rejects individual photos larger than 5 MB (5,242,880 bytes) and videos larger than 25 MB (26,214,400 bytes), using 1 MB = 1,048,576 bytes. Files exactly at the limit are accepted. Oversized files are not retained in the in-memory upload map or payload; valid files from the same selection are retained and rejected filenames appear in an accessible error message. Existing image/* and video/* MIME selection rules remain unchanged. These are per-file limits; count, aggregate size and video duration limits are not implemented.

Enforce the same byte limits on the backend, independently of browser checks. This section currently selects files synchronously and retains File references in memory; it does not perform network uploads. Async upload/progress, retries and pending validation still need backend integration. A per-file size limit does not itself bound total storage, bandwidth or playback cost.

## Errors and concurrency

Return 401 unauthenticated, 403 unauthorized, 404 unavailable report, 409 invalid transition/stale version (include current version), 422 validation errors, 429 rate limit with Retry-After, 5xx retryable failures. Return only safe messages, never submitted passwords/tokens or private report values in logs/errors. Use optimistic concurrency via version; enforce per-action ownership/admin permissions and legal transitions in a transaction. Use idempotency keys for creation/submission/review to avoid duplicate reports or audit events on retries.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please review the highlighted fields.", "fields": { "missingPersonDetails.caseAndReporterContact.1.reporterEmail": "Enter a valid email." } } }
```

## Executable example requests (once implemented)

From the repository root, export a valid session cookie jar and CSRF token locally, then:

```sh
export REPORT_API='http://localhost:8000/bringthemhome/api/v1/person-reports'
# Production: export REPORT_API='https://www.missinglives.com/bringthemhome/api/v1/person-reports'
curl --fail-with-body "$REPORT_API" \
  -b "$SESSION_COOKIE_JAR" -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @docs/api/person-report-payload.example.json

curl --fail-with-body "$REPORT_API/$REPORT_ID/submit" \
  -b "$SESSION_COOKIE_JAR" -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H 'Content-Type: application/json' -d '{"version":1}'

curl --fail-with-body "$REPORT_API/$REPORT_ID/found" \
  -b "$SESSION_COOKIE_JAR" -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"version":3,"found_at":"2026-11-02","reason":"Located safely"}'
```

## Expanded Last Seen and Circumstances

The updated full fixture includes every new field under `payload.missingPersonDetails.lastSeen`. This extends the existing contract; it does not introduce a second circumstances object that could disagree with the existing narrative/location fields.

| UI group | JSON fields |
|---|---|
| Classification | `classification`: empty/unknown/endangered_medical/endangered/involuntary/voluntary/other |
| Timeline | Existing `date` and `time`; new `lastContact: {date,time}`, `timezone` |
| Location | Existing `location` (place description), city/state/country/zipcode/coordinates; new `address` (street address), `locationType`, `locationTypeOther` |
| Narrative | Existing `circumstances` string, now a larger guided text area |
| Last seen with | `lastSeenWith: {name,relationship,contactPhone}`; retain existing `companions` as general notes |
| Risks | `riskFactors` string array, `riskFactorsOther` when other selected |
| Items left behind | `itemsLeftBehind: [{item,details}]`; omit completely blank rows |
| Additional context | `additionalContext`; existing `possibleDestination` remains separate |

Location types: unknown, home, workplace, school, shopping_center, transit_station, outdoors, other. Risk values: unknown, insulin_dependent, medication_required, cognitive_impairment, limited_mobility, phone_powered_off, extreme_weather_exposure, other.

All new details are optional. Choosing other for risk or location requires non-whitespace details. Unknown timezone is the empty string, not UTC. The UI validates supplied timezone identifiers using Intl.DateTimeFormat. Store event local date/time and timezone independently; only derive UTC timestamps server-side when all required information is known. Handle ambiguous/nonexistent daylight-saving times explicitly rather than silently choosing an offset. The user example's `19:30Z` is a UTC instant; `19:30` in America/New_York is a different instant. These must not be treated interchangeably.

The existing form uses state display names and string coordinates; this is unchanged. Normalize these to ISO region codes/numeric coordinates in the backend adapter if needed, without dropping original submitted values. Older draft payloads lacking the new fields load with empty defaults. Backend migration should supply equivalent defaults.

Companion phone numbers, precise private addresses and risk/medical details belong to the private review payload; administrator publishing must choose safe public fields explicitly.

Create/update examples below target **proposed endpoints, not endpoints implemented by this frontend**. Run from the repository root after backend implementation, with authenticated cookies/CSRF variables populated:

```sh
export REPORT_API='http://localhost:8000/bringthemhome/api/v1/person-reports'
# Production:
# export REPORT_API='https://www.missinglives.com/bringthemhome/api/v1/person-reports'

# Create a draft using the complete payload, including detailed circumstances.
curl --fail-with-body "$REPORT_API" \
  -b "$SESSION_COOKIE_JAR" -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @docs/api/person-report-payload.example.json

# Save an existing draft. Replace version in the file with the latest server version.
curl --fail-with-body -X PATCH "$REPORT_API/$REPORT_ID" \
  -b "$SESSION_COOKIE_JAR" -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @docs/api/person-report-update.example.json
```
