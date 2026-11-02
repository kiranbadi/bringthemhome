import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { AccountManagementService } from '../../services/account-management';
import { CaseClaimsService } from './case-claims.service';
import {
  Claim,
  RELATIONSHIPS,
  Relationship,
  claimError,
  needsSignIn,
  trimmedLength,
} from './case-claims.models';
import { ClaimContributionComposerComponent } from './claim-contribution-composer.component';
import { CaseContributionsComponent } from './case-contributions.component';

@Component({
  selector: 'app-case-claim-panel',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ClaimContributionComposerComponent,
    CaseContributionsComponent,
  ],
  templateUrl: './case-claim-panel.component.html',
  styleUrl: './case-claims.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseClaimPanelComponent {
  readonly caseId = input.required<string>();
  private readonly auth = inject(AccountManagementService);
  readonly user = toSignal(this.auth.currentUser$, { initialValue: null });
  private readonly api = inject(CaseClaimsService);
  private readonly router = inject(Router);
  private readonly requests = new Subject<{ id: string; signedIn: boolean }>();
  readonly claim = signal<Claim | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly statusError = signal('');
  readonly actionError = signal('');
  readonly reauthenticate = signal(false);
  readonly saving = signal(false);
  readonly showClaimForm = signal(false);
  readonly showComposer = signal(false);
  readonly contributionVersion = signal(0);
  readonly canContribute = computed(
    () =>
      !!this.user() &&
      !this.loading() &&
      !this.statusError() &&
      this.claim()?.status === 'APPROVED',
  );
  readonly returnUrl = computed(() =>
    this.router.serializeUrl(
      this.router.createUrlTree(['/missing-persons', this.caseId()], { fragment: 'case-claims' }),
    ),
  );
  readonly relationships = Object.entries(RELATIONSHIPS) as [Relationship, string][];
  readonly form = inject(FormBuilder).nonNullable.group({
    relationship: ['FAMILY' as Relationship, Validators.required],
    explanation: ['', trimmedLength(10, 3000)],
  });
  @ViewChild(ClaimContributionComposerComponent)
  private composer?: ClaimContributionComposerComponent;
  constructor() {
    this.requests
      .pipe(
        tap(({ signedIn }) => {
          this.loading.set(signedIn);
          this.loaded.set(false);
          this.statusError.set('');
        }),
        switchMap(({ id, signedIn }) =>
          signedIn
            ? this.api.findMyClaim(id).pipe(
                tap((claim) => {
                  this.claim.set(claim);
                  this.loaded.set(true);
                  this.loading.set(false);
                  if (claim?.status === 'APPROVED') this.showComposer.set(true);
                }),
                catchError((error: unknown) => {
                  this.statusError.set(claimError(error));
                  this.reauthenticate.set(needsSignIn(error));
                  this.loading.set(false);
                  return EMPTY;
                }),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
    effect(() => {
      const id = this.caseId(),
        userId = this.user()?.id;
      untracked(() => {
        this.claim.set(null);
        this.showComposer.set(false);
        this.showClaimForm.set(false);
        this.actionError.set('');
        this.reauthenticate.set(false);
        this.form.reset({ relationship: 'FAMILY', explanation: '' });
        this.requests.next({ id, signedIn: !!userId });
      });
    });
  }
  reload() {
    this.requests.next({ id: this.caseId(), signedIn: !!this.user() });
  }
  submitClaim() {
    if (
      !this.user() ||
      this.saving() ||
      this.loading() ||
      !this.loaded() ||
      this.statusError() ||
      this.claim()
    )
      return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.actionError.set('');
    const value = this.form.getRawValue();
    this.api
      .claim(this.caseId(), {
        relationship: value.relationship,
        explanation: value.explanation.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showClaimForm.set(false);
          this.reload();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.actionError.set(claimError(error));
          if (error instanceof HttpErrorResponse && error.status === 409) this.reload();
          else this.permissionError(error);
        },
      });
  }
  private readonly destroyRef = inject(DestroyRef);
  permissionChanged() {
    this.reload();
    this.contributionVersion.update((n) => n + 1);
  }
  private permissionError(error: unknown) {
    this.reauthenticate.set(needsSignIn(error));
    if (error instanceof HttpErrorResponse && [401, 403].includes(error.status))
      this.permissionChanged();
  }
  published() {
    this.contributionVersion.update((n) => n + 1);
    this.reload();
  }
  addInformation() {
    this.composer?.focusInformation();
  }
  addPhotos() {
    this.composer?.focusPhotos();
  }
  signInAgain() {
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        () =>
          void this.router.navigate(['/login'], { queryParams: { returnUrl: this.returnUrl() } }),
      );
  }
}
