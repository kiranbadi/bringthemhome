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
    button {
      font: inherit;
      font-weight: 700;
      padding: 0.6rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.4rem;
      background: white;
      color: #172e50;
      cursor: pointer;
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
