import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

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

  protected submitted = false;

  protected readonly inquiryTypes = [
    'Report support',
    'Account help',
    'Technical issue',
    'Volunteer or partnership',
    'Media inquiry',
    'General question',
  ];

  protected readonly contactForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    inquiryType: ['', Validators.required],
    subject: ['', [Validators.required, Validators.minLength(4)]],
    message: ['', [Validators.required, Validators.minLength(20)]],
    website: [''],
  });

  protected submit(): void {
    this.contactForm.markAllAsTouched();

    if (this.contactForm.invalid) {
      return;
    }

    const payload = this.contactForm.getRawValue();

    if (payload.website.trim().length > 0) {
      return;
    }

    console.log('Contact us payload', {
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      inquiryType: payload.inquiryType,
      subject: payload.subject,
      message: payload.message,
    });
    this.submitted = true;
    this.contactForm.reset();
  }
}
