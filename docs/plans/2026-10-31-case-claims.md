# Case Claims Implementation Plan

**Goal:** Integrate implemented claim, verified contribution, and staff review APIs into existing Angular 22 case details.
**Architecture:** Typed API service with complete own-claim pagination; standalone Material claim panel, contribution composer/uploader, public feed and admin queue. Session/CSRF remain in existing services, and direct-storage uploads use HttpBackend to bypass interceptors. Case IDs always come from backend _id. Login supports a validated local return URL.

1. Write failing service tests for pagination, encoded IDs and credential-free storage PUTs.
2. Implement API models/service and errors; extend /api proxy and CSRF allowlist.
3. Implement claim state/form, approved-only composer, cancellable staged upload with preview cleanup, and public paginated contributions.
4. Implement ADMIN/ADMINISTRATOR guard, queue pagination/filter, transitions, independent-verification acknowledgement and own-claim restriction.
5. Add safe login return flow, case detail integration, account staff link, and integration documentation.
6. Test all claim states, duplicates, pagination failures, publication modes, upload rejections/failures, revocation, staff restrictions and credential isolation. Run full tests/build.
