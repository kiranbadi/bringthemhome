import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CaseShareData, CaseShareService } from './case-share.service';

@Component({
  selector: 'app-case-share-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <div>
        <h2 mat-dialog-title>Share this case</h2>
        <p>Help this person reach someone who knows.</p>
      </div>
      <button type="button" mat-dialog-close aria-label="Close share dialog" class="close">
        ×
      </button>
    </header>
    <mat-dialog-content>
      <section class="preview" aria-label="Case preview">
        <img
          [src]="photo()"
          [alt]="data.title"
          (error)="photo.set('/missing-person-placeholder.svg')"
        />
        <div>
          <span class="eyebrow">MISSING PERSON</span>
          <h3>{{ data.title }}</h3>
          <p>{{ data.location || 'Location unavailable' }}</p>
        </div>
      </section>
      <p class="caption">Choose where to share</p>
      <div class="platforms">
        @for (link of links; track link.label; let i = $index) {
          <a
            class="platform"
            [href]="link.url"
            target="_blank"
            rel="noopener noreferrer"
            [attr.aria-label]="'Share on ' + link.label + ' (opens in a new tab)'"
          >
            <span class="badge" [class]="'badge brand-' + i" aria-hidden="true">{{
              badges[i]
            }}</span
            >{{ link.label }}</a
          >
        }
        @for (app of deviceApps; track app.label) {
          <button
            type="button"
            class="platform app-option"
            (click)="shareToApp(app.label)"
            [attr.aria-label]="
              app.label +
              (service.nativeAvailable
                ? ': choose in device share menu'
                : ': copy message to paste')
            "
          >
            <span
              class="badge"
              [style.background]="app.color"
              [style.color]="app.textColor"
              aria-hidden="true"
              >{{ app.badge }}</span
            >
            {{ app.label }}
          </button>
        }
      </div>
      <p class="app-hint">
        Instagram, Snapchat and Signal: choose the app in your device’s share menu, or copy the
        message to paste. Use Download case image for a photo post.
      </p>
      <div class="actions">
        <button type="button" (click)="copyMessage()">Copy message</button>
        <button type="button" (click)="copyLink()">Copy link</button>
        <button type="button" (click)="download()" [disabled]="downloading()">
          {{ downloading() ? 'Preparing image…' : 'Download case image' }}
        </button>
      </div>
      @if (service.nativeAvailable) {
        <button class="more" type="button" (click)="nativeShare()">More sharing options</button>
      }
      <p role="status" aria-live="polite" class="status">{{ message() }}</p>
    </mat-dialog-content>
  `,
  styles: `
    :host {
      display: block;
      color: #172e50;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      padding: 20px 22px 12px;
    }
    h2[mat-dialog-title] {
      padding: 0;
      font-size: 22px;
      font-weight: 750;
      line-height: 1.3;
    }
    h2::before {
      display: none;
    }
    header p {
      margin: 6px 0 0;
      font-size: 13px;
      color: #64748b;
    }
    .close {
      border: 0;
      font-size: 25px;
      padding: 0 6px;
      background: transparent;
    }
    mat-dialog-content {
      padding: 4px 22px 20px;
    }
    .preview {
      display: flex;
      gap: 14px;
      align-items: center;
      background: #f1f5f9;
      padding: 14px;
      border-radius: 12px;
    }
    img {
      width: 74px;
      height: 88px;
      object-fit: cover;
      border-radius: 8px;
    }
    h3 {
      margin: 4px 0;
      font-size: 18px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .preview p {
      font-size: 13px;
      margin: 0;
      color: #475569;
    }
    .eyebrow {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      color: #b45309;
    }
    .caption {
      font-size: 13px;
      margin: 18px 0 12px;
      color: #64748b;
    }
    .platforms {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .platform {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 7px;
      text-decoration: none;
      font-size: 12px;
      color: #172e50;
      padding: 5px 0;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-size: 21px;
      font-weight: 800;
      color: white;
    }
    .app-option {
      border: 0;
      background: transparent;
    }
    .app-hint {
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
      margin: 12px 0 0;
    }
    .brand-4 {
      background: #d93a00;
    }
    .brand-5 {
      background: #1686b0;
    }
    .brand-0 {
      background: #128c4b;
    }
    .brand-1 {
      background: #1877f2;
    }
    .brand-2 {
      background: #111827;
    }
    .brand-3 {
      background: #0a66c2;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 20px;
    }
    .actions button:last-child {
      grid-column: 1 / -1;
    }
    button {
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      color: #172e50;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
    }
    button:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    .more {
      width: 100%;
      margin-top: 8px;
      border: 0;
      background: #eef2ff;
    }
    a:focus-visible,
    button:focus-visible {
      outline: 3px solid #2563eb;
      outline-offset: 3px;
    }
    .status {
      font-size: 12px;
      color: #475569;
      overflow-wrap: anywhere;
      margin-bottom: 0;
    }
    .status:empty {
      margin: 0;
    }
  `,
})
export class CaseShareDialog {
  readonly data = inject<CaseShareData & { location: string; image: string }>(MAT_DIALOG_DATA);
  readonly service = inject(CaseShareService);
  readonly photo = signal(this.data.image || '/missing-person-placeholder.svg');
  readonly links = this.service.links(this.data);
  readonly badges = ['W', 'f', '𝕏', 'in', 'r', '➤'];
  readonly deviceApps = [
    { label: 'Instagram', badge: '◎', color: '#c13584', textColor: 'white' },
    { label: 'Snapchat', badge: 'S', color: '#fffc00', textColor: '#172e50' },
    { label: 'Signal', badge: 'S', color: '#3a76f0', textColor: 'white' },
  ];
  async shareToApp(app: string) {
    if (this.service.nativeAvailable) {
      this.message.set(await this.service.share(this.data));
    } else {
      const result = await this.service.copyMessage(this.data);
      this.message.set(
        result.startsWith('Case message copied')
          ? `Message copied. Open ${app} and paste it. For a photo post, download the case image.`
          : result,
      );
    }
  }
  readonly message = signal('');
  readonly downloading = signal(false);
  async copyLink() {
    this.message.set(await this.service.copy(this.data));
  }
  async copyMessage() {
    this.message.set(await this.service.copyMessage(this.data));
  }
  async nativeShare() {
    this.message.set(await this.service.share(this.data));
  }
  async download() {
    if (this.downloading()) return;
    this.downloading.set(true);
    try {
      this.message.set(await this.service.downloadImage(this.data, this.photo()));
    } catch {
      this.message.set(
        'The image could not be downloaded. Please copy the message or link instead.',
      );
    } finally {
      this.downloading.set(false);
    }
  }
}
