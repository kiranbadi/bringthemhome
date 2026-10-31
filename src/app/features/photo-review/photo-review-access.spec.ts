import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { routes } from '../../app.routes';
import { AccountManagementService } from '../../services/account-management';
import { NavigationHeader } from '../../shared/navigation-header/navigation-header';
import { PhotoReviewComponent } from './photo-review.component';

@Component({ template: '<h1>Login</h1>' })
class LoginPage {}

describe('Photo review access', () => {
  const user = {
    id: '1',
    full_name: 'Reviewer',
    email: 'reviewer@example.com',
    role: 'GENERAL_PUBLIC',
  };
  const currentUser = new BehaviorSubject<typeof user | null>(null);

  beforeEach(() => {
    currentUser.next(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([
          routes.find((route) => route.path === 'photo-review')!,
          { path: 'login', component: LoginPage },
        ]),
        {
          provide: AccountManagementService,
          useValue: {
            currentUser$: currentUser.asObservable(),
            isAuthenticated: () => currentUser.value !== null,
          },
        },
      ],
    });
  });

  it('redirects guests from the protected page to login', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/photo-review', LoginPage);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('input[type=file]')).toBeNull();
  });

  it('loads the photo page for authenticated users', async () => {
    currentUser.next(user);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/photo-review', PhotoReviewComponent);
    expect(harness.routeNativeElement?.querySelectorAll('input[type=file]')).toHaveLength(2);
  });

  it('shows the navigation entry only while authenticated', async () => {
    const fixture = TestBed.createComponent(NavigationHeader);
    await fixture.whenStable();
    const link = () =>
      (fixture.nativeElement as HTMLElement).querySelector('a[href="/photo-review"]');
    expect(link()).toBeNull();
    currentUser.next(user);
    await fixture.whenStable();
    expect(link()?.textContent).toContain('Photo Review');
    currentUser.next(null);
    await fixture.whenStable();
    expect(link()).toBeNull();
  });
});
