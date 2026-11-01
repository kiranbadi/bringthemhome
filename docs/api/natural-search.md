# Simple home-page search

The home page has one Material search field and a Search button. Users can enter names, case IDs (`157263`, `NamUs #MP48192`), or descriptions such as "teenage girl with braces last seen in Raleigh NC". A microphone button optionally fills the same field using browser speech recognition. There are no home-page modes, manual filters, autocomplete, or prompt chips. Typing and voice transcription do not submit a search automatically. Select Search or press Enter to submit. Unsupported browsers and microphone permission failures provide a typing fallback. Voice input stops when cleared, submitted, or when leaving the page. Browser speech services may process audio remotely; the search API receives only the submitted text.

## Request

`POST /bringthemhome/api/v1/search/natural`

```json
{
  "query": "teenage girl with braces last seen in Raleigh NC",
  "mode": "semantic",
  "filters": {},
  "page": 1,
  "page_size": 20
}
```

The client trims the query, requires 1–500 characters, and always uses semantic mode with an empty filter object for a new home-page search. Semantic mode must also resolve explicit IDs. Mode, filters, and pagination remain in the payload to preserve the existing backend contract. Existing advanced search and older natural-search result links are unchanged. See [JSON Schema](natural-search.schema.json).

## Executable cURL

This command targets the configured local backend. Replace the origin with the actual production HTTPS origin when deploying; no production hostname is provided in this repository. Replace the session/CSRF placeholders with valid values from your backend.

```bash
curl --fail-with-body --show-error --silent --max-time 25 \
  'http://localhost:8000/bringthemhome/api/v1/search/natural' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'X-CSRF-Token: YOUR_CSRF_TOKEN' \
  --cookie 'bth_session=YOUR_SESSION_COOKIE' \
  --data '{"query":"teenage girl with braces last seen in Raleigh NC","mode":"semantic","filters":{},"page":1,"page_size":20}'
```

For ID lookup, replace only `query` with `157263` or `NamUs #MP48192`.

Browser requests use Angular `withCredentials: true` (fetch equivalent `credentials: 'include'`); the existing interceptor supplies `X-CSRF-Token` when available. Configure credentialed CORS for the frontend's exact origin and cookies covering the endpoint path. Public search should remain available to guests: the server must support anonymous CSRF/session bootstrap or explicitly exempt anonymous read-only search. Do not require registration to search public cases.

## 200 response

Return the existing gallery pagination structure. Case IDs must resolve through `GET /api/v1/missing-persons/{id}`. This is a synthetic fixture, not an actual missing person:

```json
{
  "records": [{"_id":"example-case-id","full_name":"Example Person","photo_url":null,"missing_from_city":"Raleigh","missing_from_state":"NC","age_when_missing":16}],
  "total_records": 1,
  "total_pages": 1,
  "current_page": 1,
  "page_size": 20,
  "next_page": null,
  "previous_page": null
}
```

No matches: empty records, zero totals/pages, current page 1, null next/previous pages. Return stable relevance ordering with case-ID tie-breaking. The gallery preserves the query across page navigation. A new search resets page to 1.

## Errors

```json
{"error":{"code":"INVALID_QUERY","message":"Enter a valid search query.","field_errors":{"query":"Required"}}}
```

| Status | Code | Client behavior |
| --- | --- | --- |
| 400 / 422 | INVALID_QUERY / INVALID_FILTERS | Inline validation and alert; preserve query |
| 429 | RATE_LIMITED | Warning snackbar and persistent notice |
| 500 | SEARCH_FAILED | Retry banner |
| 503 | SEARCH_UNAVAILABLE | Retry banner |
| Network / 20-second timeout | — | Suggest simpler keywords and offer retry |

429 example: `{"error":{"code":"RATE_LIMITED","message":"Search rate limit exceeded.","retry_after_seconds":30}}` with `Retry-After: 30`. 500 example: `{"error":{"code":"SEARCH_FAILED","message":"Search could not be completed."}}`.

Client messages are normalized rather than rendering arbitrary server diagnostics. Retry repeats the last submitted query/page without clearing text. A failed search never substitutes unrelated gallery results.

## Deployment

The natural-search backend is not included in this repository; it must implement this endpoint before search can retrieve results. Suggestion and city endpoints are no longer required by the home page. The hero loads as an immediately deferred chunk above the existing card gallery, with an advanced-search link if that chunk cannot load. Search terms appear in results URLs for navigation and pagination; use the separate confidential-tip channel for private information.
