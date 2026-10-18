# Registration refactor implementation plan

Goal: Extract registration into a standalone Angular Material component with reactive validation, typed payload, guarded asynchronous submission, and in-place confirmation.

Architecture: Account Management hosts RegistrationComponent and keeps login/password recovery. Registration owns its FormGroup, dynamic OTHER validator subscriptions, phone serialization, request lifecycle and errors. Extend the existing service contract with password, role, other_role_description and terms_accepted; keep its current endpoint. The backend must support and persist these new fields.

1. Write DOM/HTTP tests for validation, role switching, E.164 payload, duplicate submission prevention, errors, password toggle and success rendering.
2. Implement registration payload model, component and Material template/styles. Use OnPush, markForCheck, subscription teardown and finalize.
3. Replace the account page registration markup and logic with the component; wire Proceed to Login to email prefill and focus. Update service and integration tests for the new contract.
4. Run focused/full tests and production build, then verify responsive layout and submission behavior with mocked HTTP responses.

Policy follow-up: User requested interim local Terms and Privacy pages. Add a reusable PolicyPageComponent at /terms and /privacy using route input binding. Clearly identify draft status, describe the implemented data flows, and avoid undocumented retention/security promises. Keep URLs deployment-configurable.
