import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { AccountManagementService } from '../services/account-management';
import { isAdministrator } from '../features/case-claims/case-claims.models';

@Component({
  selector: 'app-account-dashboard',
  imports: [MatButtonModule, MatIconModule, NavigationHeader, RouterLink],
  templateUrl: './account-dashboard.html',
  styleUrl: './account-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDashboard {
  protected readonly isAdmin = computed(() => isAdministrator(this.user()?.role));
  protected readonly user = toSignal(inject(AccountManagementService).currentUser$, {
    initialValue: null,
  });
  protected readonly roleLabel = computed(
    () =>
      this.user()
        ?.role?.trim()
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Not provided',
  );
}
