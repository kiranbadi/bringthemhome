import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountManagementService } from '../../services/account-management';

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const backend = new URL(environment.apiUrl);
  const url = new URL(request.url, backend);
  const isBackend =
    url.origin === backend.origin &&
    (url.pathname.startsWith(`${environment.apiBaseUrl}/`) || url.pathname.startsWith('/api/'));
  const isLogin = url.pathname === `${environment.apiBaseUrl}/auth/login`;
  const isLogout = url.pathname === `${environment.apiBaseUrl}/auth/logout`;
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (!isBackend || isLogin || isLogout || (!isMutation && !request.withCredentials)) {
    return next(request);
  }

  const auth = inject(AccountManagementService);
  const token = auth.csrfToken;
  const outgoing =
    isMutation && token
      ? request.clone({ setHeaders: { 'X-CSRF-Token': token }, withCredentials: true })
      : request;
  const userId = outgoing.withCredentials ? auth.currentUser?.id : undefined;
  if (!userId) return next(outgoing);

  return next(outgoing).pipe(
    tap({
      error: (error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          error.status === 401 &&
          auth.currentUser?.id === userId &&
          auth.csrfToken === token
        ) {
          auth.expireLocalSession();
        }
      },
    }),
  );
};
