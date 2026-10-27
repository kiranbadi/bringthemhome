# Case Discussions Implementation Plan

**Goal:** Provide separate public case discussion pages with authenticated participation.
**Architecture:** Standalone Angular Material components, local signal state, typed HttpClient service. Reuse account sessions, case lookup, tip dialog, and theme. Keep the existing case detail layout and add one discussion link.
**Tech Stack:** Angular 22, Material, RxJS, Vitest.

Approved design: /missing-persons/:id/discussions and /missing-persons/:id/discussions/:discussionId. Both retain compact case context and links to the case; discussion detail links to the board. Text is interpolated. API media URLs are temporary and only validated media is displayed. Backend remains authoritative for ownership, moderation, votes and attachment readiness.

1. Write service contract, media validation, vote transition, and route tests; run and confirm failure before implementation.
2. Add typed discussion models, service and isolated presigned uploads; extend CSRF coverage for discussion API paths only.
3. Add media selection/preview, creation dialog, shared media rendering, vote/report/delete controls, reply component.
4. Add routed case board/detail pages with case context, pagination, search, sort, loading/error/empty states and confidential tips.
5. Add component tests for posting validation, duplicate submission prevention, optimistic voting rollback and case mismatch safety.
6. Document endpoint payloads, response envelopes, upload workflow, auth, soft deletion and backend responsibilities in docs/api/discussions.md.
7. Run the full tests and production build, inspect diff, fix issues.
