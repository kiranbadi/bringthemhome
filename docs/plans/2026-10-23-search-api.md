# Search API Implementation Plan

**Goal:** Connect advanced search to the backend and reuse gallery and case details.

**Architecture:** Submit snake_case search criteria in gallery route query parameters. The existing service requests the search endpoint; the gallery retains query criteria while paging and uses returned `_id` for the existing detail route and endpoint. Extend the shared record contract for nullable search fields.

**Tech Stack:** Angular 22, reactive forms, HttpClient, RxJS, Vitest.

1. Add request-contract tests for GET search parameters, including false and zero values, and detail identity.
2. Implement typed search filters and search service method.
3. Replace age bands with explicit min/max inputs, fix date validation, expose state codes and backend option values, and navigate to gallery on submit.
4. Read route query parameters in the gallery, preserve them during pagination, and display search-specific record fields with fallbacks.
5. Test form submission, validation, gallery search/pagination, nullable fields, errors and detail links. Run the suite and production build.

Approved design: reuse the existing gallery and detail endpoint, with filters in the URL and server pagination. No unrelated UI redesign.
