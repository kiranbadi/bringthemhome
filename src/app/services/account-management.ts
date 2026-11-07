import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
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

import { safeReturnUrl } from '../core/auth/return-url';
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

export interface ForgotPasswordResponse {
  readonly message: string;
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
  readonly phone?: string | null;
}

export interface LoginResponse {
  readonly user: AuthenticatedUser;
  readonly csrf_token: string;
  readonly expires_at: string;
}

const SESSION_EXPIRY_KEY = 'bth_session_expires_at';
const MAX_TIMEOUT_MS = 2_147_483_647;

@Injectable({ providedIn: 'root' })
export class AccountManagementService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router, { optional: true });
  private readonly userSubject = new BehaviorSubject<AuthenticatedUser | null>(
    this.readStoredUser(),
  );
  private logoutRequest?: Observable<void>;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  readonly currentUser$ = this.userSubject.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
    this.scheduleExpiry();
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(
        `${environment.apiUrl}${environment.apiBaseUrl}/auth/reset-password`,
        { token, new_password: newPassword },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .pipe(timeout(15000));
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http
      .post<ForgotPasswordResponse>(
        `${environment.apiUrl}${environment.apiBaseUrl}/auth/forgot-password`,
        { email },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .pipe(timeout(15000));
  }

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
            const expiresAt = Date.parse(response.expires_at);
            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
              throw new Error('The login response did not contain an active session.');
            }
            sessionStorage.setItem(SESSION_EXPIRY_KEY, response.expires_at);
            sessionStorage.setItem('csrf_token', response.csrf_token);
            sessionStorage.setItem('bth_csrf', response.csrf_token);
            const sessionToken = this.readToken('bth_session');
            if (sessionToken) sessionStorage.setItem('bth_session', sessionToken);
            sessionStorage.setItem('currentUser', JSON.stringify(response.user));
            this.scheduleExpiry();
            this.userSubject.next(response.user);
          } catch (error) {
            this.clearLocalSession();
            throw error;
          }
        }),
      );
  }

  get currentUser(): AuthenticatedUser | null {
    const expiresAt = this.readSessionExpiry();
    if (expiresAt !== null && expiresAt <= Date.now()) {
      this.expireLocalSession();
      return null;
    }
    return this.readStoredUser();
  }

  isAuthenticated(): boolean {
    // Storage is authoritative, including when a guard runs before any subscribers.
    const user = this.currentUser;
    if (JSON.stringify(user) !== JSON.stringify(this.userSubject.value)) {
      this.userSubject.next(user);
    }
    return user !== null;
  }

  logout(): Observable<void> {
    if (this.logoutRequest) return this.logoutRequest;
    const csrfToken = this.csrfToken;
    this.logoutRequest = this.http
      .post(`${environment.apiUrl}${environment.apiBaseUrl}/auth/logout`, '', {
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
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

  expireLocalSession(): void {
    this.clearLocalSession();
    const router = this.router;
    if (!router) return;
    let route = router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    if (route.data['requiresAuth']) {
      const returnUrl = safeReturnUrl(router.url);
      void router.navigate(['/login'], {
        replaceUrl: true,
        queryParams: returnUrl ? { returnUrl } : undefined,
      });
    }
  }

  clearLocalSession(): void {
    clearTimeout(this.expiryTimer);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    const authKeys = ['currentUser', 'csrf_token', 'bth_csrf', 'bth_session'];
    for (const key of authKeys) sessionStorage.removeItem(key);
    for (const name of authKeys) {
      for (const path of ['/', '/bringthemhome', '/bringthemhome/auth']) {
        this.document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;
      }
    }
    this.userSubject.next(null);
  }

  private readSessionExpiry(): number | null {
    try {
      const stored = sessionStorage.getItem(SESSION_EXPIRY_KEY);
      if (stored === null) return null;
      const expiresAt = Date.parse(stored);
      return Number.isFinite(expiresAt) ? expiresAt : 0;
    } catch {
      return null;
    }
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    const expiresAt = this.readSessionExpiry();
    if (expiresAt === null) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      this.expireLocalSession();
      return;
    }
    this.expiryTimer = setTimeout(() => this.scheduleExpiry(), Math.min(delay, MAX_TIMEOUT_MS));
  }

  private readToken(name: string): string | null {
    const stored = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(name);
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
