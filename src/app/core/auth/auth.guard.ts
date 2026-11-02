import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountManagementService } from '../../services/account-management';
import { safeReturnUrl } from './return-url';

export const authGuard: CanActivateFn = (route) =>
  inject(AccountManagementService).isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/login'], {
        queryParams:
          route.routeConfig?.path === 'missing-person-report'
            ? { reason: 'report-account-required' }
            : undefined,
      });

// Resolve the stored session before creating the login component to avoid a login flash.
export const guestGuard: CanActivateFn = (route) =>
  inject(AccountManagementService).isAuthenticated()
    ? inject(Router).parseUrl(
        safeReturnUrl(route.queryParamMap?.get('returnUrl')) ?? '/account/management',
      )
    : true;
