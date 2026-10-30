import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, combineLatest, startWith, switchMap, tap } from 'rxjs';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { AccountManagementService } from '../services/account-management';
import { ResourceService } from './resource.service';
import {
  CATEGORIES,
  Resource,
  SCOPES,
  STATUSES,
  coverage,
  resourceError,
  safeWebUrl,
  emailLink,
} from './resource.models';
import { ResourceAdminComponent } from './resource-admin.component';
import { ResourceVerificationComponent } from './resource-verification.component';

@Component({
  selector: 'app-resource-detail',
  imports: [
    NavigationHeader,
    DatePipe,
    RouterLink,
    MatButtonModule,
    ResourceVerificationComponent,
    ResourceAdminComponent,
  ],
  templateUrl: './resource-detail.component.html',
  styleUrls: ['./resources.scss', './resource-detail.component.scss'],
})
export class ResourceDetailComponent {
  readonly auth = inject(AccountManagementService);
  private readonly api = inject(ResourceService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly resource = signal<Resource | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly loginPrompt = signal(false);
  readonly retry = new Subject<void>();
  readonly categories = CATEGORIES;
  readonly scopes = SCOPES;
  readonly statuses = STATUSES;
  readonly coverage = coverage;
  readonly safeUrl = safeWebUrl;
  readonly emailLink = emailLink;
  readonly phoneLink = (phone: string) => 'tel:' + phone.replace(/[^+\d]/g, '');
  constructor() {
    combineLatest([this.route.paramMap, this.retry.pipe(startWith(undefined))])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.resource.set(null);
          this.loginPrompt.set(false);
        }),
        switchMap(([params]) =>
          this.api.detail(params.get('id')!).pipe(
            catchError((e) => {
              this.error.set(resourceError(e));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((r) => {
        this.resource.set(r);
        this.loading.set(false);
      });
  }
}
