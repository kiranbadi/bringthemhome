import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Observable, Subject } from 'rxjs';

import {
  AccountManagementService,
  AccountRegistrationRequest,
  AccountRegistrationResponse,
} from '../services/account-management';
import { AccountManagement } from './account-management';

class AccountManagementServiceFake {
  readonly requests: AccountRegistrationRequest[] = [];
  response$ = new Subject<AccountRegistrationResponse>();

  register(request: AccountRegistrationRequest): Observable<AccountRegistrationResponse> {
    this.requests.push(request);
    return this.response$;
  }
}

describe('AccountManagement', () => {
  let component: AccountManagement;
  let fixture: ComponentFixture<AccountManagement>;
  let accountService: AccountManagementServiceFake;

  const formValue = {
    email: 'kiranbadi6@yahoo.com',
    phone: '6462013106',
    fullName: 'Kiran Badi4',
    notes: 'This is a test note',
    website: '',
  };

  const response: AccountRegistrationResponse = {
    registration_id: 7,
    login_id: 3,
    email: formValue.email,
    phone: formValue.phone,
    full_name: formValue.fullName,
    notes: formValue.notes,
    temporary_password: 'pYl5RErb',
  };

  beforeEach(async () => {
    accountService = new AccountManagementServiceFake();

    await TestBed.configureTestingModule({
      imports: [AccountManagement],
      providers: [
        provideRouter([]),
        { provide: AccountManagementService, useValue: accountService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  function registrationState() {
    return component as unknown as {
      registerForm: { setValue(value: typeof formValue): void; getRawValue(): typeof formValue };
      registrationPending: boolean;
      registrationResponse?: AccountRegistrationResponse;
      registrationError: string;
      submitRegistration(): void;
    };
  }

  it('maps the registration form to the account service request', () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);

    state.submitRegistration();

    expect(accountService.requests).toEqual([
      {
        email: formValue.email,
        phone: formValue.phone,
        full_name: formValue.fullName,
        notes: formValue.notes,
      },
    ]);
    expect(state.registrationPending).toBe(true);
  });

  it('clears pending and stores credentials as soon as registration succeeds', () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);
    state.submitRegistration();

    accountService.response$.next(response);

    expect(state.registrationPending).toBe(false);
    expect(state.registrationResponse).toEqual(response);
    expect(state.registrationError).toBe('');
  });

  it('preserves entered values and exposes an error after registration fails', () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);
    state.submitRegistration();

    accountService.response$.error(new Error('Network unavailable'));

    expect(state.registrationPending).toBe(false);
    expect(state.registrationResponse).toBeUndefined();
    expect(state.registrationError).not.toBe('');
    expect(state.registerForm.getRawValue()).toEqual(formValue);
  });

  it('explains when the email or phone is already registered', () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);
    state.submitRegistration();

    accountService.response$.error(
      new HttpErrorResponse({
        status: 409,
        error: { detail: 'A registration with this email or phone already exists.' },
      }),
    );

    expect(state.registrationError).toBe(
      'A registration with this email or phone already exists. Try signing in or use different contact information.',
    );
  });

  it('renders both login IDs, the temporary password, and a save warning', async () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);
    state.submitRegistration();

    accountService.response$.next(response);
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain(formValue.email);
    expect(page.textContent).toContain(formValue.phone);
    expect(page.textContent).toContain(response.temporary_password);
    expect(page.textContent?.toLowerCase()).toContain('save this information');
  });

  it('disables the registration button while the request is pending', async () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);
    state.submitRegistration();
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector(
      '.account-panel:last-child button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Registering');
  });

  it('renders an error and keeps the registration inputs populated', async () => {
    const state = registrationState();
    state.registerForm.setValue(formValue);
    state.submitRegistration();

    accountService.response$.error(new Error('Network unavailable'));
    await fixture.whenStable();

    const panel = fixture.nativeElement.querySelector('.account-panel:last-child') as HTMLElement;
    const alert = panel.querySelector('[role="alert"]');
    const email = panel.querySelector('input[formControlName="email"]') as HTMLInputElement;
    const button = panel.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(alert?.textContent).toContain('could not complete your registration');
    expect(email.value).toBe(formValue.email);
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Register');
  });
});
