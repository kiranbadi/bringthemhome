import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { PhotoReviewComponent, PHOTO_REVIEW_MAX_BYTES } from './photo-review.component';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/auth/auth.guard';

describe('Photo review', () => {
  let fixture: ComponentFixture<PhotoReviewComponent>;
  let http: HttpTestingController;
  let sequence: number;
  const root = () => fixture.nativeElement as HTMLElement;
  const input = (index: number) =>
    root().querySelectorAll<HTMLInputElement>('input[type=file]')[index];
  const choose = async (index: number, file: File) => {
    Object.defineProperty(input(index), 'files', { configurable: true, value: [file] });
    input(index).dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  const photo = (name = 'photo.png', type = 'image/png', size = 10) =>
    new File([new Uint8Array(size)], name, { type });
  const click = async (label: string) => {
    const button = [...root().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    )!;
    button.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sessionStorage.clear();
    sequence = 0;
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

  it('renders two independent previews and local-only privacy information', async () => {
    await choose(0, photo());
    await choose(1, photo('second.jpg', 'image/jpeg'));
    const images = root().querySelectorAll<HTMLImageElement>('.photo-card img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe('blob:photo-1');
    expect(images[1].getAttribute('src')).toBe('blob:photo-2');
    images.forEach((img) => img.dispatchEvent(new Event('load')));
    await fixture.whenStable();
    expect(root().querySelector('[role=status]')?.textContent).toContain(
      'Ready for side-by-side review',
    );
    expect(root().textContent).toContain('not uploaded');
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

  it('clears images and validation errors and releases remaining previews on destroy', async () => {
    await choose(0, photo());
    await choose(1, photo('bad.gif', 'image/gif'));
    await click('Clear Images');
    expect(root().querySelector('.photo-card img')).toBeNull();
    expect(root().querySelector('[role=alert]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
    expect(input(0).value).toBe('');
    await choose(1, photo());
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-2');
  });
});
