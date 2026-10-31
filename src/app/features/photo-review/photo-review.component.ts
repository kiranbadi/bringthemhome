import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NavigationHeader } from '../../shared/navigation-header/navigation-header';
import { Subscription, finalize, take } from 'rxjs';
import { PhotoQuality, PhotoQualityResponse } from './photo-quality';

export const PHOTO_REVIEW_MAX_BYTES = new InjectionToken<number>(
  'Photo review maximum image bytes',
  {
    providedIn: 'root',
    factory: () => 5 * 1024 * 1024,
  },
);

type PhotoIndex = 0 | 1;
interface PhotoSlot {
  readonly file?: File;
  readonly url: string;
  readonly name: string;
  readonly loaded: boolean;
  readonly error: string;
}
const emptyPhoto = (): PhotoSlot => ({ url: '', name: '', loaded: false, error: '' });

@Component({
  selector: 'app-photo-review',
  imports: [MatButtonModule, NavigationHeader],
  templateUrl: './photo-review.component.html',
  styleUrl: './photo-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoReviewComponent {
  private readonly qualityService = inject(PhotoQuality);
  private qualityRequest?: Subscription;
  protected readonly checkingQuality = signal(false);
  protected readonly qualityResult = signal<PhotoQualityResponse | null>(null);
  protected readonly qualityError = signal('');
  protected readonly maxBytes = inject(PHOTO_REVIEW_MAX_BYTES);
  protected readonly maxSizeLabel = `${Number((this.maxBytes / 1024 / 1024).toFixed(2))} MB`;
  protected readonly cards = [
    { index: 0, title: 'Reference Photo', label: 'reference photo' },
    { index: 1, title: 'Comparison Photo', label: 'comparison photo' },
  ] as const;
  protected readonly photos = signal<readonly PhotoSlot[]>([emptyPhoto(), emptyPhoto()]);
  protected readonly ready = computed(() => this.photos().every((photo) => photo.loaded));
  protected readonly hasContent = computed(() =>
    this.photos().some((photo) => photo.url || photo.error),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  protected select(index: PhotoIndex, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.remove(index);
    let error = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error = 'Choose a JPEG, PNG, or WebP image.';
    } else if (file.size === 0) {
      error = 'This file is empty. Choose another image.';
    } else if (file.size > this.maxBytes) {
      error = `Choose an image no larger than ${this.maxSizeLabel}.`;
    }
    if (error) {
      this.update(index, { ...emptyPhoto(), error });
      return;
    }
    try {
      this.update(index, {
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        loaded: false,
        error: '',
      });
    } catch {
      this.update(index, {
        ...emptyPhoto(),
        error: 'This image could not be opened. Choose another image.',
      });
    }
  }

  protected imageLoaded(index: PhotoIndex, url: string): void {
    const photo = this.photos()[index];
    if (photo.url === url) this.update(index, { ...photo, loaded: true });
  }

  protected imageFailed(index: PhotoIndex, url: string): void {
    if (this.photos()[index].url !== url) return;
    this.remove(index);
    this.update(index, {
      ...emptyPhoto(),
      error: 'This image could not be read. Choose a valid JPEG, PNG, or WebP image.',
    });
  }

  protected remove(index: PhotoIndex): void {
    this.resetQuality();
    const url = this.photos()[index].url;
    if (url) URL.revokeObjectURL(url);
    this.update(index, emptyPhoto());
  }

  protected clear(): void {
    this.remove(0);
    this.remove(1);
  }

  protected checkQuality(): void {
    if (!this.ready() || this.checkingQuality()) return;
    const [reference, comparison] = this.photos();
    if (!reference.file || !comparison.file) return;
    this.resetQuality();
    this.checkingQuality.set(true);
    this.qualityRequest = this.qualityService
      .checkPhotos(reference.file, comparison.file)
      .pipe(
        take(1),
        finalize(() => this.checkingQuality.set(false)),
      )
      .subscribe({
        next: (result) => this.qualityResult.set(result),
        error: () =>
          this.qualityError.set('The demo quality check could not complete. Please try again.'),
      });
  }

  private resetQuality(): void {
    this.qualityRequest?.unsubscribe();
    this.qualityRequest = undefined;
    this.checkingQuality.set(false);
    this.qualityResult.set(null);
    this.qualityError.set('');
  }

  private update(index: PhotoIndex, photo: PhotoSlot): void {
    this.photos.update((photos) => photos.map((current, i) => (i === index ? photo : current)));
  }
}
