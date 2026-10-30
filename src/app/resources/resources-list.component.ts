import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SearchableSelectComponent } from './searchable-select.component';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, combineLatest, startWith, switchMap, tap } from 'rxjs';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { AccountManagementService } from '../services/account-management';
import { ResourceService } from './resource.service';
import { ResourceLocationsComponent } from './resource-locations.component';
import { ResourceCardComponent } from './resource-card.component';
import { CATEGORIES, SCOPES, Page, Resource, resourceError } from './resource.models';

@Component({
  selector: 'app-resources-list',
  imports: [
    NavigationHeader,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    SearchableSelectComponent,
    MatPaginatorModule,
    ResourceLocationsComponent,
    ResourceCardComponent,
  ],
  templateUrl: './resources-list.component.html',
  styleUrl: './resources.scss',
})
export class ResourcesListComponent implements OnInit {
  readonly auth = inject(AccountManagementService);
  private readonly api = inject(ResourceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly locationNotice = signal('');
  readonly reload = new Subject<void>();
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal<Page<Resource> | null>(null);
  readonly categories = Object.entries(CATEGORIES);
  readonly scopes = Object.entries(SCOPES);
  readonly categoryOptions = this.categories.map(([id, name]) => ({ id, name }));
  readonly scopeOptions = this.scopes.map(([id, name]) => ({ id, name }));
  readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    scope: new FormControl('', { nonNullable: true }),
    state: new FormControl('', { nonNullable: true }),
    county: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
  });
  ngOnInit() {
    combineLatest([this.route.queryParamMap, this.reload.pipe(startWith(undefined))])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(([params]) => {
          const values = {
            search: params.get('q') ?? params.get('search') ?? '',
            category: params.get('category') ?? '',
            scope: params.get('scope') ?? '',
            state: params.get('state') ?? '',
            county: params.get('county') ?? '',
            city: params.get('city') ?? '',
          };
          const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
          const needsResolve =
            values.state &&
            ((values.city && !values.county) || !/^(?:[a-z]{2}|\d{2})$/i.test(values.state));
          if (needsResolve)
            return this.api.resolve(values.state, values.county, values.city).pipe(
              switchMap((resolved) => {
                if ((values.county && !resolved.county) || (values.city && !resolved.city))
                  this.locationNotice.set(
                    'Some case locations could not be matched. Showing resources for the matched area.',
                  );
                void this.router.navigate(['/resources'], {
                  queryParams: { ...values, ...resolved, page },
                  replaceUrl: true,
                });
                return EMPTY;
              }),
              catchError(() => {
                this.locationNotice.set(
                  'The case location could not be matched. Showing the unfiltered directory.',
                );
                void this.router.navigate(['/resources'], { replaceUrl: true });
                return EMPTY;
              }),
            );
          this.filters.setValue(values);
          return this.api.list({ ...values, page }).pipe(
            catchError((e) => {
              this.error.set(resourceError(e));
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((p) => {
        this.page.set(p);
        this.loading.set(false);
      });
  }
  search() {
    const values = this.filters.getRawValue();
    void this.router
      .navigate(['/resources'], { queryParams: { ...values, page: 1 } })
      .then((navigated) => {
        if (!navigated) this.reload.next();
      });
  }
  clear() {
    this.locationNotice.set('');
    void this.router.navigate(['/resources']);
  }
  paginate(e: PageEvent) {
    void this.router.navigate(['/resources'], {
      queryParams: { ...this.filters.getRawValue(), page: e.pageIndex + 1 },
    });
  }
}
