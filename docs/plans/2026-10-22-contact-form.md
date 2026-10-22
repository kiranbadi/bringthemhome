# Contact form implementation plan

**Goal:** Implement the approved contact form lifecycle without changing inputs or payload keys.

**Architecture:** Retain the Angular reactive form and Material controls. Guard submission with pending/success state, preserve values on HTTP errors, and replace the form on success using the response name.

**Tech Stack:** Angular 22, Material, RxJS, Vitest.

1. Add regression tests in contact-us.spec.ts for exact JSON payload, duplicate guards, response-name confirmation, errors/retry, validation and clean Cancel reset. Run focused tests and confirm failures.
2. Update contact-us.ts with typed payload/response, validators, pending state, reset through FormGroupDirective, and HTTP completion handling.
3. Update contact-us.html with mutually exclusive form/success markup, specific errors, loading state, Submit and Cancel. Preserve all controls.
4. Extend contact-us.scss using existing theme tokens for success/error cards and dynamic validation spacing.
5. Run focused tests, full unit suite, and production build; review diff.
