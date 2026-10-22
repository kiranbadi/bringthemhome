import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroupDirective,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

interface ContactPayload {
  full_name: string;
  email: string;
  phone: string;
  inquiry_type: string;
  subject: string;
  message: string;
}

interface ContactResponse {
  full_name: string;
}

const trimmedText =
  (minimum: number): ValidatorFn =>
  (control) => {
    const value = (control.value as string).trim();
    return !value
      ? { required: true }
      : value.length < minimum
        ? { minlength: { requiredLength: minimum, actualLength: value.length } }
        : null;
  };

@Component({
  selector: 'app-contact-us',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    NavigationHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './contact-us.html',
  styleUrl: './contact-us.scss',
})
export class ContactUs {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  private readonly CONTACT_US_URL = '/bringthemhome/contact';

  private readonly destroyRef = inject(DestroyRef);
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly submittedName = signal('');
  protected readonly submissionError = signal('');

  private readonly httpClient = inject(HttpClient);

  protected readonly inquiryTypes = [
    'Missing person tip',
    'Report support',
    'Account help',
    'Technical issue',
    'Volunteer or partnership',
    'Media inquiry',
    'General question',
  ];

  protected readonly contactForm = this.formBuilder.nonNullable.group({
    full_name: ['', [trimmedText(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^(?=(?:\D*\d){7,15}\D*$)\+?[\d ()-]+$/)]],
    inquiry_type: [
      '',
      [
        Validators.required,
        (control) =>
          !control.value || this.inquiryTypes.includes(control.value)
            ? null
            : { inquiryType: true },
      ],
    ],
    subject: ['', [trimmedText(4)]],
    message: ['', [trimmedText(20)]],
    website: ['', Validators.pattern(/^$/)],
  });

  constructor() {
    const query = this.route.snapshot.queryParamMap;
    if (query.get('type') === 'tip' && query.get('personId')) {
      this.contactForm.patchValue({
        inquiry_type: 'Missing person tip',
        subject: `Tip for ${query.get('full_name') || 'missing person'} (${query.get('personId')})`,
      });
    }
  }

  protected cancel(formDirective: FormGroupDirective): void {
    if (this.submitting() || this.submitted()) return;
    formDirective.resetForm();
    this.submissionError.set('');
  }

  protected submit(): void {
    if (this.submitting() || this.submitted()) return;
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const { full_name, email, phone, inquiry_type, subject, message } =
      this.contactForm.getRawValue();
    const payload: ContactPayload = { full_name, email, phone, inquiry_type, subject, message };
    this.submitting.set(true);
    this.submissionError.set('');
    this.contactForm.disable({ emitEvent: false });
    console.log(JSON.stringify(payload));

    this.httpClient
      .post<ContactResponse>(this.CONTACT_US_URL, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.submitting.set(false);
          if (!this.submitted()) this.contactForm.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (response) => {
          this.submittedName.set(response.full_name);
          this.submitted.set(true);
        },
        error: () => {
          this.submissionError.set('We could not send your message. Please try again.');
        },
      });
  }
}
