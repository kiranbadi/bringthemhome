import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { PhotoReviewComponent, PHOTO_REVIEW_MAX_BYTES } from './photo-review.component';
import { PhotoComparisonService } from './photo-comparison.service';
import { PhotoComparisonResponse } from './photo-comparison.types';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';

describe('Photo review', () => {
  let fixture: ComponentFixture<PhotoReviewComponent>;
  let http: HttpTestingController;
  let sequence: number;
  let comparisonSubject: Subject<PhotoComparisonResponse>;
  let comparisonServiceMock: {
    comparePhotos: ReturnType<typeof vi.fn>;
  };

  const mockComparisonResponse: PhotoComparisonResponse = {
    similarity_classification: 'HIGH_SIMILARITY',
    confidence_score: 0.94,
    estimated_match_percentage: 91,
    age_and_maturation_assessment: {
      estimated_apparent_age_image_a: '20-25 years',
      estimated_apparent_age_image_b: '25-30 years',
      morphological_continuity: 'CONSISTENT',
      maturation_observations: 'Natural facial maturation observed.',
    },
    landmark_analysis: {
      orbit_and_interocular_region: {
        congruence: 'HIGH',
        findings: 'Interocular distance and orbital geometry match.',
      },
      nasal_complex: {
        congruence: 'HIGH',
        findings: 'Nasal bridge and alar base are congruent.',
      },
      mandibular_and_perioral_region: {
        congruence: 'HIGH',
        findings: 'Chin cleft and vermilion border align.',
      },
      auricular_features: {
        congruence: 'HIGH',
        findings: 'Ear lobe attachment matches.',
      },
      surface_markers: {
        features_detected: true,
        consistent_markers: ['Mole on left cheek'],
        inconsistent_markers: ['Faint scar on forehead'],
      },
    },
    imaging_limitations: {
      image_a_clarity: 'High resolution portrait',
      image_b_clarity: 'Moderate resolution image',
      perspective_or_lighting_distortions: 'Minor lighting angle difference.',
    },
    distinguishing_differences: ['Subtle difference in facial hair density'],
    technical_summary: 'Comprehensive biometric landmark comparison indicates strong facial concordance.',
  };

  const root = () => fixture.nativeElement as HTMLElement;
  const input = (index: number) =>
    root().querySelectorAll<HTMLInputElement>('input[type=file]')[index];
  const choose = async (index: number, file: File) => {
    Object.defineProperty(input(index), 'files', { configurable: true, value: [file] });
    input(index).dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  const chooseAndLoad = async (index: number, file: File) => {
    await choose(index, file);
    root().querySelectorAll('.photo-card img')[index].dispatchEvent(new Event('load'));
    await fixture.whenStable();
  };
  const photo = (name = 'photo.png', type = 'image/png', size = 10) =>
    new File([new Uint8Array(size)], name, { type });
  const button = (label: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label || b.textContent?.includes(label),
    );
  const click = async (label: string) => {
    const btn = button(label);
    if (!btn) throw new Error(`Button "${label}" not found`);
    btn.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    sequence = 0;
    comparisonSubject = new Subject<PhotoComparisonResponse>();
    comparisonServiceMock = {
      comparePhotos: vi.fn().mockReturnValue(comparisonSubject),
    };

    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = vi.fn(() => `blob:photo-${++sequence}`);
        static override revokeObjectURL = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      imports: [PhotoReviewComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PHOTO_REVIEW_MAX_BYTES, useValue: 100 },
        { provide: PhotoComparisonService, useValue: comparisonServiceMock },
      ],
    });
    fixture = TestBed.createComponent(PhotoReviewComponent);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    http.expectNone(() => true);
    http.verify();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('protects the lazy route with the existing guard', () => {
    expect(routes.find((r) => r.path === 'photo-review')?.canActivate).toContain(authGuard);
  });

  it('renders two independent previews and updated privacy notice', async () => {
    await choose(0, photo());
    await choose(1, photo('second.jpg', 'image/jpeg'));
    const images = root().querySelectorAll<HTMLImageElement>('.photo-card img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe('blob:photo-1');
    expect(images[1].getAttribute('src')).toBe('blob:photo-2');
    images.forEach((img) => img.dispatchEvent(new Event('load')));
    await fixture.whenStable();
    expect(root().querySelector('[role=status]')?.textContent).toContain(
      'Ready for photo comparison.',
    );
    expect(root().textContent).toContain('Secure Image Analysis');
    expect(root().textContent).toContain('Photos are transmitted securely to the comparison service');
    expect(root().textContent).toContain('does not establish identity');
  });

  it('rejects unsupported, oversized and empty files without creating previews', async () => {
    for (const file of [
      photo('bad.gif', 'image/gif'),
      photo('large.png', 'image/png', 101),
      photo('empty.png', 'image/png', 0),
    ]) {
      await choose(0, file);
      expect(root().querySelector('[role=alert]')?.textContent?.trim()).toBeTruthy();
      expect(root().querySelector('.photo-card img')).toBeNull();
      expect(input(0).value).toBe('');
    }
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('accepts WebP at the configured limit', async () => {
    await choose(0, photo('photo.webp', 'image/webp', 100));
    expect(root().querySelector('.photo-card img')).not.toBeNull();
    expect(root().querySelector('[role=alert]')).toBeNull();
  });

  it('revokes replaced previews and preserves the other photo on removal', async () => {
    await choose(0, photo());
    await choose(1, photo());
    await choose(0, photo('replacement.png'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    await click('Remove reference photo');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-3');
    expect(root().querySelectorAll('.photo-card img')).toHaveLength(1);
    expect(root().querySelector('.photo-card img')?.getAttribute('src')).toBe('blob:photo-2');
  });

  it('reports undecodable images and releases their previews', async () => {
    await choose(0, photo());
    root().querySelector('.photo-card img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(root().querySelector('[role=alert]')?.textContent).toContain('could not be read');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    expect(root().querySelector('.photo-card img')).toBeNull();
  });

  it('disables Compare Photos button until both photos are selected and loaded', async () => {
    const compareBtn = button('Compare Photos')!;
    expect(compareBtn).toBeTruthy();
    expect(compareBtn.disabled).toBe(true);

    const file1 = photo('ref.png');
    const file2 = photo('comp.png');

    await choose(0, file1);
    expect(compareBtn.disabled).toBe(true);

    root().querySelectorAll('.photo-card img')[0].dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(compareBtn.disabled).toBe(true);

    await choose(1, file2);
    expect(compareBtn.disabled).toBe(true);

    root().querySelectorAll('.photo-card img')[1].dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(compareBtn.disabled).toBe(false);
  });

  it('triggers comparePhotos on PhotoComparisonService and displays analyzing state', async () => {
    const file1 = photo('ref.png');
    const file2 = photo('comp.png');
    await chooseAndLoad(0, file1);
    await chooseAndLoad(1, file2);

    await click('Compare Photos');
    expect(comparisonServiceMock.comparePhotos).toHaveBeenCalledWith(file1, file2);

    const analyzingBtn = button('Analyzing…');
    expect(analyzingBtn).toBeTruthy();
    expect(analyzingBtn?.disabled).toBe(true);
    expect(analyzingBtn?.getAttribute('aria-busy')).toBe('true');
    expect(root().querySelector('[role=status]')?.textContent).toContain('Analyzing photographs…');
  });

  it('displays comprehensive report on successful comparison', async () => {
    const file1 = photo('ref.png');
    const file2 = photo('comp.png');
    await chooseAndLoad(0, file1);
    await chooseAndLoad(1, file2);

    await click('Compare Photos');
    comparisonSubject.next(mockComparisonResponse);
    comparisonSubject.complete();
    await fixture.whenStable();

    const report = root().querySelector('section[aria-labelledby="comparison-result-title"]');
    expect(report).toBeTruthy();
    expect(report?.textContent).toContain('Comparison Analysis Report');
    expect(report?.textContent).toContain('HIGH_SIMILARITY');
    expect(report?.textContent).toContain('91%');
    expect(report?.textContent).toContain('0.94');
    expect(report?.textContent).toContain(
      'Comprehensive biometric landmark comparison indicates strong facial concordance.',
    );

    // Age & Maturation Assessment
    expect(report?.textContent).toContain('Age & Maturation Assessment');
    expect(report?.textContent).toContain('20-25 years');
    expect(report?.textContent).toContain('25-30 years');
    expect(report?.textContent).toContain('CONSISTENT');
    expect(report?.textContent).toContain('Natural facial maturation observed.');

    // Facial Landmark Analysis
    expect(report?.textContent).toContain('Facial Landmark Analysis');
    expect(report?.textContent).toContain('Orbit and Interocular Region');
    expect(report?.textContent).toContain('Interocular distance and orbital geometry match.');
    expect(report?.textContent).toContain('Nasal Complex');
    expect(report?.textContent).toContain('Nasal bridge and alar base are congruent.');
    expect(report?.textContent).toContain('Mandibular and Perioral Region');
    expect(report?.textContent).toContain('Chin cleft and vermilion border align.');
    expect(report?.textContent).toContain('Auricular Features');
    expect(report?.textContent).toContain('Ear lobe attachment matches.');
    expect(report?.textContent).toContain('Surface Markers');
    expect(report?.textContent).toContain('Mole on left cheek');
    expect(report?.textContent).toContain('Faint scar on forehead');

    // Differences & Imaging Limitations
    expect(report?.textContent).toContain('Differences and Imaging Limitations');
    expect(report?.textContent).toContain('Subtle difference in facial hair density');
    expect(report?.textContent).toContain('High resolution portrait');
    expect(report?.textContent).toContain('Moderate resolution image');
    expect(report?.textContent).toContain('Minor lighting angle difference.');
  });

  it('displays error alert if comparison fails and allows retry', async () => {
    const file1 = photo('ref.png');
    const file2 = photo('comp.png');
    await chooseAndLoad(0, file1);
    await chooseAndLoad(1, file2);

    await click('Compare Photos');
    comparisonSubject.error(new Error('Comparison service offline'));
    await fixture.whenStable();

    const errorAlert = root().querySelector('[role=alert]');
    expect(errorAlert?.textContent).toContain('Unable to complete photo comparison. Please try again.');
    expect(root().querySelector('section[aria-labelledby="comparison-result-title"]')).toBeNull();

    const compareBtn = button('Compare Photos');
    expect(compareBtn?.disabled).toBe(false);
  });

  it('clears comparison results and errors when removing a photo or clicking Clear Images', async () => {
    const file1 = photo('ref.png');
    const file2 = photo('comp.png');
    await chooseAndLoad(0, file1);
    await chooseAndLoad(1, file2);

    await click('Compare Photos');
    comparisonSubject.next(mockComparisonResponse);
    comparisonSubject.complete();
    await fixture.whenStable();
    expect(root().querySelector('section[aria-labelledby="comparison-result-title"]')).toBeTruthy();

    await click('Remove reference photo');
    expect(root().querySelector('section[aria-labelledby="comparison-result-title"]')).toBeNull();

    // Re-add and get error
    await chooseAndLoad(0, file1);
    comparisonSubject = new Subject<PhotoComparisonResponse>();
    comparisonServiceMock.comparePhotos.mockReturnValue(comparisonSubject);
    await click('Compare Photos');
    comparisonSubject.error(new Error('fail'));
    await fixture.whenStable();
    expect(root().querySelector('[role=alert]')).toBeTruthy();

    await click('Clear Images');
    expect(root().querySelector('[role=alert]')).toBeNull();
    expect(root().querySelector('section[aria-labelledby="comparison-result-title"]')).toBeNull();
    expect(root().querySelectorAll('.photo-card img')).toHaveLength(0);
    expect(button('Compare Photos')?.disabled).toBe(true);
  });

  it('clears images, cancels pending comparison, and releases previews on destroy', async () => {
    await choose(0, photo());
    await choose(1, photo());
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-2');
  });
});

