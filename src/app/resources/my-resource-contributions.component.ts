import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { ResourceService } from './resource.service';
import { Contributions, Page, Resource, resourceError } from './resource.models';
import { ResourceCardComponent } from './resource-card.component';

@Component({
  selector: 'app-my-resource-contributions',
  imports: [NavigationHeader, RouterLink, DatePipe, MatButtonModule, ResourceCardComponent],
  templateUrl: './my-resource-contributions.component.html',
  styleUrl: './resources.scss',
})
export class MyResourceContributionsComponent {
  private readonly api = inject(ResourceService);
  private readonly destroy = inject(DestroyRef);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly own = signal<Page<Resource> | null>(null);
  readonly contributions = signal<Contributions | null>(null);
  constructor() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ own: this.api.own(this.page()), contributions: this.api.contributions(this.page()) })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.own.set(r.own);
          this.contributions.set(r.contributions);
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(resourceError(e));
          this.loading.set(false);
        },
      });
  }
  hasNext() {
    return (
      Math.max(
        this.own()?.total ?? 0,
        this.contributions()?.assessments.total ?? 0,
        this.contributions()?.corrections.total ?? 0,
      ) >
      this.page() * 20
    );
  }
  changePage(delta: number) {
    this.page.update((p) => p + delta);
    this.load();
  }
}
