import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

const DEFAULT_CRITERIA = {
  reportedStartDate: '2026-01-30',
  reportedEndDate: '2026-07-26',
  firstName: '',
  middleName: '',
  lastName: '',
  city: '',
  state: '',
  country: 'United States',
  ageMissing: '',
  ageNow: '',
  agency: '',
  gender: '',
  race: '',
  hairColor: '',
  eyeColor: '',
  photoAvailable: '',
  alertType: '',
  sortBy: 'mostRecent',
};

type CriteriaKey = keyof typeof DEFAULT_CRITERIA;

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
    ageMissing: 'Age Missing',
    ageNow: 'Age Now',
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
    sortBy: {
      mostRecent: 'Most Recent',
      az: 'A - Z',
    },
  };

  protected readonly states = [
    'Alabama',
    'Alaska',
    'Arizona',
    'California',
    'Colorado',
    'Florida',
    'Georgia',
    'Illinois',
    'Massachusetts',
    'New York',
    'Oregon',
    'Texas',
    'Washington',
  ];

  protected readonly races = ['American Indian', 'Asian', 'Black', 'Hispanic', 'White', 'Other'];
  protected readonly genders = ['Female', 'Male', 'Nonbinary', 'Unknown'];
  protected readonly hairColors = ['Black', 'Blonde', 'Brown', 'Gray', 'Red', 'Other'];
  protected readonly eyeColors = ['Black', 'Blue', 'Brown', 'Green', 'Hazel', 'Other'];
  protected readonly ageOptions = [
    '0 - 2',
    '3 - 5',
    '6 - 9',
    '10 - 12',
    '13 - 15',
    '16 - 18',
    '19+',
    'Unknown',
  ];
  protected readonly photoAvailabilityOptions = ['Available', 'Not Available', 'Unknown'];
  protected readonly alertTypes = [
    'Amber Alert',
    'Endangered Missing',
    'Missing',
    'Runaway',
    'Unknown',
  ];

  protected readonly advancedSearchForm = this.formBuilder.nonNullable.group({
    reportedStartDate: ['2026-01-30'],
    reportedEndDate: ['2026-07-26'],
    firstName: [''],
    middleName: [''],
    lastName: [''],
    city: [''],
    state: [''],
    country: ['United States'],
    ageMissing: [''],
    ageNow: [''],
    agency: [''],
    gender: [''],
    race: [''],
    hairColor: [''],
    eyeColor: [''],
    photoAvailable: [''],
    alertType: [''],
    sortBy: ['mostRecent'],
  });

  protected reset(): void {
    this.advancedSearchForm.reset(this.defaultCriteria);
  }

  protected submit(): void {
    this.advancedSearchForm.markAllAsTouched();

    if (this.reportedDateRangeIncomplete()) {
      return;
    }

    console.log('Advanced search payload', JSON.stringify(this.searchPayload(), null, 2));
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
          (criteria[key].trim().length > 0 && criteria[key] !== this.defaultCriteria[key]),
      )
      .map((key) => ({
        key,
        label: this.criteriaLabels[key],
        value: this.criteriaDisplayValues[key]?.[criteria[key]] ?? criteria[key],
        canRemove: key !== 'sortBy' || criteria[key] !== this.defaultCriteria[key],
      }));
  }

  protected reportedDateRangeIncomplete(): boolean {
    const criteria = this.advancedSearchForm.getRawValue();

    return (
      criteria.reportedStartDate !== this.defaultCriteria.reportedStartDate &&
      criteria.reportedEndDate === this.defaultCriteria.reportedEndDate
    );
  }

  private searchPayload() {
    return {
      criteria: this.advancedSearchForm.getRawValue(),
      selectedCriteria: this.activeCriteria(),
    };
  }
}
