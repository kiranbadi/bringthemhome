import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { defer, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RelatedSite {
  id: string;
  name: string;
  url: string;
}
export type RelatedSiteInput = Omit<RelatedSite, 'id'>;

export const RELATED_SITES_API = new InjectionToken('RELATED_SITES_API', {
  providedIn: 'root',
  factory: () => ({
    url: `${environment.apiUrl}${environment.apiBaseUrl}/api/admin/related-sites`,
    usePlaceholder: false,
  }),
});

@Injectable({ providedIn: 'root' })
export class RelatedSitesService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RELATED_SITES_API);
  readonly usesPlaceholder = this.config.usePlaceholder;
  private sites: RelatedSite[] = [];
  private nextId = 1;
  private readonly options = { withCredentials: true };

  list() {
    if (!this.usesPlaceholder) return this.http.get<RelatedSite[]>(this.config.url, this.options);
    return defer(() => of(this.sites.map((site) => ({ ...site }))));
  }

  create(input: RelatedSiteInput) {
    if (!this.usesPlaceholder)
      return this.http.post<RelatedSite>(this.config.url, input, this.options);
    return defer(() => {
      const site = { ...input, id: `site-${this.nextId++}` };
      this.sites = [...this.sites, site];
      return of({ ...site });
    });
  }

  update(id: string, input: RelatedSiteInput) {
    if (!this.usesPlaceholder)
      return this.http.put<RelatedSite>(
        `${this.config.url}/${encodeURIComponent(id)}`,
        input,
        this.options,
      );
    return defer(() => {
      this.requireSite(id);
      const site = { ...input, id };
      this.sites = this.sites.map((current) => (current.id === id ? site : current));
      return of({ ...site });
    });
  }

  delete(id: string) {
    if (!this.usesPlaceholder)
      return this.http.delete<void>(`${this.config.url}/${encodeURIComponent(id)}`, this.options);
    return defer(() => {
      this.requireSite(id);
      this.sites = this.sites.filter((site) => site.id !== id);
      return of(undefined);
    });
  }

  private requireSite(id: string) {
    if (!this.sites.some((site) => site.id === id))
      throw new HttpErrorResponse({
        status: 404,
        statusText: 'Site not found',
      });
  }
}
