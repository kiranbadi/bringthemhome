import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AccountManagementService } from '../../services/account-management';

const user = {
  id: 'user-1',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  role: 'GENERAL_PUBLIC',
};

describe('Persisted account navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
  });
  afterEach(() => sessionStorage.clear());

  for (const path of ['/account-management', '/login', '/account/management']) {
    it(`opens the account dashboard from ${path} with a persisted session`, async () => {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      sessionStorage.setItem('csrf_token', 'persisted-token');
      const harness = await RouterTestingHarness.create(path);
      expect(harness.routeNativeElement?.textContent).toContain('My Account');
      expect(harness.routeNativeElement?.querySelector('app-registration')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/account/management');
      expect(sessionStorage.getItem('csrf_token')).toBe('persisted-token');
    });
  }

  it('keeps the session when navigating away and returning through the header link', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/myaccount');
    await harness.navigateByUrl('/support-us');
    await harness.navigateByUrl('/account-management');
    expect(harness.routeNativeElement?.textContent).toContain('My Account');
    expect(sessionStorage.getItem('currentUser')).toBe(JSON.stringify(user));
  });

  it('redirects a guest to login without a redirect loop', async () => {
    const harness = await RouterTestingHarness.create('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
  });

  it('redirects guests opening the report route to Login', async () => {
    const harness = await RouterTestingHarness.create('/missing-person-report');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
  });

  it('allows signed-in users to open the report route', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/missing-person-report');
    expect(TestBed.inject(Router).url).toBe('/missing-person-report');
    expect(harness.routeNativeElement?.textContent).toContain('Missing Person');
  });

  it('requires login again only after explicit logout', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/account/management');
    const service = TestBed.inject(AccountManagementService);
    service.logout().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8000/bringthemhome/auth/logout')
      .flush('');
    await harness.navigateByUrl('/support-us');
    await harness.navigateByUrl('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
