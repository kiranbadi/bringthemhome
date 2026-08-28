import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import {
  AccountManagementService,
  AccountRegistrationResponse,
} from '../services/account-management';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { finalize } from 'rxjs';

type AccountMode = 'login' | 'forgotPassword';

@Component({
  selector: 'app-account-management',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    NavigationHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './account-management.html',
  styleUrl: './account-management.scss',
})
export class AccountManagement {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly accountManagementService = inject(AccountManagementService);

  protected accountMode: AccountMode = 'login';
  protected forgotPasswordSubmitted = false;
  protected registrationPending = false;
  protected registrationResponse: AccountRegistrationResponse | undefined;
  protected registrationError = '';

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, this.emailOrPhoneValidator]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly forgotPasswordForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, this.emailOrPhoneValidator]],
  });

  protected readonly registerForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 .()-]{10,20}$/)]],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    notes: ['', [Validators.required, Validators.minLength(12)]],
    website: [''],
  });

  protected showForgotPassword(): void {
    this.accountMode = 'forgotPassword';
    this.forgotPasswordSubmitted = false;
  }

  protected showLogin(): void {
    this.accountMode = 'login';
    this.forgotPasswordForm.reset();
    this.forgotPasswordSubmitted = false;
  }

  protected submitLogin(): void {
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      return;
    }

    void this.router.navigate(['/myaccount']);
  }

  protected submitForgotPassword(): void {
    this.forgotPasswordForm.markAllAsTouched();

    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.forgotPasswordSubmitted = true;
  }

  protected submitRegistration(): void {
    if (this.registrationPending) {
      return;
    }

    this.registerForm.markAllAsTouched();

    const website = (this.registerForm.controls.website.value ?? '').trim();

    // Website is a honeypot field.
    if (this.registerForm.invalid || website.length > 0) {
      return;
    }

    const registration = this.registerForm.getRawValue();

    this.registrationPending = true;
    this.registrationResponse = undefined;
    this.registrationError = '';

    this.accountManagementService
      .register({
        email: registration.email.trim(),
        phone: registration.phone.trim(),
        full_name: registration.fullName.trim(),
        notes: registration.notes.trim(),
      })
      .pipe(
        finalize(() => {
          this.registrationPending = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.registrationPending = false;
          this.registrationResponse = response;
        },
        error: (error: HttpErrorResponse) => {
          this.registrationError = this.registrationErrorMessage(error);
        },
      });
  }

  private registrationErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return 'Registration with this email or phone already exists. Try signing in or use different contact information.';
    }

    if (error.status === 422 && Array.isArray(error.error?.detail)) {
      const validationMessages = error.error.detail
        .map((item: { msg?: unknown }) => (typeof item.msg === 'string' ? item.msg : ''))
        .filter((message: string) => message.length > 0);

      if (validationMessages.length > 0) {
        return `Please correct the registration details: ${validationMessages.join(' ')}`;
      }
    }

    if (error.status >= 400 && error.status < 500 && typeof error.error?.detail === 'string') {
      return error.error.detail;
    }

    return error.status === 0
      ? 'The registration service could not be reached. Confirm that the API is running and try again.'
      : 'We could not complete your registration. Please try again later.';
  }

  private emailOrPhoneValidator(control: { value: string }) {
    const value = control.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^\+?[0-9 .()-]{10,20}$/;

    return emailPattern.test(value) || phonePattern.test(value) ? null : { emailOrPhone: true };
  }
}
