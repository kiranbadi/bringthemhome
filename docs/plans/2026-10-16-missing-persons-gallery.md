# Missing persons gallery implementation plan

Goal: Replace the home listing with a responsive, API-backed gallery using the supplied contracts.

Architecture: Keep the existing sample-data service and singular detail route for compatibility. Add a separate typed REST client and standalone OnPush gallery with signal state. Use server pagination and cancel outdated requests. Add a plural detail route which locates a record on its source API page; do not invent a detail endpoint. Send tip links to the contact form with case identity.

1. Add HTTP and gallery behavior tests covering page defaults, transitions, failures/retry, empty results, image fallback and nullable fields.
2. Add core models, environment API origin, and a typed HTTP service with error propagation.
3. Implement the gallery template, state, sharing, pagination and responsive styles.
4. Wire the home and plural detail routes; prefill contact tips using query parameters.
5. Run focused tests, full tests, production build and review the diff. Preserve unrelated report HTML edits.

Validation: Angular HttpTestingController for deterministic API behavior; DOM assertions for loading, error, empty and pagination states. No running backend is assumed. Use bundled Node 24.19 because the shell's Node 24.11 is too old for the installed CLI.
