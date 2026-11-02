import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AccountManagement } from '../../account-management/account-management';
import { caseClaimsAdminGuard } from './case-claims.guard';

@Component({ template: '<h1>Destination</h1>' })
class Destination {}

describe('Claim sign-in return navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: AccountManagement },
          { path: 'missing-persons/:id', component: Destination },
          { path: 'account/management', component: Destination },
        ]),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
  });
  for (const [returnUrl, expected] of [
    ['/missing-persons/case-1#case-claims', '/missing-persons/case-1#case-claims'],
    ['https://example.com', '/account/management'],
  ]) {
    it(`returns only to the permitted local destination for ${returnUrl}`, async () => {
      const harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl(
        `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
        AccountManagement,
      );
      page['loginForm'].setValue({ identity: 'jane@example.com', password: 'StrongPassword123' });
      page['submitLogin']();
      TestBed.inject(HttpTestingController)
        .expectOne('http://localhost:8000/bringthemhome/auth/login')
        .flush({
          user: {
            id: 'member-1',
            email: 'jane@example.com',
            full_name: 'Jane',
            role: 'GENERAL_PUBLIC',
          },
          csrf_token: 'token',
          expires_at: '2026-11-01T04:00:00Z',
        });
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(expected);
    });
  }
});

describe('Case claims administrator guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });
  afterEach(() => sessionStorage.clear());
  for (const [role, expected] of [
    [null, '/login?returnUrl=%2Fadmin%2Fcase-claims'],
    ['GENERAL_PUBLIC', '/account/management'],
    ['ADMIN', true],
    ['ADMINISTRATOR', true],
  ] as const) {
    it(`gates staff routes for ${role ?? 'guests'}`, () => {
      if (role) sessionStorage.setItem('currentUser', JSON.stringify({ id: 'user-1', role }));
      const result = TestBed.runInInjectionContext(() =>
        caseClaimsAdminGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/admin/case-claims' } as RouterStateSnapshot,
        ),
      );
      expect(
        typeof result === 'boolean'
          ? result
          : TestBed.inject(Router).serializeUrl(result as UrlTree),
      ).toBe(expected);
    });
  }
});
