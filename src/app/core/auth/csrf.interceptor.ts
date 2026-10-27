import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AccountManagementService } from '../../services/account-management';

export const csrfInterceptor: HttpInterceptorFn = (request, next) => {
  const backend = new URL(environment.apiUrl);
  const url = new URL(request.url, backend);
  const isBackend =
    url.origin === backend.origin &&
    (url.pathname.startsWith(`${environment.apiBaseUrl}/`) ||
      /^\/api\/(cases\/|discussions(?:\/|$)|comments(?:\/|$)|discussion-uploads\/)/.test(
        url.pathname,
      ));
  const isLogin = url.pathname === `${environment.apiBaseUrl}/auth/login`;
  const isLogout = url.pathname === `${environment.apiBaseUrl}/auth/logout`;
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (isBackend && isMutation && !isLogin && !isLogout) {
    const token = inject(AccountManagementService).csrfToken;
    if (token) {
      return next(request.clone({ setHeaders: { 'X-CSRF-Token': token }, withCredentials: true }));
    }
  }
  return next(request);
};
