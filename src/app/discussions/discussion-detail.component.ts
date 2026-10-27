import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  catchError,
  combineLatest,
  finalize,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { AccountManagementService } from '../services/account-management';
import { DiscussionService } from './discussion.service';
import { Discussion, DiscussionComment } from './discussion.models';
import { DiscussionActionsComponent } from './discussion-actions.component';
import { DiscussionMediaComponent } from './discussion-media.component';
import { DiscussionMediaUploadComponent } from './discussion-media-upload.component';
import { DiscussionReplyComponent } from './discussion-reply.component';
@Component({
  selector: 'app-discussion-detail',
  imports: [
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    DiscussionActionsComponent,
    DiscussionMediaComponent,
    DiscussionMediaUploadComponent,
    DiscussionReplyComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="['/missing-persons', caseId(), 'discussions']">← All discussions</a>
    @if (loading()) {
      <div role="status">
        <p>Loading discussion…</p>
        <div class="skeleton" aria-hidden="true"></div>
      </div>
    } @else if (error()) {
      <div role="alert">
        <p>{{ error() }}</p>
        <button matButton type="button" (click)="reload.next()">Try again</button>
      </div>
    } @else if (topic(); as discussion) {
      <article class="topic">
        <h2>{{ discussion.title }}</h2>
        <p class="meta">
          {{ discussion.author_name }} ·
          <time [attr.datetime]="discussion.created_at">{{
            discussion.created_at | date: 'medium'
          }}</time>
        </p>
        <p class="content">{{ discussion.content }}</p>
        <app-discussion-media [attachments]="discussion.attachments" />
        <app-discussion-actions
          [item]="discussion"
          kind="discussions"
          (updated)="updateTopic($event)"
          (removed)="backToBoard()"
        />
      </article>
      <section aria-labelledby="replies-heading">
        <h3 id="replies-heading">{{ discussion.reply_count }} replies</h3>
        @if (commentsLoading()) {
          <p role="status">Loading replies…</p>
        } @else if (commentsError()) {
          <p role="alert">{{ commentsError() }}</p>
          <button matButton type="button" (click)="loadReplies()">Retry replies</button>
        } @else {
          @for (comment of comments(); track comment.id) {
            <app-discussion-reply
              [comment]="comment"
              (updated)="updateComment($event)"
              (removed)="replyRemoved()"
            />
          } @empty {
            <p>No replies yet. Share a helpful public update.</p>
          }
        }
        @if (commentTotal() > 20) {
          <mat-paginator
            [length]="commentTotal()"
            [pageSize]="20"
            [pageIndex]="commentPage() - 1"
            [disabled]="commentsLoading()"
            (page)="changePage($event)"
            aria-label="Reply pages"
          />
        }
      </section>
      <section class="reply-form" aria-labelledby="reply-heading">
        <h3 id="reply-heading">Add a reply</h3>
        @if (authenticated()) {
          <form (submit)="$event.preventDefault(); postReply()">
            <mat-form-field
              ><mat-label>Reply</mat-label
              ><textarea
                matInput
                [formControl]="content"
                rows="4"
                maxlength="5000"
                required
              ></textarea
              ><mat-hint>Public information only. Maximum 5,000 characters.</mat-hint
              ><mat-error>A reply is required.</mat-error></mat-form-field
            >
            <app-discussion-media-upload
              [disabled]="posting()"
              (filesChanged)="files = $event"
              (checkingChanged)="checking.set($event)"
            />
            @if (posting()) {
              <mat-progress-bar mode="determinate" [value]="progress()" />
              <p role="status">Uploading and posting reply… {{ progress() }}%</p>
            }
            @if (postError()) {
              <p role="alert">{{ postError() }}</p>
            }
            <button matButton="filled" type="submit" [disabled]="posting() || checking()">
              Post Reply
            </button>
          </form>
        } @else {
          <p><a routerLink="/login">Log in</a> to reply, vote, or report content.</p>
        }
      </section>
    }
  `,
  styleUrl: './discussions.scss',
})
export class DiscussionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DiscussionService);
  private readonly auth = inject(AccountManagementService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replyRefresh = new Subject<void>();
  private readonly cancelPost = new Subject<void>();
  readonly reload = new Subject<void>();
  readonly caseId = signal('');
  readonly topic = signal<Discussion | null>(null);
  readonly comments = signal<DiscussionComment[]>([]);
  readonly commentPage = signal(1);
  readonly commentTotal = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly commentsLoading = signal(false);
  readonly commentsError = signal('');
  readonly content = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(5000), Validators.pattern(/\S/)],
  });
  readonly posting = signal(false);
  readonly checking = signal(false);
  readonly progress = signal(0);
  readonly postError = signal('');
  files: File[] = [];
  @ViewChild(DiscussionMediaUploadComponent) private upload?: DiscussionMediaUploadComponent;
  constructor() {
    this.replyRefresh
      .pipe(
        switchMap(() => {
          const topic = this.topic();
          if (!topic) return EMPTY;
          this.commentsLoading.set(true);
          this.commentsError.set('');
          return this.service.comments(topic.id, this.commentPage()).pipe(
            tap((result) => {
              this.comments.set(result.items.filter((c) => c.discussion_id === topic.id));
              this.commentTotal.set(result.total);
              this.commentsLoading.set(false);
              this.topic.update((current) =>
                current ? { ...current, reply_count: result.total } : null,
              );
            }),
            catchError(() => {
              this.commentsError.set('Could not load replies. Please try again.');
              this.commentsLoading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    combineLatest([
      this.route.parent!.paramMap,
      this.route.paramMap,
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([parent, params]) => {
          this.cancelPost.next();
          this.content.reset();
          this.content.enable();
          this.files = [];
          this.upload?.reset();
          this.checking.set(false);
          this.posting.set(false);
          this.progress.set(0);
          this.postError.set('');
          this.caseId.set(parent.get('id') ?? '');
          this.topic.set(null);
          this.comments.set([]);
          this.commentPage.set(1);
          this.loading.set(true);
          this.error.set('');
          // Cancel any outstanding reply request when changing discussion.
          this.replyRefresh.next();
          return this.service.detail(params.get('discussionId') ?? '').pipe(
            switchMap((topic) =>
              topic.missing_person_id !== this.caseId()
                ? throwError(() => new Error('This discussion does not belong to this case.'))
                : [topic],
            ),
            tap((topic) => {
              this.topic.set(topic);
              this.loading.set(false);
              this.loadReplies();
            }),
            catchError((error) => {
              this.loading.set(false);
              this.error.set(
                error instanceof Error && !('status' in error)
                  ? error.message
                  : 'Discussion unavailable or could not be loaded. Please try again.',
              );
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
  authenticated(): boolean {
    return this.auth.isAuthenticated();
  }
  updateTopic(value: Discussion | DiscussionComment): void {
    this.topic.set(value as Discussion);
  }
  updateComment(value: Discussion | DiscussionComment): void {
    this.comments.update((items) =>
      items.map((item) => (item.id === value.id ? (value as DiscussionComment) : item)),
    );
  }
  backToBoard(): void {
    void this.router.navigate(['/missing-persons', this.caseId(), 'discussions']);
  }
  loadReplies(): void {
    this.replyRefresh.next();
  }
  changePage(event: PageEvent): void {
    this.commentPage.set(event.pageIndex + 1);
    this.loadReplies();
  }
  replyRemoved(): void {
    if (this.comments().length === 1 && this.commentPage() > 1)
      this.commentPage.update((p) => p - 1);
    this.loadReplies();
  }
  postReply(): void {
    if (this.posting() || this.checking()) return;
    if (!this.authenticated()) {
      void this.router.navigate(['/login']);
      return;
    }
    this.content.markAsTouched();
    const topic = this.topic();
    if (this.content.invalid || !topic) return;
    const text = this.content.value.trim();
    this.posting.set(true);
    this.postError.set('');
    this.progress.set(0);
    this.content.disable();
    this.service
      .upload(this.files, this.caseId(), (value) => this.progress.set(value))
      .pipe(
        switchMap((attachment_ids) =>
          this.service.reply(topic.id, { content: text, attachment_ids }),
        ),
        takeUntil(this.cancelPost),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.posting.set(false);
          this.content.enable();
        }),
      )
      .subscribe({
        next: () => {
          if (this.topic()?.id !== topic.id) return;
          this.content.reset();
          this.files = [];
          this.upload?.reset();
          this.commentPage.set(Math.max(1, Math.ceil((this.commentTotal() + 1) / 20)));
          this.loadReplies();
          this.snack.open('Reply posted.', 'Close', { duration: 4000 });
        },
        error: (error) =>
          this.postError.set(
            error instanceof Error && !('status' in error)
              ? error.message
              : 'Could not post your reply. Your draft is kept; please try again.',
          ),
      });
  }
}
