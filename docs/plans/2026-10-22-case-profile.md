# Missing person case profile

Preserve the existing navigation, summary/photo and Submit Tip query parameters. Add seven Material expansion panels (Demographics/Circumstances initially expanded), reusable read-only fields and structured array display. Use one existing GET detail request per case; retain loading/error/retry/404 handling.

Discovery: GET http://localhost:8000/api/v1/missing-persons/{id} was verified with the user's ID. The live response is flat; the user also supplied a richer seven-section JSON example. Model both directly without normalization or backend changes. List endpoint remains unchanged.

Age: calculate from a valid birth date or estimate from missingAge plus dateOfLastContact/missing_since. Never use reported/created dates. Unknown otherwise. Preserve 0, false, missing units and explicit unknown strings.

Privacy: source profile photos remain supported. Empty array item schemas were not provided, and the user allowed static examples. Use examples only in tests, not as case facts. Optional media/contact objects are rendered only when explicitly marked isPublic: true and not restricted/private. Sample document shape: url, name, fileType, isPublic. Unknown/restricted shapes fail closed until the real item/public-access contract is confirmed.

Components: CaseProfileSections owns accordion/gallery/preview behavior; CaseDetailField renders scalar label/value pairs; CaseRecord recursively renders clothing/transport/physical structured values without raw JSON. Additional public contacts use an explicit scalar field allowlist so nested private objects cannot render. Presentation helpers handle age, text, safe URLs, map and contact links.

Validation: focused tests for dates and missing values, seven panels and expansion, source arrays, links, previews/broken images, privacy filters; integration tests for the single HTTP request, legacy records, retry and unavailable states; browser visual/keyboard checks, full unit suite and production build.
