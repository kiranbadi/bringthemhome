import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import {
  AccountManagementService,
  AccountRegistrationRequest,
  AccountRegistrationResponse,
} from './account-management';

describe('AccountManagementService', () => {
  let service: AccountManagementService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AccountManagementService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('posts a registration and returns the generated credentials', () => {
    expect(environment.apiBaseUrl).toBe('/bringthemhome');

    const request: AccountRegistrationRequest = {
      email: 'kiranbadi6@yahoo.com',
      phone: '6462013106',
      full_name: 'Kiran Badi4',
      notes: 'This is a test note',
    };
    const response: AccountRegistrationResponse = {
      registration_id: 7,
      login_id: 3,
      email: request.email,
      phone: request.phone,
      full_name: request.full_name,
      notes: request.notes,
      temporary_password: 'pYl5RErb',
    };
    let actual: AccountRegistrationResponse | undefined;

    service.register(request).subscribe((value) => (actual = value));

    const httpRequest = httpTesting.expectOne(`${environment.apiBaseUrl}/registrations`);
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.body).toEqual(request);

    httpRequest.flush(response);
    expect(actual).toEqual(response);
  });
});
