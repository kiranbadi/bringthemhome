# Submit Tip

`SubmitTipComponent` is a standalone Angular Material dialog opened through `TipDialogService`. The gallery fetches the selected case details before opening it directly on the current page. The detail page reuses its loaded `MissingPersonDetail` response. Both pass the same data contract through `MAT_DIALOG_DATA` and share dialog sizing, focus restoration, Escape/backdrop handling, and the tip API. The legacy `/missing-person/:id` route redirects to `/missing-persons/:id`.

## Modes
- Standard: reactive tip form with optional contact information and consent to follow-up.
- Anonymous: same tip form with contact fields cleared, hidden, and omitted from the draft request.
- Agency: public contact fields from `contacts.investigatingAgencies`, including telephone and email links. Missing fields are explicitly unavailable. The current API model does not define an official agency website, so no URL is invented.

Material provides the focus trap and focus restoration. Escape, backdrop, Cancel, and the close button check for unsaved edits. Back preserves the draft and returns keyboard focus to the entry cards. Nothing is written to browser storage or the URL.

## Submission and evidence

The form posts multipart data to `/api/v1/tips`: a JSON `metadata` text field plus
repeated `files` parts. Images, PDF documents, and MP4/WebM/MOV videos are supported.
Selection supports removal, type/size/count validation, and retains files on a
failed request. Limits: 5 files, 50 MiB each, 100 MiB total. Nothing uploads until
Submit Tip is pressed. Only a server response with a nonempty reference number
shows success.

See [the API contract and cURL example](../../../../docs/api/online-tips.md) and
[PostgreSQL migration](../../../../docs/database/online-tips.sql). The backend must
implement this proposed route and persist files to private S3. Enabling the client
does not create the backend endpoint or provision storage.

## Verification
Run Angular CLI with a compatible Node runtime (this workspace shell has an older version):

```sh
/Users/kiranbadi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@angular/cli/bin/ng.js test --watch=false
/Users/kiranbadi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@angular/cli/bin/ng.js build --configuration production
```

Tests cover form validation, anonymous contact omission, enabled attachments,
file validation/removal, multipart serialization, server response validation,
error handling, duplicate-click prevention, and draft/discard behavior.
