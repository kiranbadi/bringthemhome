# Case links without page query design

## Goal

Remove the gallery page number from missing-person detail URLs, including URLs produced by the Share action.

## Design

Build detail links using only the case route and ID. Build shared URLs from that same route without adding a `page` query parameter. Keep tip-form query parameters unchanged. The detail view already defaults to page one and searches remaining API pages when a case is not found on the requested page, so these clean URLs remain resolvable; finding a case may require additional API requests.

## Validation

Update gallery tests to assert detail and shared links contain no page query parameter, while continuing to verify case identity, share/copy behavior, and existing tip query parameters. Run the focused gallery and detail component tests.
