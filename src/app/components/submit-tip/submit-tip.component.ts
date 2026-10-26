import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { finalize } from 'rxjs';
import { MissingPersonDetail } from '../../core/models/missing-person-detail.model';
import { environment } from '../../../environments/environment';
import { TipSubmissionService } from './tip-submission.service';
import { SubmitTipRequest, SubmitTipResponse } from './tip-submission.model';

type Mode = 'STANDARD' | 'ANONYMOUS' | 'AGENCY';

@Component({
  selector: 'app-submit-tip',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './submit-tip.component.html',
  styleUrl: './submit-tip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmitTipComponent {
  readonly record = inject<MissingPersonDetail>(MAT_DIALOG_DATA);
  readonly service = inject(TipSubmissionService);
  private readonly dialog = inject(MatDialogRef<SubmitTipComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly keepEditingButton = viewChild<unknown, ElementRef<HTMLButtonElement>>(
    'keepEditing',
    { read: ElementRef },
  );
  private readonly viewHeading = viewChild<unknown, ElementRef<HTMLElement>>('viewHeading', {
    read: ElementRef,
  });
  readonly mode = signal<Mode | null>(null);
  readonly submitting = signal(false);
  readonly success = signal<SubmitTipResponse | null>(null);
  readonly error = signal('');
  readonly discardPrompt = signal(false);
  readonly files = signal<readonly File[]>([]);
  readonly attachmentErrors = signal<readonly string[]>([]);
  readonly policies = environment;
  readonly agencies = this.record.contacts?.investigatingAgencies ?? [];
  readonly contactableAgencies = this.agencies.filter((agency) =>
    [agency.agencyPhone, agency.agencyEmail, agency.agencyAddress].some((value) => value?.trim()),
  );
  readonly fullName =
    this.record.summary?.fullName ||
    this.record.full_name ||
    this.record._source?.full_name ||
    'Name not provided';
  readonly caseNumber =
    this.record.caseNumber || this.agencies.find((a) => a.agencyCaseNumber)?.agencyCaseNumber || '';
  readonly agencyName =
    this.record.summary?.reportingAgency ||
    this.record.agency ||
    this.agencies.find((a) => a.agencyName)?.agencyName ||
    'Not provided';
  readonly categories = [
    'Possible Sighting',
    'Information About Last Known Location',
    'Vehicle or Transportation Information',
    'Person of Interest or Associated Individual',
    'Social Media or Online Activity',
    'Photo, Video, or Document Evidence',
    'Possible Match With Another Missing Person Case',
    'Other Relevant Information',
  ];
  readonly form = this.fb.group({
    category: ['', Validators.required],
    description: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(5000)]],
    incidentDate: [''],
    incidentTime: [''],
    location: [''],
    additionalInformation: [''],
    confidenceLevel: [''],
    fullName: [''],
    email: ['', Validators.email],
    phone: [''],
    preferredContactMethod: [''],
    willingToBeContacted: [false],
    acknowledged: [false, Validators.requiredTrue],
  });

  constructor() {
    afterRenderEffect(() => {
      const keep = this.keepEditingButton();
      if (keep) keep.nativeElement.focus();
      else this.viewHeading()?.nativeElement.focus();
    });
  }

  choose(mode: Mode): void {
    if (mode === 'AGENCY' && !this.contactableAgencies.length) return;
    this.mode.set(mode);
    if (mode === 'ANONYMOUS') {
      this.form.patchValue({
        fullName: '',
        email: '',
        phone: '',
        preferredContactMethod: '',
        willingToBeContacted: false,
      });
    }
  }

  back(): void {
    if (!this.submitting()) this.mode.set(null);
  }

  canClose(): boolean {
    if (this.submitting()) return false;
    if (!this.success() && this.form.dirty) {
      this.discardPrompt.set(true);
      return false;
    }
    return true;
  }

  requestClose(): void {
    if (this.canClose()) this.dialog.close();
  }

  confirmDiscard(): void {
    if (this.submitting()) return;
    this.files.set([]);
    this.form.reset();
    this.discardPrompt.set(false);
    this.dialog.close();
  }

  selectFiles(event: Event): void {
    if (this.submitting() || !this.service.available) return;
    const input = event.target as HTMLInputElement;
    const selected = [...this.files()];
    const errors: string[] = [];
    const policy = this.policies.tipSubmission;
    for (const file of Array.from(input.files ?? [])) {
      if (!(policy.allowedMimeTypes as readonly string[]).includes(file.type)) {
        errors.push(`${file.name}: unsupported file type.`);
      } else if (file.size > policy.maxFileSizeBytes) {
        errors.push(`${file.name}: exceeds the 50 MB per-file limit.`);
      } else if (selected.length >= policy.maxFiles) {
        errors.push(`${file.name}: a maximum of 5 attachments is allowed.`);
      } else if (
        selected.reduce((total, item) => total + item.size, 0) + file.size >
        policy.maxTotalSizeBytes
      ) {
        errors.push(`${file.name}: exceeds the 100 MB total limit.`);
      } else {
        selected.push(file);
      }
    }
    this.files.set(selected);
    this.attachmentErrors.set(errors);
    if (selected.length) this.form.markAsDirty();
    input.value = '';
  }

  removeFile(index: number): void {
    if (this.submitting()) return;
    this.files.update((files) => files.filter((_, i) => i !== index));
    this.form.markAsDirty();
  }

  request(): SubmitTipRequest {
    const value = this.form.getRawValue();
    const optional = (s: string) => s.trim() || undefined;
    return {
      missingPersonId: this.record._id,
      caseNumber: this.caseNumber || undefined,
      submissionType: this.mode() === 'ANONYMOUS' ? 'ANONYMOUS' : 'STANDARD',
      tipCategory: value.category,
      description: value.description.trim(),
      acknowledged: value.acknowledged,
      incidentDate: optional(value.incidentDate),
      incidentTime: optional(value.incidentTime),
      location: optional(value.location),
      additionalInformation: optional(value.additionalInformation),
      confidenceLevel: optional(value.confidenceLevel),
      ...(this.mode() === 'STANDARD'
        ? {
            contact: {
              fullName: optional(value.fullName),
              email: optional(value.email),
              phone: optional(value.phone),
              preferredContactMethod: optional(value.preferredContactMethod),
              willingToBeContacted: value.willingToBeContacted,
            },
          }
        : {}),
    };
  }

  submit(): void {
    if (
      this.submitting() ||
      this.success() ||
      !this.service.available ||
      !['STANDARD', 'ANONYMOUS'].includes(this.mode() ?? '')
    )
      return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set('');
    this.form.disable();
    this.service
      .submit(this.request(), this.files())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.submitting.set(false);
          if (!this.success()) this.form.enable();
        }),
      )
      .subscribe({
        next: (response) => {
          this.success.set(response);
          this.files.set([]);
          this.form.reset();
        },
        error: () =>
          this.error.set(
            'Your tip could not be submitted. Your information is still here. Please try again.',
          ),
      });
  }
}
