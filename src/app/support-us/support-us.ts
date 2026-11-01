import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

@Component({
  selector: 'app-support-us',
  imports: [MatButtonModule, MatIconModule, NavigationHeader, RouterLink],
  templateUrl: './support-us.html',
  styleUrl: './support-us.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportUs {
  readonly supportOptions = [
    {
      icon: 'campaign',
      title: 'Share Active Cases',
      description:
        'Help case pages reach neighborhood groups, school networks, and local communities.',
      action: 'Find Cases',
      route: '/missing-persons',
    },
    {
      icon: 'groups',
      title: 'Volunteer Your Skills',
      description:
        'Offer your time for outreach, translation, poster preparation, or community coordination.',
      action: 'Volunteer',
      route: '/contact-us',
    },
    {
      icon: 'handshake',
      title: 'Partner With Us',
      description:
        'Connect your school, nonprofit, business, or local organization with our community.',
      action: 'Start a Partnership',
      route: '/contact-us',
    },
    {
      icon: 'volunteer_activism',
      title: 'Contribute Resources',
      description:
        'Help with printing, outreach materials, technology, or other practical support.',
      action: 'Discuss a Contribution',
      route: '/contact-us',
    },
  ] as const;
}
