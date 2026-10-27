import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap } from 'rxjs';
import { DiscussionService } from './discussion.service';
import { DiscussionMediaUploadComponent } from './discussion-media-upload.component';

@Component({
  selector: 'app-discussion-create-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    DiscussionMediaUploadComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Start Discussion</h2>
    <mat-dialog-content>
      <p>
        Share public information only. Send sensitive details through Submit a Confidential Tip on
        the discussion board.
      </p>
      <form id="new-discussion" [formGroup]="form" (ngSubmit)="publish()">
        <mat-form-field
          ><mat-label>Discussion title</mat-label
          ><input matInput formControlName="title" maxlength="150" required /><mat-hint
            >Maximum 150 characters</mat-hint
          ><mat-error>A title is required (maximum 150 characters).</mat-error></mat-form-field
        >
        <mat-form-field
          ><mat-label>Description</mat-label
          ><textarea
            matInput
            formControlName="content"
            rows="6"
            maxlength="5000"
            required
          ></textarea
          ><mat-hint>Maximum 5,000 characters</mat-hint
          ><mat-error
            >A description is required (maximum 5,000 characters).</mat-error
          ></mat-form-field
        >
        <app-discussion-media-upload
          [disabled]="pending()"
          (filesChanged)="files = $event"
          (checkingChanged)="checking.set($event)"
        />
      </form>
      @if (pending()) {
        <mat-progress-bar mode="determinate" [value]="progress()" />
        <p role="status">
          {{ files.length ? 'Uploading and validating media…' : 'Publishing…' }}
          {{ files.length ? progress() + '%' : '' }}
        </p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [disabled]="pending()" mat-dialog-close>Cancel</button>
      <button
        matButton="filled"
        type="submit"
        form="new-discussion"
        [disabled]="pending() || checking()"
      >
        Publish Discussion
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-form-field {
        display: block;
        margin: 16px 0;
      }
      [role='alert'] {
        color: var(--mat-sys-error, #a00);
      }
    `,
  ],
})
export class DiscussionCreateDialogComponent {
  private readonly service = inject(DiscussionService);
  private readonly ref = inject(MatDialogRef<DiscussionCreateDialogComponent>);
  private readonly data = inject<{ caseId: string }>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    content: ['', [Validators.required, Validators.maxLength(5000), Validators.pattern(/\S/)]],
  });
  readonly pending = signal(false);
  readonly checking = signal(false);
  readonly progress = signal(0);
  readonly error = signal('');
  files: File[] = [];
  publish(): void {
    if (this.pending() || this.checking()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.pending.set(true);
    this.error.set('');
    this.progress.set(0);
    this.ref.disableClose = true;
    this.form.disable();
    const values = this.form.getRawValue();
    this.service
      .upload(this.files, this.data.caseId, (value) => this.progress.set(value))
      .pipe(
        switchMap((attachment_ids) =>
          this.service.create(this.data.caseId, {
            title: values.title.trim(),
            content: values.content.trim(),
            attachment_ids,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.pending.set(false);
          this.ref.disableClose = false;
          this.form.enable();
        }),
      )
      .subscribe({
        next: (topic) => this.ref.close(topic),
        error: (error) =>
          this.error.set(
            error instanceof Error && !('status' in error)
              ? error.message
              : 'Could not publish the discussion. Your draft is kept; please try again.',
          ),
      });
  }
}
