import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { CaseClaimsService } from './case-claims.service';
import { Contribution, Page, RELATIONSHIPS, claimError, safePhotoUrl } from './case-claims.models';
@Component({
  selector: 'app-case-contributions',
  imports: [DatePipe, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './case-claims.scss',
  template: `
    <section
      class="panel"
      aria-labelledby="public-contributions-title"
      [attr.aria-busy]="loading()"
    >
      <div class="heading-row">
        <div>
          <h2 id="public-contributions-title">Verified claimant contributions</h2>
          <p>
            Verified access confirms the contributor’s relationship. It does not independently
            verify every statement.
          </p>
        </div>
        <button matButton type="button" [disabled]="loading()" (click)="load(page())">
          Refresh photos and information
        </button>
      </div>
      @if (loading()) {
        <p role="status">Loading contributions…</p>
      } @else if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
        <button matButton type="button" (click)="load(page())">Retry contributions</button>
      } @else {
        @for (entry of result()?.items; track entry.id) {
          <article class="contribution">
            <h3>Provided by a verified claimant</h3>
            <p>
              {{ relationships[entry.relationship] }} ·
              <time [attr.datetime]="entry.created_at">{{
                entry.created_at | date: 'medium'
              }}</time>
            </p>
            <p class="content">{{ entry.content }}</p>
            <div class="photo-grid">
              @for (photo of entry.photos; track photo.id) {
                @if (photo.status === 'ready' && safeUrl(photo.display_url)) {
                  <img
                    [src]="photo.display_url"
                    alt="Photo provided by a verified claimant"
                    loading="lazy"
                    (error)="photoExpired(photo.id)"
                    [hidden]="failedPhotos().has(photo.id)"
                  />
                }
              }
            </div>
          </article>
        } @empty {
          <p>No public contributions yet.</p>
        }
        @if (failedPhotos().size) {
          <p role="status">
            A photo could not load. Refresh photos and information to request fresh display links.
          </p>
        }
        @if (result(); as data) {
          <nav class="actions" aria-label="Contributions pagination">
            <button matButton type="button" [disabled]="page() <= 1" (click)="load(page() - 1)">
              Previous contributions</button
            ><span>Page {{ page() }} · {{ data.total }} contributions</span
            ><button
              matButton
              type="button"
              [disabled]="page() * data.page_size >= data.total"
              (click)="load(page() + 1)"
            >
              Next contributions
            </button>
          </nav>
        }
      }
    </section>
  `,
})
export class CaseContributionsComponent {
  readonly caseId = input.required<string>();
  readonly refresh = input(0);
  private readonly api = inject(CaseClaimsService);
  private readonly requests = new Subject<{ id: string; page: number }>();
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly result = signal<Page<Contribution> | null>(null);
  readonly failedPhotos = signal(new Set<string>());
  readonly relationships = RELATIONSHIPS;
  readonly safeUrl = safePhotoUrl;
  constructor() {
    this.requests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
          this.result.set(null);
          this.failedPhotos.set(new Set());
        }),
        switchMap(({ id, page }) =>
          this.api.contributions(id, page).pipe(
            catchError((error) => {
              this.error.set(claimError(error));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.result.set(result);
        this.loading.set(false);
      });
    effect(() => {
      const id = this.caseId();
      this.refresh();
      this.page.set(1);
      this.requests.next({ id, page: 1 });
    });
  }
  load(page: number) {
    this.page.set(page);
    this.requests.next({ id: this.caseId(), page });
  }
  photoExpired(id: string) {
    this.failedPhotos.update((ids) => new Set([...ids, id]));
  }
}
