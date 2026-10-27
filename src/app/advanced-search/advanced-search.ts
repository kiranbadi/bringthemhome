import { US_STATES, stateName } from '../core/models/us-state-display';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ActivatedRoute, Router } from '@angular/router';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

const DEFAULT_CRITERIA = {
  reportedStartDate: '',
  reportedEndDate: '',
  firstName: '',
  middleName: '',
  lastName: '',
  city: '',
  state: '',
  country: '',
  ageMissingMin: '',
  ageMissingMax: '',
  ageNowMin: '',
  ageNowMax: '',
  agency: '',
  gender: '',
  race: '',
  hairColor: '',
  eyeColor: '',
  photoAvailable: '',
  alertType: '',
  sortBy: 'most_recent',
};

type CriteriaKey = keyof typeof DEFAULT_CRITERIA;

const CRITERIA_PARAMS: Record<CriteriaKey, string> = {
  reportedStartDate: 'reported_start_date',
  reportedEndDate: 'reported_end_date',
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  city: 'city',
  state: 'state',
  country: 'country',
  agency: 'agency',
  gender: 'gender',
  race: 'race',
  ageMissingMin: 'age_missing_min',
  ageMissingMax: 'age_missing_max',
  ageNowMin: 'age_now_min',
  ageNowMax: 'age_now_max',
  hairColor: 'hair_color',
  eyeColor: 'eye_color',
  photoAvailable: 'photo_available',
  alertType: 'alert_type',
  sortBy: 'sort_by',
};

@Component({
  selector: 'app-advanced-search',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    NavigationHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './advanced-search.html',
  styleUrl: './advanced-search.scss',
})
export class AdvancedSearch {
  protected readonly stateName = stateName;
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  private readonly defaultCriteria = DEFAULT_CRITERIA;

  private readonly criteriaLabels: Record<CriteriaKey, string> = {
    reportedStartDate: 'Reported Start Date',
    reportedEndDate: 'Reported End Date',
    firstName: 'First Name',
    middleName: 'Middle Name',
    lastName: 'Last Name',
    city: 'City',
    state: 'State',
    country: 'Country',
    ageMissingMin: 'Age Missing Minimum',
    ageMissingMax: 'Age Missing Maximum',
    ageNowMin: 'Age Now Minimum',
    ageNowMax: 'Age Now Maximum',
    agency: 'Agency',
    gender: 'Gender',
    race: 'Race',
    hairColor: 'Hair Color',
    eyeColor: 'Eye Color',
    photoAvailable: 'Photo Available',
    alertType: 'Alert Type',
    sortBy: 'Sort By',
  };

  private readonly criteriaDisplayValues: Partial<Record<CriteriaKey, Record<string, string>>> = {
    state: US_STATES,
    sortBy: {
      most_recent: 'Most Recent',
    },
  };

  protected readonly states =
    'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
      ' ',
    );

  protected readonly races = ['American Indian', 'Asian', 'Black', 'Hispanic', 'White', 'Other'];
  protected readonly genders = ['Female', 'Male', 'Nonbinary', 'Unknown'];
  protected readonly hairColors = ['Black', 'Blonde', 'Brown', 'Gray', 'Red', 'Other'];
  protected readonly eyeColors = ['Black', 'Blue', 'Brown', 'Green', 'Hazel', 'Other'];
  protected readonly photoAvailabilityOptions = [
    { label: 'Available', value: 'true' },
    { label: 'Not Available', value: 'false' },
  ];
  protected readonly alertTypes = ['AMBER'];

  protected readonly advancedSearchForm = this.formBuilder.nonNullable.group({
    reportedStartDate: [''],
    reportedEndDate: [''],
    firstName: [''],
    middleName: [''],
    lastName: [''],
    city: [''],
    state: [''],
    country: [''],
    ageMissingMin: [''],
    ageMissingMax: [''],
    ageNowMin: [''],
    ageNowMax: [''],
    agency: [''],
    gender: [''],
    race: [''],
    hairColor: [''],
    eyeColor: [''],
    photoAvailable: [''],
    alertType: [''],
    sortBy: ['most_recent'],
  });

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    for (const key of Object.keys(CRITERIA_PARAMS) as CriteriaKey[]) {
      const value = params.get(CRITERIA_PARAMS[key]);
      if (value !== null) this.advancedSearchForm.controls[key].setValue(value);
    }
  }

  protected reset(): void {
    this.advancedSearchForm.reset(this.defaultCriteria);
  }

  protected submit(): void {
    this.advancedSearchForm.markAllAsTouched();

    if (this.reportedDateRangeIncomplete()) {
      return;
    }

    if (this.invalidRanges()) return;
    const criteria = this.advancedSearchForm.getRawValue();
    const queryParams: Record<string, string | number> = { search: 'true', page: 1, page_size: 20 };

    for (const key of Object.keys(CRITERIA_PARAMS) as CriteriaKey[]) {
      const value = String(criteria[key] ?? '').trim();
      if (value) queryParams[CRITERIA_PARAMS[key]] = value;
    }
    void this.router.navigate(['/missing-persons'], { queryParams });
  }

  protected removeCriteria(key: CriteriaKey): void {
    this.advancedSearchForm.controls[key].setValue(this.defaultCriteria[key]);
  }

  protected activeCriteria(): readonly {
    key: CriteriaKey;
    label: string;
    value: string;
    canRemove: boolean;
  }[] {
    const criteria = this.advancedSearchForm.getRawValue();

    return (Object.keys(criteria) as CriteriaKey[])
      .filter(
        (key) =>
          key === 'sortBy' ||
          (String(criteria[key] ?? '').trim().length > 0 &&
            criteria[key] !== this.defaultCriteria[key]),
      )
      .map((key) => ({
        key,
        label: this.criteriaLabels[key],
        value: this.criteriaDisplayValues[key]?.[criteria[key]] ?? String(criteria[key] ?? ''),
        canRemove: key !== 'sortBy' || criteria[key] !== this.defaultCriteria[key],
      }));
  }

  protected reportedDateRangeIncomplete(): boolean {
    const criteria = this.advancedSearchForm.getRawValue();

    return Boolean(criteria.reportedStartDate && !criteria.reportedEndDate);
  }

  protected invalidRanges(): boolean {
    const c = this.advancedSearchForm.getRawValue();
    if (c.reportedStartDate && c.reportedEndDate && c.reportedStartDate > c.reportedEndDate)
      return true;
    return [
      [c.ageMissingMin, c.ageMissingMax],
      [c.ageNowMin, c.ageNowMax],
    ].some(
      ([min, max]) =>
        [min, max].some(
          (v) => String(v ?? '') !== '' && (!Number.isInteger(Number(v)) || Number(v) < 0),
        ) ||
        (String(min ?? '') !== '' && String(max ?? '') !== '' && Number(min) > Number(max)),
    );
  }
}
