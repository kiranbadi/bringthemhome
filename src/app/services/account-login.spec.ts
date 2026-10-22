import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountManagementService } from './account-management';
import { csrfInterceptor } from '../core/auth/csrf.interceptor';

const response = {
  user: { id: 'user-1', email: 'jane@example.com', full_name: 'Jane Doe', role: 'GENERAL_PUBLIC' },
  csrf_token: 'csrf-value',
  expires_at: '2026-10-22T23:57:20.080428Z',
};

describe('Account login and CSRF', () => {
  let service: AccountManagementService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AccountManagementService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('posts exact credentials and stores the session before emitting success', () => {
    let reactiveUser: unknown;
    const subscription = service.currentUser$.subscribe((user) => (reactiveUser = user));
    const credentials = { email: 'jane@example.com', password: 'ReplaceWithAStrongPassword!' };
    service.login(credentials).subscribe((value) => {
      expect(value).toEqual(response);
      expect(reactiveUser).toEqual(response.user);
      expect(JSON.parse(sessionStorage.getItem('currentUser')!)).toEqual(response.user);
      expect(sessionStorage.getItem('csrf_token')).toBe(response.csrf_token);
      expect(service.isAuthenticated()).toBe(true);
    });
    const request = http.expectOne('http://localhost:8000/bringthemhome/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(credentials);
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    expect(request.request.withCredentials).toBe(true);
    request.flush(response);
    subscription.unsubscribe();
  });

  it('does not persist a failed login', () => {
    service.login({ email: 'jane@example.com', password: 'wrong' }).subscribe({ error: () => {} });
    http
      .expectOne('http://localhost:8000/bringthemhome/auth/login')
      .flush(
        { error_message: 'Invalid email or password.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('csrf_token')).toBeNull();
  });

  it('restores authentication from session presence', () => {
    expect(service.isAuthenticated()).toBe(false);
    sessionStorage.setItem('currentUser', JSON.stringify(response.user));
    expect(service.isAuthenticated()).toBe(true);
  });

  it('attaches CSRF only to backend mutations and never to login or external origins', () => {
    sessionStorage.setItem('csrf_token', response.csrf_token);
    service.register({} as Parameters<AccountManagementService['register']>[0]).subscribe();
    const backend = http.expectOne('/bringthemhome/registrations');
    expect(backend.request.headers.get('X-CSRF-Token')).toBe(response.csrf_token);
    backend.flush({});
    const client = TestBed.inject(HttpClient);
    client.post('https://example.com/bringthemhome/update', {}).subscribe();
    const external = http.expectOne('https://example.com/bringthemhome/update');
    expect(external.request.headers.has('X-CSRF-Token')).toBe(false);
    external.flush({});
    client.get('/bringthemhome/reports').subscribe();
    const read = http.expectOne('/bringthemhome/reports');
    expect(read.request.headers.has('X-CSRF-Token')).toBe(false);
    read.flush([]);
    service.login({ email: 'jane@example.com', password: 'password' }).subscribe();
    const login = http.expectOne('http://localhost:8000/bringthemhome/auth/login');
    expect(login.request.headers.has('X-CSRF-Token')).toBe(false);
    login.flush(response);
  });
});
