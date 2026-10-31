# Photo Comparison API Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the `/bringthemhome/photo-review/compare` multipart API into the Photo Review page to replace simulated quality check with live facial comparison analysis.

**Architecture:** An injectable `PhotoComparisonService` constructs a `multipart/form-data` payload containing `reference_photo` and `uploaded_photo` and calls the comparison endpoint via Angular's `HttpClient`. `PhotoReviewComponent` leverages reactive signals to trigger comparison, track progress, handle errors, and render a comprehensive report covering similarity score, age assessment, facial landmarks, and imaging limitations.

**Tech Stack:** Angular 22 (Standalone Components, Signals), RxJS, Angular Material, Vitest.

---

### Task 1: Create Photo Comparison Types & Service with Unit Tests

**Files:**
- Create: `src/app/features/photo-review/photo-comparison.types.ts`
- Create: `src/app/features/photo-review/photo-comparison.service.spec.ts`
- Create: `src/app/features/photo-review/photo-comparison.service.ts`

**Step 1: Create TypeScript type definitions**

Create `src/app/features/photo-review/photo-comparison.types.ts`:
```typescript
export interface AgeAndMaturationAssessment {
  readonly estimated_apparent_age_image_a: string;
  readonly estimated_apparent_age_image_b: string;
  readonly morphological_continuity: string;
  readonly maturation_observations: string;
}

export interface LandmarkRegionAnalysis {
  readonly congruence: 'HIGH' | 'MODERATE' | 'LOW' | string;
  readonly findings: string;
}

export interface SurfaceMarkers {
  readonly features_detected: boolean;
  readonly consistent_markers: readonly string[];
  readonly inconsistent_markers: readonly string[];
}

export interface LandmarkAnalysis {
  readonly orbit_and_interocular_region: LandmarkRegionAnalysis;
  readonly nasal_complex: LandmarkRegionAnalysis;
  readonly mandibular_and_perioral_region: LandmarkRegionAnalysis;
  readonly auricular_features: LandmarkRegionAnalysis;
  readonly surface_markers: SurfaceMarkers;
}

export interface ImagingLimitations {
  readonly image_a_clarity: string;
  readonly image_b_clarity: string;
  readonly perspective_or_lighting_distortions: string;
}

export interface PhotoComparisonResponse {
  readonly similarity_classification: 'HIGH_SIMILARITY' | 'MODERATE_SIMILARITY' | 'LOW_SIMILARITY' | string;
  readonly confidence_score: number;
  readonly estimated_match_percentage: number;
  readonly age_and_maturation_assessment: AgeAndMaturationAssessment;
  readonly landmark_analysis: LandmarkAnalysis;
  readonly imaging_limitations: ImagingLimitations;
  readonly distinguishing_differences: readonly string[];
  readonly technical_summary: string;
}
```

**Step 2: Write failing unit test for PhotoComparisonService**

