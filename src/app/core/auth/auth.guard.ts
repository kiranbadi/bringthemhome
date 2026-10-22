import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountManagementService } from '../../services/account-management';

export const authGuard: CanActivateFn = () =>
  inject(AccountManagementService).isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/login']);

// Resolve the stored session before creating the login component to avoid a login flash.
export const guestGuard: CanActivateFn = () =>
  inject(AccountManagementService).isAuthenticated()
    ? inject(Router).createUrlTree(['/account/management'])
    : true;
