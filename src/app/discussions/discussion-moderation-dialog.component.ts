import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
@Component({
  selector: 'app-discussion-moderation-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ data.action === 'delete' ? 'Delete this content?' : 'Report inappropriate content' }}
    </h2>
    <mat-dialog-content>
      @if (data.action === 'delete') {
        <p>This content will be removed from public view.</p>
      } @else {
        <mat-form-field
          ><mat-label>Reason for reporting</mat-label
          ><textarea matInput [(ngModel)]="reason" maxlength="1000" rows="4" required></textarea>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button
        matButton="filled"
        [disabled]="data.action === 'report' && !reason.trim()"
        [mat-dialog-close]="data.action === 'delete' ? '' : reason.trim()"
      >
        {{ data.action === 'delete' ? 'Delete' : 'Send report' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: ['mat-form-field{width:100%}'],
})
export class DiscussionModerationDialogComponent {
  readonly data = inject<{ action: 'report' | 'delete' }>(MAT_DIALOG_DATA);
  reason = '';
}
