import { Routes } from '@angular/router';

import { Home } from './home/home';
import { AdvancedSearch } from './advanced-search/advanced-search';
import { BasicPage } from './pages/basic-page/basic-page';

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
    path: 'login',
    component: BasicPage,
    data: { title: 'Login' },
  },
  {
    path: 'register',
    component: BasicPage,
    data: { title: 'Register' },
  },
  {
    path: 'contact-us',
    component: BasicPage,
    data: { title: 'Contact Us' },
  },
];
