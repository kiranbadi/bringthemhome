import { DestroyRef, Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { takeUntil } from 'rxjs';
import { MissingPersonDetail } from '../../core/models/missing-person-detail.model';

@Injectable({ providedIn: 'root' })
export class TipDialogService {
  private readonly dialog = inject(MatDialog);

  async open(record: MissingPersonDetail, owner: DestroyRef): Promise<void> {
    const { SubmitTipComponent } = await import('./submit-tip.component');
    if (owner.destroyed) return;
    const ref = this.dialog.open(SubmitTipComponent, {
      data: record,
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '94dvh',
      disableClose: true,
      closeOnNavigation: false,
      restoreFocus: true,
      ariaLabel: 'Share information about this case',
    });
    ref
      .backdropClick()
      .pipe(takeUntilDestroyed(owner), takeUntil(ref.afterClosed()))
      .subscribe(() => ref.componentInstance?.requestClose());
    ref
      .keydownEvents()
      .pipe(takeUntilDestroyed(owner), takeUntil(ref.afterClosed()))
      .subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          ref.componentInstance?.requestClose();
        }
      });
    owner.onDestroy(() => ref.close());
  }
}
