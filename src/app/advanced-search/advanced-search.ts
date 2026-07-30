import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';

import { NavigationHeader } from '../shared/navigation-header/navigation-header';

@Component({
  selector: 'app-advanced-search',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
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
  protected readonly hairColors = ['Black', 'Blonde', 'Brown', 'Gray', 'Red', 'Other'];
  protected readonly eyeColors = ['Black', 'Blue', 'Brown', 'Green', 'Hazel', 'Other'];

  protected readonly advancedSearchForm = this.formBuilder.nonNullable.group({
    firstName: [''],
    lastName: [''],
    refine: ['child'],
    city: [''],
    state: [''],
    country: ['United States'],
    dateFrom: [''],
    dateTo: [''],
    ageNowFrom: ['0'],
    ageNowTo: ['99+'],
    ageMissingFrom: ['0'],
    ageMissingTo: ['99+'],
    gender: ['all'],
    race: [''],
    hairColor: [''],
    eyeColor: [''],
    sortBy: ['mostRecent'],
  });

  protected reset(): void {
    this.advancedSearchForm.reset({
      firstName: '',
      lastName: '',
      refine: 'child',
      city: '',
      state: '',
      country: 'United States',
      dateFrom: '',
      dateTo: '',
      ageNowFrom: '0',
      ageNowTo: '99+',
      ageMissingFrom: '0',
      ageMissingTo: '99+',
      gender: 'all',
      race: '',
      hairColor: '',
      eyeColor: '',
      sortBy: 'mostRecent',
    });
  }

  protected submit(): void {
    this.advancedSearchForm.markAllAsTouched();
  }
}
