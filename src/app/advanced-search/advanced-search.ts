import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

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
  protected readonly alertTypes = ['Amber Alert', 'Endangered Missing', 'Missing', 'Runaway', 'Unknown'];

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
    this.advancedSearchForm.reset({
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
    });
  }

  protected submit(): void {
    this.advancedSearchForm.markAllAsTouched();
  }
}
