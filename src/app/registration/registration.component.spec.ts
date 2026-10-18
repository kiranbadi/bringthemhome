import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { RegistrationComponent } from './registration.component';

// Drive inputs and submit events as a user would, without depending on private component state.
describe('RegistrationComponent', () => {
  let fixture: ComponentFixture<RegistrationComponent>;
  let http: HttpTestingController;
  let log: ReturnType<typeof vi.spyOn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const input = (name: string) =>
    el().querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
  async function fill() {
    for (const [name, value] of Object.entries({
      email: 'jane@example.com',
      password: 'A-test-password',
      fullName: 'Jane Doe',
      nationalPhone: '9195550199',
    })) {
      input(name).value = value;
      input(name).dispatchEvent(new Event('input'));
    }
    const notes = el().querySelector<HTMLTextAreaElement>('textarea')!;
    notes.value = 'I want to help families find their loved ones.';
    notes.dispatchEvent(new Event('input'));
    el().querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    await fixture.whenStable();
  }
  const submit = () =>
    el()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const request = () => http.expectOne('/bringthemhome/registrations');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    fixture = TestBed.createComponent(RegistrationComponent);
    await fixture.whenStable();
  });
  afterEach(() => {
    http.verify();
    log.mockRestore();
  });

  it('requires valid credentials, phone and accepted terms before enabling submit', async () => {
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submit();
    http.expectNone('/bringthemhome/registrations');
    await fill();
    expect(input('email').autocomplete).toBe('username');
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    input('password').value = 'short';
    input('password').dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('attaches and removes required validation for Other and clears its old value', async () => {
    await fill();
    // Material select options live in the overlay container.
    el().querySelector<HTMLElement>('mat-select[formControlName="role"]')!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
      .find((option) => option.textContent?.trim() === 'Other')!
      .click();
    await fixture.whenStable();
    expect(input('otherRoleDescription')).toBeTruthy();
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    input('otherRoleDescription').value = 'Community volunteer';
    input('otherRoleDescription').dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    el().querySelector<HTMLElement>('mat-select[formControlName="role"]')!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
      .find((option) => option.textContent?.trim() === 'General Public')!
      .click();
    await fixture.whenStable();
    expect(input('otherRoleDescription')).toBeNull();
    submit();
    const req = request();
    expect(req.request.body.other_role_description).toBeNull();
    req.flush({ email: 'jane@example.com' }, { status: 201, statusText: 'Created' });
  });

  it('serializes E.164, prevents duplicate posts, logs JSON, and hides the form only on success', async () => {
    await fill();
    submit();
    submit();
    const req = request();
    expect(req.request.body).toEqual({
      email: 'jane@example.com',
      password: 'A-test-password',
      phone: '+19195550199',
      full_name: 'Jane Doe',
      notes: 'I want to help families find their loved ones.',
      role: 'GENERAL_PUBLIC',
      other_role_description: null,
      terms_accepted: true,
    });
    expect(log).toHaveBeenCalledWith(
      'Registration Payload:',
      JSON.stringify(req.request.body, null, 2),
    );
    await fixture.whenStable();
    expect(el().querySelector('mat-spinner')).toBeTruthy();
    expect(el().querySelector('form')).toBeTruthy();
    req.flush({ email: 'jane@example.com' }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    expect(el().querySelector('form')).toBeNull();
    expect(el().textContent).toContain('Thank You for Registering');
    expect(el().textContent).toContain('jane@example.com');
    expect(el().querySelector('mat-spinner')).toBeNull();
  });

  it('preserves values on conflict and allows retry after correcting the email', async () => {
    await fill();
    submit();
    request().flush({ detail: 'Duplicate email' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('already registered');
    expect(input('email').value).toBe('jane@example.com');
    expect(input('nationalPhone').value).toBe('9195550199');
    input('email').value = 'new@example.com';
    input('email').dispatchEvent(new Event('input'));
    await fixture.whenStable();
    submit();
    request().flush({ email: 'new@example.com' });
    await fixture.whenStable();
    expect(el().textContent).toContain('Thank You for Registering');
  });

  it('shows backend validation errors and keeps the form available', async () => {
    await fill();
    submit();
    request().flush(
      { detail: [{ loc: ['body', 'email'], msg: 'Email is not allowed' }] },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Email is not allowed');
    expect(el().querySelector('mat-error')?.textContent).toContain('Email is not allowed');
    expect(input('fullName').value).toBe('Jane Doe');
  });

  it('toggles password visibility without submitting', async () => {
    expect(input('password').type).toBe('password');
    el().querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!.click();
    await fixture.whenStable();
    expect(input('password').type).toBe('text');
    expect(el().querySelector('button[aria-label="Hide password"]')).toBeTruthy();
    http.expectNone('/bringthemhome/registrations');
  });

  it('checks minimum lengths after trimming names and notes', async () => {
    await fill();
    input('fullName').value = 'a ';
    input('fullName').dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    input('fullName').value = 'Jane Doe';
    input('fullName').dispatchEvent(new Event('input'));
    const notes = el().querySelector<HTMLTextAreaElement>('textarea')!;
    notes.value = 'short                 ';
    notes.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('revalidates the national number for the selected international country code', async () => {
    await fill();
    el().querySelector<HTMLElement>('mat-select[formControlName="countryCode"]')!.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
      .find((option) => option.textContent?.includes('United Kingdom'))!
      .click();
    input('nationalPhone').value = '02079460123';
    input('nationalPhone').dispatchEvent(new Event('input'));
    await fixture.whenStable();
    submit();
    const req = request();
    expect(req.request.body.phone).toBe('+442079460123');
    req.flush({ email: 'jane@example.com' });
  });
});
