import { Component, effect, forwardRef, input, output, signal } from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocationOption } from './resource.models';

@Component({
  selector: 'app-searchable-select',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
})
export class SearchableSelectComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input<readonly LocationOption[]>([]);
  readonly emptyLabel = input('All options');
  readonly required = input(false);
  readonly selectionChange = output<void>();
  readonly text = new FormControl<string | null>('');
  readonly query = signal('');
  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};
  constructor() {
    effect(() => {
      this.options();
      this.text.setValue(this.text.value, { emitEvent: false });
    });
    this.text.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      // Material resets unselected free text to null when the panel closes.
      if (value === null) this.select('');
    });
  }
  readonly display = (value: string): string =>
    this.options().find((o) => o.id === value)?.name ?? '';
  filtered() {
    const query = this.query().trim().toLowerCase();
    return this.options().filter(
      (o) => o.name.toLowerCase().includes(query) || o.id.toLowerCase().includes(query),
    );
  }
  select(value: string) {
    this.text.setValue(value, { emitEvent: false });
    this.query.set('');
    this.onChange(value);
    this.selectionChange.emit();
  }
  writeValue(value: string | null) {
    this.text.setValue(value ?? '', { emitEvent: false });
    this.query.set('');
  }
  registerOnChange(fn: (value: string) => void) {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean) {
    disabled ? this.text.disable({ emitEvent: false }) : this.text.enable({ emitEvent: false });
  }
}
