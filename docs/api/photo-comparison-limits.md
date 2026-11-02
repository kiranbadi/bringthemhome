# Photo comparison allowance

The existing `POST /bringthemhome/photo-review/compare` accepts at most **five validated comparison submissions per authenticated account in a rolling 24-hour window**. It is not a midnight reset and is not tracked in browser storage.

## Activate the backend change

In the Python backend repository, apply the additive migration after registration.sql using the normal migration/deployment process:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/photo_comparison_quota.sql
```

Restart/reload the backend. The migration has not been run automatically. Without its table, the API fails closed with 503 instead of allowing unmetered comparisons.

## Enforcement

- Use the existing validated session and CSRF dependency; arbitrary cookie/header strings do not authenticate an account.
- Validate both image uploads before counting the request.
- Reserve a slot in PostgreSQL before starting the comparison service. A per-user transaction-scoped advisory lock serializes simultaneous submissions across API processes and replicas.
- Attempts started in the last 24 hours count toward the limit, including service attempts that later fail or whose browser connection is cancelled. This prevents failed/retried paid work bypassing the allowance.
- Rejected invalid uploads, unauthorized requests, and already rate-limited submissions do not consume slots.
- All account roles have the same allowance. The server derives the user ID from the session; clients never submit a user ID or count.
- Rows contain only user ID and submission time, not photos or comparison results. Expired rows for the current account are removed when reserving its next slot.

## Limit response

The sixth submission is rejected before invoking the comparison service:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
Cache-Control: no-store
```

```json
{
  "detail": {
    "code": "PHOTO_COMPARISON_LIMIT_REACHED",
    "message": "Only 5 photo comparisons are allowed per account in any 24-hour period.",
    "limit": 5,
    "window_hours": 24,
    "retry_after_seconds": 3600,
    "retry_at": "2026-11-02T12:00:00+00:00"
  }
}
```

The retry time is when the oldest counted submission exits the rolling window. Rejected attempts do not extend the window. The page shows the allowance before comparison, retains a limit-reached message after Clear Images, and disables Compare until the retry time. Reloading or switching devices cannot bypass the server allowance.

The HTTP client explicitly sends credentials; the existing interceptor sends CSRF to the application API. The endpoint path and successful comparison response are unchanged.
