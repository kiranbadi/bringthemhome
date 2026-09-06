import { ChangeDetectorRef, Component, inject, signal, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
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
  protected registrationResponse: AccountRegistrationResponse | undefined;
  protected registrationError = signal('');
  protected registrationSuccess = signal('');

  @ViewChild(FormGroupDirective) private formDirective?: FormGroupDirective;
  private cdr = inject(ChangeDetectorRef);

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
    this.registerForm.markAllAsTouched();

    const website = (this.registerForm.controls.website.value ?? '').trim();

    // Website is a honeypot field.
    if (this.registerForm.invalid || website.length > 0) {
      return;
    }

    const registration = this.registerForm.getRawValue();

    this.registrationResponse = undefined;
    this.registrationError.set('');
    this.registrationSuccess.set('');

    this.accountManagementService
      .register({
        email: registration.email.trim(),
        phone: registration.phone.trim(),
        full_name: registration.fullName.trim(),
        notes: registration.notes.trim(),
      })
      .subscribe({
        next: (response) => {
          this.registrationResponse = response;
          // append email and phone and temp password from response to the success message for clarity
          this.registrationSuccess.set(
            'Registration successful.' +
              'Please use your email ' +
              response.email +
              ' or phone number ' +
              response.phone +
              ' to login with the ' +
              response.temporary_password +
              ' temporary password provided.',
          );
          this.registrationError.set('');
          // clear the form after successful registration and ensure no validation errors are shown
          this.registerForm.reset();
          this.formDirective?.resetForm();
          this.cdr.markForCheck();
        },
        error: (error: HttpErrorResponse) => {
          this.registrationError.set(this.registrationErrorMessage(error));
          this.registrationSuccess.set('');
          this.cdr.markForCheck();
        },
      });
  }

  private registrationErrorMessage(error: HttpErrorResponse): string {
    console.log(`Registration error: ${error.status} - ${error.message}`, error);

    const detail = error.error?.detail;

    if (error.status === 409) {
      return 'Registration with this email or phone already exists. Try signing in or use different contact information.';
    }

    if (error.status === 422 && Array.isArray(detail)) {
      const messages = detail.flatMap((item) =>
        typeof item?.msg === 'string' && item.msg.trim() ? [item.msg] : [],
      );
      if (messages.length) {
        return `Please correct the registration details: ${messages.join(' ')}`;
      }
    }

    if (error.status >= 400 && error.status < 500 && typeof detail === 'string') {
      return detail;
    }

    if (error.status === 0) {
      return 'The registration service could not be reached. Confirm that the API is running and try again.';
    }
    return 'We could not complete your registration. Please try again later.';
  }

  private emailOrPhoneValidator(control: { value: string }) {
    const value = control.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^\+?[0-9 .()-]{10,20}$/;

    return emailPattern.test(value) || phonePattern.test(value) ? null : { emailOrPhone: true };
  }

  protected onRegisterCancel(): void {
    this.registrationError.set('');
    this.registrationSuccess.set('');
    this.registrationResponse = undefined;
    this.registerForm.reset();
  }
}
