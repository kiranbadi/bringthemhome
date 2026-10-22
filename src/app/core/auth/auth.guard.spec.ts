import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { routes } from '../../app.routes';

describe('Authentication guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });
  afterEach(() => sessionStorage.clear());
  const check = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  it('protects the dashboard route', () => {
    expect(routes.find((route) => route.path === 'myaccount')?.canActivate).toContain(authGuard);
  });
  it('redirects missing sessions to login', () => {
    expect(check()).toEqual(TestBed.inject(Router).createUrlTree(['/login']));
  });
  it('permits an existing session', () => {
    sessionStorage.setItem('currentUser', JSON.stringify({ id: '1' }));
    expect(check()).toBe(true);
  });
});
