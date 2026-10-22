# Login integration plan

**Goal:** Connect existing login to the supplied API contract using sessionStorage only.
**Architecture:** Extend AccountManagementService with typed login and session getters. Add a functional route guard and an origin-scoped CSRF interceptor. Keep the existing account dashboard route and login/registration layout.
**Tech stack:** Angular 22 reactive forms, Material, HttpClient, RxJS, Vitest.

Approved design: email-only login, POST http://localhost:8000/bringthemhome/auth/login, credentialed JSON request, currentUser and csrf_token in sessionStorage, pending/error UI, success navigation to /myaccount, session-presence guard. No cookie creation requirement. Use X-CSRF-Token for backend mutations; this header name is a frontend convention because the supplied contract does not specify one.

1. Add failing service, component, guard and interceptor tests. Run focused tests.
2. Implement typed login with session persistence before completion, pending lock, exact 429 and API error messages, and spinner.
3. Register route guard and scoped CSRF interceptor; preserve other API behavior.
4. Run full tests and production build, review diff, report verification limits.
