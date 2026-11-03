# Report workspace implementation plan

Goal: Preserve all existing report fields while introducing section navigation, repeatable records and a server-authoritative lifecycle.
Architecture: Keep reactive form groups and the Material stepper as content infrastructure. Add accessible sidebar/mobile navigation, per-section readiness, repeatable FormArrays, and a typed lifecycle API adapter. No client-only submission or browser persistence of sensitive report details.
Tech stack: Angular standalone components, Angular Material, reactive forms, HttpClient, Vitest.

1. Add repeatable aliases, employment (25), sightings (25), case/contact (10). Retain all original record fields. Require details when Other is selected. Test limits and payload fidelity.
2. Add non-linear workspace navigation with real per-section readiness, mobile selector, and preview edit links. Keep existing fields and validation.
3. Add lifecycle adapter with configurable endpoint (disabled until backend contract confirmed), load/save/submit/revise/found/archive actions, pending/error states and explicit confirmations. Never fabricate server state.
4. Add owner report and administrator-review routes. Enforce actual permissions through server, and constrain actions by returned status. Document required contract including files, revisions, approval, and index updates.
5. Test new behavior and run application build. State backend deployment requirements clearly.
