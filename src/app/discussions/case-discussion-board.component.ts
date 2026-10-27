import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { DiscussionService } from './discussion.service';
import { Discussion, ListQuery, readyMedia } from './discussion.models';
import { AccountManagementService } from '../services/account-management';
import { DiscussionCreateDialogComponent } from './discussion-create-dialog.component';
@Component({
  selector: 'app-case-discussion-board',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="board-title">
      <div class="board-heading">
        <div>
          <h2 id="board-title">Community Discussions</h2>
          <p>Connect with the community and share public information about this case.</p>
          <p role="status">{{ total() }} discussions</p>
        </div>
        <button matButton="filled" type="button" (click)="startDiscussion()">
          Start Discussion
        </button>
      </div>
      <div class="filters">
        <mat-form-field
          ><mat-label>Search discussions</mat-label
          ><input matInput [formControl]="search" maxlength="200" type="search"
        /></mat-form-field>
        <mat-form-field
          ><mat-label>Sort discussions</mat-label
          ><mat-select [value]="sort()" (selectionChange)="setSort($event.value)"
            ><mat-option value="newest">Newest</mat-option
            ><mat-option value="oldest">Oldest</mat-option
            ><mat-option value="most_liked">Most Liked</mat-option></mat-select
          ></mat-form-field
        >
      </div>
      @if (loading()) {
        <div role="status" aria-label="Loading discussions">
          <p>Loading discussions…</p>
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton" aria-hidden="true"></div>
          }
        </div>
      } @else if (error()) {
        <div role="alert">
          <p>{{ error() }}</p>
          <button matButton type="button" (click)="refresh.next()">Try again</button>
        </div>
      } @else if (!items().length) {
        <div class="empty">
          <h3>{{ search.value.trim() ? 'No matching discussions' : 'No discussions yet' }}</h3>
          <p>
            {{
              search.value.trim()
                ? 'Try a different search.'
                : 'Start a thoughtful conversation using public information about this case.'
            }}
          </p>
        </div>
      } @else {
        <div class="discussion-list">
          @for (topic of items(); track topic.id) {
            <mat-card appearance="outlined"
              ><mat-card-content>
                <h3>
                  <a [routerLink]="['/missing-persons', caseId(), 'discussions', topic.id]">{{
                    topic.title
                  }}</a>
                </h3>
                <p class="excerpt">{{ topic.content }}</p>
                <p class="meta">
                  {{ topic.author_name }} ·
                  <time [attr.datetime]="topic.created_at">{{
                    topic.created_at | date: 'medium'
                  }}</time>
                </p>
                <div class="stats">
                  <span>{{ topic.reply_count }} replies</span
                  ><span
                    ><mat-icon aria-hidden="true">thumb_up</mat-icon
                    >{{ topic.like_count }} likes</span
                  ><span
                    ><mat-icon aria-hidden="true">thumb_down</mat-icon
                    >{{ topic.dislike_count }} dislikes</span
                  >
                  @if (hasMedia(topic)) {
                    <span><mat-icon aria-hidden="true">attachment</mat-icon>Media attached</span>
                  }
                </div>
              </mat-card-content></mat-card
            >
          }
        </div>
      }
      @if (total() > 10 && !error()) {
        <mat-paginator
          [length]="total()"
          [pageSize]="10"
          [pageIndex]="page() - 1"
          [disabled]="loading()"
          (page)="changePage($event)"
          aria-label="Discussion pages"
        />
      }
    </section>
  `,
  styleUrl: './discussions.scss',
})
export class CaseDiscussionBoardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DiscussionService);
  private readonly auth = inject(AccountManagementService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly search = new FormControl('', { nonNullable: true });
  readonly sort = signal<ListQuery['sort']>('newest');
  readonly page = signal(1);
  readonly caseId = signal('');
  readonly items = signal<Discussion[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly refresh = new Subject<void>();
  constructor() {
    combineLatest([
      this.route.parent!.paramMap.pipe(
        map((p) => p.get('id') ?? ''),
        distinctUntilChanged(),
        tap((id) => {
          this.caseId.set(id);
          this.page.set(1);
        }),
      ),
      this.search.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.page.set(1)),
        startWith(''),
      ),
      this.refresh.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([id]) => {
          this.loading.set(true);
          this.error.set('');
          return this.service
            .list(id, {
              page: this.page(),
              page_size: 10,
              search: this.search.value.trim(),
              sort: this.sort(),
            })
            .pipe(
              tap((result) => {
                this.items.set(result.items.filter((topic) => topic.missing_person_id === id));
                this.total.set(result.total);
                this.loading.set(false);
              }),
              catchError(() => {
                this.error.set('Could not load discussions. Please try again.');
                this.loading.set(false);
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
  setSort(sort: ListQuery['sort']): void {
    this.sort.set(sort);
    this.page.set(1);
    this.refresh.next();
  }
  changePage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.refresh.next();
  }
  hasMedia(topic: Discussion): boolean {
    return readyMedia(topic.attachments).length > 0;
  }
  startDiscussion(): void {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login']);
      return;
    }
    const ref = this.dialog.open(DiscussionCreateDialogComponent, {
      data: { caseId: this.caseId() },
      width: '720px',
      maxWidth: '96vw',
      maxHeight: '94dvh',
      ariaLabel: 'Start a case discussion',
    });
    this.destroyRef.onDestroy(() => ref.close());
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((topic) => {
        if (!topic) return;
        this.search.setValue('', { emitEvent: false });
        this.page.set(1);
        this.sort.set('newest');
        this.refresh.next();
        this.snack.open('Discussion published.', 'Close', { duration: 4000 });
      });
  }
}
