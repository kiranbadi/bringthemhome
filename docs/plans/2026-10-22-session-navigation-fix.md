# Account session navigation fix

Root cause reproduced with router tests: stored session remains present, but the header's account-management route instantiates login without a guest redirect. The requested account/management dashboard URL is missing. Existing isAuthenticated already checks storage directly.

Fix: hydrate a root-scoped BehaviorSubject from currentUser on service initialization, update it on login/logout and guard checks, protect account/management, keep myaccount working, redirect authenticated login/account-management visits before activation, and add component initialization fallback. Explicit logout removes auth storage keys and known legacy readable auth cookies. Cookie creation remains out of scope as previously agreed.

Validation: regression tests for fresh startup hydration, navigation away/back, login entry redirect, guest access, logout, malformed storage, and existing login API behavior; full unit suite and production build.
