import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  output,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { finalize, startWith, take } from 'rxjs';
import { RegistrationPayload, RegistrationRole } from '../core/models/registration-payload.model';
import { AccountManagementService } from '../services/account-management';
import { environment } from '../../environments/environment';

interface DialingCountry {
  label: string;
  code: string;
  min: number;
  max: number;
  stripTrunk?: boolean;
}

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AccountManagementService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly proceedToLogin = output<string>();
  readonly termsUrl = environment.termsUrl;
  readonly privacyPolicyUrl = environment.privacyPolicyUrl;
  isSubmitting = false;
  isSubmitted = false;
  passwordVisible = false;
  registrationError = '';
  registeredEmail = '';
  @ViewChild('successHeading') private successHeading?: ElementRef<HTMLElement>;
  @ViewChild('errorBanner') private errorBanner?: ElementRef<HTMLElement>;

  readonly roles: readonly { value: RegistrationRole; label: string }[] = [
    { value: 'LAW_ENFORCEMENT', label: 'Law Enforcement Official' },
    { value: 'GENERAL_PUBLIC', label: 'General Public' },
    { value: 'RELATIVE', label: 'Relative of Missing Person' },
    { value: 'TIP_PROVIDER', label: 'Information / Tip Provider' },
    { value: 'OTHER', label: 'Other' },
  ];
  readonly countries: readonly DialingCountry[] = [
    { label: 'United States / Canada (+1)', code: '+1', min: 10, max: 10 },
    { label: 'United Kingdom (+44)', code: '+44', min: 9, max: 10, stripTrunk: true },
    { label: 'India (+91)', code: '+91', min: 10, max: 10, stripTrunk: true },
    { label: 'Australia (+61)', code: '+61', min: 9, max: 9, stripTrunk: true },
    { label: 'New Zealand (+64)', code: '+64', min: 8, max: 10, stripTrunk: true },
    { label: 'Germany (+49)', code: '+49', min: 5, max: 13, stripTrunk: true },
    { label: 'France (+33)', code: '+33', min: 9, max: 9, stripTrunk: true },
    { label: 'Italy (+39)', code: '+39', min: 6, max: 12 },
    { label: 'Spain (+34)', code: '+34', min: 9, max: 9 },
    { label: 'Mexico (+52)', code: '+52', min: 10, max: 10 },
    { label: 'Brazil (+55)', code: '+55', min: 10, max: 11 },
    { label: 'Japan (+81)', code: '+81', min: 9, max: 10, stripTrunk: true },
    { label: 'China (+86)', code: '+86', min: 11, max: 11 },
    { label: 'South Africa (+27)', code: '+27', min: 9, max: 9, stripTrunk: true },
  ];

  private readonly nonBlank = (control: AbstractControl): ValidationErrors | null =>
    typeof control.value === 'string' && control.value.trim().length === 0
      ? { required: true }
      : null;

  private readonly trimmedMinLength =
    (minimum: number) =>
    (control: AbstractControl): ValidationErrors | null => {
      const length = String(control.value ?? '').trim().length;
      return length < minimum
        ? { minlength: { requiredLength: minimum, actualLength: length } }
        : null;
    };

  readonly form = this.fb.nonNullable.group({
    role: this.fb.nonNullable.control<RegistrationRole>('GENERAL_PUBLIC', Validators.required),
    otherRoleDescription: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    countryCode: ['+1', Validators.required],
    nationalPhone: [
      '',
      [Validators.required, Validators.pattern(/^\d+$/), (control) => this.validatePhone(control)],
    ],
    fullName: ['', [Validators.required, this.nonBlank, this.trimmedMinLength(2)]],
    notes: ['', [Validators.required, this.nonBlank, this.trimmedMinLength(12)]],
    acceptTerms: [false, Validators.requiredTrue],
    website: [''],
  });

  ngOnInit(): void {
    this.form.controls.role.valueChanges
      .pipe(startWith(this.form.controls.role.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        const description = this.form.controls.otherRoleDescription;
        if (role === 'OTHER') description.setValidators([Validators.required, this.nonBlank]);
        else {
          description.clearValidators();
          description.reset('', { emitEvent: false });
        }
        description.updateValueAndValidity({ emitEvent: false });
        this.cdr.markForCheck();
      });
    this.form.controls.countryCode.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.controls.nationalPhone.updateValueAndValidity();
        this.cdr.markForCheck();
      });
  }

  submit(): void {
    if (this.isSubmitting || this.isSubmitted) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.website.value.trim()) return;
    const values = this.form.getRawValue();
    const payload: RegistrationPayload = {
      email: values.email.trim(),
      password: values.password,
      phone: `${values.countryCode}${this.nationalNumber(values.nationalPhone, values.countryCode)}`,
      full_name: values.fullName.trim(),
      notes: values.notes.trim(),
      role: values.role,
      other_role_description: values.role === 'OTHER' ? values.otherRoleDescription.trim() : null,
      terms_accepted: values.acceptTerms,
    };
    this.isSubmitting = true;
    this.registrationError = '';
    this.form.disable({ emitEvent: false });
    console.log('Registration Payload:', JSON.stringify(payload, null, 2));
    this.cdr.markForCheck();
    this.service
      .register(payload)
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSubmitting = false;
          if (!this.isSubmitted && this.form.disabled) this.form.enable({ emitEvent: false });
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.registeredEmail = payload.email;
          this.isSubmitted = true;
          this.form.controls.password.reset('', { emitEvent: false });
          this.passwordVisible = false;
          this.cdr.markForCheck();
          // Render the conditional view before moving keyboard focus into it.
          this.cdr.detectChanges();
          this.successHeading?.nativeElement.focus();
        },
        error: (error: HttpErrorResponse) => {
          this.form.enable({ emitEvent: false });
          this.registrationError = this.errorMessage(error);
          this.cdr.markForCheck();
          this.cdr.detectChanges();
          this.errorBanner?.nativeElement.focus();
        },
      });
  }

  reset(): void {
    if (this.isSubmitting) return;
    this.form.reset();
    this.registrationError = '';
    this.passwordVisible = false;
  }

  private nationalNumber(number: string, code: string): string {
    return this.countries.find((country) => country.code === code)?.stripTrunk
      ? number.replace(/^0/, '')
      : number;
  }

  private validatePhone(control: AbstractControl): ValidationErrors | null {
    const code = control.parent?.get('countryCode')?.value ?? '+1';
    const country = this.countries.find((option) => option.code === code);
    const number = this.nationalNumber(String(control.value ?? ''), code);
    if (!number) return null; // required handles the empty input.
    return !country ||
      !/^\d+$/.test(number) ||
      number.length < country.min ||
      number.length > country.max ||
      code.length - 1 + number.length > 15
      ? { nationalPhone: true }
      : null;
  }

  private errorMessage(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return 'This email or phone is already registered. Try signing in or use different contact information.';
    }
    const detail: unknown = error.error?.detail;
    if (error.status === 422 && Array.isArray(detail)) {
      const fields: Record<string, string> = {
        email: 'email',
        password: 'password',
        phone: 'nationalPhone',
        full_name: 'fullName',
        notes: 'notes',
        role: 'role',
        other_role_description: 'otherRoleDescription',
        terms_accepted: 'acceptTerms',
      };
      const messages: string[] = [];
      for (const issue of detail) {
        if (typeof issue?.msg !== 'string' || !issue.msg.trim()) continue;
        messages.push(issue.msg);
        const field = Array.isArray(issue.loc) ? fields[String(issue.loc.at(-1))] : undefined;
        if (field) this.form.get(field)?.setErrors({ server: issue.msg });
      }
      if (messages.length) return `Please correct your registration details: ${messages.join(' ')}`;
    }
    if (error.status === 0)
      return 'The registration service could not be reached. Please try again.';
    if (error.status >= 400 && error.status < 500 && typeof detail === 'string') return detail;
    return 'We could not complete your registration. Please try again.';
  }
}
