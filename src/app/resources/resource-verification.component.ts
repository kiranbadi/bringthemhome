import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccountManagementService } from '../services/account-management';
import { ResourceService } from './resource.service';
import { Resource, resourceError } from './resource.models';
import { Observable } from 'rxjs';
import { webUrl } from './resource-form';

@Component({
  selector: 'app-resource-verification',
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './resource-verification.component.html',
  styleUrl: './resource-verification.component.scss',
})
export class ResourceVerificationComponent {
  readonly resource = input.required<Resource>();
  readonly updated = output<Resource>();
  readonly auth = inject(AccountManagementService);
  private readonly api = inject(ResourceService);
  private readonly destroy = inject(DestroyRef);
  readonly busy = signal(false);
  readonly prompt = signal(false);
  readonly showIssue = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly verificationUnavailable = computed(
    () => this.resource().can_verify === false && this.auth.isAuthenticated(),
  );
  readonly reportingUnavailable = computed(
    () => this.resource().can_suggest_correction === false && this.auth.isAuthenticated(),
  );
  readonly issue = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)],
    }),
    source_url: new FormControl('', {
      nonNullable: true,
      validators: [webUrl, Validators.maxLength(2048)],
    }),
  });
  private allowed(action: 'verify' | 'report' = 'verify') {
    if (!this.auth.isAuthenticated()) {
      this.prompt.set(true);
      return false;
    }
    if (
      action === 'verify'
        ? this.resource().can_verify === false
        : this.resource().can_suggest_correction === false
    ) {
      this.error.set(
        action === 'verify'
          ? 'You cannot assess this resource.'
          : 'You cannot report this resource.',
      );
      return false;
    }
    return (action === 'report' || !this.resource().is_owner) && !this.busy();
  }
  accurate() {
    if (this.allowed())
      this.send(
        this.api.assess(this.resource().id, { assessment: 'ACCURATE' }),
        'Your accuracy assessment was saved.',
        (resource) => this.updated.emit(resource),
      );
  }
  withdraw() {
    if (this.allowed())
      this.send(
        this.api.withdraw(this.resource().id),
        'Your assessment was withdrawn. Submitted issues remain pending until reviewed.',
        (resource) => this.updated.emit(resource),
      );
  }
  report() {
    this.error.set('');
    if (this.allowed('report')) {
      this.showIssue.set(true);
      this.message.set('');
    }
  }
  inaccurate() {
    this.issue.markAllAsTouched();
    if (!this.allowed('report') || this.issue.invalid) return;
    const v = this.issue.getRawValue();
    this.send(
      this.api.report(this.resource().id, {
        issue_type: 'ACCURACY',
        reason: v.reason.trim(),
        source_url: v.source_url.trim() || null,
      }),
      'Your report is pending review.',
    );
  }
  private send<T>(request: Observable<T>, message: string, onSuccess?: (response: T) => void) {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (r) => {
        onSuccess?.(r);
        this.busy.set(false);
        this.showIssue.set(false);
        this.message.set(message);
      },
      error: (e) => {
        this.error.set(resourceError(e));
        this.busy.set(false);
      },
    });
  }
}
