import { Routes } from '@angular/router';

import { MissingPersonsGalleryComponent } from './missing-persons-gallery/missing-persons-gallery.component';
import { MissingPersonsDetailComponent } from './missing-persons-detail/missing-persons-detail.component';
import { AccountDashboard } from './account-dashboard/account-dashboard';
import { AdvancedSearch } from './advanced-search/advanced-search';
import { AccountManagement } from './account-management/account-management';
import { ContactUs } from './contact-us/contact-us';
import { MissingPersonReport } from './missing-person-report/missing-person-report';
import { PolicyPageComponent } from './policy-page/policy-page.component';
import { PersonDetail } from './person-detail/person-detail';
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
    path: 'missing-persons/:id',
    component: MissingPersonsDetailComponent,
  },
  {
    path: 'advanced-search',
    component: AdvancedSearch,
  },
  {
    path: 'missing-person/:id',
    component: PersonDetail,
  },
  {
    path: 'account-management',
    component: AccountManagement,
  },
  {
    path: 'login',
    redirectTo: 'account-management',
    pathMatch: 'full',
  },
  {
    path: 'register',
    redirectTo: 'account-management',
    pathMatch: 'full',
  },
  {
    path: 'myaccount',
    component: AccountDashboard,
  },
  {
    path: 'missing-person-report',
    component: MissingPersonReport,
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
