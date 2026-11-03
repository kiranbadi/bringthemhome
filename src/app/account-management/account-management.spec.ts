import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountManagementService } from '../services/account-management';
import { AccountManagement } from './account-management';
import { RegistrationComponent } from '../registration/registration.component';
import { By } from '@angular/platform-browser';

describe('AccountManagement', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountManagement],
      providers: [
        provideRouter([]),
        {
          provide: AccountManagementService,
          useValue: {
            isAuthenticated: () => false,
            register: () => of({ email: 'jane@example.com' }),
          },
        },
      ],
    }).compileComponents();
  });

  it('hosts the new registration form alongside sign in', async () => {
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-registration')).toBeTruthy();
    expect(el.textContent).toContain('Sign In');
    expect(el.querySelectorAll('form').length).toBe(2);
  });

  it('prefills and focuses login when the thank-you action emits', async () => {
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const registration = fixture.debugElement.query(By.directive(RegistrationComponent))
      .componentInstance as RegistrationComponent;
    registration.proceedToLogin.emit('jane@example.com');
    await fixture.whenStable();
    const login = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[formControlName="identity"]',
    )!;
    expect(login.value).toBe('jane@example.com');
    expect(document.activeElement).toBe(login);
  });

  it('continues to show the existing password-recovery form', async () => {
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Forgot Password?'))!
      .click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Reset Password');
    expect(el.querySelector('app-registration')).toBeTruthy();
  });
  it('validates email, prevents duplicate requests, and shows confirmation only after success', async () => {
    const service = TestBed.inject(AccountManagementService);
    const response = new Subject<{ message: string }>();
    service.forgotPassword = vi.fn(() => response);
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Forgot Password?'))!
      .click();
    await fixture.whenStable();
    const form = el.querySelector('form')!;
    const input = form.querySelector<HTMLInputElement>('input')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(service.forgotPassword).not.toHaveBeenCalled();
    input.value = 'jane@example.com';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(service.forgotPassword).toHaveBeenCalledExactlyOnceWith('jane@example.com');
    await fixture.whenStable();
    expect(form.querySelector('button')!.disabled).toBe(true);
    expect(form.querySelector('[role="status"]')).toBeNull();
    response.next({
      message: 'If an account exists for this email, a password reset link will be sent.',
    });
    response.complete();
    await fixture.whenStable();
    expect(form.querySelector('[role="status"]')?.textContent).toContain(
      'If an account exists for this email, a password reset link will be sent.',
    );
    expect(form.querySelector('button')!.disabled).toBe(false);
  });

  it('retains the email and enables retry after a rate limit error', async () => {
    const service = TestBed.inject(AccountManagementService);
    const response = new Subject<{ message: string }>();
    service.forgotPassword = vi.fn(() => response);
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Forgot Password?'))!
      .click();
    await fixture.whenStable();
    const form = el.querySelector('form')!;
    const input = form.querySelector<HTMLInputElement>('input')!;
    input.value = 'jane@example.com';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    response.error(new HttpErrorResponse({ status: 429 }));
    await fixture.whenStable();
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('Too many reset requests');
    expect(input.value).toBe('jane@example.com');
    expect(input.disabled).toBe(false);
    expect(form.querySelector('[role="status"]')).toBeNull();
  });
});
