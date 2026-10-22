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
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccountManagementService } from '../services/account-management';

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

  private readonly accountService = inject(AccountManagementService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly loginPending = signal(false);
  protected readonly loginError = signal('');
  private loginSucceeded = false;

  protected accountMode: AccountMode = 'login';
  protected forgotPasswordSubmitted = false;
  @ViewChild('loginIdentity') private loginIdentity?: ElementRef<HTMLInputElement>;
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly forgotPasswordForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, this.emailOrPhoneValidator]],
  });

  ngOnInit(): void {
    if (this.accountService.isAuthenticated()) {
      void this.router.navigate(['/account/management']);
    }
  }

  protected showForgotPassword(): void {
    if (this.loginPending()) return;
    this.loginError.set('');
    this.accountMode = 'forgotPassword';
    this.forgotPasswordSubmitted = false;
  }

  protected showLogin(): void {
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
          void this.router.navigate(['/account/management']);
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
    this.forgotPasswordForm.markAllAsTouched();

    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.forgotPasswordSubmitted = true;
  }

  protected proceedToLogin(email: string): void {
    this.showLogin();
    this.loginForm.controls.identity.setValue(email);
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.loginIdentity?.nativeElement.focus();
    this.loginIdentity?.nativeElement.scrollIntoView?.({ block: 'center', behavior: 'auto' });
  }

  private emailOrPhoneValidator(control: { value: string }) {
    const value = control.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^\+?[0-9 .()-]{10,20}$/;

    return emailPattern.test(value) || phonePattern.test(value) ? null : { emailOrPhone: true };
  }
}
