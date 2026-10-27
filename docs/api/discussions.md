# Case discussion backend contract

The Angular UI is implemented against the **proposed** endpoints below. This repository does not include the FastAPI implementation. Deploy these APIs before the feature can persist or retrieve discussions. No mock content or local persistence is used.

## Navigation and integration

- Existing case: `/missing-persons/{missing_person_id}`; one Community Discussions link is added beside case actions.
- Board: `/missing-persons/{missing_person_id}/discussions`.
- Topic: `/missing-persons/{missing_person_id}/discussions/{discussion_id}`.
- Both discussion pages have a compact case header, a link back to the case, and the existing confidential-tip dialog. Topic details also link back to the board.
- Case context uses the existing `GET /api/v1/missing-persons/{id}`.
- All new API paths below are relative to `environment.apiUrl`, **not** `environment.apiBaseUrl` (`/bringthemhome`). This preserves the requested `/api/...` structure.
- IDs are opaque strings, URL-encoded by the client. A case ID must not be constrained to a UUID.
- The frontend requires no new libraries.

## Authentication

GET endpoints allow anonymous visitors. When a valid session exists, include its current vote in responses. Mutations require the existing authenticated session cookie and `X-CSRF-Token`, with credentials enabled. Validate CSRF and permissions on the server; UI ownership and role checks are presentation only. Configure credentialed CORS for the frontend origin, allow the header, and ensure the session cookie's Path includes `/api` (typically `/`). A cookie restricted to `/bringthemhome` will not authenticate these endpoints.

The existing login page is used for visitors attempting participation. Its existing post-login destination remains the account dashboard.

## Endpoints

| Method | Path                                        | Request                                      | Success response                                 |
| ------ | ------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| GET    | `/api/cases/{case_id}/discussions`          | `page=1&page_size=10&search=&sort=newest`    | `Page<Discussion>`                               |
| POST   | `/api/cases/{case_id}/discussions`          | `{title, content, attachment_ids: string[]}` | `201 Discussion`                                 |
| GET    | `/api/discussions/{discussion_id}`          | —                                            | `Discussion`                                     |
| DELETE | `/api/discussions/{discussion_id}`          | —                                            | `204` (soft delete)                              |
| GET    | `/api/discussions/{discussion_id}/comments` | `page=1&page_size=20`                        | `Page<DiscussionComment>`                        |
| POST   | `/api/discussions/{discussion_id}/comments` | `{content, attachment_ids: string[]}`        | `201 DiscussionComment`                          |
| DELETE | `/api/comments/{comment_id}`                | —                                            | `204` (soft delete)                              |
| PUT    | `/api/discussions/{discussion_id}/vote`     | `{vote: "like" \| "dislike"}`                | `VoteState`                                      |
| DELETE | `/api/discussions/{discussion_id}/vote`     | —                                            | `VoteState`                                      |
| PUT    | `/api/comments/{comment_id}/vote`           | `{vote: "like" \| "dislike"}`                | `VoteState`                                      |
| DELETE | `/api/comments/{comment_id}/vote`           | —                                            | `VoteState`                                      |
| POST   | `/api/discussion-uploads/presign`           | See upload workflow                          | `UploadTicket`                                   |
| POST   | `/api/discussion-uploads/complete`          | `{upload_id: string}`                        | `Attachment` (`ready`, `pending`, or `rejected`) |
| POST   | `/api/discussions/{discussion_id}/report`   | `{reason: string}`                           | `204`                                            |
| POST   | `/api/comments/{comment_id}/report`         | `{reason: string}`                           | `204`                                            |

All times are ISO 8601 UTC timestamps. Counts and arrays must always be present, including zero and empty arrays. Return errors with appropriate HTTP status codes: 401 (session missing/expired), 403 (permission/CSRF), 404 (case/topic missing or removed), 409 (attachment not ready/already bound), 413 (size), 422 (validation), 429 (rate limit), 5xx (server failure). The UI keeps drafts on failed submission and offers retries for reads.

### Pagination and sorting

```typescript
interface Page<T> {
  items: T[];
  total: number; // matching public, non-deleted records
  page: number; // one-based
  page_size: number;
}
```

Search title/content within **only** the selected case. Sort accepts `newest`, `oldest`, `most_liked`, with deterministic ID tie-breaking. Comments are always oldest first (flat, no parent-comment field), with deterministic tie-breaking. Apply filtering, sorting and pagination on the backend, not after returning a partial page. `reply_count` and comment `total` exclude deleted or removed comments.

### Models

```typescript
type Vote = 'like' | 'dislike' | null;
interface VoteState {
  like_count: number;
  dislike_count: number;
  current_user_vote: Vote;
}
interface Attachment {
  id: string;
  media_type: 'image' | 'video';
  content_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';
  display_url: string; // short-lived signed display URL; empty unless ready
  status: 'pending' | 'ready' | 'rejected';
}
interface Discussion extends VoteState {
  id: string;
  missing_person_id: string;
  user_id: string; // opaque public author ID, never an email
  author_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  reply_count: number;
  attachments: Attachment[];
}
interface DiscussionComment extends VoteState {
  id: string;
  discussion_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  attachments: Attachment[];
}
```

