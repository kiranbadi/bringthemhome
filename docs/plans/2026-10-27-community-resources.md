# Community Resources Implementation Plan

**Goal:** Deliver the requested Angular directory, a reusable FastAPI API implementation, and curl documentation.

**Architecture:** Lazy standalone Angular pages share typed contracts and reactive forms. A FastAPI router uses SQLAlchemy transactions, server-owned statuses, and an injectable authenticated principal. PostgreSQL is the production store; SQLite is used only for isolated tests. Location reference rows are imported from authoritative Census files, never invented by the UI.

**Tech Stack:** Angular 22, Material, RxJS, Vitest; FastAPI, Pydantic, SQLAlchemy, PostgreSQL.

1. Add failing contract and workflow tests for form validation, filtered requests, assessments, corrections, backend coverage inheritance and authorization.
2. Implement backend schemas, persistence, location lookups, duplicate search, contributions and moderation. Add a Census importer and explicit authentication integration instructions.
3. Implement typed Angular service, reusable location/form controls, listing, detail, verification, corrections and contributions.
4. Connect navigation, guarded routes, account contributions and public case location query parameters.
5. Document setup, request/response contracts and curl commands for every endpoint.
6. Run backend tests, Angular tests and production build; fix failures and inspect changes.

Backend integration limitation: the existing FastAPI application and its authentication implementation are not in this workspace. Deliver an includable router and a fail-closed standalone app; do not pretend the existing deployment is wired.

## Verification results

- Full Angular test suite: 164 tests passed.
- PostgreSQL 17 API suite: 16 tests passed, including concurrent assessment upserts.
- Imported 26,913 reference records from the actual Census national CSV and state file.
- Browser check confirmed state/county/city names populate from canonical query IDs.
- Independent review findings addressed: safe mailto encoding, incomplete city ancestry,
  and whitespace duplicate queries. Regression tests cover each.
- Production build passes; existing 500 kB warning budget is exceeded (under the 1 MB error limit).
- Deployment remains an explicit integration step: provide database, load Census data,
  and connect the actual existing account/CSRF dependency.
