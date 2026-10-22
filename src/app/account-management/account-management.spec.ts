import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccountManagementService } from '../services/account-management';
import { AccountManagement } from './account-management';
import { RegistrationComponent } from '../registration/registration.component';
import { By } from '@angular/platform-browser';

describe('AccountManagement', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountManagement],
      providers: [
        provideRouter([]),
        {
          provide: AccountManagementService,
          useValue: {
            isAuthenticated: () => false,
            register: () => of({ email: 'jane@example.com' }),
          },
        },
      ],
    }).compileComponents();
  });

  it('hosts the new registration form alongside sign in', async () => {
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-registration')).toBeTruthy();
    expect(el.textContent).toContain('Sign In');
    expect(el.querySelectorAll('form').length).toBe(2);
  });

  it('prefills and focuses login when the thank-you action emits', async () => {
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const registration = fixture.debugElement.query(By.directive(RegistrationComponent))
      .componentInstance as RegistrationComponent;
    registration.proceedToLogin.emit('jane@example.com');
    await fixture.whenStable();
    const login = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[formControlName="identity"]',
    )!;
    expect(login.value).toBe('jane@example.com');
    expect(document.activeElement).toBe(login);
  });

  it('continues to show the existing password-recovery form', async () => {
    const fixture = TestBed.createComponent(AccountManagement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Forgot Password?'))!
      .click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Reset Password');
    expect(el.querySelector('app-registration')).toBeTruthy();
  });
});
