import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  output,
  signal,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { validateMedia } from './discussion.models';

@Component({
  selector: 'app-discussion-media-upload',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="upload">
      <label
        >Attachments (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4"
          multiple
          [disabled]="disabled() || checking()"
          (change)="select($event)"
        />
      </label>
      <p>
        Up to 3 images (5 MB each), or 1 MP4 video (25 MB, 30 seconds). Only share public
        information.
      </p>
      @if (checking()) {
        <p role="status">Checking video duration…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <div class="previews">
        @for (entry of previews(); track entry.url; let i = $index) {
          <figure>
            @if (entry.file.type.startsWith('image/')) {
              <img [src]="entry.url" [alt]="entry.file.name" />
            } @else {
              <video [src]="entry.url" controls preload="metadata"></video>
            }
            <figcaption>{{ entry.file.name }}</figcaption>
            <button
              matButton
              type="button"
              [disabled]="disabled() || checking()"
              (click)="remove(i)"
            >
              Remove {{ entry.file.name }}
            </button>
          </figure>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      input {
        display: block;
        margin-top: 0.6rem;
        max-width: 100%;
      }
      p {
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant, #555);
      }
      .previews {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      figure {
        margin: 0;
        min-width: 0;
      }
      img,
      video {
        width: 100%;
        height: 140px;
        object-fit: contain;
        border-radius: 8px;
      }
      figcaption {
        overflow-wrap: anywhere;
        font-size: 0.8rem;
      }
      [role='alert'] {
        color: var(--mat-sys-error, #a00);
      }
    `,
  ],
})
export class DiscussionMediaUploadComponent implements OnDestroy {
  readonly disabled = input(false);
  readonly filesChanged = output<File[]>();
  readonly checkingChanged = output<boolean>();
  readonly previews = signal<{ file: File; url: string }[]>([]);
  readonly error = signal('');
  readonly checking = signal(false);
  private generation = 0;
  async select(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = [...this.previews().map((p) => p.file), ...Array.from(input.files ?? [])];
    input.value = '';
    this.error.set(validateMedia(files));
    if (this.error()) return;
    const generation = ++this.generation;
    this.checking.set(true);
    this.checkingChanged.emit(true);
    try {
      const video = files.find((f) => f.type === 'video/mp4');
      if (video && !(await this.shortVideo(video))) {
        this.error.set('Choose a readable MP4 video no longer than 30 seconds.');
        return;
      }
      if (generation !== this.generation) return;
      this.clear();
      this.previews.set(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
      this.filesChanged.emit(files);
    } finally {
      if (generation === this.generation) {
        this.checking.set(false);
        this.checkingChanged.emit(false);
      }
    }
  }
  remove(index: number): void {
    const entries = [...this.previews()];
    URL.revokeObjectURL(entries[index].url);
    entries.splice(index, 1);
    this.previews.set(entries);
    this.error.set('');
    this.filesChanged.emit(entries.map((p) => p.file));
  }
  reset(): void {
    this.clear();
    this.previews.set([]);
    this.filesChanged.emit([]);
  }
  private shortVideo(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const player = document.createElement('video');
      const url = URL.createObjectURL(file);
      const finish = (valid: boolean) => {
        clearTimeout(timeout);
        player.onloadedmetadata = null;
        player.onerror = null;
        player.removeAttribute('src');
        player.load();
        URL.revokeObjectURL(url);
        resolve(valid);
      };
      const timeout = setTimeout(() => finish(false), 10000);
      player.preload = 'metadata';
      player.onloadedmetadata = () =>
        finish(Number.isFinite(player.duration) && player.duration > 0 && player.duration <= 30);
      player.onerror = () => finish(false);
      player.src = url;
    });
  }
  private clear(): void {
    this.previews().forEach((p) => URL.revokeObjectURL(p.url));
  }
  ngOnDestroy(): void {
    ++this.generation;
    this.clear();
  }
}
