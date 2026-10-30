import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AccountManagementService } from '../../services/account-management';

@Component({
  selector: 'app-navigation-header',
  imports: [
    AsyncPipe,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './navigation-header.html',
  styleUrls: ['./navigation-header.scss'],
})
export class NavigationHeader {
  private readonly authService = inject(AccountManagementService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly currentUser$ = this.authService.currentUser$;
  protected readonly loggingOut = signal(false);

  protected logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.authService.logout().subscribe(() => {
      this.loggingOut.set(false);
      void this.router.navigate(['/']);
      this.snackBar.open('You have been logged out successfully.', 'Close', { duration: 5000 });
    });
  }

  protected readonly links = [
    { label: 'Home', route: '/' },
    { label: 'Account', route: '/account/management' },
    { label: 'Search', route: '/advanced-search' },
    { label: 'Resources', route: '/resources' },
    { label: 'Support Us', route: '/support-us' },
    { label: 'Contact Us', route: '/contact-us' },
  ];
}
