import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { HttpClient } from '@angular/common/http';

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

  private readonly CONTACT_US_URL = '/bringthemhome/contact';

  protected submitted = false;

  private httpClient = inject(HttpClient);

  protected readonly inquiryTypes = [
    'Report support',
    'Account help',
    'Technical issue',
    'Volunteer or partnership',
    'Media inquiry',
    'General question',
  ];

  protected readonly contactForm = this.formBuilder.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    inquiry_type: ['', Validators.required],
    subject: ['', [Validators.required, Validators.minLength(4)]],
    message: ['', [Validators.required, Validators.minLength(20)]],
    website: [''],
  });

  protected submit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }
    const payload = this.contactForm.getRawValue();
    if (payload.website.trim().length > 0) {
      console.log('returning from here ', payload.website);
      return;
    }
    // @ts-ignore
    delete payload.website;
    console.log('Contact us payload', {
      full_name: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      inquiry_type: payload.inquiry_type,
      subject: payload.subject,
      message: payload.message,
    });
    this.saveContactForm(payload);
    Object.keys(this.contactForm.controls).forEach((key) => {
      const control = this.contactForm.get(key);
      control?.markAsPristine();
      control?.markAsUntouched();
      control?.updateValueAndValidity({ emitEvent: false });
    });
    this.contactForm.reset();
  }

  // make an HTTP POST request to the server with the contact form data
  private saveContactForm(payload: any) {
    // add json headers to the request
    const headers = { 'Content-Type': 'application/json' };
    this.httpClient.post(this.CONTACT_US_URL, payload, { headers }).subscribe({
      next: (response) => {
        console.log('Contact form submitted successfully', response);
        // response is json object with a full_name property we need to return to the user in a thank you message
        this.submitted = true;
      },
      error: (error) => {
        console.error('Error submitting contact form', error);
      },
    });
  }
}