Create `src/app/features/photo-review/photo-comparison.service.spec.ts`:
```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PhotoComparisonService } from './photo-comparison.service';
import { PhotoComparisonResponse } from './photo-comparison.types';
import { environment } from '../../../environments/environment';

describe('PhotoComparisonService', () => {
  let service: PhotoComparisonService;
  let httpTesting: HttpTestingController;

  const mockResponse: PhotoComparisonResponse = {
    similarity_classification: 'HIGH_SIMILARITY',
    confidence_score: 0.92,
    estimated_match_percentage: 88,
    age_and_maturation_assessment: {
      estimated_apparent_age_image_a: '20-25 years',
      estimated_apparent_age_image_b: '25-30 years',
      morphological_continuity: 'CONSISTENT',
      maturation_observations: 'Natural aging progression.',
    },
    landmark_analysis: {
      orbit_and_interocular_region: {
        congruence: 'HIGH',
        findings: 'Consistent eye shape.',
      },
      nasal_complex: {
        congruence: 'HIGH',
        findings: 'Consistent nasal structure.',
      },
      mandibular_and_perioral_region: {
        congruence: 'HIGH',
        findings: 'Consistent jawline.',
      },
      auricular_features: {
        congruence: 'HIGH',
        findings: 'Consistent ear structure.',
      },
      surface_markers: {
        features_detected: false,
        consistent_markers: [],
        inconsistent_markers: [],
      },
    },
    imaging_limitations: {
      image_a_clarity: 'Good',
      image_b_clarity: 'Good',
      perspective_or_lighting_distortions: 'Minimal differences.',
    },
    distinguishing_differences: ['Minor styling differences.'],
    technical_summary: 'High degree of craniofacial similarity.',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PhotoComparisonService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PhotoComparisonService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('posts reference_photo and uploaded_photo as multipart/form-data to comparison endpoint', () => {
    const refFile = new File(['ref-bytes'], 'reference.jpg', { type: 'image/jpeg' });
    const compFile = new File(['comp-bytes'], 'comparison.jpg', { type: 'image/jpeg' });

    let actualResponse: PhotoComparisonResponse | undefined;
    service.comparePhotos(refFile, compFile).subscribe((res) => {
      actualResponse = res;
    });

    const expectedUrl = `${environment.apiUrl}${environment.apiBaseUrl}/photo-review/compare`;
    const req = httpTesting.expectOne(expectedUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Accept')).toBe('application/json');

    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBe(true);
    expect(body.get('reference_photo')).toBe(refFile);
    expect(body.get('uploaded_photo')).toBe(compFile);

    req.flush(mockResponse);
    expect(actualResponse).toEqual(mockResponse);
  });

  it('propagates HTTP error when comparison request fails', () => {
    const refFile = new File(['ref'], 'ref.jpg', { type: 'image/jpeg' });
    const compFile = new File(['comp'], 'comp.jpg', { type: 'image/jpeg' });

    let errorOccurred = false;
    service.comparePhotos(refFile, compFile).subscribe({
      next: () => fail('Should have failed'),
      error: () => {
        errorOccurred = true;
      },
    });

    const expectedUrl = `${environment.apiUrl}${environment.apiBaseUrl}/photo-review/compare`;
    const req = httpTesting.expectOne(expectedUrl);
    req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    expect(errorOccurred).toBe(true);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 24.15.0 && npx ng test --no-watch --include src/app/features/photo-review/photo-comparison.service.spec.ts`
Expected: FAIL (Cannot find module `./photo-comparison.service`)

**Step 4: Implement PhotoComparisonService**

Create `src/app/features/photo-review/photo-comparison.service.ts`:
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PhotoComparisonResponse } from './photo-comparison.types';

@Injectable({ providedIn: 'root' })
export class PhotoComparisonService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}${environment.apiBaseUrl}/photo-review/compare`;

  comparePhotos(referencePhoto: File, comparisonPhoto: File): Observable<PhotoComparisonResponse> {
    const formData = new FormData();
    formData.append('reference_photo', referencePhoto);
    formData.append('uploaded_photo', comparisonPhoto);

    const headers = new HttpHeaders({
      Accept: 'application/json',
    });

    return this.http.post<PhotoComparisonResponse>(this.endpoint, formData, { headers });
  }
}
```

**Step 5: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 24.15.0 && npx ng test --no-watch --include src/app/features/photo-review/photo-comparison.service.spec.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/features/photo-review/photo-comparison.types.ts src/app/features/photo-review/photo-comparison.service.ts src/app/features/photo-review/photo-comparison.service.spec.ts
git commit -m "feat(photo-review): create photo comparison service and types

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Update Photo Review Component with Comparison UI and Comprehensive Report

**Files:**
- Modify: `src/app/features/photo-review/photo-review.component.ts`
- Modify: `src/app/features/photo-review/photo-review.component.html`
- Modify: `src/app/features/photo-review/photo-review.component.scss`
- Modify: `src/app/features/photo-review/photo-review.component.spec.ts`
- Remove: `src/app/features/photo-review/photo-quality.ts`
- Remove: `src/app/features/photo-review/photo-quality.spec.ts`
- Remove: `src/app/features/photo-review/photo-quality-workflow.spec.ts`

**Step 1: Write failing component tests for Photo Comparison**

