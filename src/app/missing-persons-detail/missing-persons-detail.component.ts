import { formatLocation } from '../core/models/us-state-display';
import { CaseShareComponent } from '../shared/case-share/case-share.component';
import { TipDialogService } from '../components/submit-tip/tip-dialog.service';
import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { MissingPersonDetail } from '../core/models/missing-person-detail.model';
import { CaseProfileSections } from './components/case-profile-sections';
import { currentAge, publicImageUrl } from './case-profile-format';
import {
  PERSON_PLACEHOLDER,
  personLocation,
  personReportedDate,
} from '../core/models/missing-person-display';
import { MissingPersonService } from '../core/services/missing-person.service';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

@Component({
  selector: 'app-missing-persons-detail',
  standalone: true,
  imports: [CaseShareComponent, NavigationHeader, RouterLink, TitleCasePipe, CaseProfileSections],
  templateUrl: './missing-persons-detail.component.html',
  styleUrl: './missing-persons-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingPersonsDetailComponent implements OnInit {
  private readonly tipDialog = inject(TipDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MissingPersonService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly person = signal<MissingPersonDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private readonly failedImages = signal(new Set<string>());
  readonly openingTip = signal(false);
  readonly tipError = signal('');
  readonly placeholder = PERSON_PLACEHOLDER;
  readonly location = (record: MissingPersonDetail) =>
    formatLocation(record.summary?.lastKnownLocation) || personLocation(record);
  readonly reportedDate = (record: MissingPersonDetail) =>
    record.summary?.dateReported || personReportedDate(record);
  readonly currentAge = currentAge;
  readonly name = (record: MissingPersonDetail) =>
    record.summary?.fullName ||
    record.full_name ||
    record._source?.full_name ||
    'Name not provided';
  readonly image = computed(() => {
    const record = this.person();
    if (!record) return this.placeholder;
    const candidates = [
      record.summary?.primaryImageUrl,
      ...(record.embedded_images?.data_urls ?? []),
      ...(record._source?.embedded_images?.data_urls ?? []),
      ...(record._source?.image_urls ?? []),
      record._source?.photo_url,
    ];
    return (
      candidates
        .map(publicImageUrl)
        .find((url): url is string => !!url && !this.failedImages().has(url)) ?? this.placeholder
    );
  });

  imageFailed(): void {
    const url = this.image();
    if (url === this.placeholder) return;
    this.failedImages.update((failed) => new Set([...failed, url]));
  }

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
      ),
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([id]) => {
          this.loading.set(true);
          this.error.set('');
          this.person.set(null);
          this.failedImages.set(new Set());
          return this.service.findMissingPerson(id).pipe(
            tap((person) => {
              this.person.set(person);
              this.loading.set(false);
            }),
            catchError(() => {
              this.error.set('We could not load this case. Please try again.');
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  async openSubmitTip(record: MissingPersonDetail): Promise<void> {
    if (this.openingTip()) return;
    this.openingTip.set(true);
    this.tipError.set('');
    try {
      if (this.destroyRef.destroyed || this.person()?._id !== record._id) return;
      await this.tipDialog.open(record, this.destroyRef);
    } catch {
      this.tipError.set('The tip form could not be opened. Please try again.');
    } finally {
      this.openingTip.set(false);
    }
  }

  retry(): void {
    this.reload.next();
  }
}
