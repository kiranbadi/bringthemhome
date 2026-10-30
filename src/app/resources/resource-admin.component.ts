import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AccountManagementService } from '../services/account-management';
import { ResourceService } from './resource.service';
import {
  Correction,
  Page,
  Resource,
  ReviewDecision,
  STATUSES,
  resourceError,
  safeWebUrl,
} from './resource.models';
import { webUrl } from './resource-form';

@Component({
  selector: 'app-resource-admin',
  imports: [
    DatePipe,
    KeyValuePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './resource-admin.component.html',
  styleUrl: './resource-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceAdminComponent {
  readonly resource = input.required<Resource>();
  readonly updated = output<Resource>();
  private readonly auth = inject(AccountManagementService);
  private readonly user = toSignal(this.auth.currentUser$, { initialValue: null });
  readonly isAdmin = computed(() => this.user()?.role?.toUpperCase() === 'ADMIN');
  private readonly api = inject(ResourceService);
  private readonly destroy = inject(DestroyRef);
  readonly queue = signal<Page<Correction> | null>(null);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly busy = signal('');
  readonly error = signal('');
  readonly queueError = signal('');
  readonly message = signal('');
  readonly statuses = Object.entries(STATUSES);
  readonly safeUrl = safeWebUrl;
  readonly form = new FormGroup({
    verification_status: new FormControl<Resource['status']>('UNVERIFIED', {
      nonNullable: true,
      validators: Validators.required,
    }),
    listing_status: new FormControl<'ACTIVE' | 'HIDDEN'>('ACTIVE', {
      nonNullable: true,
      validators: Validators.required,
    }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)],
    }),
    source_url: new FormControl('', {
      nonNullable: true,
      validators: [webUrl, Validators.maxLength(2048)],
    }),
  });
  constructor() {
    effect(() => {
      if (this.isAdmin()) untracked(() => this.load());
    });
    effect(() => {
      const resource = this.resource();
      this.form.patchValue({
        verification_status: resource.status,
        listing_status: resource.listing_status ?? 'ACTIVE',
      });
    });
  }
  load() {
    if (!this.isAdmin()) return;
    this.loading.set(true);
    this.queueError.set('');
    this.api
      .adminCorrections(this.page())
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (page) => {
          this.queue.set(page);
          this.loading.set(false);
        },
        error: (error) => {
          this.queueError.set(resourceError(error));
          this.loading.set(false);
        },
      });
  }
  review(id: string, decision: ReviewDecision) {
    if (!this.isAdmin() || this.busy() || this.loading()) return;
    const suggestion = this.queue()?.items.find((item) => item.id === id);
    if (!suggestion || suggestion.status !== 'PENDING') return;
    this.busy.set(id);
    this.error.set('');
    this.message.set('');
    this.api
      .reviewCorrection(id, decision)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: () => {
          this.busy.set('');
          this.message.set(
            decision === 'ACCEPTED' ? 'Suggestion accepted.' : 'Suggestion rejected.',
          );
          this.load();
          if (suggestion.resource_id === this.resource().id)
            this.api
              .detail(this.resource().id)
              .pipe(takeUntilDestroyed(this.destroy))
              .subscribe({
                next: (resource) => this.updated.emit(resource),
                error: (error) => this.error.set(resourceError(error)),
              });
        },
        error: (error) => {
          this.error.set(resourceError(error));
          this.busy.set('');
        },
      });
  }
  saveStatus() {
    if (!this.isAdmin() || this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (value.verification_status === 'OFFICIALLY_VERIFIED' && !value.source_url.trim()) {
      this.error.set('Provide an official source URL for official verification.');
      return;
    }
    this.busy.set('status');
    this.error.set('');
    this.message.set('');
    this.api
      .updateStatus(this.resource().id, {
        ...value,
        reason: value.reason.trim(),
        source_url: value.source_url.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (resource) => {
          this.updated.emit(resource);
          this.busy.set('');
          this.message.set('Resource status updated.');
        },
        error: (error) => {
          this.error.set(resourceError(error));
          this.busy.set('');
        },
      });
  }
  changePage(delta: number) {
    if (this.loading() || this.busy()) return;
    const next = this.page() + delta;
    if (next < 1 || (delta > 0 && this.page() * 20 >= (this.queue()?.total ?? 0))) return;
    this.page.set(next);
    this.load();
  }
}
