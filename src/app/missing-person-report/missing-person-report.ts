import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { RouterLink } from '@angular/router';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

type UploadedMedia = {
  name: string;
  size: string;
  type: string;
};

@Component({
  selector: 'app-missing-person-report',
  imports: [
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

  protected readonly photoFiles: UploadedMedia[] = [];
  protected readonly videoFiles: UploadedMedia[] = [];
  protected submitted = false;

  protected readonly mediaForm = this.formBuilder.nonNullable.group({
    mediaNotes: [''],
    consentToUseMedia: [false, Validators.requiredTrue],
  });

  protected readonly detailsForm = this.formBuilder.nonNullable.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    nickname: [''],
    dateOfBirth: [''],
    ageWhenMissing: [''],
    currentAge: [''],
    gender: [''],
    sexAtBirth: [''],
    raceEthnicity: [''],
    height: [''],
    weight: [''],
    hairColor: [''],
    eyeColor: [''],
    complexion: [''],
    scarsMarksTattoos: [''],
    medicalConditions: [''],
    medications: [''],
    disabilities: [''],
    languages: [''],
    socialProfiles: this.formBuilder.array([this.createSocialProfile()]),
    educationHistory: this.formBuilder.array([this.createEducationRecord()]),
    currentEmployer: [''],
    jobTitle: [''],
    workLocation: [''],
    workSchedule: [''],
    supervisorContact: [''],
    previousEmployers: [''],
    employmentNotes: [''],
    clothing: [''],
    accessories: [''],
    otherIdentifiers: [''],
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
    lawEnforcementAgency: [''],
    caseNumber: [''],
    officerName: [''],
    officerPhone: [''],
    reporterRelationship: [''],
    reporterName: ['', Validators.required],
    reporterPhone: ['', Validators.required],
    reporterEmail: ['', [Validators.required, Validators.email]],
    urgentSafetyNotes: [''],
  });

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
    this.photoFiles.splice(index, 1);
  }

  protected removeVideo(index: number): void {
    this.videoFiles.splice(index, 1);
  }

  protected addSocialProfile(): void {
    this.socialProfiles.push(this.createSocialProfile());
  }

  protected removeSocialProfile(index: number): void {
    if (this.socialProfiles.length > 1) {
      this.socialProfiles.removeAt(index);
    }
  }

  protected addEducationRecord(): void {
    this.educationHistory.push(this.createEducationRecord());
  }

  protected removeEducationRecord(index: number): void {
    if (this.educationHistory.length > 1) {
      this.educationHistory.removeAt(index);
    }
  }

  protected addPossibleSighting(): void {
    this.possibleSightings.push(this.createPossibleSighting());
  }

  protected removePossibleSighting(index: number): void {
    if (this.possibleSightings.length > 1) {
      this.possibleSightings.removeAt(index);
    }
  }

  protected submitReport(): void {
    this.mediaForm.markAllAsTouched();
    this.detailsForm.markAllAsTouched();

    if (this.mediaForm.invalid || this.detailsForm.invalid) {
      return;
    }

    const payload = this.buildReportPayload();
    console.log('Missing person report payload', payload);
    this.submitted = true;
  }

  protected buildReportPayload() {
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
          nickname: details.nickname,
          dateOfBirth: details.dateOfBirth,
          ageWhenMissing: details.ageWhenMissing,
          currentAge: details.currentAge,
        },
        physicalDescription: {
          gender: details.gender,
          sexAtBirth: details.sexAtBirth,
          raceEthnicity: details.raceEthnicity,
          height: details.height,
          weight: details.weight,
          hairColor: details.hairColor,
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
        employmentHistory: {
          currentEmployer: details.currentEmployer,
          jobTitle: details.jobTitle,
          workLocation: details.workLocation,
          workSchedule: details.workSchedule,
          supervisorContact: details.supervisorContact,
          previousEmployers: details.previousEmployers,
          employmentNotes: details.employmentNotes,
        },
        lastSeen: {
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
        caseAndReporterContact: {
          lawEnforcementAgency: details.lawEnforcementAgency,
          caseNumber: details.caseNumber,
          officerName: details.officerName,
          officerPhone: details.officerPhone,
          reporterRelationship: details.reporterRelationship,
          reporterName: details.reporterName,
          reporterPhone: details.reporterPhone,
          reporterEmail: details.reporterEmail,
          urgentSafetyNotes: details.urgentSafetyNotes,
        },
      },
    };
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
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith(typePrefix));

    collection.push(
      ...files.map((file) => ({
        name: file.name,
        size: this.formatFileSize(file.size),
        type: file.type || 'Unknown',
      })),
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
