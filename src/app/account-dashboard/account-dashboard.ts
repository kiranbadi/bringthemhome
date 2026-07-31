import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

@Component({
  selector: 'app-account-dashboard',
  imports: [MatButtonModule, MatIconModule, NavigationHeader, RouterLink],
  templateUrl: './account-dashboard.html',
  styleUrl: './account-dashboard.scss',
})
export class AccountDashboard {}
