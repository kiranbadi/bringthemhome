import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  timeout,
} from 'rxjs';
import { DOCUMENT } from '@angular/common';

import { environment } from '../../environments/environment';

import { RegistrationPayload } from '../core/models/registration-payload.model';

export type AccountRegistrationRequest = RegistrationPayload;

export interface AccountRegistrationResponse {
  readonly email: string;
  readonly phone?: string;
  readonly full_name?: string;
  readonly notes?: string;
  readonly registration_id?: number;
  readonly login_id?: number;
  readonly temporary_password?: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
  readonly role: string;
}

export interface LoginResponse {
  readonly user: AuthenticatedUser;
  readonly csrf_token: string;
  readonly expires_at: string;
}

@Injectable({ providedIn: 'root' })
export class AccountManagementService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly userSubject = new BehaviorSubject<AuthenticatedUser | null>(
    this.readStoredUser(),
  );
  private logoutRequest?: Observable<void>;
  readonly currentUser$ = this.userSubject.asObservable();

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}${environment.apiBaseUrl}/auth/login`, request, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          // Persist before emitting success so navigation and guards see the session.
          try {
            sessionStorage.setItem('csrf_token', response.csrf_token);
            sessionStorage.setItem('bth_csrf', response.csrf_token);
            const sessionToken = this.readToken('bth_session');
            if (sessionToken) sessionStorage.setItem('bth_session', sessionToken);
            sessionStorage.setItem('currentUser', JSON.stringify(response.user));
            this.userSubject.next(response.user);
          } catch (error) {
            this.clearLocalSession();
            throw error;
          }
        }),
      );
  }

  isAuthenticated(): boolean {
    // Storage is authoritative, including when a guard runs before any subscribers.
    const user = this.readStoredUser();
    if (JSON.stringify(user) !== JSON.stringify(this.userSubject.value)) {
      this.userSubject.next(user);
    }
    return user !== null;
  }

  logout(): Observable<void> {
    if (this.logoutRequest) return this.logoutRequest;
    const headers = {
      bth_csrf: this.csrfToken ?? '',
      bth_session: this.readToken('bth_session') ?? '',
    };
    this.logoutRequest = this.http
      .post(`${environment.apiUrl}${environment.apiBaseUrl}/auth/logout`, '', {
        headers,
        withCredentials: true,
        responseType: 'text',
      })
      .pipe(
        // A stalled server must not keep the user signed in indefinitely.
        timeout(10_000),
        catchError(() => of('')),
        map(() => undefined),
        tap(() => this.clearLocalSession()),
        finalize(() => {
          this.logoutRequest = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.logoutRequest;
  }

  private clearLocalSession(): void {
    const authKeys = ['currentUser', 'csrf_token', 'bth_csrf', 'bth_session'];
    for (const key of authKeys) sessionStorage.removeItem(key);
    for (const name of authKeys) {
      for (const path of ['/', '/bringthemhome', '/bringthemhome/auth']) {
        this.document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
      }
    }
    this.userSubject.next(null);
  }

  private readToken(name: string): string | null {
    const stored = sessionStorage.getItem(name);
    if (stored) return stored;
    const cookie = this.document.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`));
    if (!cookie) return null;
    try {
      return decodeURIComponent(cookie.slice(name.length + 1));
    } catch {
      return cookie.slice(name.length + 1);
    }
  }

  private readStoredUser(): AuthenticatedUser | null {
    try {
      const stored = sessionStorage.getItem('currentUser');
      if (stored === null) return null;
      const user: unknown = JSON.parse(stored);
      return user !== null && typeof user === 'object' && !Array.isArray(user)
        ? (user as AuthenticatedUser)
        : null;
    } catch {
      return null;
    }
  }

  get csrfToken(): string | null {
    return this.readToken('bth_csrf') ?? this.readToken('csrf_token');
  }

  register(request: AccountRegistrationRequest): Observable<AccountRegistrationResponse> {
    return this.http.post<AccountRegistrationResponse>(
      `${environment.apiBaseUrl}/registrations`,
      request,
    );
  }
}
