import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountManagementService, AuthenticatedUser } from './account-management';

const user = { id: '1', email: 'jane@example.com', full_name: 'Jane Doe', role: 'GENERAL_PUBLIC' };

describe('Auth session hydration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });
  afterEach(() => {
    sessionStorage.clear();
    document.cookie = 'currentUser=; Max-Age=0; Path=/';
    document.cookie = 'csrf_token=; Max-Age=0; Path=/';
  });

  it('hydrates the first reactive emission synchronously from stored user', () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const service = TestBed.inject(AccountManagementService);
    expect(service.currentUser$).toBeDefined();
    const values: (AuthenticatedUser | null)[] = [];
    const subscription = service.currentUser$.subscribe((value) => values.push(value));
    expect(values).toEqual([user]);
    subscription.unsubscribe();
  });

  it('synchronizes reactive state when storage is updated after initialization', () => {
    const service = TestBed.inject(AccountManagementService);
    expect(service.currentUser$).toBeDefined();
    let current: AuthenticatedUser | null = null;
    const subscription = service.currentUser$.subscribe((value) => (current = value));
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    expect(service.isAuthenticated()).toBe(true);
    expect(current).toEqual(user);
    sessionStorage.removeItem('currentUser');
    expect(service.isAuthenticated()).toBe(false);
    expect(current).toBeNull();
    subscription.unsubscribe();
  });

  for (const value of ['null', 'broken-json', '[]', '"not a user"']) {
    it(`treats ${value} as no stored user without crashing`, () => {
      sessionStorage.setItem('currentUser', value);
      expect(TestBed.inject(AccountManagementService).isAuthenticated()).toBe(false);
    });
  }

  it('logout clears auth keys, reactive state and associated readable cookies only', () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'csrf-value');
    sessionStorage.setItem('unrelated', 'keep');
    document.cookie = 'currentUser=legacy; Path=/';
    document.cookie = 'csrf_token=legacy; Path=/';
    const service = TestBed.inject(AccountManagementService);
    expect(typeof service.logout).toBe('function');
    service.logout().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8000/bringthemhome/auth/logout')
      .flush('');
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('currentUser')).toBeNull();
    expect(sessionStorage.getItem('csrf_token')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
    expect(document.cookie).not.toMatch(/(?:^|;\s*)(currentUser|csrf_token)=/);
    let current: AuthenticatedUser | null | undefined;
    service.currentUser$.subscribe((value) => (current = value)).unsubscribe();
    expect(current).toBeNull();
  });
});
