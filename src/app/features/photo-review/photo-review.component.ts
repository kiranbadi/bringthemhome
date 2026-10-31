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
import { PhotoComparisonService } from './photo-comparison.service';
import { PhotoComparisonResponse } from './photo-comparison.types';

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
  private readonly comparisonService = inject(PhotoComparisonService);
  private comparisonRequest?: Subscription;
  protected readonly comparing = signal(false);
  protected readonly comparisonResult = signal<PhotoComparisonResponse | null>(null);
  protected readonly comparisonError = signal('');
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
    this.resetComparison();
    const url = this.photos()[index].url;
    if (url) URL.revokeObjectURL(url);
    this.update(index, emptyPhoto());
  }

  protected clear(): void {
    this.remove(0);
    this.remove(1);
  }

  protected compare(): void {
    if (!this.ready() || this.comparing()) return;
    const [reference, comparison] = this.photos();
    if (!reference.file || !comparison.file) return;
    this.resetComparison();
    this.comparing.set(true);
    this.comparisonRequest = this.comparisonService
      .comparePhotos(reference.file, comparison.file)
      .pipe(
        take(1),
        finalize(() => this.comparing.set(false)),
      )
      .subscribe({
        next: (result) => this.comparisonResult.set(result),
        error: () =>
          this.comparisonError.set('Unable to complete photo comparison. Please try again.'),
      });
  }

  protected similarityBadgeClass(classification: string): string {
    switch (classification) {
      case 'HIGH_SIMILARITY':
        return 'badge-high';
      case 'MODERATE_SIMILARITY':
        return 'badge-moderate';
      case 'LOW_SIMILARITY':
        return 'badge-low';
      default:
        return 'badge-default';
    }
  }

  protected congruenceBadgeClass(congruence: string): string {
    switch (congruence) {
      case 'HIGH':
        return 'badge-high';
      case 'MODERATE':
        return 'badge-moderate';
      case 'LOW':
        return 'badge-low';
      default:
        return 'badge-default';
    }
  }

  private resetComparison(): void {
    this.comparisonRequest?.unsubscribe();
    this.comparisonRequest = undefined;
    this.comparing.set(false);
    this.comparisonResult.set(null);
    this.comparisonError.set('');
  }

  private update(index: PhotoIndex, photo: PhotoSlot): void {
    this.photos.update((photos) => photos.map((current, i) => (i === index ? photo : current)));
  }
}

