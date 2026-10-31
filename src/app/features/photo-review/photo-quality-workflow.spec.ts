import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { PhotoReviewComponent } from './photo-review.component';
import { PhotoQuality, PhotoQualityResponse } from './photo-quality';

describe('Photo review quality demo workflow', () => {
  let fixture: ComponentFixture<PhotoReviewComponent>;
  let response: Subject<PhotoQualityResponse>;
  const checkPhotos = vi.fn();
  const reference = new File(['reference'], 'reference.png', { type: 'image/png' });
  const comparison = new File(['comparison'], 'comparison.png', { type: 'image/png' });
  const demo: PhotoQualityResponse = {
    mode: 'demo',
    reference: { name: reference.name, sizeBytes: reference.size },
    comparison: { name: comparison.name, sizeBytes: comparison.size },
    message: 'Demo response only. Image quality has not been analyzed.',
  };
  const root = () => fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    )!;
  const choose = async (index: number, file: File) => {
    const input = root().querySelectorAll<HTMLInputElement>('input[type=file]')[index];
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    root().querySelectorAll('.photo-card img')[index].dispatchEvent(new Event('load'));
    await fixture.whenStable();
  };
  const ready = async () => {
    await choose(0, reference);
    await choose(1, comparison);
  };

  beforeEach(async () => {
    response = new Subject<PhotoQualityResponse>();
    checkPhotos.mockReset().mockReturnValue(response);
    let sequence = 0;
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = vi.fn(() => `blob:quality-${++sequence}`);
        static override revokeObjectURL = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      imports: [PhotoReviewComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PhotoQuality, useValue: { checkPhotos } },
      ],
    });
    fixture = TestBed.createComponent(PhotoReviewComponent);
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    vi.unstubAllGlobals();
  });

  it('requires two decoded images and only calls the mock after a click', async () => {
    expect(button('Check Image Quality').disabled).toBe(true);
    await ready();
    expect(button('Check Image Quality').disabled).toBe(false);
    expect(checkPhotos).not.toHaveBeenCalled();
    button('Check Image Quality').click();
    button('Check Image Quality').click();
    await fixture.whenStable();
    expect(checkPhotos).toHaveBeenCalledExactlyOnceWith(reference, comparison);
    expect(button('Checking').disabled).toBe(true);
    expect(root().querySelector('[aria-busy="true"]')).not.toBeNull();
    response.next(demo);
    response.complete();
    await fixture.whenStable();
    expect(root().querySelector('.quality-result')?.textContent).toContain(
      'Image quality has not been analyzed',
    );
    expect(button('Check Image Quality').disabled).toBe(false);
  });

  it('shows a safe error, preserves previews, and allows retry', async () => {
    await ready();
    button('Check Image Quality').click();
    response.error(new Error('internal server secret'));
    await fixture.whenStable();
    expect(root().querySelector('[role=alert]')?.textContent).toContain('Please try again');
    expect(root().textContent).not.toContain('internal server secret');
    expect(root().querySelectorAll('.photo-card img')).toHaveLength(2);
    expect(button('Check Image Quality').disabled).toBe(false);
  });

  it('cancels pending work and removes stale results on clear', async () => {
    await ready();
    button('Check Image Quality').click();
    expect(response.observed).toBe(true);
    button('Clear Images').click();
    expect(response.observed).toBe(false);
    response.next(demo);
    await fixture.whenStable();
    expect(root().querySelector('.quality-result')).toBeNull();
    expect(root().querySelectorAll('.photo-card img')).toHaveLength(0);
    expect(button('Check Image Quality').disabled).toBe(true);
  });

  it('invalidates results on replacement and cancels pending work on destruction', async () => {
    await ready();
    button('Check Image Quality').click();
    response.next(demo);
    response.complete();
    await fixture.whenStable();
    await choose(0, reference);
    expect(root().querySelector('.quality-result')).toBeNull();
    response = new Subject<PhotoQualityResponse>();
    checkPhotos.mockReturnValue(response);
    button('Check Image Quality').click();
    expect(response.observed).toBe(true);
    fixture.destroy();
    expect(response.observed).toBe(false);
  });
});
