import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { EMPTY, Subject, catchError, startWith, switchMap, tap } from 'rxjs';
import { AccountManagementService } from '../../services/account-management';
import { NavigationHeader } from '../../shared/navigation-header/navigation-header';
import { CaseClaimsService } from './case-claims.service';
import {
  ClaimStatus,
  Page,
  RELATIONSHIPS,
  StaffClaim,
  TRANSITIONS,
  claimError,
  isAdministrator,
  needsSignIn,
  trimmedLength,
} from './case-claims.models';

@Component({
  selector: 'app-case-claims-admin',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    NavigationHeader,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './case-claims-admin.component.html',
  styleUrl: './case-claims.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseClaimsAdminComponent {
  private readonly auth = inject(AccountManagementService);
  readonly user = toSignal(this.auth.currentUser$, { initialValue: null });
  readonly isAdmin = computed(() => isAdministrator(this.user()?.role));
  private readonly api = inject(CaseClaimsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly reload = new Subject<void>();
  private readonly draftNotes = new Map<string, string>();
  readonly staleReview = signal(false);
  readonly status = signal<ClaimStatus>('PENDING');
  readonly page = signal(1);
  readonly queue = signal<Page<StaffClaim> | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly denied = signal(false);
  readonly error = signal('');
  readonly reviewError = signal('');
  readonly message = signal('');
  readonly reauthenticate = signal(false);
  readonly selected = signal<StaffClaim | null>(null);
  readonly statuses: ClaimStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'];
  readonly relationships = RELATIONSHIPS;
  readonly choices = computed(() =>
    this.selected() ? (TRANSITIONS[this.selected()!.status] ?? []) : [],
  );
  readonly form = inject(FormBuilder).nonNullable.group({
    status: ['APPROVED' as ClaimStatus, Validators.required],
    review_notes: ['', trimmedLength(10, 3000)],
    verified: [false],
  });
  constructor() {
    this.reload
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.queue.set(null);
        }),
        switchMap(() => {
          if (!this.isAdmin()) {
            this.loading.set(false);
            return EMPTY;
          }
          return this.api.adminClaims(this.status(), this.page()).pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(claimError(error));
              this.handleAccess(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((queue) => {
        this.queue.set(queue);
        this.loading.set(false);
        this.denied.set(false);
      });
  }
  load() {
    if (!this.saving()) this.reload.next();
  }
  filter(status: ClaimStatus) {
    if (this.saving()) return;
    this.rememberDraft();
    this.status.set(status);
    this.page.set(1);
    this.selected.set(null);
    this.load();
  }
  changePage(delta: number) {
    const next = this.page() + delta;
    if (
      this.loading() ||
      this.saving() ||
      next < 1 ||
      (delta > 0 && this.page() * 20 >= (this.queue()?.total ?? 0))
    )
      return;
    this.page.set(next);
    this.rememberDraft();
    this.selected.set(null);
    this.load();
  }
  own(claim: StaffClaim) {
    return String(claim.user_id) === String(this.user()?.id);
  }
  select(claim: StaffClaim) {
    if (this.saving() || this.own(claim) || !this.isAdmin() || this.denied()) return;
    this.rememberDraft();
    this.staleReview.set(false);
    this.selected.set(claim);
    this.reviewError.set('');
    this.message.set('');
    this.form.reset({
      status: TRANSITIONS[claim.status]?.[0] ?? 'APPROVED',
      review_notes: this.draftNotes.get(claim.id) ?? '',
      verified: false,
    });
  }
  review() {
    const claim = this.selected(),
      value = this.form.getRawValue();
    if (
      !claim ||
      !this.isAdmin() ||
      this.denied() ||
      this.staleReview() ||
      this.saving() ||
      this.loading() ||
      this.own(claim)
    )
      return;
    this.form.markAllAsTouched();
    this.reviewError.set('');
    if (this.form.invalid || !TRANSITIONS[claim.status]?.includes(value.status)) return;
    if (value.status === 'APPROVED' && !value.verified) {
      this.reviewError.set('Confirm that you completed independent verification before approving.');
      return;
    }
    this.saving.set(true);
    this.api
      .review(claim.id, value.status, value.review_notes.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.draftNotes.delete(claim.id);
          this.selected.set(null);
          this.message.set('Claim review saved.');
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.reviewError.set(claimError(error));
          this.handleAccess(error);
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.rememberDraft();
            this.staleReview.set(true);
            this.load();
          }
        },
      });
  }
  private rememberDraft() {
    const claim = this.selected();
    if (claim) this.draftNotes.set(claim.id, this.form.controls.review_notes.value);
  }
  private handleAccess(error: unknown) {
    this.reauthenticate.set(needsSignIn(error));
    if (error instanceof HttpErrorResponse && [401, 403].includes(error.status))
      this.denied.set(true);
  }
  signInAgain() {
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        () =>
          void this.router.navigate(['/login'], {
            queryParams: { returnUrl: '/admin/case-claims' },
          }),
      );
  }
}
