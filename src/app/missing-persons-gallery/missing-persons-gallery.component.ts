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
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import {
  MissingPerson,
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
          this.service.getMissingPersons(page, this.pageSize).pipe(
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
    this.requests.next(1);
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
    this.requests.next(page);
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
      : person.embedded_images?.data_urls?.[0]?.trim() || this.placeholder;
  }

  imageFailed(person: MissingPerson): void {
    this.failedImages.update((ids) => new Set([...ids, person._id]));
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
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
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
