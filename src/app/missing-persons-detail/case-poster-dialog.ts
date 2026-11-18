import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CasePosterData, posterPdf, renderPoster } from './case-poster';

@Component({
  selector: 'app-case-poster-dialog',
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule],
  template: `
    <h2 mat-dialog-title>Missing person poster</h2>
    <mat-dialog-content>
      @if (loading()) {
        <p role="status">Preparing poster…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @if (image(); as preview) {
        @if (photoMissing() || data.phone === 'Not provided') {
          <div class="notice" role="status">
            @if (photoMissing()) {
              <p>A usable photo is unavailable for this poster.</p>
            }
            @if (data.phone === 'Not provided') {
              <p>The case has no public police contact number.</p>
            }
            <mat-checkbox [checked]="acknowledged()" (change)="acknowledged.set($event.checked)">
              Continue with these details missing
            </mat-checkbox>
          </div>
        }
        <figure>
          <img
            [src]="preview"
            [alt]="'Missing person poster for ' + data.name"
            width="612"
            height="792"
          />
          <figcaption>
            US Letter · {{ data.name }} · {{ data.agency }} · {{ data.phone }}
            <a [href]="data.caseUrl" target="_blank" rel="noopener noreferrer"
              >Current case details</a
            >
          </figcaption>
        </figure>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close [disabled]="saving()">Close</button>
      @if (error() && !image()) {
        <button matButton (click)="prepare()">Try again</button>
      }
      <button matButton="outlined" (click)="print()" [disabled]="!ready() || saving()">
        Print
      </button>
      <button matButton="filled" (click)="download()" [disabled]="!ready() || saving()">
        {{ saving() ? 'Creating PDF…' : 'Download PDF' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      max-height: 70vh;
    }
    figure {
      margin: 12px 0 0;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid #d3deed;
    }
    figcaption {
      margin-top: 10px;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    figcaption a {
      display: block;
    }
    .notice {
      padding: 12px;
      background: #fff5df;
      border-radius: 8px;
    }
    .notice p {
      margin: 0 0 6px;
    }
    [role='alert'] {
      color: #a32424;
    }
    mat-dialog-actions {
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasePosterDialog implements OnInit {
  readonly data = inject<CasePosterData>(MAT_DIALOG_DATA);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly image = signal('');
  readonly photoMissing = signal(false);
  readonly acknowledged = signal(false);

  ngOnInit() {
    void this.prepare();
  }

  ready() {
    return (
      !!this.image() &&
      ((!this.photoMissing() && this.data.phone !== 'Not provided') || this.acknowledged())
    );
  }

  async prepare() {
    this.loading.set(true);
    this.error.set('');
    this.acknowledged.set(false);
    try {
      const preview = await renderPoster(this.data);
      if (this.destroy.destroyed) return;
      this.image.set(preview.image);
      this.photoMissing.set(preview.photoMissing);
    } catch {
      if (!this.destroy.destroyed)
        this.error.set('Could not prepare this poster. Please try again.');
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }

  async download() {
    if (!this.ready() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const bytes = await posterPdf(this.image());
      if (this.destroy.destroyed) return;
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'missing-person-poster.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (!this.destroy.destroyed) this.error.set('Could not download the PDF. Please try again.');
    } finally {
      if (!this.destroy.destroyed) this.saving.set(false);
    }
  }

  print() {
    if (!this.ready()) return;
    this.error.set('');
    const frame = document.createElement('iframe');
    frame.title = 'Print missing person poster';
    frame.style.cssText = 'position:fixed;left:-10000px;width:816px;height:1056px;border:0;';
    frame.onload = () => {
      const content = frame.contentDocument;
      const printWindow = frame.contentWindow;
      if (!content || !printWindow) {
        frame.remove();
        this.error.set('Printing is unavailable. Download the PDF to print it.');
        return;
      }
      const image = content.createElement('img');
      const printFailed = () => {
        frame.remove();
        if (!this.destroy.destroyed)
          this.error.set('Printing is unavailable. Download the PDF to print it.');
      };
      image.onerror = printFailed;
      image.onload = () => {
        try {
          printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
          printWindow.focus();
          printWindow.print();
        } catch {
          printFailed();
        }
      };
      image.src = this.image();
      image.alt = 'Missing person poster';
      content.body.append(image);
    };
    frame.srcdoc =
      '<!doctype html><html><head><style>@page{size:letter;margin:0}html,body{margin:0}img{display:block;width:100%;height:auto}</style></head><body></body></html>';
    document.body.append(frame);
    window.setTimeout(() => frame.remove(), 60000);
  }
}