Update `src/app/features/photo-review/photo-review.component.spec.ts`:
- Replace `PhotoQuality` mock with `PhotoComparisonService` mock.
- Add test: "disables Compare button until both reference and comparison photos are selected and loaded".
- Add test: "triggers comparePhotos on PhotoComparisonService and displays comprehensive report on success".
- Add test: "displays error banner if comparison fails".
- Add test: "clears comparison results and errors when removing a photo or clearing all photos".
- Add test: "updates privacy notice to reflect secure transmission to comparison service".

**Step 2: Run component tests to verify failures**

Run: `source ~/.nvm/nvm.sh && nvm use 24.15.0 && npx ng test --no-watch --include src/app/features/photo-review/photo-review.component.spec.ts`
Expected: FAIL (PhotoQuality references / missing comparison methods)

**Step 3: Update PhotoReviewComponent implementation**

Update `src/app/features/photo-review/photo-review.component.ts`:
- Inject `PhotoComparisonService`.
- Replace `checkingQuality`, `qualityResult`, `qualityError` signals with:
  - `comparing = signal(false)`
  - `comparisonResult = signal<PhotoComparisonResponse | null>(null)`
  - `comparisonError = signal('')`
- Implement `compare()` method that calls `comparisonService.comparePhotos(reference.file, comparison.file)`.
- Reset comparison state in `remove()` and `clear()`.
- Add helper method for CSS class mapping of `similarity_classification` (e.g. `HIGH_SIMILARITY` -> positive badge).

Update `src/app/features/photo-review/photo-review.component.html`:
- Update privacy notice heading to "Secure Image Analysis" with text informing user photos are transmitted securely for analysis.
- Update action button:
  ```html
  <button
    matButton="filled"
    type="button"
    (click)="compare()"
    [disabled]="!ready() || comparing()"
    [attr.aria-busy]="comparing()"
  >
    {{ comparing() ? 'Analyzing…' : 'Compare Photos' }}
  </button>
  ```
- Add Comprehensive Report container when `comparisonResult()` is present:
  - Classification badge, match percentage, confidence score, technical summary.
  - Age & Maturation Assessment card (apparent ages, morphological continuity, maturation observations).
  - Landmark Analysis grid:
    - Orbit & Interocular Region card (congruence badge, findings)
    - Nasal Complex card (congruence badge, findings)
    - Mandibular & Perioral Region card (congruence badge, findings)
    - Auricular Features card (congruence badge, findings)
    - Surface Markers card (features detected status, markers lists)
  - Distinguishing Differences & Imaging Limitations card (differences list, clarity image A & B, lighting/perspective distortions).
- Render `comparisonError()` alert if present.

Update `src/app/features/photo-review/photo-review.component.scss`:
- Add styles for comparison result cards, metrics display (percentage, confidence score), status badges (`HIGH_SIMILARITY`, congruence badges), landmark grid, and limitations.
- Ensure responsive layout, accessible contrast, and dark/light mode compatibility.

**Step 4: Clean up obsolete photo-quality files**

Remove:
- `src/app/features/photo-review/photo-quality.ts`
- `src/app/features/photo-review/photo-quality.spec.ts`
- `src/app/features/photo-review/photo-quality-workflow.spec.ts`

**Step 5: Run tests to verify all component and feature specs pass**

Run: `source ~/.nvm/nvm.sh && nvm use 24.15.0 && npx ng test --no-watch --include src/app/features/photo-review/**`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/features/photo-review/
git commit -m "feat(photo-review): integrate comparison API and render comprehensive report

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Full Verification and Build Validation

**Files:**
- Repository-wide test suite and build artifacts

**Step 1: Run full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 24.15.0 && npx ng test --no-watch`
Expected: PASS (All test files passing)

**Step 2: Run production build**

Run: `source ~/.nvm/nvm.sh && nvm use 24.15.0 && npx ng build`
Expected: PASS (Application bundle generation complete with 0 errors)

**Step 3: Verify git status and diff**

Run: `git status`
Expected: Clean working directory or ready for integration.
