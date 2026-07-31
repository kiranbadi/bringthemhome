import { Routes } from '@angular/router';

import { Home } from './home/home';
import { AccountDashboard } from './account-dashboard/account-dashboard';
import { AdvancedSearch } from './advanced-search/advanced-search';
import { AccountManagement } from './account-management/account-management';
import { ContactUs } from './contact-us/contact-us';
import { MissingPersonReport } from './missing-person-report/missing-person-report';
import { BasicPage } from './pages/basic-page/basic-page';
import { PersonDetail } from './person-detail/person-detail';
import { SupportUs } from './support-us/support-us';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    pathMatch: 'full',
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