`Attachment.status` is an explicit addition to the minimum proposed model so the client can distinguish scanned media from pending or rejected files. Only `ready` attachments are rendered. List/detail responses should normally include only ready attachments and freshly signed URLs. Never expose storage object keys or permanent public S3 URLs. Refreshing the page obtains new display URLs after expiry.

### Posting and authorization

Trim title/content. Enforce a nonblank title of at most 150 characters and nonblank content of at most 5,000 characters for topics and replies. Resolve `user_id`, `author_name`, `missing_person_id`, counts and timestamps on the server; do not accept these from a post body. A topic belongs to exactly one existing case. A comment belongs to one live topic. Validate that submitted attachment IDs belong to the current user and case, are ready, have not been attached elsewhere, and meet aggregate limits. Bind attachments atomically when saving content. No ordinary-text approval queue is required.

Only an author or administrator may delete content. The current UI recognizes role values `ADMIN` and `ADMINISTRATOR` (case-insensitive); align these with the existing auth response. Use `deleted_at`/`deleted_by` or an equivalent soft-delete representation; do not physically delete rows. Removed topics and their comments must no longer be accessible publicly. Update counts transactionally, and do not expose deleted content in search. Reports require a nonblank reason of at most 1,000 characters; keep reporter identity and reports private to moderation staff.

### Voting

Use a unique key on `(user_id, target_id)` per target type. PUT atomically creates/replaces the current vote; DELETE removes it idempotently. Return the resulting **authoritative** `VoteState` after either operation. The client shows a provisional count while the request is pending, disables repeated votes, then reconciles with the response or rolls back on error. Never accept client-provided counts.

## Upload workflow

1. Validate file count/type/size and MP4 duration in the browser for feedback. Server validation remains mandatory.
2. `POST /api/discussion-uploads/presign`:
   ```json
   {
     "missing_person_id": "case-string-id",
     "filename": "photo.jpg",
     "content_type": "image/jpeg",
     "size_bytes": 123456
   }
   ```
   Response:
   ```json
   {
     "upload_id": "opaque-upload-id",
     "upload_url": "https://private-bucket.s3.amazonaws.com/temporary?...",
     "headers": { "Content-Type": "image/jpeg" }
   }
   ```
3. Browser PUTs the file bytes to `upload_url`, with exactly the supplied headers. The upload uses an isolated XHR-backed HttpClient without application interceptors or cookies. Angular 22 defaults to Fetch, which does not support upload progress. Backend must issue HTTPS, short-lived, narrowly scoped URLs. Configure S3 CORS for PUT and required signed headers from the frontend origin.
4. `POST /api/discussion-uploads/complete` with `{ "upload_id": "opaque-upload-id" }` verifies actual object existence, bytes, size, MIME signature, video duration and security scans. Make completion idempotent; repeating it must not enqueue duplicate scans. Return an Attachment with `status: pending` while checking, `ready` after acceptance, or `rejected` after failure. Never return a usable display URL until ready.
5. The UI repeats completion every two seconds for pending media, up to 30 checks (about one minute). It keeps the draft and shows an error if validation is still pending, rejected, or fails. No discussion/comment is created until all attachments are ready. Retrying a failed submission currently uploads selected files again; expire abandoned upload objects using lifecycle cleanup.
6. The content POST includes only the resulting `attachment_ids`. Serve only validated media through temporary display URLs. Content APIs must reject unready or unauthorized attachment IDs even if a client bypasses this flow.

Limits per topic/reply: **up to 3 images OR exactly 1 optional video**; no mixing. JPEG/PNG/WebP images ≤5 MiB each; MP4 video ≤25 MiB and ≤30 seconds. Files must be nonempty. Enforce aggregate rules at content creation as well as file validation at presign/completion. Quarantine originals until validated, scan for malware and sensitive content, and remove location metadata where appropriate. Ordinary text posts do not wait on media checks if no media was selected.

## Backend implementation checklist

- PostgreSQL tables for discussions, comments, votes, uploads/attachments, content-attachment bindings and private reports; foreign keys, uniqueness constraints, case/time indexes and soft-delete columns.
- Derive identity from the existing session. Author/admin authorization, CSRF, credentialed CORS and cookie Path compatibility.
- Private S3 storage with presign PUT, scanning/quarantine, signed display URLs and orphan cleanup.
- Rate limits, abuse protection, content limits and sensitive-content checks. Only public display names leave the backend.
- OpenSearch is optional for this MVP. PostgreSQL case-scoped search is sufficient; if indexed, delete/filter removed content consistently.
- Tests for cross-case isolation, vote switching/removal races, unauthorized deletion, report privacy, malicious/unready upload binding and deleted-content visibility.

## Frontend verification

Use a Node version supported by Angular 22. Run `npm test -- --watch=false` and `npm run build`. This environment's default Node 24.11.1 is too old; the bundled Node runtime was used to invoke the existing Angular CLI without changing project dependencies.

Verification in this workspace: the complete unit suite and optimized production compilation were run. The production build used `CI=true` to bypass a local native LMDB cache crash and an in-memory `optimization.fonts: false` override because access to Google Fonts is unavailable. Script optimization, style optimization, production file replacements and bundle budgets remained enabled; no persistent build setting was changed. The initial bundle is about 965 kB, below the 1 MB error limit; the existing 500 kB warning threshold remains exceeded.
