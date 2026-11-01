import { CaseShareService } from '../shared/case-share/case-share.service';
import { CaseShareComponent } from '../shared/case-share/case-share.component';
import { TipDialogService } from '../components/submit-tip/tip-dialog.service';
import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, firstValueFrom, switchMap, tap } from 'rxjs';
import {
  MissingPerson,
  MissingPersonSearchFilters,
  SEARCH_FILTER_KEYS,
  PaginatedMissingPersonsResponse,
} from '../core/models/missing-person.model';
import {
  PERSON_PLACEHOLDER,
  personLocation,
  personReportedDate,
} from '../core/models/missing-person-display';
import { MissingPersonService } from '../core/services/missing-person.service';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { NaturalSearchHeroComponent } from '../features/natural-search/natural-search-hero.component';
import { NaturalSearchService } from '../features/natural-search/natural-search.service';
import {
  ApiError,
  SearchPayload,
  searchError,
} from '../features/natural-search/natural-search.models';

@Component({
  selector: 'app-missing-persons-gallery',
  standalone: true,
  imports: [
    CaseShareComponent,
    NavigationHeader,
    RouterLink,
    TitleCasePipe,
    NaturalSearchHeroComponent,
  ],
  templateUrl: './missing-persons-gallery.component.html',
  styleUrl: './missing-persons-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingPersonsGalleryComponent implements OnInit {
  private readonly caseShare = inject(CaseShareService);
  private readonly tipDialog = inject(TipDialogService);
  readonly openingTip = signal(false);
  readonly tipError = signal('');
  private readonly route = inject(ActivatedRoute);
  private filters: MissingPersonSearchFilters = {};
  readonly isSearch = signal(false);
  private readonly service = inject(MissingPersonService);
  private readonly naturalService = inject(NaturalSearchService);
  private naturalPayload: SearchPayload | null = null;
  readonly naturalActive = signal(false);
  readonly naturalError = signal<ApiError | null>(null);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly requests = new Subject<number>();
  private requestedPage = 1;

  @ViewChild('galleryHeading') private galleryHeading?: ElementRef<HTMLElement>;

  readonly pageSize = 20;
  readonly response = signal<PaginatedMissingPersonsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly shareMessage = signal('');
  readonly records = computed(() => this.response()?.records ?? []);
  readonly currentPage = computed(() => this.response()?.current_page ?? 1);
  readonly totalPages = computed(() => this.response()?.total_pages ?? 0);
  readonly failedImages = signal<ReadonlySet<string>>(new Set());
  readonly placeholder = PERSON_PLACEHOLDER;
  readonly location = personLocation;
  readonly reportedDate = personReportedDate;
  readonly skeletons = Array.from({ length: 8 }, (_, index) => index);

  ngOnInit(): void {
    this.requests
      .pipe(
        tap((page) => {
          this.requestedPage = page;
          this.loading.set(true);
          this.error.set('');
          this.naturalError.set(null);
          this.shareMessage.set('');
        }),
        switchMap((page) =>
          (this.naturalPayload
            ? this.naturalService.search({ ...this.naturalPayload, page })
            : this.isSearch()
              ? this.service.searchMissingPersons(this.filters, page, this.pageSize)
              : this.service.getMissingPersons(page, this.pageSize)
          ).pipe(
            tap((response) => {
              this.response.set(response);
              this.failedImages.set(new Set());
              this.loading.set(false);
            }),
            catchError((error: unknown) => {
              this.loading.set(false);
              if (this.naturalPayload) {
                const failure = searchError(error);
                this.naturalError.set(failure);
                this.response.set(null);
                this.error.set(failure.message);
              } else this.error.set('We could not load missing persons. Please try again.');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.naturalPayload = null;
      if (params.has('nl_query')) {
        const naturalFilters: SearchPayload['filters'] = {};
        for (const key of [
          'state',
          'city',
          'gender',
          'date_last_seen_after',
          'date_last_seen_before',
        ] as const) {
          const value = params.get(`nl_${key}`)?.trim();
          if (value) naturalFilters[key] = value;
        }
        for (const key of ['age_min', 'age_max'] as const) {
          const value = params.get(`nl_${key}`);
          if (value !== null && value !== '' && Number.isFinite(Number(value)))
            naturalFilters[key] = Number(value);
        }
        this.naturalPayload = {
          query: params.get('nl_query')?.trim() ?? '',
          mode: params.get('nl_mode') === 'exact' ? 'exact' : 'semantic',
          filters: naturalFilters,
          page: 1,
          page_size: this.pageSize,
        };
      }
      this.naturalActive.set(this.naturalPayload !== null);
      const filters: Record<string, string> = {};
      for (const key of SEARCH_FILTER_KEYS) {
        const value = params.get(key)?.trim();
        if (value) filters[key] = value;
      }
      this.filters = filters as MissingPersonSearchFilters;
      this.isSearch.set(
        this.naturalActive() || params.get('search') === 'true' || Object.keys(filters).length > 0,
      );
      const page = Number(params.get('page') ?? 1);
      this.requests.next(Number.isInteger(page) && page > 0 ? page : 1);
    });
  }

  goToPage(page: number): void {
    if (
      this.loading() ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > this.totalPages() ||
      page === this.currentPage()
    )
      return;
    if (this.isSearch()) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page },
        queryParamsHandling: 'merge',
      });
    } else {
      this.requests.next(page);
    }
    const heading = this.galleryHeading?.nativeElement;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  }

  retry(): void {
    if (!this.loading()) this.requests.next(this.requestedPage);
  }

  image(person: MissingPerson): string {
    return this.failedImages().has(person._id)
      ? this.placeholder
      : person.photo_url?.trim() ||
          person.embedded_images?.data_urls?.[0]?.trim() ||
          this.placeholder;
  }

  imageFailed(person: MissingPerson): void {
    this.failedImages.update((ids) => new Set([...ids, person._id]));
  }

  async openSubmitTip(person: MissingPerson): Promise<void> {
    if (this.openingTip()) return;
    this.openingTip.set(true);
    this.tipError.set('');
    try {
      const record = await firstValueFrom(
        this.service.findMissingPerson(person._id).pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (this.destroyRef.destroyed) return;
      if (!record) throw new Error('Case unavailable');
      await this.tipDialog.open(record, this.destroyRef);
    } catch {
      if (!this.destroyRef.destroyed)
        this.tipError.set('The tip form could not be opened. Please try again.');
    } finally {
      this.openingTip.set(false);
    }
  }

  async share(person: MissingPerson): Promise<void> {
    this.shareMessage.set(
      await this.caseShare.share(
        this.caseShare.data(person._id, person.full_name, this.location(person)),
      ),
    );
  }
}
