import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AccountManagementService } from '../services/account-management';
import {
  ContentKind,
  Discussion,
  DiscussionComment,
  Vote,
  optimisticVote,
} from './discussion.models';
import { DiscussionService } from './discussion.service';
import { DiscussionModerationDialogComponent } from './discussion-moderation-dialog.component';

@Component({
  selector: 'app-discussion-actions',
  imports: [MatButtonModule, MatIconModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="actions" aria-label="Participation controls">
      <button
        matButton
        type="button"
        [disabled]="busy()"
        [attr.aria-pressed]="item().current_user_vote === 'like'"
        (click)="castVote('like')"
        aria-label="Like"
      >
        <mat-icon>thumb_up</mat-icon>{{ item().like_count }}
      </button>
      <button
        matButton
        type="button"
        [disabled]="busy()"
        [attr.aria-pressed]="item().current_user_vote === 'dislike'"
        (click)="castVote('dislike')"
        aria-label="Dislike"
      >
        <mat-icon>thumb_down</mat-icon>{{ item().dislike_count }}
      </button>
      <button matButton type="button" [disabled]="busy()" (click)="moderate('report')">
        Report
      </button>
      @if (canDelete()) {
        <button matButton type="button" [disabled]="busy()" (click)="moderate('delete')">
          Delete
        </button>
      }
    </div>
  `,
  styles: [
    `
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      button[aria-pressed='true'] {
        background: var(--mat-sys-secondary-container, #dce9f7);
      }
    `,
  ],
})
export class DiscussionActionsComponent {
  readonly item = input.required<Discussion | DiscussionComment>();
  readonly kind = input.required<ContentKind>();
  readonly updated = output<Discussion | DiscussionComment>();
  readonly removed = output<void>();
  readonly busy = signal(false);
  private readonly service = inject(DiscussionService);
  private readonly auth = inject(AccountManagementService);
  private readonly user = toSignal(this.auth.currentUser$);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly canDelete = computed(
    () =>
      !!this.user() &&
      (this.user()!.id === this.item().user_id ||
        ['ADMIN', 'ADMINISTRATOR'].includes(this.user()!.role?.toUpperCase())),
  );
  private authenticated(): boolean {
    if (this.auth.isAuthenticated()) return true;
    void this.router.navigate(['/login']);
    return false;
  }
  castVote(selected: Exclude<Vote, null>): void {
    if (this.busy() || !this.authenticated()) return;
    const before = this.item();
    const vote = before.current_user_vote === selected ? null : selected;
    this.busy.set(true);
    this.updated.emit({ ...before, ...optimisticVote(before, vote) });
    this.service
      .vote(this.kind(), before.id, vote)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (authoritative) => this.updated.emit({ ...this.item(), ...authoritative }),
        error: () => {
          this.updated.emit({
            ...this.item(),
            like_count: before.like_count,
            dislike_count: before.dislike_count,
            current_user_vote: before.current_user_vote,
          });
          this.snack.open('Vote could not be saved. Please try again.', 'Close', {
            duration: 5000,
          });
        },
      });
  }
  moderate(action: 'report' | 'delete'): void {
    if (this.busy() || !this.authenticated()) return;
    const item = this.item();
    const ref = this.dialog.open(DiscussionModerationDialogComponent, {
      data: { action },
      width: '440px',
      maxWidth: '95vw',
    });
    this.destroyRef.onDestroy(() => ref.close());
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((reason: string | undefined) => {
        if (reason === undefined) return;
        this.busy.set(true);
        const request =
          action === 'delete'
            ? this.service.remove(this.kind(), item.id)
            : this.service.report(this.kind(), item.id, reason);
        request
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => this.busy.set(false)),
          )
          .subscribe({
            next: () => {
              if (action === 'delete') this.removed.emit();
              this.snack.open(
                action === 'delete' ? 'Content removed.' : 'Report received. Thank you.',
                'Close',
                { duration: 4000 },
              );
            },
            error: () =>
              this.snack.open('This action could not be completed. Please try again.', 'Close', {
                duration: 5000,
              }),
          });
      });
  }
}
