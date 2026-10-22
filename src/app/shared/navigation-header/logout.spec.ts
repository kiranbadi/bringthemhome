import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { NavigationHeader } from './navigation-header';
import { AccountManagementService } from '../../services/account-management';

const user = { id: '1', email: 'jane@example.com', full_name: 'Jane Doe', role: 'GENERAL_PUBLIC' };

describe('Header logout flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [NavigationHeader],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
    for (const name of ['bth_csrf', 'bth_session', 'csrf_token', 'currentUser'])
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    vi.restoreAllMocks();
  });
  const button = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Logout'));

  it('hides Logout for guests', async () => {
    const fixture = TestBed.createComponent(NavigationHeader);
    await fixture.whenStable();
    expect(button(fixture.nativeElement)).toBeUndefined();
  });

  it('reads readable cookie tokens when session storage has only the legacy CSRF token', () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'login-csrf');
    document.cookie = 'bth_session=cookie-session; Path=/';
    const service = TestBed.inject(AccountManagementService);
    service.logout().subscribe();
    service.logout().subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/bringthemhome/auth/logout',
    );
    expect(request.request.headers.get('bth_csrf')).toBe('login-csrf');
    expect(request.request.headers.get('bth_session')).toBe('cookie-session');
    request.flush('');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears the session when the logout server never responds', async () => {
    vi.useFakeTimers();
    try {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      const service = TestBed.inject(AccountManagementService);
      let finished = false;
      service.logout().subscribe(() => (finished = true));
      const request = TestBed.inject(HttpTestingController).expectOne(
        'http://localhost:8000/bringthemhome/auth/logout',
      );
      await vi.advanceTimersByTimeAsync(10_000);
      expect(request.cancelled).toBe(true);
      expect(finished).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  for (const status of [200, 401, 500, 0]) {
    it(`sends logout once and tears down with home navigation and toast on ${status}`, async () => {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      sessionStorage.setItem('bth_csrf', 'csrf-value');
      sessionStorage.setItem('bth_session', 'session-value');
      sessionStorage.setItem('csrf_token', 'old-csrf');
      document.cookie = 'bth_csrf=csrf-value; Path=/';
      document.cookie = 'bth_session=session-value; Path=/';
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(NavigationHeader);
      const toast = vi
        .spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open')
        .mockImplementation(() => undefined as never);
      await fixture.whenStable();
      const logout = button(fixture.nativeElement)!;
      expect(logout).toBeDefined();
      logout.click();
      logout.click();
      await fixture.whenStable();
      expect(logout.disabled).toBe(true);
      const request = TestBed.inject(HttpTestingController).expectOne(
        'http://localhost:8000/bringthemhome/auth/logout',
      );
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toBe('');
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('bth_csrf')).toBe('csrf-value');
      expect(request.request.headers.get('bth_session')).toBe('session-value');
      request.flush('', { status, statusText: status === 200 ? 'OK' : 'Error' });
      await fixture.whenStable();
      for (const key of ['currentUser', 'bth_csrf', 'bth_session', 'csrf_token'])
        expect(sessionStorage.getItem(key)).toBeNull();
      expect(document.cookie).not.toMatch(/(?:^|;\s*)bth_(csrf|session)=/);
      expect(TestBed.inject(AccountManagementService).isAuthenticated()).toBe(false);
      expect(button(fixture.nativeElement)).toBeUndefined();
      expect(navigate).toHaveBeenCalledWith(['/']);
      expect(toast).toHaveBeenCalledWith(
        'You have been logged out successfully.',
        'Close',
        expect.any(Object),
      );
    });
  }
});
