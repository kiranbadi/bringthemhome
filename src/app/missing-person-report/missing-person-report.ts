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
import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ViewChild,
  effect,
} from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { ReportWorkflow, ReportAction, allowedReportActions } from './report-workflow';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReportActionDialog } from './report-action-dialog';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

type UploadedMedia = {
  attachment_id?: string;
  client_id: string;
  name: string;
  size_bytes: number;
  size: string;
  type: string;
};

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
export class MissingPersonReport {
  private readonly formBuilder = inject(FormBuilder);

  readonly uploadFiles = new Map<string, File>();
  protected readonly photoFiles: UploadedMedia[] = [];
  protected readonly videoFiles: UploadedMedia[] = [];
  /** Host integration supplies persisted workflow and listens for actionRequested. */
  readonly workflow = input<ReportWorkflow | null>(null);
  readonly administrator = input(false);
  readonly integrationReady = input(false);
  readonly actionRequested = output<{
    action: ReportAction;
    report_id?: string;
    version?: number;
    payload: unknown;
  }>();
  protected readonly editable = computed(
    () =>
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
  protected readonly validationShown = signal(false);
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
  }
  protected selectSection(index: number): void {
    if (this.stepper) this.stepper.selectedIndex = index;
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
    if (!this.integrationReady() || !this.actions().includes(action)) return;
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
    }
    this.dialog
      .open(ReportActionDialog, {
        data: action,
        width: '480px',
        maxWidth: '95vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((details) => {
        if (details)
          this.emitAction(action, action === 'submit' ? this.buildReportPayload() : details);
      });
  }
  private emitAction(action: ReportAction, payload: unknown): void {
    const workflow = this.workflow();
    this.actionRequested.emit({
      action,
      report_id: workflow?.id,
      version: workflow?.version,
      payload,
    });
  }

  protected readonly mediaForm = this.formBuilder.nonNullable.group({
    mediaNotes: [''],
    consentToUseMedia: [false, Validators.requiredTrue],
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
    this.uploadFiles.delete(this.photoFiles[index]?.client_id);
    this.photoFiles.splice(index, 1);
  }

  protected removeVideo(index: number): void {
    if (!this.editable()) return;
    this.uploadFiles.delete(this.videoFiles[index]?.client_id);
    this.videoFiles.splice(index, 1);
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

  buildReportPayload() {
    const details = this.detailsForm.getRawValue();

    return {
      media: {
        photos: this.photoFiles,
        videos: this.videoFiles,
        notes: this.mediaForm.controls.mediaNotes.value,
        consentToUseMedia: this.mediaForm.controls.consentToUseMedia.value,
      },
      missingPersonDetails: {
        identity: {
          firstName: details.firstName,
          middleName: details.middleName,
          lastName: details.lastName,
          aliases: details.aliases.map((value) => value.trim()).filter(Boolean),
          dateOfBirth: details.dateOfBirth,
          ageWhenMissing: details.ageWhenMissing,
          currentAge: details.currentAge,
        },
        physicalDescription: {
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
        },
        socialMediaPresence: this.filledSocialProfiles(),
        educationalHistory: this.filledEducationRecords(),
        employmentHistory: details.employmentHistory.filter((record) =>
          Object.values(record).some((value) => value.trim()),
        ),
        lastSeen: {
          classification: details.classification,
          timezone: details.timezone.trim(),
          lastContact: { date: details.lastContactDate, time: details.lastContactTime },
          address: details.streetAddress,
          locationType: details.locationType,
          locationTypeOther:
            details.locationType === 'other' ? details.locationTypeOther.trim() : '',
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
    this.employmentHistory.clear();
    for (const record of data.employmentHistory.length ? data.employmentHistory : [{}]) {
      const group = this.createEmployment();
      group.patchValue(record);
      this.employmentHistory.push(group);
    }
    this.caseContacts.clear();
    for (const record of data.caseAndReporterContact.length ? data.caseAndReporterContact : [{}]) {
      const group = this.createContact();
      group.patchValue(record);
      this.caseContacts.push(group);
    }
    this.socialProfiles.clear();
    for (const record of data.socialMediaPresence.length ? data.socialMediaPresence : [{}]) {
      const group = this.createSocialProfile();
      group.patchValue(record);
      this.socialProfiles.push(group);
    }
    this.educationHistory.clear();
    for (const record of data.educationalHistory.length ? data.educationalHistory : [{}]) {
      const group = this.createEducationRecord();
      group.patchValue(record);
      this.educationHistory.push(group);
    }
    this.possibleSightings.clear();
    for (const record of data.possibleSightingLocations.length
      ? data.possibleSightingLocations
      : [{}]) {
      const group = this.createPossibleSighting();
      group.patchValue(record);
      this.possibleSightings.push(group);
    }
    this.itemsLeftBehind.clear();
    for (const record of data.lastSeen.itemsLeftBehind?.length
      ? data.lastSeen.itemsLeftBehind
      : [{}]) {
      const group = this.createLeftBehindItem();
      group.patchValue(record);
      this.itemsLeftBehind.push(group);
    }
    this.detailsForm.patchValue({
      classification: data.lastSeen.classification ?? '',
      timezone: data.lastSeen.timezone ?? '',
      lastContactDate: data.lastSeen.lastContact?.date ?? '',
      lastContactTime: data.lastSeen.lastContact?.time ?? '',
      streetAddress: data.lastSeen.address ?? '',
      locationType: data.lastSeen.locationType ?? '',
      locationTypeOther: data.lastSeen.locationTypeOther ?? '',
      lastSeenWithName: data.lastSeen.lastSeenWith?.name ?? '',
      lastSeenWithRelationship: data.lastSeen.lastSeenWith?.relationship ?? '',
      lastSeenWithPhone: data.lastSeen.lastSeenWith?.contactPhone ?? '',
      riskFactors: data.lastSeen.riskFactors ?? [],
      riskFactorsOther: data.lastSeen.riskFactorsOther ?? '',
      additionalContext: data.lastSeen.additionalContext ?? '',
      ...data.identity,
      ...data.physicalDescription,
      lastSeenDate: data.lastSeen.date,
      lastSeenTime: data.lastSeen.time,
      lastSeenLocation: data.lastSeen.location,
      city: data.lastSeen.city,
      state: data.lastSeen.state,
      country: data.lastSeen.country,
      zipcode: data.lastSeen.zipcode,
      lastSeenLatitude: data.lastSeen.coordinates.latitude,
      lastSeenLongitude: data.lastSeen.coordinates.longitude,
      clothing: data.lastSeen.clothing,
      accessories: data.lastSeen.accessories,
      circumstances: data.lastSeen.circumstances,
      possibleDestination: data.lastSeen.possibleDestination,
      transportation: data.lastSeen.transportation,
      companions: data.lastSeen.companions,
    });
    this.mediaForm.patchValue({
      mediaNotes: payload.media.notes,
      consentToUseMedia: payload.media.consentToUseMedia,
    });
    this.photoFiles.splice(0, this.photoFiles.length, ...payload.media.photos);
    this.videoFiles.splice(0, this.videoFiles.length, ...payload.media.videos);
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

  protected mediaCount(): number {
    return this.photoFiles.length + this.videoFiles.length;
  }

  protected filledSocialProfiles() {
    return this.socialProfiles
      .getRawValue()
      .filter((profile) => Object.values(profile).some((value) => value.trim().length > 0));
  }

  protected filledEducationRecords() {
    return this.educationHistory
      .getRawValue()
      .filter((record) => Object.values(record).some((value) => value.trim().length > 0));
  }

  protected filledPossibleSightings() {
    return this.possibleSightings
      .getRawValue()
      .filter((sighting) => Object.values(sighting).some((value) => value.trim().length > 0));
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
    const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith(typePrefix));

    collection.push(
      ...files.map((file) => {
        const clientId = crypto.randomUUID();
        this.uploadFiles.set(clientId, file);
        return {
          client_id: clientId,
          size_bytes: file.size,
          name: file.name,
          size: this.formatFileSize(file.size),
          type: file.type || 'Unknown',
        };
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
