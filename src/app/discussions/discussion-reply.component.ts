import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Discussion, DiscussionComment } from './discussion.models';
import { DiscussionActionsComponent } from './discussion-actions.component';
import { DiscussionMediaComponent } from './discussion-media.component';
@Component({
  selector: 'app-discussion-reply',
  imports: [DatePipe, DiscussionActionsComponent, DiscussionMediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<article>
    <p class="meta">
      <strong>{{ comment().author_name }}</strong> ·
      <time [attr.datetime]="comment().created_at">{{
        comment().created_at | date: 'medium'
      }}</time>
    </p>
    <p class="content">{{ comment().content }}</p>
    <app-discussion-media [attachments]="comment().attachments" /><app-discussion-actions
      [item]="comment()"
      kind="comments"
      (updated)="updated.emit($event)"
      (removed)="removed.emit()"
    />
  </article>`,
  styles: [
    `
      article {
        padding: 20px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant, #ddd);
      }
      .meta {
        font-size: 0.85rem;
      }
      .content {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.6;
      }
    `,
  ],
})
export class DiscussionReplyComponent {
  readonly comment = input.required<DiscussionComment>();
  readonly updated = output<Discussion | DiscussionComment>();
  readonly removed = output<void>();
}
