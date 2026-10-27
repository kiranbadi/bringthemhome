import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CaseShareService } from './case-share.service';
import { CaseShareDialog } from './case-share.dialog';

@Component({
  selector: 'app-case-share',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" (click)="open()" [attr.aria-label]="'Share case for ' + name()">
    Share
  </button>`,
  styles: `
    :host {
      display: inline-flex;
    }
    button {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      font: var(--mat-sys-label-large, inherit);
      font-weight: 600;
      line-height: 22px;
      padding: 10px 18px;
      border: 1px solid var(--mat-sys-outline-variant, #cbd5e1);
      border-radius: 8px;
      background: var(--mat-sys-surface-container-lowest, white);
      color: var(--mat-sys-primary, #172e50);
      cursor: pointer;
    }
    button:hover {
      background: var(--mat-sys-surface-container, #edf3f9);
    }
    button:focus-visible {
      outline: 3px solid #2563eb;
      outline-offset: 3px;
    }
  `,
})
export class CaseShareComponent {
  readonly caseId = input.required<string>();
  readonly name = input.required<string>();
  readonly location = input('');
  readonly image = input('');
  private readonly service = inject(CaseShareService);
  private readonly dialog = inject(MatDialog);
  open(): void {
    this.dialog.open(CaseShareDialog, {
      data: {
        ...this.service.data(this.caseId(), this.name(), this.location()),
        location: this.location(),
        image: this.image(),
      },
      width: '440px',
      maxWidth: '94vw',
      maxHeight: '92dvh',
      ariaLabel: 'Share this case',
      restoreFocus: true,
    });
  }
}
