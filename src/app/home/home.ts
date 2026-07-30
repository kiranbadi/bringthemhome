import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';

import { MissingPerson, MissingPersonSearchCriteria } from '../models/missing-person';
import { MissingPersonsService } from '../services/missing-persons';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';

@Component({
  selector: 'app-home',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    NavigationHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly formBuilder = inject(FormBuilder);
  private readonly missingPersonsService = inject(MissingPersonsService);

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

  protected readonly searchForm = this.formBuilder.nonNullable.group({
    fullName: [''],
    zipcode: [''],
    city: [''],
    state: [''],
  });

  protected pageIndex = 0;
  protected pageSize = 8;
  protected readonly pageSizeOptions = [4, 8, 12];
  protected pagedMissingPersons: readonly MissingPerson[] = [];
  protected totalMissingPersons = 0;
  protected readonly carouselIndexes: Record<number, number> = {};
  protected searchSummary = 'Search by full name, zipcode, city, or state.';

  constructor() {
    this.loadMissingPersons();
  }

  protected search(): void {
    this.pageIndex = 0;
    this.loadMissingPersons();
  }

  protected clearSearch(): void {
    this.searchForm.reset();
    this.pageIndex = 0;
    this.loadMissingPersons();
    this.searchSummary = 'Search by full name, zipcode, city, or state.';
  }

  protected pageChanged(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadMissingPersons();
  }

  protected currentPhoto(person: MissingPerson): string {
    return person.photos[this.carouselIndexes[person.id] ?? 0];
  }

  protected previousPhoto(person: MissingPerson): void {
    const currentIndex = this.carouselIndexes[person.id] ?? 0;
    this.carouselIndexes[person.id] =
      currentIndex === 0 ? person.photos.length - 1 : currentIndex - 1;
  }

  protected nextPhoto(person: MissingPerson): void {
    const currentIndex = this.carouselIndexes[person.id] ?? 0;
    this.carouselIndexes[person.id] =
      currentIndex === person.photos.length - 1 ? 0 : currentIndex + 1;
  }

  protected sharePerson(person: MissingPerson): void {
    this.searchSummary = `Share ready for ${person.fullName}.`;
  }

  private loadMissingPersons(): void {
    const criteria = this.normalizedCriteria();
    const page = this.missingPersonsService.search(criteria, this.pageIndex, this.pageSize);
    const activeCriteria = Object.values(criteria).filter((value) => value.length > 0);

    this.pagedMissingPersons = page.items;
    this.totalMissingPersons = page.total;
    this.searchSummary =
      activeCriteria.length === 0
        ? `Showing ${page.total} missing persons.`
        : `${page.total} result${page.total === 1 ? '' : 's'} found.`;
  }

  private normalizedCriteria(): MissingPersonSearchCriteria {
    const criteria = this.searchForm.getRawValue();

    return {
      fullName: criteria.fullName.trim(),
      zipcode: criteria.zipcode.trim(),
      city: criteria.city.trim(),
      state: criteria.state.trim(),
    };
  }
}
