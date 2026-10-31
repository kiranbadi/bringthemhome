import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { PhotoQuality } from './photo-quality';

describe('Photo quality demo service', () => {
  afterEach(() => vi.useRealTimers());

  it('accepts both files and returns an asynchronous, explicitly simulated response', async () => {
    vi.useFakeTimers();
    const reference = new File(['reference'], 'reference.png', { type: 'image/png' });
    const comparison = new File(['comparison'], 'comparison.webp', { type: 'image/webp' });
    let completed = false;
    const response = firstValueFrom(
      TestBed.inject(PhotoQuality).checkPhotos(reference, comparison),
    );
    response.then(
      () => {
        completed = true;
      },
      () => {},
    );
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(response).resolves.toEqual({
      mode: 'demo',
      reference: { name: reference.name, sizeBytes: reference.size },
      comparison: { name: comparison.name, sizeBytes: comparison.size },
      message: 'Demo response only. Image quality has not been analyzed.',
    });
  });

  it('cancels the simulated response when unsubscribed', async () => {
    vi.useFakeTimers();
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    const next = vi.fn();
    const subscription = TestBed.inject(PhotoQuality).checkPhotos(file, file).subscribe(next);
    subscription.unsubscribe();
    await vi.advanceTimersByTimeAsync(1000);
    expect(next).not.toHaveBeenCalled();
  });
});
