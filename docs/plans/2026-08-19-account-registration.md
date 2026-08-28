# Account Registration API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Submit the account registration form to the REST API and display the returned temporary login credentials.

**Architecture:** A root-provided shared `AccountManagementService` owns account API contracts and endpoints. The Account Management component manages validation and request UI state, delegating HTTP work to the service.

**Tech Stack:** Angular 22, Angular `HttpClient`, reactive forms, Angular Material, RxJS, Vitest

---

### Task 1: Shared account service

**Files:**
- Create: `src/app/services/account-management.spec.ts`
- Create: `src/app/services/account-management.ts`
- Modify: `src/app/app.config.ts`

**Step 1: Write the failing service test**

Test `AccountManagementService.register()` with Angular's HTTP testing provider. Expect one POST request to `http://localhost:8000/bringthemhome/registrations` whose body is exactly:

```ts
{
  email: 'kiranbadi6@yahoo.com',
  phone: '6462013106',
  full_name: 'Kiran Badi4',
  notes: 'This is a test note',
}
```

Flush a representative response and assert the observable returns it.

**Step 2: Run the service test and verify RED**

Run: `npm test -- --watch=false src/app/services/account-management.spec.ts`

Expected: FAIL because `AccountManagementService` does not exist.

**Step 3: Implement the service and HTTP provider**

Define exported readonly request and response interfaces. Create a root-provided service using `inject(HttpClient)` and a `register(request)` method returning `Observable<AccountRegistrationResponse>`. Add `provideHttpClient()` to `appConfig`.

**Step 4: Run the service test and verify GREEN**

Run: `npm test -- --watch=false src/app/services/account-management.spec.ts`

Expected: PASS with no outstanding HTTP requests.

### Task 2: Component request behavior

**Files:**
- Create: `src/app/account-management/account-management.spec.ts`
- Modify: `src/app/account-management/account-management.ts`

**Step 1: Write failing component tests**

Provide a controlled fake `AccountManagementService`. Test separately that:

- valid form submission calls `register()` with `full_name` mapped from `fullName`;
- submission exposes a pending state;
- successful response stores the returned credentials;
- failed response preserves form values and exposes an inline error state.

Use the zoneless Act, Wait, Assert pattern with `await fixture.whenStable()`.

**Step 2: Run component tests and verify RED**

Run: `npm test -- --watch=false src/app/account-management/account-management.spec.ts`

Expected: FAIL because the component does not call the service or expose request state.

**Step 3: Implement minimal component behavior**

Inject `AccountManagementService`. Replace `registrationSubmitted` with pending, response, and error state. On valid submission, call `register`; map `fullName` to `full_name`; preserve the form on error; and do not log credentials.

**Step 4: Run component tests and verify GREEN**

Run: `npm test -- --watch=false src/app/account-management/account-management.spec.ts`

Expected: PASS.

### Task 3: Registration credential UI

**Files:**
- Modify: `src/app/account-management/account-management.spec.ts`
- Modify: `src/app/account-management/account-management.html`
- Modify: `src/app/account-management/account-management.scss`

**Step 1: Write failing rendered-UI tests**

Verify that a successful response renders email and phone as login IDs, renders the temporary password, and asks the user to save the information. Verify that loading disables the submit button and failure renders an alert while input values remain populated.

**Step 2: Run component tests and verify RED**

Run: `npm test -- --watch=false src/app/account-management/account-management.spec.ts`

Expected: FAIL because the template still contains the generic success message.

**Step 3: Implement credential, loading, and error presentation**

Conditionally replace the registration form content with an accessible success box after registration. Add a `role="alert"` failure message, a disabled loading button, and scoped styles consistent with the existing panel.

**Step 4: Run component tests and verify GREEN**

Run: `npm test -- --watch=false src/app/account-management/account-management.spec.ts`

Expected: PASS.

### Task 4: Full verification

**Files:**
- Verify all changed files

**Step 1: Run the full test suite**

Run: `npm test -- --watch=false`

Expected: all Vitest tests pass.

**Step 2: Run the production build**

Run: `npm run build`

Expected: build completes successfully within configured budgets.

**Step 3: Review the diff**

Run: `git diff --check` and inspect `git diff` to ensure no credentials are logged and unrelated user changes remain intact.
