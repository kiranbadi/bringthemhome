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
import { EMPTY, Subject, catchError, combineLatest, startWith, switchMap, tap } from 'rxjs';
import { MissingPerson } from '../core/models/missing-person.model';
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
  imports: [NavigationHeader, RouterLink, TitleCasePipe],
  templateUrl: './missing-persons-detail.component.html',
  styleUrl: './missing-persons-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingPersonsDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MissingPersonService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  readonly person = signal<MissingPerson | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly failedImage = signal(false);
  readonly placeholder = PERSON_PLACEHOLDER;
  readonly location = personLocation;
  readonly reportedDate = personReportedDate;

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([params, query]) => {
          this.loading.set(true);
          this.error.set('');
          this.person.set(null);
          this.failedImage.set(false);
          const sourcePage = Number(query.get('page') ?? 1);
          const page = Number.isInteger(sourcePage) && sourcePage > 0 ? sourcePage : 1;
          // Only the paginated list endpoint is part of the API contract.
          return this.service.findMissingPerson(params.get('id') ?? '', page).pipe(
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
