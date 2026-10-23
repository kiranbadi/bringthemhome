# Submit Tip Implementation Plan

**Goal:** Add an accessible case-aware Submit Tip dialog.
**Architecture:** Standalone Material dialog, reactive form, private in-memory state, and a disabled service integration boundary. Reuse the detail response and public agency fields. No backend changes.
**Tech Stack:** Angular 22, Material, RxJS, Vitest.

## Approved design
Three entry cards lead to standard, anonymous, or read-only agency views. Keep online submission and evidence disabled until a real contract exists. Material handles focus trapping and restoration; all dismiss actions check for unsaved changes. Use existing privacy and terms routes.

## Tasks
1. Add tests for mode selection, validation, anonymous payload omission, agency links, unavailable submission/uploads, errors/success through an injected adapter, duplicate protection, and discard behavior. Run the tests before implementation.
2. Create models, environment configuration, and service boundary. The default service must never send requests to an invented endpoint.
3. Create the standalone responsive dialog with labeled reactive controls, notices, conditional sighting fields, disabled evidence input, and discard confirmation.
4. Replace the detail page contact link with a dialog button passing the selected record. Update integration tests.
5. Run the focused tests, full Angular suite, and production build. Document remaining backend work.
