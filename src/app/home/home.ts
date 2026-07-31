import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';

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
    NavigationHeader,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly formBuilder = inject(FormBuilder);
  private readonly missingPersonsService = inject(MissingPersonsService);

  protected readonly searchForm = this.formBuilder.nonNullable.group({
    query: [''],
  });

  protected pageIndex = 0;
  protected pageSize = 8;
  protected readonly pageSizeOptions = [4, 8, 12];
  protected pagedMissingPersons: readonly MissingPerson[] = [];
  protected totalMissingPersons = 0;
  protected readonly carouselIndexes: Record<number, number> = {};
  protected searchSummary = 'Search by name, zipcode, city, or state.';

  constructor() {
    this.loadMissingPersons();
  }

  protected search(): void {
    this.pageIndex = 0;
    this.loadMissingPersons();
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
      query: criteria.query.trim(),
      fullName: '',
      zipcode: '',
      city: '',
      state: '',
    };
  }
}
