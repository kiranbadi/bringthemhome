import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SearchableSelectComponent } from './searchable-select.component';
import { stateName } from '../core/models/us-state-display';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of, startWith, switchMap, catchError, tap } from 'rxjs';
import { ResourceService } from './resource.service';
import { LocationOption } from './resource.models';

@Component({
  selector: 'app-resource-locations',
  imports: [ReactiveFormsModule, MatFormFieldModule, SearchableSelectComponent],
  templateUrl: './resource-locations.component.html',
  styleUrl: './resource-locations.component.scss',
})
export class ResourceLocationsComponent implements OnInit {
  @Input({ required: true }) form!: FormGroup;
  @Input() scope = '';
  private readonly api = inject(ResourceService);
  private readonly destroy = inject(DestroyRef);
  readonly states = signal<LocationOption[]>([]);
  readonly counties = signal<LocationOption[]>([]);
  readonly cities = signal<LocationOption[]>([]);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly countyLoading = signal(false);
  readonly cityLoading = signal(false);
  ngOnInit() {
    this.loadStates();
    const state = this.form.get('state')!;
    const county = this.form.get('county')!;
    state.valueChanges
      .pipe(
        startWith(state.value),
        tap(() => {
          county.disable({ emitEvent: false });
          this.counties.set([]);
          this.countyLoading.set(true);
        }),
        switchMap((s) =>
          s
            ? this.api.counties(s).pipe(
                catchError(() => {
                  this.error.set('Counties could not be loaded.');
                  return of([]);
                }),
              )
            : of([]),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((rows) => {
        this.counties.set(rows);
        this.countyLoading.set(false);
        if (state.value) county.enable({ emitEvent: false });
      });
    combineLatest([
      state.valueChanges.pipe(startWith(state.value)),
      county.valueChanges.pipe(startWith(county.value)),
    ])
      .pipe(
        tap(() => {
          this.form.get('city')!.disable({ emitEvent: false });
          this.cities.set([]);
          this.cityLoading.set(true);
        }),
        switchMap(([s, c]) =>
          s && c
            ? this.api.cities(s, c).pipe(
                catchError(() => {
                  this.error.set('Cities could not be loaded.');
                  return of([]);
                }),
              )
            : of([]),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((rows) => {
        this.cities.set(rows);
        this.cityLoading.set(false);
        if (state.value && county.value) this.form.get('city')!.enable({ emitEvent: false });
      });
  }
  private loadStates() {
    this.loading.set(true);
    this.api
      .states()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (rows) => {
          this.states.set(rows.map((row) => ({ ...row, name: stateName(row.name) })));
          this.loading.set(false);
          if (!rows.length) this.error.set('Location reference data is not available yet.');
        },
        error: () => {
          this.error.set('States could not be loaded.');
          this.loading.set(false);
        },
      });
  }
  retry() {
    this.error.set('');
    this.loadStates();
    this.form.get('state')!.updateValueAndValidity();
    this.form.get('county')!.updateValueAndValidity();
  }
  stateChanged() {
    this.form.patchValue({ county: '', city: '' });
  }
  countyChanged() {
    this.form.patchValue({ city: '' });
  }
}
