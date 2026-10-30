# Bringthemhome

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.8.

## Missing persons gallery

The home page and `/missing-persons` display a responsive gallery backed by
`GET {apiUrl}/api/v1/missing-persons?page=1&page_size=20`. Set `apiUrl` in
`src/environments/environment.ts` and `environment.production.ts` for each deployment
(both currently use `http://localhost:8000`). The API must allow requests from the
frontend origin when served on a different origin.

The gallery supports server pagination, page jumps, loading/empty/error states,
photo fallbacks, native sharing with clipboard fallback, and case-specific tip
links to the contact form. `/missing-persons/:id?page=N` loads the case from its
source page. If the record has moved, it searches remaining API pages sequentially;
a future lookup-by-ID endpoint would make this fallback more efficient.

Gallery contracts and the HTTP client live in `src/app/core`. The older sample
data service and `/missing-person/:id` route remain available for existing links.

Use a Node version supported by Angular 22 (the bundled Node 24.19 runtime works).
In environments affected by the native Angular disk-cache crash, `CI=1` disables
the local disk cache for a build. Production builds also need internet access to
inline the existing Google Fonts stylesheets.

## Account registration and policies

Account Management hosts a standalone `RegistrationComponent` with role-dependent
validation, password visibility, international phone serialization, required policy
acceptance, duplicate-submit protection, and an in-place confirmation view. The
request model is `src/app/core/models/registration-payload.model.ts`.

The registration endpoint remains `/bringthemhome/registrations`. Its frontend
request now includes `password`, `role`, `other_role_description`, and
`terms_accepted` in addition to the existing contact fields. The backend must
accept and persist these fields, including the chosen account password; its
implementation is not part of this repository. Requests are logged as formatted
JSON to the browser console, as requested for this development flow.

`/terms` and `/privacy` render interim policy drafts through `PolicyPageComponent`.
Their links are configured through `termsUrl` and `privacyPolicyUrl` in the
environment files. The drafts disclose the current diagnostics and external media
requests, and identify the operational details that still need confirmation.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Community resources directory

The `/resources` directory supports search, cascading Census-backed location filters,
resource details, authenticated submissions, community assessments, pending corrections,
and `/account/resource-contributions`. Public case-location links require an explicit
`circumstances.lastKnownLocation.visibility: "PUBLIC"` marker.

A new includable FastAPI/SQLAlchemy backend is provided in `backend/`. See
[the Resources API guide](docs/api/resources.md) for PostgreSQL setup, integration with
existing authentication, Census reference-data import, all endpoints, JSON contracts,
and curl examples. The existing deployed backend is not automatically connected.
