import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReportAction } from './report-workflow';
@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <mat-dialog-content
      ><p>{{ message }}</p>
      <form [formGroup]="form" id="report-action" (ngSubmit)="confirm()">
        @if (action === 'report-found') {
          <mat-form-field appearance="outline"
            ><mat-label>Date found</mat-label
            ><input matInput type="date" formControlName="found_at" [max]="today" /><mat-error
              >Enter a valid date on or before today.</mat-error
            ></mat-form-field
          >
        }
        @if (action === 'reject' || action === 'reject-found' || action === 'report-found') {
          <mat-form-field appearance="outline"
            ><mat-label>{{
              action === 'report-found' ? 'Notes (optional)' : 'Reason for changes'
            }}</mat-label
            ><textarea matInput formControlName="reason" rows="3"></textarea
            ><mat-error>Provide a reason.</mat-error></mat-form-field
          >
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end"
      ><button matButton mat-dialog-close>Cancel</button
      ><button matButton="filled" type="submit" form="report-action">
        Confirm
      </button></mat-dialog-actions
    >
  `,
  styles: `
    mat-form-field {
      width: 100%;
      margin-top: 0.75rem;
    }
  `,
})
export class ReportActionDialog {
  readonly action = inject<ReportAction>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ReportActionDialog>);
  readonly today = new Date().toLocaleDateString('en-CA');
  readonly form = inject(FormBuilder).nonNullable.group({
    found_at: [
      '',
      this.action === 'report-found'
        ? [
            Validators.required,
            (control) =>
              !control.value ||
              (/^\d{4}-\d{2}-\d{2}$/.test(control.value) && control.value <= this.today)
                ? null
                : { date: true },
          ]
        : [],
    ],
    reason: [
      '',
      this.action === 'reject' || this.action === 'reject-found'
        ? [Validators.required, Validators.pattern(/\S/)]
        : [],
    ],
  });
  readonly title = {
    submit: 'Submit for administrator review?',
    revise: 'Edit this published report?',
    'report-found': 'Report this person as found?',
    archive: 'Archive this report?',
    approve: 'Approve and publish this report?',
    reject: 'Return report for changes?',
    'confirm-found': 'Confirm this person was found?',
    'reject-found': 'Return found update for changes?',
    save: 'Save draft?',
  }[this.action];
  readonly message =
    this.action === 'submit'
      ? 'Your report will remain private until an administrator approves it.'
      : this.action === 'revise'
        ? 'The approved version stays public while your changes are reviewed.'
        : this.action === 'report-found'
          ? 'An administrator must confirm this update before the public case changes to Found.'
          : this.action === 'archive'
            ? 'This found report will leave active listings. The record and its history will be retained.'
            : 'This action will be recorded in the report history.';
  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) this.ref.close(this.form.getRawValue());
  }
}
