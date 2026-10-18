import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
    NavigationHeader,
    ReactiveFormsModule,
    RegistrationComponent,
  ],
  templateUrl: './account-management.html',
  styleUrl: './account-management.scss',
})
export class AccountManagement {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  protected accountMode: AccountMode = 'login';
  protected forgotPasswordSubmitted = false;
  @ViewChild('loginIdentity') private loginIdentity?: ElementRef<HTMLInputElement>;
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, this.emailOrPhoneValidator]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly forgotPasswordForm = this.formBuilder.nonNullable.group({
    identity: ['', [Validators.required, this.emailOrPhoneValidator]],
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
