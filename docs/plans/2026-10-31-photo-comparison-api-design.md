# Photo Comparison API Integration Design

**Goal:** Integrate the `/bringthemhome/photo-review/compare` endpoint into the Photo Review page, replacing the mock quality check with real facial landmark and similarity analysis.

## Overview
The Photo Review page enables authorized reviewers to compare two photographs: a reference photo and a comparison (uploaded) photo. This design replaces the local-only simulated quality check with the backend comparison API, submitting multipart form data and presenting a comprehensive, structured report on facial similarity, age maturation, anatomical landmarks, differences, and imaging limitations.

## API Specification
- **Method:** `POST`
- **URL:** `${environment.apiUrl}${environment.apiBaseUrl}/photo-review/compare` (e.g. `http://localhost:8000/bringthemhome/photo-review/compare`)
- **Headers:**
  - `Accept: application/json`
  - `X-CSRF-Token`: injected by `csrfInterceptor`
  - `withCredentials: true`: enabled by `csrfInterceptor`
- **Request Body (Multipart Form-Data):**
  - `reference_photo`: File (Reference photo)
  - `uploaded_photo`: File (Comparison photo)
- **Response Shape (JSON):**
  - `similarity_classification`: String (e.g. `HIGH_SIMILARITY`)
  - `confidence_score`: Number (e.g. `0.92`)
  - `estimated_match_percentage`: Number (e.g. `88`)
  - `age_and_maturation_assessment`:
    - `estimated_apparent_age_image_a`: String
    - `estimated_apparent_age_image_b`: String
    - `morphological_continuity`: String
    - `maturation_observations`: String
  - `landmark_analysis`:
    - `orbit_and_interocular_region`: `{ congruence: string, findings: string }`
    - `nasal_complex`: `{ congruence: string, findings: string }`
    - `mandibular_and_perioral_region`: `{ congruence: string, findings: string }`
    - `auricular_features`: `{ congruence: string, findings: string }`
    - `surface_markers`: `{ features_detected: boolean, consistent_markers: string[], inconsistent_markers: string[] }`
  - `imaging_limitations`:
    - `image_a_clarity`: String
    - `image_b_clarity`: String
    - `perspective_or_lighting_distortions`: String
  - `distinguishing_differences`: String[]
  - `technical_summary`: String

## Architecture & Data Flow
1. **Types (`photo-comparison.types.ts`):** Strong TypeScript definitions mirroring backend JSON schema.
2. **Service (`photo-comparison.service.ts`):**
   - Injectable service using Angular's `HttpClient`.
   - Method: `comparePhotos(referencePhoto: File, comparisonPhoto: File): Observable<PhotoComparisonResponse>`.
   - Appends files to `FormData` under keys `reference_photo` and `uploaded_photo`.
3. **Component State (`PhotoReviewComponent`):**
   - `comparing` signal (`boolean`) for progress state.
   - `comparisonResult` signal (`PhotoComparisonResponse | null`) storing received analysis.
   - `comparisonError` signal (`string`) holding error feedback.
   - Clears results and cancels subscriptions if either photo is removed or if "Clear Images" is clicked.
4. **UI Layout:**
   - Updated privacy notice explaining secure photo analysis.
   - Primary action button: `Compare Photos` (busy label: `Analyzing…`).
   - Results panel rendered conditionally when `comparisonResult` is present:
     - Header summary badge, match percentage, confidence score, and technical summary.
     - Age & Maturation Assessment card.
     - Landmark Analysis grid for orbit, nasal complex, mandibular/perioral, auricular features, and surface markers.
     - Distinguishing Differences and Imaging Limitations card.
5. **Accessibility:**
   - ARIA live status indicators during analysis.
   - Semantic headings and definition lists for metrics and landmark findings.
   - Role alert for errors.

## Testing Strategy
- Unit tests for `PhotoComparisonService` verifying request construction, headers, URLs, and response mapping.
- Component specs verifying button activation, comparison triggering, report rendering, error display, and cleanup.
- Vitest test suite and Angular build verification.
