import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AccountManagement } from './account-management';

describe('Login UI integration', () => {
  let fixture: ComponentFixture<AccountManagement>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  const root = () => fixture.nativeElement as HTMLElement;
  const submit = () => fixture.componentInstance['submitLogin']();
  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AccountManagement],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    fixture.componentInstance['loginForm'].setValue({
      identity: 'jane@example.com',
      password: 'ReplaceWithAStrongPassword!',
    });
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('redirects during component initialization when a saved user already exists', async () => {
    fixture.destroy();
    sessionStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: '1',
        email: 'jane@example.com',
        full_name: 'Jane Doe',
        role: 'GENERAL_PUBLIC',
      }),
    );
    fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/account/management']);
    http.expectNone('http://localhost:8000/bringthemhome/auth/login');
  });

  it('locks pending submissions, shows a spinner and navigates after persistence', async () => {
    submit();
    submit();
    const request = http.expectOne('http://localhost:8000/bringthemhome/auth/login');
    expect(request.request.body).toEqual({
      email: 'jane@example.com',
      password: 'ReplaceWithAStrongPassword!',
    });
    await fixture.whenStable();
    expect(root().querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(
      true,
    );
    expect(root().querySelector('mat-spinner')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    request.flush({
      user: { id: '1', email: 'jane@example.com', full_name: 'Jane Doe', role: 'GENERAL_PUBLIC' },
      csrf_token: 'token',
      expires_at: '2026-10-22T23:57:20Z',
    });
    await fixture.whenStable();
    expect(sessionStorage.getItem('currentUser')).toContain('Jane Doe');
    expect(navigate).toHaveBeenCalledWith(['/account/management']);
    submit();
    http.expectNone('http://localhost:8000/bringthemhome/auth/login');
  });

  for (const status of [400, 401, 429, 500, 0]) {
    it(`displays the appropriate ${status} error and permits retry`, async () => {
      submit();
      http
        .expectOne('http://localhost:8000/bringthemhome/auth/login')
        .flush({ error_message: 'Invalid email or password.' }, { status, statusText: 'Error' });
      await fixture.whenStable();
      const text = root().querySelector('[role="alert"]')?.textContent;
      expect(text).toContain(
        status === 429
          ? 'Too many login attempts. Please try again after 10 minutes or Reset the password'
          : status === 400 || status === 401
            ? 'Invalid email or password.'
            : 'Unable to sign in. Please try again.',
      );
      expect(navigate).not.toHaveBeenCalled();
      expect(root().querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(
        false,
      );
      submit();
      http
        .expectOne('http://localhost:8000/bringthemhome/auth/login')
        .flush({}, { status: 401, statusText: 'Unauthorized' });
    });
  }

  it('requires email rather than phone and does not request on invalid submission', () => {
    fixture.componentInstance['loginForm'].controls.identity.setValue('2014848805');
    submit();
    expect(fixture.componentInstance['loginForm'].controls.identity.invalid).toBe(true);
    http.expectNone('http://localhost:8000/bringthemhome/auth/login');
  });
});
