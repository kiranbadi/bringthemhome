import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { AccountManagementService } from '../services/account-management';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NavigationHeader,
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly service = inject(AccountManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private token = '';
  readonly pending = signal(false);
  readonly invalidLink = signal(false);
  readonly error = signal('');
  private succeeded = false;
  readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmation: ['', Validators.required],
    },
    {
      validators: (group) =>
        group.get('password')?.value === group.get('confirmation')?.value
          ? null
          : { mismatch: true },
    },
  );

  constructor() {
    const tokens = new URLSearchParams(this.route.snapshot.fragment ?? '').getAll('token');
    this.token = tokens.length === 1 ? tokens[0].trim() : '';
    this.invalidLink.set(!this.token);
    if (this.route.snapshot.fragment) this.location.replaceState(this.router.url.split('#')[0]);
    this.destroyRef.onDestroy(() => {
      this.token = '';
    });
  }

  submit(): void {
    if (this.pending() || this.invalidLink() || this.succeeded) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.pending.set(true);
    const password = this.form.controls.password.value;
    this.form.disable({ emitEvent: false });
    this.service
      .resetPassword(this.token, password)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.pending.set(false);
          if (!this.succeeded) this.form.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: () => {
          this.succeeded = true;
          this.token = '';
          this.form.reset();
          this.snackBar.open(
            'Password reset successfully. Please sign in with your new password.',
            'Dismiss',
            { duration: 10000 },
          );
          void this.router.navigateByUrl('/login', { replaceUrl: true });
        },
        error: (error: unknown) => {
          this.form.reset();
          if (error instanceof HttpErrorResponse && error.status === 400) {
            this.token = '';
            this.invalidLink.set(true);
          } else
            this.error.set(
              error instanceof HttpErrorResponse && error.status === 429
                ? 'Too many reset attempts. Please wait a moment before trying again.'
                : 'We could not reset your password. Please try again.',
            );
        },
      });
  }
}
