import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { RouterLink } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  computed,
  ViewChild,
  effect,
  OnInit,
} from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import {
  ReportContext,
  ReportWorkflow,
  ReportAction,
  allowedReportActions,
} from './report-workflow';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReportActionDialog } from './report-action-dialog';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, finalize, from, map, of, switchMap, timeout, toArray } from 'rxjs';
import { environment } from '../../environments/environment';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

const requiredWhenOther = (selection: string) => (control: AbstractControl) => {
  const value = control.parent?.get(selection)?.value;
  const other = Array.isArray(value)
    ? value.includes('other')
    : typeof value === 'string' && value.toLowerCase() === 'other';
  return other && !String(control.value ?? '').trim() ? { required: true } : null;
};
const timezoneValidator = (control: AbstractControl) => {
  if (!String(control.value ?? '').trim()) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: control.value.trim() });
    return null;
  } catch {
    return { timezone: true };
  }
};

type UploadedMedia = {
  attachment_id?: string;
  url?: string;
  name: string;
  size_bytes: number;
  size: string;
  type: string;
};

const reportMediaEndpoint = `${environment.apiUrl}${environment.apiBaseUrl}/api/v2/person-reports/media`;

function hasReportMediaUrl(url: string | undefined, documentId: string | undefined): boolean {
  if (typeof url !== 'string') return false;
  if (/^s3:\/\/[a-z0-9.-]+\/[^\s?#]+$/.test(url)) return true;
  if (!documentId) return false;

  const prefix = `${reportMediaEndpoint}/files/${encodeURIComponent(documentId)}/`;
  // The API also serves older uploads whose S3 keys include a file UUID.
  const filePath = /^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/)?[0-9a-f]{64}$/;
  return url.startsWith(prefix) && filePath.test(url.slice(prefix.length));
}

function sectionChanges<Fields extends object>(fields: Fields, baseline: Fields): Partial<Fields> {
  const changes: Partial<Fields> = {};
  for (const key of Object.keys(fields) as (keyof Fields)[]) {
    if (JSON.stringify(fields[key]) !== JSON.stringify(baseline[key])) {
      changes[key] = fields[key];
    }
  }
  return changes;
}

@Component({
  selector: 'app-missing-person-report',
  imports: [
    KeyValuePipe,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    NavigationHeader,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './missing-person-report.html',
  styleUrl: './missing-person-report.scss',
})
export class MissingPersonReport implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly uploadFiles = new Map<UploadedMedia, File>();
  protected readonly maxPhotoSizeMb = 5;
  protected readonly maxVideoSizeMb = 25;
  protected readonly mediaSelectionErrors = signal<string[]>([]);
  protected readonly mediaUploadError = signal('');
  protected readonly uploadingMedia = signal(false);
  protected readonly photoFiles: UploadedMedia[] = [];
  protected readonly videoFiles: UploadedMedia[] = [];
  /** Host integration supplies persisted workflow and listens for actionRequested. */
  readonly workflow = input<ReportWorkflow | null>(null);
  readonly reportContext = input<ReportContext | null>(null);
  readonly reviewReason = input('');
  readonly administrator = input(false);
  readonly integrationReady = input(false);
  readonly reportSubmitted = output<void>();
  readonly actionRequested = output<{
    action: ReportAction;
    report_id?: string;
    user_id?: string;
    version?: number;
    payload: unknown;
  }>();
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submissionError = signal('');
  protected readonly confirmingSubmission = signal(false);
  protected readonly editable = computed(
    () =>
      !this.submitting() &&
      !this.submitted() &&
      !this.administrator() &&
      (!this.workflow() ||
        ['DRAFT', 'REJECTED'].includes(this.workflow()!.status) ||
        (this.workflow()!.status === 'PUBLISHED' &&
          this.workflow()!.person_status === 'MISSING' &&
          ['DRAFT', 'REJECTED'].includes(this.workflow()!.revision_status ?? ''))),
  );
  protected readonly actions = computed(() =>
    allowedReportActions(this.workflow(), this.administrator()),
  );
  protected readonly selectedSection = signal(0);
  private readonly editingFromPreview = signal<number | null>(null);
  protected readonly sectionSaveAvailable = computed(
    () => !!this.reportContext() && !this.workflow() && this.editable(),
  );
  protected readonly validationShown = signal(false);
  protected readonly reviewLoading = computed(
    () => this.uploadingMedia() || this.reviewSections.some((section) => section.pending()),
  );
  protected readonly reviewLoadFailed = computed(
    () => !this.reviewLoading() && this.reviewSections.some((section) => section.needsLoad()),
  );
  protected readonly submitAvailable = computed(
    () =>
      this.editable() &&
      this.actions().includes('submit') &&
      (this.integrationReady() || this.sectionSaveAvailable()) &&
      !this.confirmingSubmission() &&
      !this.reviewLoading() &&
      !this.reviewLoadFailed(),
  );
  protected readonly sections = [
    'Pictures and Videos',
    'Identity',
    'Physical Description',
    'Social Media',
    'Educational History',
    'Employment History',
    'Last Seen & Circumstances',
    'Possible Sightings',
    'Case and Contact',
    'Preview and Submit',
  ];
  private readonly dialog = inject(MatDialog);
  @ViewChild(MatStepper) protected stepper?: MatStepper;
  protected sectionChanged(index: number): void {
    this.selectedSection.set(index);
    if (index !== this.editingFromPreview()) this.editingFromPreview.set(null);
    if (index === 9) {
      this.loadPreviewSections();
    } else {
      const section = this.reviewSections[index];
      if (section?.needsLoad()) section.load();
    }
  }
  protected selectSection(index: number): void {
    if (this.stepper) this.stepper.selectedIndex = index;
  }
  protected loadPreviewSections(): void {
    for (const section of this.reviewSections) {
      if (section.needsLoad()) section.load();
    }
  }
  protected editFromPreview(index: number): void {
    this.editingFromPreview.set(index);
    this.selectSection(index);
  }
  protected sectionNextLabel(index: number, label = 'Next'): string {
    if (this.editingFromPreview() !== index) return label;
    return this.sectionSaveAvailable() ? 'Save and return to preview' : 'Return to preview';
  }
  protected advanceFromSection(index: number): void {
    if (this.editingFromPreview() === index) this.selectSection(9);
    else this.stepper?.next();
  }
  private reportSection<Fields extends object>(config: {
    index: number;
    path: string;
    label: string;
    requestKey: string;
    payload: () => Fields;
    apply: (fields: Fields) => void;
    validate?: () => boolean;
  }) {
    const empty = config.payload();
    const baseline = signal<Fields | null | undefined>(undefined);
    const pending = signal<'loading' | 'saving' | null>(null);
    const errorMessage = signal('');
    const needsLoad = computed(() => this.sectionSaveAvailable() && baseline() === undefined);
    const actionSuffix = config.path.replaceAll('-', '_');
    const responseKey = `${actionSuffix}_section`;
    const label = config.label.toLowerCase();
    const request = (
      operation: 'get' | 'create' | 'update',
      context: ReportContext,
      fields: Partial<Fields> = {},
    ) =>
      this.http.post<Record<string, Partial<Fields> & { deleted_at?: string | null }>>(
        `${environment.apiUrl}${environment.apiBaseUrl}/api/v2/person-reports/${config.path}`,
        {
          action: `${operation}_${actionSuffix}`,
          [config.requestKey]: { ...context, ...fields },
        },
        { withCredentials: true },
      );
    const read = (context: ReportContext) =>
      request('get', context).pipe(
        map((response) => {
          const section = response[responseKey];
          if (!section || section.deleted_at) throw new Error('Section is unavailable.');
          const saved: Partial<Fields> = section;
          const fields = { ...empty };
          for (const key of Object.keys(empty) as (keyof Fields)[]) {
            fields[key] = saved[key] ?? empty[key];
          }
          return fields;
        }),
      );
    const load = () => {
      const context = this.reportContext();
      if (!context || pending()) return;

      pending.set('loading');
      errorMessage.set('');
      read(context)
        .pipe(
          catchError((error: unknown) => {
            if (
              error instanceof HttpErrorResponse &&
              error.status === 404 &&
              error.error?.error_message === `${config.label} section not found.`
            ) {
              return of(null);
            }
            throw error;
          }),
          timeout(15_000),
          takeUntilDestroyed(this.destroyRef),
          finalize(() => pending.set(null)),
        )
        .subscribe({
          next: (saved) => {
            if (saved) config.apply(saved);
            baseline.set(saved ? config.payload() : null);
          },
          error: () => errorMessage.set(`Could not load the ${label}. Please try again.`),
        });
    };
    const next = () => {
      if (pending()) return;
      const context = this.reportContext();
      if (!context || !this.sectionSaveAvailable()) {
        this.advanceFromSection(config.index);
        return;
      }
      const previous = baseline();
      if (previous === undefined) {
        load();
        return;
      }
      if (config.validate && !config.validate()) return;

      const fields = config.payload();
      const changes = previous ? sectionChanges(fields, previous) : fields;
      errorMessage.set('');
      if (!Object.keys(changes).length) {
        this.advanceFromSection(config.index);
        return;
      }

      pending.set('saving');
      request(previous ? 'update' : 'create', context, changes)
        .pipe(
          map(() => fields),
          catchError((error: unknown) => {
            if (
              previous ||
              !(error instanceof HttpErrorResponse) ||
              error.status !== 409 ||
              error.error?.error_message !== `${config.label} section already exists.`
            ) {
              throw error;
            }

            // A prior attempt may have saved successfully even if its response was lost.
            return read(context).pipe(
              switchMap((saved) => {
                const merged = { ...saved, ...sectionChanges(fields, empty) };
                const patch = sectionChanges(merged, saved);
                return Object.keys(patch).length
                  ? request('update', context, patch).pipe(map(() => merged))
                  : of(saved);
              }),
            );
          }),
          timeout(15_000),
          takeUntilDestroyed(this.destroyRef),
          finalize(() => pending.set(null)),
        )
        .subscribe({
          next: (saved) => {
            if (saved !== fields) config.apply(saved);
            baseline.set(saved === fields ? saved : config.payload());
            if (this.selectedSection() === config.index) this.advanceFromSection(config.index);
          },
          error: () => errorMessage.set(`Could not save the ${label}. Please try again.`),
        });
    };

    return { pending, errorMessage, needsLoad, load, next };
  }

  private applyIdentity({
    aliases,
    ...fields
  }: ReturnType<MissingPersonReport['identityPayload']>): void {
    this.detailsForm.patchValue(fields);
    this.aliases.clear();
    for (const alias of aliases.length ? aliases : ['']) {
      this.aliases.push(this.formBuilder.nonNullable.control(alias));
    }
  }
  protected readonly sectionFields: string[][] = [
    [],
    [
      'firstName',
      'middleName',
      'lastName',
      'aliases',
      'dateOfBirth',
      'ageWhenMissing',
      'currentAge',
    ],
    [
      'gender',
      'sexAtBirth',
      'raceEthnicity',
      'raceEthnicityOther',
      'height',
      'weight',
      'hairColor',
      'hairColorOther',
      'eyeColor',
      'complexion',
      'scarsMarksTattoos',
      'medicalConditions',
      'medications',
      'disabilities',
      'languages',
      'otherIdentifiers',
    ],
    ['socialProfiles'],
    ['educationHistory'],
    ['employmentHistory'],
    [
      'classification',
      'lastContactDate',
      'lastContactTime',
      'timezone',
      'streetAddress',
      'locationType',
      'locationTypeOther',
      'lastSeenWithName',
      'lastSeenWithRelationship',
      'lastSeenWithPhone',
      'riskFactors',
      'riskFactorsOther',
      'itemsLeftBehind',
      'additionalContext',
      'lastSeenDate',
      'lastSeenTime',
      'lastSeenLocation',
      'city',
      'state',
      'country',
      'zipcode',
      'lastSeenLatitude',
      'lastSeenLongitude',
      'clothing',
      'accessories',
      'circumstances',
      'possibleDestination',
    ],
    ['possibleSightings'],
    ['caseContacts', 'transportation', 'companions'],
    [],
  ];
  protected sectionState(index: number): string {
    if (index === 9) return 'Review';
    const controls =
      index === 0
        ? Object.values(this.mediaForm.controls)
        : this.sectionFields[index]
            .filter((name) => name !== 'country')
            .map((name) => this.detailsForm.get(name)!);
    const hasValue = (value: unknown): boolean =>
      typeof value === 'string'
        ? !!value.trim()
        : Array.isArray(value)
          ? value.some(hasValue)
          : value !== null && typeof value === 'object'
            ? Object.values(value).some(hasValue)
            : value === true;
    const started =
      controls.some((control) => hasValue(control.getRawValue())) ||
      (index === 0 && this.mediaCount() > 0);
    if (!started) return 'Not started';
    const otherMissing = index === 2 && !this.otherDetailsValid();
    return controls.some((control) => control.invalid) || otherMissing ? 'In progress' : 'Complete';
  }
  protected fieldLabel(key: string): string {
    return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase());
  }
  private otherDetailsValid(): boolean {
    const value = this.detailsForm.getRawValue();
    return (
      (value.raceEthnicity !== 'Other' || !!value.raceEthnicityOther.trim()) &&
      (value.hairColor !== 'Other' || !!value.hairColorOther.trim())
    );
  }
  protected requestAction(action: ReportAction): void {
    if (action === 'submit') {
      if (!this.submitAvailable()) return;
    } else if (!this.integrationReady() || !this.actions().includes(action)) {
      return;
    }
    if (action === 'save') {
      this.emitAction(action, this.buildReportPayload());
      return;
    }
    if (action === 'submit') {
      this.mediaForm.markAllAsTouched();
      this.detailsForm.markAllAsTouched();
      this.validationShown.set(true);
      if (this.mediaForm.invalid || this.detailsForm.invalid || !this.otherDetailsValid()) {
        const section = this.sections.findIndex(
          (_, i) =>
            i < 9 && this.sectionFields[i].some((name) => this.detailsForm.get(name)?.invalid),
        );
        this.selectSection(
          this.mediaForm.invalid ? 0 : !this.otherDetailsValid() ? 2 : Math.max(section, 0),
        );
        return;
      }
      if (this.sectionSaveAvailable() && this.mediaWithoutUrl().length) {
        this.mediaUploadError.set(
          'Save Pictures and Videos before submitting so each file has an S3 URL.',
        );
        this.editFromPreview(0);
        return;
      }
      this.confirmingSubmission.set(true);
    }
    this.dialog
      .open(ReportActionDialog, {
        data: action,
        width: '480px',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((details) => {
        if (action === 'submit') this.confirmingSubmission.set(false);
        if (!details) return;
        if (action === 'submit' && this.sectionSaveAvailable()) {
          this.submitDraft();
        } else {
          this.emitAction(action, action === 'submit' ? this.buildReportPayload() : details);
        }
      });
  }

  private submitDraft(): void {
    const context = this.reportContext();
    if (!context || !this.submitAvailable()) return;

    this.submissionError.set('');
    this.submitting.set(true);
    this.http
      .post<ReportContext & { report_status: 'SUBMITTED' }>(
        `${environment.apiUrl}${environment.apiBaseUrl}/api/v2/person-reports/submit`,
        { action: 'submit_report', report: { ...context, ...this.buildReportPayload() } },
        { withCredentials: true },
      )
      .pipe(
        timeout(120_000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (receipt) => {
          if (
            receipt?.report_status !== 'SUBMITTED' ||
            receipt._id !== context._id ||
            receipt.report_id !== context.report_id ||
            receipt.user_id !== context.user_id
          ) {
            this.submissionError.set(
              'The server did not confirm your submission. Please try again.',
            );
            return;
          }
          this.submitted.set(true);
          this.selectSection(9);
          this.reportSubmitted.emit();
        },
        error: () => this.submissionError.set('Could not submit the report. Please try again.'),
      });
  }
  private emitAction(action: ReportAction, payload: unknown): void {
    const workflow = this.workflow();
    const context = this.reportContext();
    this.actionRequested.emit({
      action,
      report_id: context?.report_id ?? workflow?.id,
      ...(context ? { user_id: context.user_id } : {}),
      version: workflow?.version,
      payload,
    });
  }

  protected readonly mediaForm = this.formBuilder.nonNullable.group({
    mediaNotes: [''],
    consentToUseMedia: [false, Validators.requiredTrue],
  });

  protected readonly mediaSection = this.reportSection({
    index: 0,
    path: 'media',
    label: 'Media',
    requestKey: 'media',
    payload: () => this.mediaPayload(),
    apply: (media) => this.applyMedia(media),
  });

  protected readonly detailsForm = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    aliases: this.formBuilder.array([this.formBuilder.nonNullable.control('')]),
    dateOfBirth: [''],
    ageWhenMissing: [''],
    currentAge: [''],
    gender: [''],
    sexAtBirth: [''],
    raceEthnicity: [''],
    raceEthnicityOther: ['', requiredWhenOther('raceEthnicity')],
    height: [''],
    weight: [''],
    hairColor: [''],
    hairColorOther: ['', requiredWhenOther('hairColor')],
    eyeColor: [''],
    complexion: [''],
    scarsMarksTattoos: [''],
    medicalConditions: [''],
    medications: [''],
    disabilities: [''],
    languages: [''],
    employmentHistory: this.formBuilder.array([this.createEmployment()]),
    caseContacts: this.formBuilder.array([this.createContact()]),
    socialProfiles: this.formBuilder.array([this.createSocialProfile()]),
    educationHistory: this.formBuilder.array([this.createEducationRecord()]),
    clothing: [''],
    accessories: [''],
    otherIdentifiers: [''],
    classification: [''],
    lastContactDate: [''],
    lastContactTime: [''],
    timezone: ['', timezoneValidator],
    streetAddress: [''],
    locationType: [''],
    locationTypeOther: ['', requiredWhenOther('locationType')],
    lastSeenWithName: [''],
    lastSeenWithRelationship: [''],
    lastSeenWithPhone: [''],
    riskFactors: this.formBuilder.nonNullable.control<string[]>([]),
    riskFactorsOther: ['', requiredWhenOther('riskFactors')],
    itemsLeftBehind: this.formBuilder.array([this.createLeftBehindItem()]),
    additionalContext: [''],
    lastSeenDate: ['', Validators.required],
    lastSeenTime: [''],
    lastSeenLocation: ['', Validators.required],
    city: [''],
    state: [''],
    country: ['United States'],
    zipcode: [''],
    lastSeenLatitude: ['', [Validators.min(-90), Validators.max(90)]],
    lastSeenLongitude: ['', [Validators.min(-180), Validators.max(180)]],
    possibleSightings: this.formBuilder.array([this.createPossibleSighting()]),
    transportation: [''],
    companions: [''],
    circumstances: [''],
    possibleDestination: [''],
  });

  protected readonly identitySection = this.reportSection({
    index: 1,
    path: 'identity',
    label: 'Identity',
    requestKey: 'identity',
    payload: () => this.identityPayload(),
    apply: (fields) => this.applyIdentity(fields),
    validate: () => {
      const { firstName, lastName } = this.detailsForm.controls;
      firstName.markAsTouched();
      lastName.markAsTouched();
      return firstName.valid && lastName.valid;
    },
  });

  protected readonly physicalSection = this.reportSection({
    index: 2,
    path: 'physical-description',
    label: 'Physical description',
    requestKey: 'physicalDescription',
    payload: () => this.physicalDescriptionPayload(),
    apply: (fields) => this.detailsForm.patchValue(fields),
    validate: () => {
      const { raceEthnicityOther, hairColorOther } = this.detailsForm.controls;
      raceEthnicityOther.markAsTouched();
      hairColorOther.markAsTouched();
      return this.otherDetailsValid();
    },
  });

  protected readonly socialSection = this.reportSection({
    index: 3,
    path: 'social-media',
    label: 'Social media',
    requestKey: 'socialMedia',
    payload: () => ({ profiles: this.filledSocialProfiles() }),
    apply: ({ profiles }) => this.applySocialProfiles(profiles),
  });

  protected readonly educationSection = this.reportSection({
    index: 4,
    path: 'educational-history',
    label: 'Educational history',
    requestKey: 'educationalHistory',
    payload: () => ({ records: this.filledEducationRecords() }),
    apply: ({ records }) => this.applyEducationRecords(records),
  });

  protected readonly employmentSection = this.reportSection({
    index: 5,
    path: 'employment-history',
    label: 'Employment history',
    requestKey: 'employmentHistory',
    payload: () => ({ records: this.filledEmploymentRecords() }),
    apply: ({ records }) => this.applyEmploymentRecords(records),
  });

  protected readonly lastSeenSection = this.reportSection({
    index: 6,
    path: 'last-seen',
    label: 'Last seen',
    requestKey: 'lastSeen',
    payload: () => this.lastSeenPayload(),
    apply: (fields) => this.applyLastSeen(fields),
    validate: () => {
      const controls = this.sectionFields[6].map((name) => this.detailsForm.get(name)!);
      controls.forEach((control) => control.markAllAsTouched());
      return controls.every((control) => control.valid);
    },
  });

  protected readonly sightingsSection = this.reportSection({
    index: 7,
    path: 'possible-sighting-locations',
    label: 'Possible sighting locations',
    requestKey: 'possibleSightingLocations',
    payload: () => ({ records: this.filledPossibleSightings() }),
    apply: ({ records }) => this.applyPossibleSightings(records),
    validate: () => {
      this.possibleSightings.markAllAsTouched();
      return this.possibleSightings.valid;
    },
  });

  protected readonly caseContactSection = this.reportSection({
    index: 8,
    path: 'case-and-contact',
    label: 'Case and contact',
    requestKey: 'caseAndContact',
    payload: () => ({
      transportation: this.detailsForm.controls.transportation.value,
      companions: this.detailsForm.controls.companions.value,
      records: this.caseContacts.getRawValue(),
    }),
    apply: ({ records, ...fields }) => {
      this.detailsForm.patchValue(fields);
      this.applyCaseContacts(records);
    },
    validate: () => {
      this.caseContacts.markAllAsTouched();
      return this.caseContacts.valid;
    },
  });

  private readonly reviewSections = [
    this.mediaSection,
    this.identitySection,
    this.physicalSection,
    this.socialSection,
    this.educationSection,
    this.employmentSection,
    this.lastSeenSection,
    this.sightingsSection,
    this.caseContactSection,
  ];

  ngOnInit(): void {
    if (this.mediaSection.needsLoad()) this.mediaSection.load();
  }

  constructor() {
    for (const [selection, detail] of [
      ['raceEthnicity', 'raceEthnicityOther'],
      ['hairColor', 'hairColorOther'],
      ['locationType', 'locationTypeOther'],
      ['riskFactors', 'riskFactorsOther'],
    ]) {
      this.detailsForm
        .get(selection)!
        .valueChanges.pipe(takeUntilDestroyed())
        .subscribe(() =>
          this.detailsForm.get(detail)!.updateValueAndValidity({ emitEvent: false }),
        );
    }

    effect(() => {
      const editable = this.editable();
      for (const form of [this.mediaForm, this.detailsForm]) {
        if (editable) form.enable({ emitEvent: false });
        else form.disable({ emitEvent: false });
      }
    });
  }

  protected readonly states = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming',
  ];

  protected readonly genders = ['Female', 'Male', 'Nonbinary', 'Transgender', 'Unknown'];
  protected readonly sexOptions = ['Female', 'Male', 'Intersex', 'Unknown'];
  protected readonly raceOptions = [
    'American Indian or Alaska Native',
    'Asian',
    'Black or African American',
    'Hispanic or Latino',
    'Middle Eastern or North African',
    'Native Hawaiian or Pacific Islander',
    'White',
    'Multiple',
    'Other',
    'Unknown',
  ];
  protected readonly hairColors = ['Black', 'Blonde', 'Brown', 'Gray', 'Red', 'White', 'Other'];
  protected readonly eyeColors = ['Black', 'Blue', 'Brown', 'Green', 'Gray', 'Hazel', 'Other'];
  protected readonly educationStatuses = [
    'Currently enrolled',
    'Recently withdrew',
    'Graduated',
    'Homeschooled',
    'Not enrolled',
    'Unknown',
  ];

  protected get socialProfiles() {
    return this.detailsForm.controls.socialProfiles;
  }

  protected get educationHistory() {
    return this.detailsForm.controls.educationHistory;
  }

  protected get possibleSightings() {
    return this.detailsForm.controls.possibleSightings;
  }

  protected addPhotos(event: Event): void {
    this.addFiles(event, this.photoFiles, 'image/');
  }

  protected addVideos(event: Event): void {
    this.addFiles(event, this.videoFiles, 'video/');
  }

  protected removePhoto(index: number): void {
    if (!this.editable()) return;
    this.uploadFiles.delete(this.photoFiles[index]);
    this.photoFiles.splice(index, 1);
  }

  protected removeVideo(index: number): void {
    if (!this.editable()) return;
    this.uploadFiles.delete(this.videoFiles[index]);
    this.videoFiles.splice(index, 1);
  }

  protected saveMediaAndAdvance(): void {
    if (this.uploadingMedia() || this.mediaSection.pending()) return;
    const context = this.reportContext();
    if (!context || !this.sectionSaveAvailable() || this.mediaSection.needsLoad()) {
      this.mediaSection.next();
      return;
    }

    this.mediaUploadError.set('');
    const pending = this.mediaWithoutUrl();
    if (!pending.length) {
      this.mediaSection.next();
      return;
    }
    this.mediaForm.markAllAsTouched();
    if (this.mediaForm.invalid) return;
    if (pending.some((entry) => !this.uploadFiles.has(entry))) {
      this.mediaUploadError.set('Remove files with missing S3 URLs and select them again.');
      return;
    }

    this.uploadingMedia.set(true);
    from(pending)
      .pipe(
        concatMap((entry) => {
          const file = this.uploadFiles.get(entry)!;
          const body = new FormData();
          body.append('file', file);
          return this.http
            .post<{ url: string }>(`${reportMediaEndpoint}/upload`, body, {
              withCredentials: true,
              params: {
                _id: context._id,
                report_id: context.report_id,
                kind: this.photoFiles.includes(entry) ? 'photo' : 'video',
              },
            })
            .pipe(
              timeout(120_000),
              map((result) => {
                if (!hasReportMediaUrl(result?.url, context._id))
                  throw new Error('Invalid media URL');
                entry.url = result.url;
                this.uploadFiles.delete(entry);
              }),
            );
        }),
        toArray(),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.uploadingMedia.set(false)),
      )
      .subscribe({
        next: () => {
          this.uploadingMedia.set(false);
          this.mediaSection.next();
        },
        error: () =>
          this.mediaUploadError.set('Could not upload every file to S3. Please try again.'),
      });
  }

  private mediaWithoutUrl(): UploadedMedia[] {
    const documentId = this.reportContext()?._id;
    return [...this.photoFiles, ...this.videoFiles].filter(
      (entry) => !hasReportMediaUrl(entry.url, documentId),
    );
  }

  protected addSocialProfile(): void {
    if (!this.editable()) return;
    this.socialProfiles.push(this.createSocialProfile());
  }

  protected removeSocialProfile(index: number): void {
    if (!this.editable()) return;
    if (this.socialProfiles.length > 1) {
      this.socialProfiles.removeAt(index);
    }
  }

  protected addEducationRecord(): void {
    if (!this.editable()) return;
    this.educationHistory.push(this.createEducationRecord());
  }

  protected removeEducationRecord(index: number): void {
    if (!this.editable()) return;
    if (this.educationHistory.length > 1) {
      this.educationHistory.removeAt(index);
    }
  }

  protected addPossibleSighting(): void {
    if (!this.editable()) return;
    if (this.possibleSightings.length < 25)
      this.possibleSightings.push(this.createPossibleSighting());
  }

  protected removePossibleSighting(index: number): void {
    if (!this.editable()) return;
    if (this.possibleSightings.length > 1) {
      this.possibleSightings.removeAt(index);
    }
  }

  protected submitReport(): void {
    this.requestAction('submit');
  }

  private identityPayload(details = this.detailsForm.getRawValue()) {
    return {
      firstName: details.firstName,
      middleName: details.middleName,
      lastName: details.lastName,
      aliases: details.aliases.map((value) => value.trim()).filter(Boolean),
      dateOfBirth: details.dateOfBirth,
      ageWhenMissing: details.ageWhenMissing,
      currentAge: details.currentAge,
    };
  }

  private physicalDescriptionPayload(details = this.detailsForm.getRawValue()) {
    return {
      gender: details.gender,
      sexAtBirth: details.sexAtBirth,
      raceEthnicity: details.raceEthnicity,
      raceEthnicityOther:
        details.raceEthnicity === 'Other' ? details.raceEthnicityOther.trim() : '',
      height: details.height,
      weight: details.weight,
      hairColor: details.hairColor,
      hairColorOther: details.hairColor === 'Other' ? details.hairColorOther.trim() : '',
      eyeColor: details.eyeColor,
      complexion: details.complexion,
      scarsMarksTattoos: details.scarsMarksTattoos,
      medicalConditions: details.medicalConditions,
      medications: details.medications,
      disabilities: details.disabilities,
      languages: details.languages,
      otherIdentifiers: details.otherIdentifiers,
    };
  }

  private lastSeenPayload(details = this.detailsForm.getRawValue()) {
    return {
      classification: details.classification,
      timezone: details.timezone.trim(),
      lastContact: { date: details.lastContactDate, time: details.lastContactTime },
      address: details.streetAddress,
      locationType: details.locationType,
      locationTypeOther: details.locationType === 'other' ? details.locationTypeOther.trim() : '',
      lastSeenWith: {
        name: details.lastSeenWithName,
        relationship: details.lastSeenWithRelationship,
        contactPhone: details.lastSeenWithPhone,
      },
      riskFactors: details.riskFactors,
      riskFactorsOther: details.riskFactors.includes('other')
        ? details.riskFactorsOther.trim()
        : '',
      itemsLeftBehind: details.itemsLeftBehind
        .map((record) => ({ item: record.item.trim(), details: record.details.trim() }))
        .filter((record) => record.item || record.details),
      additionalContext: details.additionalContext,

      date: details.lastSeenDate,
      time: details.lastSeenTime,
      location: details.lastSeenLocation,
      city: details.city,
      state: details.state,
      country: details.country,
      zipcode: details.zipcode,
      coordinates: {
        latitude: details.lastSeenLatitude,
        longitude: details.lastSeenLongitude,
      },
      clothing: details.clothing,
      accessories: details.accessories,
      circumstances: details.circumstances,
      possibleDestination: details.possibleDestination,
    };
  }

  private applyLastSeen(saved: ReturnType<MissingPersonReport['lastSeenPayload']>): void {
    this.itemsLeftBehind.clear();
    for (const record of saved.itemsLeftBehind?.length ? saved.itemsLeftBehind : [{}]) {
      const group = this.createLeftBehindItem();
      group.patchValue(record);
      this.itemsLeftBehind.push(group);
    }
    this.detailsForm.patchValue({
      classification: saved.classification ?? '',
      timezone: saved.timezone ?? '',
      lastContactDate: saved.lastContact?.date ?? '',
      lastContactTime: saved.lastContact?.time ?? '',
      streetAddress: saved.address ?? '',
      locationType: saved.locationType ?? '',
      locationTypeOther: saved.locationTypeOther ?? '',
      lastSeenWithName: saved.lastSeenWith?.name ?? '',
      lastSeenWithRelationship: saved.lastSeenWith?.relationship ?? '',
      lastSeenWithPhone: saved.lastSeenWith?.contactPhone ?? '',
      riskFactors: saved.riskFactors ?? [],
      riskFactorsOther: saved.riskFactorsOther ?? '',
      additionalContext: saved.additionalContext ?? '',
      lastSeenDate: saved.date,
      lastSeenTime: saved.time,
      lastSeenLocation: saved.location,
      city: saved.city,
      state: saved.state,
      country: saved.country,
      zipcode: saved.zipcode,
      lastSeenLatitude: saved.coordinates.latitude,
      lastSeenLongitude: saved.coordinates.longitude,
      clothing: saved.clothing,
      accessories: saved.accessories,
      circumstances: saved.circumstances,
      possibleDestination: saved.possibleDestination,
    });
  }

  buildReportPayload() {
    const details = this.detailsForm.getRawValue();

    return {
      media: this.mediaPayload(),
      missingPersonDetails: {
        identity: this.identityPayload(details),
        physicalDescription: this.physicalDescriptionPayload(details),
        socialMediaPresence: this.filledSocialProfiles(),
        educationalHistory: this.filledEducationRecords(),
        employmentHistory: this.filledEmploymentRecords(details.employmentHistory),
        lastSeen: {
          ...this.lastSeenPayload(details),
          transportation: details.transportation,
          companions: details.companions,
        },
        possibleSightingLocations: this.filledPossibleSightings(),
        caseAndReporterContact: details.caseContacts,
      },
    };
  }

  /** Integration boundary: restore only an authenticated owner's or administrator's response. */
  loadPayload(payload: ReturnType<MissingPersonReport['buildReportPayload']>): void {
    const data = payload.missingPersonDetails;
    if (
      data.employmentHistory.length > 25 ||
      data.possibleSightingLocations.length > 25 ||
      data.caseAndReporterContact.length > 10
    )
      throw new Error('Report exceeds supported record limits.');
    this.detailsForm.reset();
    this.uploadFiles.clear();
    this.aliases.clear();
    for (const alias of data.identity.aliases.length ? data.identity.aliases : [''])
      this.aliases.push(this.formBuilder.nonNullable.control(alias));
    this.applyEmploymentRecords(data.employmentHistory);
    this.applyCaseContacts(data.caseAndReporterContact);
    this.applySocialProfiles(data.socialMediaPresence);
    this.applyEducationRecords(data.educationalHistory);
    this.applyPossibleSightings(data.possibleSightingLocations);
    this.applyLastSeen(data.lastSeen);
    this.detailsForm.patchValue({
      ...data.identity,
      ...data.physicalDescription,
      transportation: data.lastSeen.transportation,
      companions: data.lastSeen.companions,
    });
    this.applyMedia(payload.media);
    if (!this.editable()) {
      this.detailsForm.disable({ emitEvent: false });
      this.mediaForm.disable({ emitEvent: false });
    }
    this.detailsForm.markAsPristine();
    this.mediaForm.markAsPristine();
  }
  getPayload(): ReturnType<MissingPersonReport['buildReportPayload']> {
    return this.buildReportPayload();
  }

  private mediaPayload() {
    return {
      photos: this.photoFiles.map((file) => ({ ...file })),
      videos: this.videoFiles.map((file) => ({ ...file })),
      notes: this.mediaForm.controls.mediaNotes.value,
      consentToUseMedia: this.mediaForm.controls.consentToUseMedia.value,
    };
  }

  private applyMedia(media: ReturnType<MissingPersonReport['mediaPayload']>): void {
    this.mediaForm.patchValue({
      mediaNotes: media.notes,
      consentToUseMedia: media.consentToUseMedia,
    });
    this.photoFiles.splice(0, this.photoFiles.length, ...media.photos);
    this.videoFiles.splice(0, this.videoFiles.length, ...media.videos);
  }

  protected mediaCount(): number {
    return this.photoFiles.length + this.videoFiles.length;
  }

  protected filledSocialProfiles() {
    return this.socialProfiles
      .getRawValue()
      .filter((profile) => Object.values(profile).some((value) => value.trim().length > 0));
  }

  private applySocialProfiles(
    profiles: ReturnType<MissingPersonReport['filledSocialProfiles']>,
  ): void {
    this.socialProfiles.clear();
    for (const profile of profiles.length ? profiles : [{}]) {
      const group = this.createSocialProfile();
      group.patchValue(profile);
      this.socialProfiles.push(group);
    }
  }

  protected filledEducationRecords() {
    return this.educationHistory
      .getRawValue()
      .filter((record) => Object.values(record).some((value) => value.trim().length > 0));
  }

  private applyEducationRecords(
    records: ReturnType<MissingPersonReport['filledEducationRecords']>,
  ): void {
    this.educationHistory.clear();
    for (const record of records.length ? records : [{}]) {
      const group = this.createEducationRecord();
      group.patchValue(record);
      this.educationHistory.push(group);
    }
  }

  protected filledPossibleSightings() {
    return this.possibleSightings
      .getRawValue()
      .filter((sighting) => Object.values(sighting).some((value) => value.trim().length > 0));
  }

  private applyPossibleSightings(
    records: ReturnType<MissingPersonReport['filledPossibleSightings']>,
  ): void {
    this.possibleSightings.clear();
    for (const record of records.length ? records : [{}]) {
      const group = this.createPossibleSighting();
      group.patchValue(record);
      this.possibleSightings.push(group);
    }
  }

  private filledEmploymentRecords(records = this.employmentHistory.getRawValue()) {
    return records.filter((record) => Object.values(record).some((value) => value.trim()));
  }

  private applyEmploymentRecords(
    records: ReturnType<MissingPersonReport['filledEmploymentRecords']>,
  ): void {
    this.employmentHistory.clear();
    for (const record of records.length ? records : [{}]) {
      const group = this.createEmployment();
      group.patchValue(record);
      this.employmentHistory.push(group);
    }
  }

  protected optionLabel(options: string[][], value: string): string {
    return options.find((option) => option[0] === value)?.[1] ?? 'Unknown';
  }
  protected riskLabels(): string {
    return this.detailsForm.controls.riskFactors.value
      .map((value) => this.optionLabel(this.riskOptions, value))
      .join(', ');
  }
  protected readonly classifications = [
    ['unknown', 'Unknown'],
    ['endangered_medical', 'Medical concern'],
    ['endangered', 'Endangered'],
    ['involuntary', 'Suspected involuntary disappearance'],
    ['voluntary', 'Reported voluntary departure'],
    ['other', 'Other / not sure'],
  ];
  protected readonly locationTypes = [
    ['unknown', 'Unknown'],
    ['home', 'Home'],
    ['workplace', 'Workplace'],
    ['school', 'School'],
    ['shopping_center', 'Shopping center'],
    ['transit_station', 'Transit station'],
    ['outdoors', 'Outdoors'],
    ['other', 'Other'],
  ];
  protected readonly riskOptions = [
    ['unknown', 'Unknown'],
    ['insulin_dependent', 'Insulin dependent'],
    ['medication_required', 'Needs regular medication'],
    ['cognitive_impairment', 'Memory or cognitive difficulties'],
    ['limited_mobility', 'Limited mobility'],
    ['phone_powered_off', 'Phone powered off or unreachable'],
    ['extreme_weather_exposure', 'Exposure to extreme weather'],
    ['other', 'Other'],
  ];
  protected get itemsLeftBehind() {
    return this.detailsForm.controls.itemsLeftBehind;
  }
  protected addLeftBehindItem(): void {
    if (this.editable()) this.itemsLeftBehind.push(this.createLeftBehindItem());
  }
  protected removeLeftBehindItem(index: number): void {
    if (this.editable() && this.itemsLeftBehind.length > 1) this.itemsLeftBehind.removeAt(index);
  }
  private createLeftBehindItem() {
    return this.formBuilder.nonNullable.group({ item: [''], details: [''] });
  }

  protected get aliases() {
    return this.detailsForm.controls.aliases;
  }
  protected get employmentHistory() {
    return this.detailsForm.controls.employmentHistory;
  }
  protected get caseContacts() {
    return this.detailsForm.controls.caseContacts;
  }
  protected addAlias(): void {
    if (!this.editable()) return;
    this.aliases.push(this.formBuilder.nonNullable.control(''));
  }
  protected removeAlias(index: number): void {
    if (!this.editable()) return;
    if (this.aliases.length > 1) this.aliases.removeAt(index);
  }
  protected addEmployment(): void {
    if (!this.editable()) return;
    if (this.employmentHistory.length < 25) this.employmentHistory.push(this.createEmployment());
  }
  protected removeEmployment(index: number): void {
    if (!this.editable()) return;
    if (this.employmentHistory.length > 1) this.employmentHistory.removeAt(index);
  }
  protected addContact(): void {
    if (!this.editable()) return;
    if (this.caseContacts.length < 10) this.caseContacts.push(this.createContact());
  }
  protected removeContact(index: number): void {
    if (!this.editable()) return;
    if (this.caseContacts.length > 1) this.caseContacts.removeAt(index);
  }

  private applyCaseContacts(
    records: ReturnType<MissingPersonReport['caseContacts']['getRawValue']>,
  ): void {
    this.caseContacts.clear();
    for (const record of records.length ? records : [{}]) {
      const group = this.createContact();
      group.patchValue(record);
      this.caseContacts.push(group);
    }
  }

  private createEmployment() {
    return this.formBuilder.nonNullable.group({
      currentEmployer: [''],
      jobTitle: [''],
      workLocation: [''],
      workSchedule: [''],
      supervisorContact: [''],
      previousEmployers: [''],
      employmentNotes: [''],
    });
  }
  private createContact() {
    return this.formBuilder.nonNullable.group({
      lawEnforcementAgency: ['', []],
      caseNumber: ['', []],
      officerName: ['', []],
      officerPhone: ['', []],
      reporterRelationship: ['', []],
      reporterName: ['', Validators.required],
      reporterPhone: ['', Validators.required],
      reporterEmail: ['', [Validators.required, Validators.email]],
      urgentSafetyNotes: ['', []],
    });
  }

  private createSocialProfile() {
    return this.formBuilder.nonNullable.group({
      platform: [''],
      profileUrl: [''],
      handle: [''],
      onlineAlias: [''],
      messagingApp: [''],
      notes: [''],
    });
  }

  private createEducationRecord() {
    return this.formBuilder.nonNullable.group({
      schoolName: [''],
      schoolDistrict: [''],
      gradeLevel: [''],
      studentId: [''],
      educationStatus: [''],
      schoolContacts: [''],
      startDate: [''],
      endDate: [''],
      notes: [''],
    });
  }

  private createPossibleSighting() {
    return this.formBuilder.nonNullable.group({
      sightingDate: [''],
      sightingTime: [''],
      locationName: [''],
      address: [''],
      city: [''],
      state: [''],
      latitude: ['', [Validators.min(-90), Validators.max(90)]],
      longitude: ['', [Validators.min(-180), Validators.max(180)]],
      reportedBy: [''],
      notes: [''],
    });
  }

  private addFiles(event: Event, collection: UploadedMedia[], typePrefix: string): void {
    if (!this.editable()) return;
    const input = event.target as HTMLInputElement;
    const limitMb = typePrefix === 'image/' ? this.maxPhotoSizeMb : this.maxVideoSizeMb;
    const errors: string[] = [];
    const files = Array.from(input.files ?? []).filter((file) => {
      if (!file.type.startsWith(typePrefix)) return false;
      if (file.size > limitMb * 1024 * 1024) {
        errors.push(`${file.name} exceeds the ${limitMb} MB limit and was not added.`);
        return false;
      }
      return true;
    });
    this.mediaSelectionErrors.set(errors);

    collection.push(
      ...files.map((file) => {
        const entry: UploadedMedia = {
          size_bytes: file.size,
          name: file.name,
          size: this.formatFileSize(file.size),
          type: file.type || 'Unknown',
        };
        this.uploadFiles.set(entry, file);
        return entry;
      }),
    );

    input.value = '';
  }

  private formatFileSize(size: number): string {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
}
