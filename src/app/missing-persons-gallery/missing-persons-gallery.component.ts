import { TipDialogService } from '../components/submit-tip/tip-dialog.service';
import { DOCUMENT, TitleCasePipe } from '@angular/common';
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

@Component({
  selector: 'app-missing-persons-gallery',
  standalone: true,
  imports: [NavigationHeader, RouterLink, TitleCasePipe],
  templateUrl: './missing-persons-gallery.component.html',
  styleUrl: './missing-persons-gallery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingPersonsGalleryComponent implements OnInit {
  private readonly tipDialog = inject(TipDialogService);
  readonly openingTip = signal(false);
  readonly tipError = signal('');
  private readonly route = inject(ActivatedRoute);
  private filters: MissingPersonSearchFilters = {};
  readonly isSearch = signal(false);
  private readonly service = inject(MissingPersonService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
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
          this.shareMessage.set('');
        }),
        switchMap((page) =>
          (this.isSearch()
            ? this.service.searchMissingPersons(this.filters, page, this.pageSize)
            : this.service.getMissingPersons(page, this.pageSize)
          ).pipe(
            tap((response) => {
              this.response.set(response);
              this.failedImages.set(new Set());
              this.loading.set(false);
            }),
            catchError(() => {
              this.loading.set(false);
              this.error.set('We could not load missing persons. Please try again.');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const filters: Record<string, string> = {};
      for (const key of SEARCH_FILTER_KEYS) {
        const value = params.get(key)?.trim();
        if (value) filters[key] = value;
      }
      this.filters = filters as MissingPersonSearchFilters;
      this.isSearch.set(params.get('search') === 'true' || Object.keys(filters).length > 0);
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
    const browser = this.document.defaultView;
    if (!browser) return;
    const path = this.router.serializeUrl(
      this.router.createUrlTree(['/missing-persons', person._id]),
    );
    const url = new URL(path, this.document.baseURI).href;
    const navigator = browser.navigator;
    this.shareMessage.set('');
    if (navigator.share) {
      try {
        await navigator.share({
          title: person.full_name,
          text: `Help find ${person.full_name}`,
          url,
        });
        this.shareMessage.set('Case shared.');
        return;
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
          return;
      }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      this.shareMessage.set('Case link copied to clipboard.');
    } catch {
      this.shareMessage.set(`Copy this case link: ${url}`);
    }
  }
}
