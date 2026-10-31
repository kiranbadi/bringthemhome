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
    let nextCalled = false;
    service.comparePhotos(refFile, compFile).subscribe({
      next: () => {
        nextCalled = true;
      },
      error: () => {
        errorOccurred = true;
      },
    });

    const expectedUrl = `${environment.apiUrl}${environment.apiBaseUrl}/photo-review/compare`;
    const req = httpTesting.expectOne(expectedUrl);
    req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    expect(nextCalled).toBe(false);
    expect(errorOccurred).toBe(true);
  });
});
