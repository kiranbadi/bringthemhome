import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Location } from '@angular/common';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { ResetPassword } from './reset-password';
import { AccountManagementService } from '../services/account-management';

describe('Reset password', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { fragment: 'token=email-token' } } },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('posts the token and new_password using the backend contract', () => {
    TestBed.inject(AccountManagementService)
      .resetPassword('email-token', 'A strong password!')
      .subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/bringthemhome/auth/reset-password',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'email-token', new_password: 'A strong password!' });
    req.flush({ message: 'Password reset successfully. Please sign in with your new password.' });
  });
  it('reads the fragment, scrubs the address, validates confirmation and redirects after success', () => {
    const scrub = vi.spyOn(TestBed.inject(Location), 'replaceState');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const response = new Subject<{ message: string }>();
    const reset = vi
      .spyOn(TestBed.inject(AccountManagementService), 'resetPassword')
      .mockReturnValue(response);
    const fixture = TestBed.createComponent(ResetPassword);
    const page = fixture.componentInstance;
    expect(scrub).toHaveBeenCalled();
    page.form.setValue({ password: 'A strong password!', confirmation: 'different' });
    page.submit();
    expect(reset).not.toHaveBeenCalled();
    page.form.controls.confirmation.setValue('A strong password!');
    page.submit();
    page.submit();
    expect(reset).toHaveBeenCalledExactlyOnceWith('email-token', 'A strong password!');
    expect(navigate).not.toHaveBeenCalled();
    response.next({
      message: 'Password reset successfully. Please sign in with your new password.',
    });
    response.complete();
    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
    expect(page.form.controls.password.value).toBe('');
  });
  it('rejects missing links without making a request', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { fragment: null } } });
    const reset = vi.spyOn(TestBed.inject(AccountManagementService), 'resetPassword');
    const page = TestBed.createComponent(ResetPassword).componentInstance;
    page.submit();
    expect(page.invalidLink()).toBe(true);
    expect(reset).not.toHaveBeenCalled();
  });
  it('makes expired or reused tokens unusable after a 400 response', () => {
    const response = new Subject<{ message: string }>();
    const reset = vi
      .spyOn(TestBed.inject(AccountManagementService), 'resetPassword')
      .mockReturnValue(response);
    const page = TestBed.createComponent(ResetPassword).componentInstance;
    page.form.setValue({ password: 'A strong password!', confirmation: 'A strong password!' });
    page.submit();
    response.error(new HttpErrorResponse({ status: 400 }));
    expect(page.invalidLink()).toBe(true);
    expect(page.pending()).toBe(false);
    page.submit();
    expect(reset).toHaveBeenCalledTimes(1);
  });
  it('allows retry for backend errors', () => {
    const response = new Subject<{ message: string }>();
    vi.spyOn(TestBed.inject(AccountManagementService), 'resetPassword').mockReturnValue(response);
    const page = TestBed.createComponent(ResetPassword).componentInstance;
    page.form.setValue({ password: 'A strong password!', confirmation: 'A strong password!' });
    page.submit();
    response.error(new HttpErrorResponse({ status: 503 }));
    expect(page.invalidLink()).toBe(false);
    expect(page.form.enabled).toBe(true);
    expect(page.error()).toContain('try again');
  });
});
