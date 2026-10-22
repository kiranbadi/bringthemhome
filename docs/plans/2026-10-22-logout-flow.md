# Logout flow

Implement the supplied POST /bringthemhome/auth/logout contract with empty-string body, credentials and bth_csrf/bth_session headers. Read tokens from sessionStorage or readable cookies; retain csrf_token compatibility and persist bth_csrf during login. Do not invent a session identifier from the user ID: the provided login JSON has none. Ask the user whether the backend exposes bth_session elsewhere.

Share concurrent logout requests; on response, error or timeout clear all auth keys and known readable auth cookies, then publish null. Header conditionally exposes Logout via currentUser$, disables it while pending, navigates Home and opens the exact Material toast on completion. Exclude logout from the generic CSRF interceptor to keep its explicit API headers.

Validation: failing header tests followed by implementation; verify success/401/500/network errors, cookie fallback, shared request, timeout, guest visibility, hydration and login regressions, full tests and production build.
