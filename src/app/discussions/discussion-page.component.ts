import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { MissingPersonService } from '../core/services/missing-person.service';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { TipDialogService } from '../components/submit-tip/tip-dialog.service';
import { PERSON_PLACEHOLDER } from '../core/models/missing-person-display';
import { publicImageUrl } from '../missing-persons-detail/case-profile-format';
@Component({
  selector: 'app-discussion-page',
  imports: [RouterLink, RouterOutlet, MatButtonModule, NavigationHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-navigation-header />
    <main class="discussion-page">
      <a [routerLink]="['/missing-persons', caseId()]">← Back to {{ personName() }}’s case</a>
      @if (loading()) {
        <p role="status">Loading case…</p>
      } @else if (person(); as record) {
        <header class="case-context">
          <img
            [src]="imageFailed() ? placeholder : image(record)"
            (error)="imageFailed.set(true)"
            [alt]="'Photo of ' + personName()"
            width="72"
            height="72"
          />
          <div>
            <p class="eyebrow">Community discussions for</p>
            <h1>{{ personName() }}</h1>
          </div>
        </header>
        <aside class="privacy-notice" aria-label="Public information notice">
          <p>
            Discussions are public. Do not share private contact details, sensitive evidence, or
            unverified accusations.
          </p>
          <button matButton type="button" [disabled]="openingTip()" (click)="openTip(record)">
            Submit a Confidential Tip
          </button>
          @if (tipError()) {
            <p role="alert">{{ tipError() }}</p>
          }
        </aside>
        <router-outlet />
      } @else {
        <p role="alert">{{ error() }}</p>
        <button matButton type="button" (click)="reload.next()">Try again</button>
      }
    </main>
  `,
  styleUrl: './discussions.scss',
})
export class DiscussionPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MissingPersonService);
  private readonly tip = inject(TipDialogService);
  private readonly destroyRef = inject(DestroyRef);
  readonly caseId = signal('');
  readonly person = signal<MissingPersonDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly openingTip = signal(false);
  readonly tipError = signal('');
  readonly imageFailed = signal(false);
  readonly placeholder = PERSON_PLACEHOLDER;
  readonly reload = new Subject<void>();
  constructor() {
    combineLatest([
      this.route.paramMap.pipe(
        map((p) => p.get('id') ?? ''),
        distinctUntilChanged(),
      ),
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([id]) => {
          this.caseId.set(id);
          this.person.set(null);
          this.loading.set(true);
          this.imageFailed.set(false);
          this.tipError.set('');
          return this.service.findMissingPerson(id).pipe(
            tap((person) => {
              this.person.set(person);
              this.loading.set(false);
              if (!person) this.error.set('Case unavailable.');
            }),
            catchError(() => {
              this.loading.set(false);
              this.error.set('Could not load this case. Please try again.');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
  personName(): string {
    const p = this.person();
    return p?.summary?.fullName || p?.full_name || p?._source?.full_name || 'Missing person';
  }
  image(record: MissingPersonDetail): string {
    return (
      publicImageUrl(record.summary?.primaryImageUrl) ||
      publicImageUrl(record._source?.photo_url) ||
      this.placeholder
    );
  }
  async openTip(record: MissingPersonDetail): Promise<void> {
    if (this.openingTip()) return;
    this.openingTip.set(true);
    this.tipError.set('');
    try {
      await this.tip.open(record, this.destroyRef);
    } catch {
      this.tipError.set('The tip form could not be opened. Please try again.');
    } finally {
      this.openingTip.set(false);
    }
  }
}
