import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Attachment, readyMedia } from './discussion.models';
@Component({
  selector: 'app-discussion-media',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="media">
      @for (attachment of visible(); track attachment.id) {
        @if (attachment.media_type === 'image') {
          <button
            type="button"
            class="thumbnail"
            (click)="open(attachment.display_url)"
            aria-label="Enlarge attached image"
          >
            <img [src]="attachment.display_url" alt="Image attached to discussion" loading="lazy" />
          </button>
        } @else {
          <video
            [src]="attachment.display_url"
            controls
            preload="metadata"
            aria-label="Video attached to discussion"
          ></video>
        }
      }
    </div>
    <ng-template #preview let-url
      ><mat-dialog-content
        ><img class="large" [src]="url" alt="Enlarged discussion attachment" /></mat-dialog-content
      ><mat-dialog-actions
        ><button matButton mat-dialog-close>Close image</button></mat-dialog-actions
      ></ng-template
    >
  `,
  styles: [
    `
      .media {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 12px 0;
      }
      .thumbnail {
        border: 0;
        background: transparent;
        cursor: zoom-in;
        padding: 0;
      }
      img,
      video {
        width: 100%;
        max-height: 300px;
        object-fit: contain;
        border-radius: 8px;
      }
      .large {
        max-height: 75dvh;
        width: auto;
        max-width: 100%;
      }
    `,
  ],
})
export class DiscussionMediaComponent {
  readonly attachments = input<Attachment[]>([]);
  readonly visible = computed(() => readyMedia(this.attachments()));
  private readonly dialog = inject(MatDialog);
  @ViewChild('preview') private preview!: TemplateRef<{ $implicit: string }>;
  open(url: string): void {
    this.dialog.open(this.preview, {
      data: url,
      width: '900px',
      maxWidth: '96vw',
      ariaLabel: 'Discussion image preview',
    });
  }
}
