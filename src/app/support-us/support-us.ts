import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

@Component({
  selector: 'app-support-us',
  imports: [MatButtonModule, MatIconModule, NavigationHeader, RouterLink],
  templateUrl: './support-us.html',
  styleUrl: './support-us.scss',
})
export class SupportUs {}
