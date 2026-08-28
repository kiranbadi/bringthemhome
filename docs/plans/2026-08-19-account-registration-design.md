# Account Registration API Design

## Goal

Connect the Account Management registration form to the shared account REST client and show the temporary login credentials returned by the server.

## Architecture

Add a root-provided `AccountManagementService` in the shared services directory. The service owns account endpoint URLs, request/response contracts, and HTTP calls; it begins with registration and can grow to include login, password reset, and other account endpoints.

Enable Angular `HttpClient` in the application configuration. The Account Management component retains responsibility for form validation and presentation state, maps its camel-case form value into the service's registration request, and subscribes to the registration result.

## Data flow

1. The user submits a valid registration form with an empty honeypot.
2. The component marks the request as pending and clears any previous error.
3. `AccountManagementService.register` posts to `http://localhost:8000/bringthemhome/registrations` using `full_name` as required by the API.
4. On success, the component retains the returned email, phone, and temporary password and displays them in a credential box.
5. The box explicitly asks the user to save the credentials before leaving the page.
6. On failure, the component preserves every form value and displays an inline retry message.

## UI states

- Idle: registration form and enabled Register button.
- Loading: Register button disabled with submission progress text.
- Success: credential box shows both email and phone as valid login IDs and the temporary password.
- Failure: entered values stay intact and an alert explains that registration could not be completed.

The API response and temporary password must not be logged.

## Testing

- Service test verifies the POST URL, method, and exact snake-case payload.
- Component tests verify the service request mapping, pending behavior, returned credential display, save warning, and error preservation.
- Run the full Vitest suite and Angular production build.
