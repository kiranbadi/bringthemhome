import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { ResourceFieldsComponent } from './resource-fields.component';
import { resourceForm, resourcePayload } from './resource-form';
import { ResourceService } from './resource.service';
import { Resource, CorrectionInput, resourceError } from './resource.models';

@Component({
  selector: 'app-resource-form',
  imports: [
    NavigationHeader,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    ResourceFieldsComponent,
  ],
  templateUrl: './resource-form.component.html',
  styleUrls: ['./resources.scss', './resource-form.component.scss'],
})
export class ResourceFormComponent {
  private readonly api = inject(ResourceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly destroy = inject(DestroyRef);
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly isCorrection = !!this.id;
  readonly form = resourceForm();
  readonly publicContactConfirmed = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue,
  });
  readonly explanation = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(2000)],
  });
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  private original: Resource | null = null;
  constructor() {
    if (this.id) this.load();
  }
  load() {
    if (!this.id) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    this.api
      .detail(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.original = r;
          const fields = this.form.controls;
          for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
            const value = r[key] ?? '';
            fields[key].setValue(value as never);
          }
          this.loading.set(false);
        },
        error: (e) => {
          this.loading.set(false);
          this.loadFailed.set(true);
          this.error.set(resourceError(e));
        },
      });
  }
  submit() {
    if (this.busy() || this.success()) return;
    this.form.markAllAsTouched();
    this.explanation.markAsTouched();
    if (!this.isCorrection) {
      this.publicContactConfirmed.markAsTouched();
      if (this.publicContactConfirmed.invalid) return;
    }
    if (this.form.invalid || (this.isCorrection && this.explanation.invalid)) {
      this.error.set(
        'Please complete the required fields and correct the highlighted information.',
      );
      return;
    }
    this.error.set('');
    this.busy.set(true);
    const body = resourcePayload(this.form);
    if (this.isCorrection && this.original) {
      const changes: CorrectionInput['proposed_changes'] = {};
      for (const key of Object.keys(body) as (keyof typeof body)[])
        if (key !== 'source_url' && body[key] !== this.original[key])
          Object.assign(changes, { [key]: body[key] });
      if (!Object.keys(changes).length) {
        this.error.set('Change at least one field before submitting a correction.');
        this.busy.set(false);
        return;
      }
      this.api
        .correct(this.id!, {
          explanation: this.explanation.value.trim(),
          source_url: body.source_url,
          proposed_changes: changes,
        })
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: () => {
            this.snack.open(
              'Your correction is pending review. The published resource has not changed.',
              'Close',
              { duration: 8000 },
            );
            void this.router.navigate(['/resources', this.id]);
          },
          error: (e) => this.failed(e),
        });
    } else {
      this.api
        .create(body, this.publicContactConfirmed.value)
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe({
          next: () => {
            this.busy.set(false);
            this.success.set('Resource submitted successfully. It is not yet verified.');
          },
          error: (e) => this.failed(e),
        });
    }
  }
  private failed(e: unknown) {
    this.error.set(resourceError(e));
    this.busy.set(false);
  }
}
