import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountManagementService } from '../../services/account-management';
import { isAdministrator } from './case-claims.models';
import { safeReturnUrl } from '../../core/auth/return-url';
export const caseClaimsAdminGuard: CanActivateFn = (_, state) => {
  const auth = inject(AccountManagementService),
    router = inject(Router);
  if (!auth.isAuthenticated())
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: safeReturnUrl(state.url) },
    });
  let role: string | undefined;
  auth.currentUser$.subscribe((user) => (role = user?.role)).unsubscribe();
  return isAdministrator(role) ? true : router.createUrlTree(['/account/management']);
};
