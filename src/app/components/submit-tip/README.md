# Submit Tip

`SubmitTipComponent` is a standalone Angular Material dialog. The missing-person detail page loads it on demand and passes its existing `MissingPersonDetail` response through `MAT_DIALOG_DATA`. No extra case request is made.

## Modes
- Standard: reactive tip form with optional contact information and consent to follow-up.
- Anonymous: same tip form with contact fields cleared, hidden, and omitted from the draft request.
- Agency: public contact fields from `contacts.investigatingAgencies`, including telephone and email links. Missing fields are explicitly unavailable. The current API model does not define an official agency website, so no URL is invented.

Material provides the focus trap and focus restoration. Escape, backdrop, Cancel, and the close button check for unsaved edits. Back preserves the draft and returns keyboard focus to the entry cards. Nothing is written to browser storage or the URL.

## Backend integration remains incomplete
No supported tip API or upload contract was found. `TipSubmissionService.available` is deliberately false, submission is disabled, and the service rejects calls without making HTTP requests. `SubmitTipRequest` and `SubmitTipResponse` are frontend integration types, not an operational server contract. Existing generic contact endpoints are not reused.

Both environment files contain a nullable future endpoint and evidence MIME/size policy. Setting an endpoint alone must not enable submission. Implement and verify a contract adapter in the service before enabling it, including response validation, error mapping, and confirmation semantics. Only an actual successful server response may produce success; references must originate from that response.

Evidence selection is disabled with an explanation. Multiple selection is declared but no files are retained or uploaded. Once upload support exists, implement selected-file previews/removal, client size/type validation using the configuration, and a verified multipart or separate upload flow. Do not use base64 JSON. Videos remain unsupported.

The backend must provide private authorized tip review, server validation, abuse prevention/rate limiting, and secure private evidence storage with server-side content/type/size validation. Tips must remain outside public search and public history endpoints. No backend files were changed.

## Verification
Run Angular CLI with a compatible Node runtime (this workspace shell has an older version):

```sh
/Users/kiranbadi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@angular/cli/bin/ng.js test --watch=false
/Users/kiranbadi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/@angular/cli/bin/ng.js build --configuration production
```

Tests cover case integration, all three modes, validation and optional fields, anonymous contact omission, missing contacts, disabled evidence/submission, no outbound requests from the service, adapter success/error handling, duplicate prevention, Escape/backdrop dismissal, draft preservation, discard confirmation, and focus after Back. Adapter tests simulate a future backend; they do not establish that one exists.
