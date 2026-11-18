import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  TemplateRef,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { NgTemplateOutlet } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { finalize } from 'rxjs';
import { webUrl } from './resource-form';
import { RelatedSite, RelatedSitesService } from './related-sites.service';

@Component({
  selector: 'app-related-sites-admin',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    NgTemplateOutlet,
    MatPaginatorModule,
  ],
  templateUrl: './related-sites-admin.component.html',
  styleUrl: './related-sites-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedSitesAdminComponent implements OnInit {
  private readonly api = inject(RelatedSitesService);
  private readonly destroy = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private dialogRef?: MatDialogRef<unknown>;
  readonly mode = signal<'add' | 'list'>('list');
  readonly usesPlaceholder = this.api.usesPlaceholder;
  readonly sites = signal<RelatedSite[]>([]);
  private readonly pageIndex = signal(0);
  readonly pageSize = 10;
  readonly currentPage = computed(() =>
    Math.min(this.pageIndex(), Math.max(0, Math.ceil(this.sites().length / this.pageSize) - 1)),
  );
  readonly visibleSites = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.sites().slice(start, start + this.pageSize);
  });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly editing = signal<string | null>(null);
  readonly deleting = signal<string | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
    url: ['', [Validators.required, webUrl, Validators.maxLength(2048)]],
  });

  constructor() {
    this.destroy.onDestroy(() => this.dialogRef?.close());
  }

  open(mode: 'add' | 'list', template: TemplateRef<unknown>) {
    this.cancel();
    this.deleting.set(null);
    this.error.set('');
    this.message.set('');
    this.mode.set(mode);
    this.load();
    this.dialogRef = this.dialog.open(template, {
      width: mode === 'add' ? '560px' : '760px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: '85vh',
      autoFocus: 'first-tabbable',
    });
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.pageIndex.set(0);
    this.loading.set(true);
    this.error.set('');
    this.api
      .list()
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (sites) => this.sites.set(sites),
        error: () => this.error.set('Could not load related sites. Please try again.'),
      });
  }

  edit(site: RelatedSite) {
    this.editing.set(site.id);
    this.deleting.set(null);
    this.message.set('');
    this.error.set('');
    this.form.setValue({ name: site.name, url: site.url });
  }

  cancel() {
    this.editing.set(null);
    this.form.reset();
  }

  paginate(event: PageEvent) {
    this.cancel();
    this.deleting.set(null);
    this.pageIndex.set(event.pageIndex);
  }

  save() {
    if (this.saving() || this.loading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    const input = { name: values.name.trim(), url: values.url.trim() };
    const id = this.editing();
    this.saving.set(true);
    if (this.dialogRef) this.dialogRef.disableClose = true;
    this.error.set('');
    this.message.set('');
    const request = id ? this.api.update(id, input) : this.api.create(input);
    request
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.saving.set(false);
          if (this.dialogRef) this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: (site) => {
          this.sites.update((sites) =>
            id ? sites.map((row) => (row.id === id ? site : row)) : [...sites, site],
          );
          this.cancel();
          if (!id) this.pageIndex.set(Math.floor((this.sites().length - 1) / this.pageSize));
          this.mode.set('list');
          this.message.set(id ? 'Site updated.' : 'Site added.');
        },
        error: () =>
          this.error.set('Could not save this site. Your entries are available to retry.'),
      });
  }

  remove(site: RelatedSite) {
    if (this.saving()) return;
    this.saving.set(true);
    if (this.dialogRef) this.dialogRef.disableClose = true;
    this.error.set('');
    this.message.set('');
    this.api
      .delete(site.id)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.saving.set(false);
          if (this.dialogRef) this.dialogRef.disableClose = false;
        }),
      )
      .subscribe({
        next: () => {
          this.sites.update((sites) => sites.filter((row) => row.id !== site.id));
          if (this.editing() === site.id) this.cancel();
          this.deleting.set(null);
          this.message.set('Site deleted.');
        },
        error: () => this.error.set('Could not delete this site. Please try again.'),
      });
  }
}
