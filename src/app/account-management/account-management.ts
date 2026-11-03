import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  signal,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize, map } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccountManagementService } from '../services/account-management';
import { safeReturnUrl } from '../core/auth/return-url';

import { RegistrationComponent } from '../registration/registration.component';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

type AccountMode = 'login' | 'forgotPassword';

@Component({
  selector: 'app-account-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NavigationHeader,
    ReactiveFormsModule,
    RegistrationComponent,
  ],
  templateUrl: './account-management.html',
  styleUrl: './account-management.scss',
})
export class AccountManagement implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly returnDestination = toSignal(
    this.route.queryParamMap.pipe(map((params) => safeReturnUrl(params.get('returnUrl')))),
    { initialValue: null },
  );
  protected readonly reportLoginRequired = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((params) => params.get('reason') === 'report-account-required'),
    ),
    { initialValue: false },
  );

  private readonly accountService = inject(AccountManagementService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly loginPending = signal(false);
  protected readonly loginError = signal('');
  private loginSucceeded = false;

  protected accountMode: AccountMode = 'login';
  protected forgotPasswordSubmitted = false;
  protected readonly recoveryPending = signal(false);
  protected readonly recoveryError = signal('');
  @ViewChild('loginIdentity') private loginIdentity?: ElementRef<HTMLInputElement>;
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly forgotPasswordForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    if (this.accountService.isAuthenticated()) {
      if (this.returnDestination()) void this.router.navigateByUrl(this.returnDestination()!);
      else void this.router.navigate(['/account/management']);
    }
  }

  protected showForgotPassword(): void {
    if (this.loginPending()) return;
    this.recoveryError.set('');
    this.loginError.set('');
    this.accountMode = 'forgotPassword';
    this.forgotPasswordSubmitted = false;
  }

  protected showLogin(): void {
    if (this.recoveryPending()) return;
    this.recoveryError.set('');
    this.accountMode = 'login';
    this.forgotPasswordForm.reset();
    this.forgotPasswordSubmitted = false;
  }

  protected submitLogin(): void {
    if (this.loginPending() || this.loginSucceeded) return;
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;

    const { identity, password } = this.loginForm.getRawValue();
    this.loginError.set('');
    this.loginPending.set(true);
    this.loginForm.disable({ emitEvent: false });
    this.accountService
      .login({ email: identity, password })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loginPending.set(false);
          if (!this.loginSucceeded) this.loginForm.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: () => {
          this.loginSucceeded = true;
          if (this.returnDestination()) void this.router.navigateByUrl(this.returnDestination()!);
          else void this.router.navigate(['/account/management']);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 429) {
            this.loginError.set(
              'Too many login attempts. Please try again after 10 minutes or Reset the password',
            );
          } else if (
            error instanceof HttpErrorResponse &&
            (error.status === 400 || error.status === 401)
          ) {
            const message = error.error?.error_message;
            this.loginError.set(
              typeof message === 'string' && message.trim()
                ? message
                : 'Invalid email or password.',
            );
          } else {
            this.loginError.set('Unable to sign in. Please try again.');
          }
        },
      });
  }

  protected submitForgotPassword(): void {
    if (this.recoveryPending()) return;
    const control = this.forgotPasswordForm.controls.identity;
    control.setValue(control.value.trim());
    this.forgotPasswordForm.markAllAsTouched();
    if (this.forgotPasswordForm.invalid) return;
    this.forgotPasswordSubmitted = false;
    this.recoveryError.set('');
    this.recoveryPending.set(true);
    this.forgotPasswordForm.disable({ emitEvent: false });
    this.accountService
      .forgotPassword(control.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.recoveryPending.set(false);
          this.forgotPasswordForm.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: () => {
          this.forgotPasswordSubmitted = true;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.recoveryError.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? 'Too many reset requests. Please wait a moment before trying again.'
              : 'We could not request a password reset. Please try again.',
          );
        },
      });
  }

  protected proceedToLogin(email: string): void {
    this.showLogin();
    this.loginForm.controls.identity.setValue(email);
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.loginIdentity?.nativeElement.focus();
    this.loginIdentity?.nativeElement.scrollIntoView?.({ block: 'center', behavior: 'auto' });
  }
}
