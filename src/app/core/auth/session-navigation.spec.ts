import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { csrfInterceptor } from './csrf.interceptor';
import { routes } from '../../app.routes';
import { AccountManagementService } from '../../services/account-management';

const user = {
  id: 'user-1',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  role: 'GENERAL_PUBLIC',
};

const reportEndpoint = 'http://localhost:8000/bringthemhome/api/v2/person-reports';
const draft = {
  _id: 'a1afe20f-8892-5f14-ac02-5364a83c4386',
  report_id: 'VFMFQNM29S',
  user_id: user.email,
  report_status: 'DRAFT',
};

describe('Persisted account navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
    for (const name of ['bth_report_context', '_id', 'report_id', 'user_id']) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  });

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

  it('rejects an expired session on reload before opening a protected route', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('bth_session_expires_at', new Date(Date.now() - 1_000).toISOString());
    await RouterTestingHarness.create('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(sessionStorage.getItem('currentUser')).toBeNull();
  });

  it('redirects a guest to login without a redirect loop', async () => {
    const harness = await RouterTestingHarness.create('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
  });

  it('redirects guests opening the report route to Login', async () => {
    const harness = await RouterTestingHarness.create('/missing-person-report');
    expect(TestBed.inject(Router).url).toBe(
      '/login?reason=report-account-required&returnUrl=%2Fmissing-person-report',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain(
      'Only signed-in users with a registered account can create a missing person report.',
    );
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(reportEndpoint);
  });

  it('does not show the report notice on ordinary login visits or after leaving the report login', async () => {
    const harness = await RouterTestingHarness.create('/login');
    expect(harness.routeNativeElement?.querySelector('.report-login-notice')).toBeNull();
    await harness.navigateByUrl('/missing-person-report');
    expect(harness.routeNativeElement?.querySelector('.report-login-notice')).not.toBeNull();
    await harness.navigateByUrl('/login');
    expect(harness.routeNativeElement?.querySelector('.report-login-notice')).toBeNull();
  });

  it.each(['combined', 'individual'])(
    'reuses matching %s report cookies without a POST',
    async (format) => {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      const context = {
        _id: draft._id,
        report_id: draft.report_id,
        user_id: user.email.toUpperCase(),
      };
      const cookies =
        format === 'combined' ? { bth_report_context: JSON.stringify(context) } : context;
      for (const [key, value] of Object.entries(cookies)) {
        document.cookie = `${key}=${encodeURIComponent(value)}; Path=/`;
      }
      const harness = await RouterTestingHarness.create('/missing-person-report');
      TestBed.inject(HttpTestingController).expectNone(reportEndpoint);
      expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
    },
  );

  it.each([
    JSON.stringify({ ...draft, user_id: 'other@example.com' }),
    JSON.stringify({ report_id: draft.report_id, user_id: user.email }),
    '{invalid JSON',
  ])('creates a draft if the report cookie is unusable (%s)', async (cookie) => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    document.cookie = `bth_report_context=${encodeURIComponent(cookie)}; Path=/`;
    const harness = await RouterTestingHarness.create('/missing-person-report');
    TestBed.inject(HttpTestingController).expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
  });

  it('opens the workspace only after creating a draft for the signed-in account', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
    const request = TestBed.inject(HttpTestingController).expectOne(reportEndpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ user_id: user.email });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    request.flush(draft, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
    await harness.navigateByUrl('/myaccount');
    await harness.navigateByUrl('/missing-person-report');
    TestBed.inject(HttpTestingController).expectNone(reportEndpoint);
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
  });

  it('keeps the workspace closed on failure and supports an explicit retry', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
    const retry =
      harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.report-retry');
    retry!.click();
    retry!.click();
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
  });

  it('returns to sign-in when the server rejects an expired report session', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush({}, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fmissing-person-report');
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
    expect(sessionStorage.getItem('currentUser')).toBeNull();
    http.expectNone(reportEndpoint);
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
