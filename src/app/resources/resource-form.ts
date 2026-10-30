import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Category, ResourceInput, Scope, safeWebUrl } from './resource.models';
const nonblank = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && !c.value.trim() ? { required: true } : null;
export const webUrl = (c: AbstractControl): ValidationErrors | null =>
  !c.value || safeWebUrl(c.value.trim()) ? null : { url: true };
export function resourceForm() {
  return new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, nonblank, Validators.maxLength(200)],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, nonblank, Validators.maxLength(3000)],
      }),
      category: new FormControl<Category | ''>('', {
        nonNullable: true,
        validators: Validators.required,
      }),
      scope: new FormControl<Scope>('NATIONAL', {
        nonNullable: true,
        validators: Validators.required,
      }),
      state: new FormControl('', { nonNullable: true }),
      county: new FormControl('', { nonNullable: true }),
      city: new FormControl('', { nonNullable: true }),
      phone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(50), Validators.pattern(/^[+\d\s().xX#-]{3,}$/)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.email, Validators.maxLength(254)],
      }),
      website: new FormControl('', {
        nonNullable: true,
        validators: [webUrl, Validators.maxLength(2048)],
      }),
      address: new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) }),
      source_url: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, nonblank, webUrl, Validators.maxLength(2048)],
      }),
    },
    {
      validators: (group) => {
        const v = group.getRawValue();
        const errors: ValidationErrors = {};
        if (![v.phone, v.email, v.website].some((x) => x?.trim())) errors['contact'] = true;
        if (
          (v.scope !== 'NATIONAL' && !v.state) ||
          (['COUNTY', 'CITY'].includes(v.scope) && !v.county) ||
          (v.scope === 'CITY' && !v.city)
        )
          errors['coverage'] = true;
        return Object.keys(errors).length ? errors : null;
      },
    },
  );
}
export type ResourceForm = ReturnType<typeof resourceForm>;
export function resourcePayload(form: ResourceForm): ResourceInput {
  const v = form.getRawValue();
  return {
    ...v,
    name: v.name.trim(),
    description: v.description.trim(),
    category: v.category as Category,
    state: v.scope === 'NATIONAL' ? null : v.state,
    county: ['COUNTY', 'CITY'].includes(v.scope) ? v.county : null,
    city: v.scope === 'CITY' ? v.city : null,
    phone: v.phone.trim() || null,
    email: v.email.trim() || null,
    website: v.website.trim() || null,
    address: v.address.trim() || null,
    source_url: v.source_url.trim(),
  };
}
