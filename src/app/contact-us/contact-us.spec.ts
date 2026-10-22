import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ContactUs } from './contact-us';

describe('ContactUs case tip', () => {
  it('prefills the tip subject with the case id and name from the gallery', async () => {
    TestBed.configureTestingModule({
      imports: [ContactUs],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                type: 'tip',
                personId: 'case-1',
                full_name: 'Jane Doe',
              }),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ContactUs);
    await fixture.whenStable();
    const subject = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[formControlName="subject"]',
    );
    expect(subject?.value).toBe('Tip for Jane Doe (case-1)');
  });
});

describe('ContactUs submission lifecycle', () => {
  const payload = {
    full_name: 'John Doe',
    email: 'john.doe@gmail.com',
    phone: '2014848805',
    inquiry_type: 'Missing person tip',
    subject: 'Choosing a practical path to v1',
    message: 'Detailed inquiry message text...',
  };
  let fixture: ComponentFixture<ContactUs>;
  let http: HttpTestingController;
  const form = () => fixture.componentInstance['contactForm'];
  const submit = () => fixture.componentInstance['submit']();
  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ContactUs],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(ContactUs);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('logs exact JSON, locks immediately, and prevents duplicate requests before and after success', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    form().patchValue(payload);
    submit();
    const request = http.expectOne('/bringthemhome/contact');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(log).toHaveBeenCalledWith(JSON.stringify(payload));
    await fixture.whenStable();
    expect(root().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(form().disabled).toBe(true);
    submit();
    http.expectNone('/bringthemhome/contact');
    request.flush({ full_name: 'John from response' });
    await fixture.whenStable();
    expect(root().querySelector('form')).toBeNull();
    expect(root().querySelector('[role="status"]')?.textContent).toContain('John from response');
    submit();
    http.expectNone('/bringthemhome/contact');
  });

  it('preserves values on failure and enables a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    form().patchValue(payload);
    submit();
    http.expectOne('/bringthemhome/contact').flush({}, { status: 500, statusText: 'Server error' });
    await fixture.whenStable();
    expect(form().getRawValue()).toEqual({ ...payload, website: '' });
    expect(form().enabled).toBe(true);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('Please try again');
    expect(root().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    submit();
    http.expectOne('/bringthemhome/contact').flush({ full_name: payload.full_name });
  });

  it('Cancel clears values, interaction flags, and submitted validation state', async () => {
    root()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(root().querySelectorAll('mat-error').length).toBeGreaterThan(0);
    form().patchValue(payload);
    form().markAsDirty();
    const cancel = Array.from(root().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cancel'),
    );
    expect(cancel).toBeDefined();
    cancel!.click();
    await fixture.whenStable();
    expect(Object.values(form().getRawValue()).every((value) => value === '')).toBe(true);
    expect(form().pristine).toBe(true);
    expect(form().untouched).toBe(true);
    expect(root().querySelectorAll('mat-error')).toHaveLength(0);
    expect(
      fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective)
        .submitted,
    ).toBe(false);
    http.expectNone('/bringthemhome/contact');
  });

  it('rejects whitespace, invalid phone, invalid email and unknown inquiry types', () => {
    form().patchValue(payload);
    for (const key of ['full_name', 'subject', 'message'] as const) {
      form().controls[key].setValue('                       ');
      expect(form().controls[key].invalid).toBe(true);
      form().controls[key].setValue(payload[key]);
    }
    form().controls.phone.setValue('not a phone');
    expect(form().controls.phone.invalid).toBe(true);
    form().controls.phone.setValue('');
    expect(form().controls.phone.hasError('required')).toBe(true);
    form().controls.email.setValue('invalid');
    expect(form().controls.email.invalid).toBe(true);
    form().controls.inquiry_type.setValue('Unknown');
    expect(form().controls.inquiry_type.invalid).toBe(true);
    submit();
    http.expectNone('/bringthemhome/contact');
  });

  it('retains the honeypot and rejects filled values without including it in requests', () => {
    form().patchValue({ ...payload, website: 'spam.example' });
    submit();
    http.expectNone('/bringthemhome/contact');
    expect(form().controls.website.invalid).toBe(true);
  });
});
