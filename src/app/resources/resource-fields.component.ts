import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ResourceLocationsComponent } from './resource-locations.component';
import { ResourceForm } from './resource-form';
import { CATEGORIES, SCOPES } from './resource.models';

@Component({
  selector: 'app-resource-fields',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ResourceLocationsComponent,
  ],
  templateUrl: './resource-fields.component.html',
  styleUrl: './resource-fields.component.scss',
})
export class ResourceFieldsComponent {
  @Input({ required: true }) form!: ResourceForm;
  readonly categories = Object.entries(CATEGORIES);
  readonly scopes = Object.entries(SCOPES);
  scopeChanged() {
    const s = this.form.controls.scope.value;
    this.form.patchValue({
      state: s === 'NATIONAL' ? '' : this.form.controls.state.value,
      county: ['NATIONAL', 'STATE'].includes(s) ? '' : this.form.controls.county.value,
      city: s === 'CITY' ? this.form.controls.city.value : '',
    });
  }
}
