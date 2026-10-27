import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

import { MissingPersonsGalleryComponent } from './missing-persons-gallery/missing-persons-gallery.component';
import { AccountDashboard } from './account-dashboard/account-dashboard';
import { AdvancedSearch } from './advanced-search/advanced-search';
import { AccountManagement } from './account-management/account-management';
import { ContactUs } from './contact-us/contact-us';
import { MissingPersonReport } from './missing-person-report/missing-person-report';
import { PolicyPageComponent } from './policy-page/policy-page.component';
import { SupportUs } from './support-us/support-us';

export const routes: Routes = [
  {
    path: 'terms',
    component: PolicyPageComponent,
    data: { policy: 'terms' },
    title: 'Terms & Conditions | Bring Them Home',
  },
  {
    path: 'privacy',
    component: PolicyPageComponent,
    data: { policy: 'privacy' },
    title: 'Privacy Policy | Bring Them Home',
  },
  {
    path: '',
    component: MissingPersonsGalleryComponent,
    pathMatch: 'full',
  },
  {
    path: 'missing-persons',
    component: MissingPersonsGalleryComponent,
  },
  {
    path: 'missing-persons/:id/discussions',
    loadComponent: () =>
      import('./discussions/discussion-page.component').then((m) => m.DiscussionPageComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./discussions/case-discussion-board.component').then(
            (m) => m.CaseDiscussionBoardComponent,
          ),
      },
      {
        path: ':discussionId',
        loadComponent: () =>
          import('./discussions/discussion-detail.component').then(
            (m) => m.DiscussionDetailComponent,
          ),
      },
    ],
  },
  {
    path: 'missing-persons/:id',
    loadComponent: () =>
      import('./missing-persons-detail/missing-persons-detail.component').then(
        (m) => m.MissingPersonsDetailComponent,
      ),
  },
  {
    path: 'advanced-search',
    component: AdvancedSearch,
  },
  {
    path: 'missing-person/:id',
    redirectTo: 'missing-persons/:id',
    pathMatch: 'full',
  },
  {
    path: 'account-management',
    component: AccountManagement,
    canActivate: [guestGuard],
  },
  {
    path: 'login',
    component: AccountManagement,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    redirectTo: 'account-management',
    pathMatch: 'full',
  },
  {
    path: 'account/management',
    component: AccountDashboard,
    canActivate: [authGuard],
  },
  {
    path: 'myaccount',
    component: AccountDashboard,
    canActivate: [authGuard],
  },
  {
    path: 'missing-person-report',
    component: MissingPersonReport,
    canActivate: [authGuard],
  },
  {
    path: 'support-us',
    component: SupportUs,
  },
  {
    path: 'contact-us',
    component: ContactUs,
  },
];
