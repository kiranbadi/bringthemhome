# Natural Search Implementation Plan

**Goal:** Add accessible natural-language search above the home gallery without changing existing manual search contracts.
**Architecture:** A standalone Material hero serializes validated query/filter state into URL parameters. The existing gallery request stream selects a typed natural-search client for those parameters and keeps its card rendering and pagination. The hero receives busy/error state; optional suggestions use debounced cancellable requests. No backend AI implementation is included.
**Stack:** Angular 22, Material 22, reactive forms, signals, RxJS, Vitest.

1. Add failing HTTP contract tests in `src/app/features/natural-search/natural-search.service.spec.ts`; run targeted tests to confirm missing client.
2. Create `natural-search.models.ts` and `natural-search.service.ts`: credentialed natural POST, suggestions POST, city options GET, request timeout and typed error normalization.
3. Create standalone hero TS/HTML/SCSS: required trimmed query, search modes, chips, optional speech, autocomplete, manual filters, accessible errors and retry. Test empty query, serialization, debounce/cancellation, and status messages.
4. Integrate into gallery template and request stream; retain old API behavior and pagination. Add natural-search gallery test.
5. Document schemas, success/errors, optional endpoints, credentialed CORS/CSRF and executable curl examples in `docs/api/natural-search.md`.
6. Run targeted tests, development build, and diff checks. Production font inlining requires network access.
