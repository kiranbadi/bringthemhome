import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CaseClaimsService } from './case-claims.service';
import {
  ClaimPhoto,
  UploadTicket,
  claimError,
  needsSignIn,
  validateClaimPhoto,
} from './case-claims.models';
interface PhotoEntry {
  key: number;
  file: File;
  preview: string;
  state: 'uploading' | 'validating' | 'ready' | 'rejected' | 'failed';
  running: boolean;
  uploaded: boolean;
  ticket?: UploadTicket;
  photo?: ClaimPhoto;
  error: string;
}

@Component({
  selector: 'app-claim-contribution-composer',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './claim-contribution-composer.component.html',
  styleUrl: './case-claims.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClaimContributionComposerComponent {
  readonly caseId = input.required<string>();
  readonly allowed = input(false);
  readonly published = output<void>();
  readonly permissionFailure = output<void>();
  readonly signInRequested = output<void>();
  private readonly api = inject(CaseClaimsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly uploads = new Map<number, Subscription>();
  private sequence = 0;
  readonly content = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(10000),
  });
  readonly entries = signal<PhotoEntry[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly fileError = signal('');
  readonly reauthenticate = signal(false);
  readonly message = signal('');
  readonly filesReady = computed(() =>
    this.entries().every((entry) => entry.state === 'ready' && !!entry.photo),
  );
  @ViewChild('information') private information?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('photosInput') private photosInput?: ElementRef<HTMLInputElement>;
  constructor() {
    effect(() => {
      if (!this.allowed()) {
        for (const [key, request] of this.uploads) {
          request.unsubscribe();
          this.update(key, {
            state: 'failed',
            running: false,
            error: 'Access changed. Check claim status before retrying.',
          });
        }
        this.uploads.clear();
      }
    });
    this.destroyRef.onDestroy(() => this.resetPhotos());
  }
  focusInformation() {
    this.information?.nativeElement.focus();
  }
  focusPhotos() {
    this.photosInput?.nativeElement.focus();
  }
  select(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!this.allowed() || this.saving()) return;
    this.fileError.set('');
    if (files.length + this.entries().length > 3) {
      this.fileError.set('Choose up to three photos per contribution.');
      return;
    }
    for (const file of files) {
      const invalid = validateClaimPhoto(file);
      if (invalid) {
        this.fileError.set(invalid);
        return;
      }
    }
    const signatures = [...this.entries().map((entry) => entry.file), ...files].map(
      (file) => `${file.name}:${file.size}:${file.lastModified}`,
    );
    if (new Set(signatures).size !== signatures.length) {
      this.fileError.set('Each photo must be unique.');
      return;
    }
    for (const file of files) {
      try {
        const entry: PhotoEntry = {
          key: ++this.sequence,
          file,
          preview: URL.createObjectURL(file),
          state: 'uploading',
          running: false,
          uploaded: false,
          error: '',
        };
        this.entries.update((entries) => [...entries, entry]);
        this.upload(entry.key);
      } catch {
        this.fileError.set('This photo could not be opened. Choose another image.');
      }
    }
  }
  upload(key: number) {
    const entry = this.entries().find((photo) => photo.key === key);
    if (!entry || entry.running || !this.allowed() || this.saving()) return;
    this.error.set('');
    this.reauthenticate.set(false);
    this.update(key, {
      running: true,
      error: '',
      state: entry.uploaded ? 'validating' : 'uploading',
    });
    const request =
      entry.uploaded && entry.ticket
        ? this.api.complete(this.caseId(), entry.ticket.upload_id)
        : this.api.presign(this.caseId(), entry.file).pipe(
            tap((ticket) => this.update(key, { ticket })),
            switchMap((ticket) =>
              this.api.putPhoto(ticket, entry.file).pipe(
                tap(() => this.update(key, { uploaded: true, state: 'validating' })),
                switchMap(() => this.api.complete(this.caseId(), ticket.upload_id)),
              ),
            ),
          );
    const subscription = request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (photo) => {
        this.uploads.delete(key);
        this.update(key, {
          photo,
          running: false,
          state:
            photo.status === 'ready'
              ? 'ready'
              : photo.status === 'rejected'
                ? 'rejected'
                : 'validating',
          error:
            photo.status === 'rejected'
              ? 'Validation rejected this photo. Remove it and choose another.'
              : '',
        });
      },
      error: (error: unknown) => {
        this.uploads.delete(key);
        this.update(key, { state: 'failed', running: false, error: claimError(error) });
        this.handlePermission(error);
      },
    });
    if (!subscription.closed) this.uploads.set(key, subscription);
  }
  remove(key: number) {
    if (this.saving()) return;
    this.uploads.get(key)?.unsubscribe();
    this.uploads.delete(key);
    const entry = this.entries().find((photo) => photo.key === key);
    if (entry) URL.revokeObjectURL(entry.preview);
    this.entries.update((entries) => entries.filter((photo) => photo.key !== key));
  }
  publish() {
    if (!this.allowed() || this.saving()) return;
    this.content.markAsTouched();
    this.error.set('');
    this.message.set('');
    const content = this.content.value.trim();
    const ids = this.entries()
      .map((entry) => entry.photo?.id)
      .filter((id): id is string => !!id);
    if (
      this.content.invalid ||
      !this.filesReady() ||
      new Set(ids).size !== ids.length ||
      (!content && !ids.length)
    ) {
      this.error.set(
        'Add information or at least one ready photo. Finish or remove all unfinished photos.',
      );
      return;
    }
    this.saving.set(true);
    this.reauthenticate.set(false);
    this.api
      .contribute(this.caseId(), { content, photo_ids: ids })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.content.reset();
          this.resetPhotos();
          this.message.set('Your contribution has been published.');
          this.published.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(claimError(error));
          this.handlePermission(error);
        },
      });
  }
  private handlePermission(error: unknown) {
    this.reauthenticate.set(needsSignIn(error));
    if (error instanceof HttpErrorResponse && [401, 403].includes(error.status))
      this.permissionFailure.emit();
  }
  private update(key: number, update: Partial<PhotoEntry>) {
    this.entries.update((entries) =>
      entries.map((entry) => (entry.key === key ? { ...entry, ...update } : entry)),
    );
  }
  private resetPhotos() {
    this.uploads.forEach((request) => request.unsubscribe());
    this.uploads.clear();
    this.entries().forEach((entry) => URL.revokeObjectURL(entry.preview));
    this.entries.set([]);
  }
}
