import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navigation-header',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, RouterLink, RouterLinkActive],
  templateUrl: './navigation-header.html',
  styleUrls: ['./navigation-header.scss'],
})
export class NavigationHeader {
  protected readonly links = [
    { label: 'Home', route: '/' },
    { label: 'Support Us', route: 'support-us' },
    { label: 'Our Goal', route: 'goal' },
    { label: 'Advanced Search', route: 'advanced-search' },
    { label: 'Login', route: 'login' },
    { label: 'Register', route: 'register' },
    { label: 'Contact Us', route: 'contact-us' },
  ];
}
