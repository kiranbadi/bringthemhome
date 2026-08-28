import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface AccountRegistrationRequest {
  readonly email: string;
  readonly phone: string;
  readonly full_name: string;
  readonly notes: string;
}

export interface AccountRegistrationResponse extends AccountRegistrationRequest {
  readonly registration_id: number;
  readonly login_id: number;
  readonly temporary_password: string;
}

@Injectable({ providedIn: 'root' })
export class AccountManagementService {
  private readonly http = inject(HttpClient);

  register(request: AccountRegistrationRequest): Observable<AccountRegistrationResponse> {
    return this.http.post<AccountRegistrationResponse>(
      `${environment.apiBaseUrl}/registrations`,
      request,
    );
  }
}
