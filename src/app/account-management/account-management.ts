import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';

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
    RouterLink,
  ],
  templateUrl: './account-management.html',
  styleUrl: './account-management.scss',
})
export class AccountManagement {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  protected accountMode: AccountMode = 'login';
  protected forgotPasswordSubmitted = false;
  protected registrationSubmitted = false;

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

    if (this.registerForm.invalid || this.registerForm.controls.website.value.trim().length > 0) {
      return;
    }

    this.registrationSubmitted = true;
    this.registerForm.reset();
  }

  private emailOrPhoneValidator(control: { value: string }) {
    const value = control.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^\+?[0-9 .()-]{10,20}$/;

    return emailPattern.test(value) || phonePattern.test(value) ? null : { emailOrPhone: true };
  }
}
