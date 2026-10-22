import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
  imports: [NavigationHeader, RouterLink, TitleCasePipe, CaseProfileSections],
  templateUrl: './missing-persons-detail.component.html',
  styleUrl: './missing-persons-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingPersonsDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MissingPersonService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly person = signal<MissingPersonDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly failedImage = signal(false);
  readonly placeholder = PERSON_PLACEHOLDER;
  readonly location = (record: MissingPersonDetail) =>
    record.summary?.lastKnownLocation || personLocation(record);
  readonly reportedDate = (record: MissingPersonDetail) =>
    record.summary?.dateReported || personReportedDate(record);
  readonly currentAge = currentAge;
  readonly name = (record: MissingPersonDetail) =>
    record.summary?.fullName ||
    record.full_name ||
    record._source?.full_name ||
    'Name not provided';
  readonly image = (record: MissingPersonDetail) =>
    publicImageUrl(record.summary?.primaryImageUrl) ||
    publicImageUrl(record.embedded_images?.data_urls?.[0]) ||
    publicImageUrl(record._source?.embedded_images?.data_urls?.[0]) ||
    publicImageUrl(record._source?.image_urls?.[0]) ||
    publicImageUrl(record._source?.photo_url) ||
    this.placeholder;

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
          this.failedImage.set(false);
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

  retry(): void {
    this.reload.next();
  }
}
