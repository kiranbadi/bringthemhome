import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { US_STATES, stateName } from '../core/models/us-state-display';
import { environment } from '../../environments/environment';
import {
  ResourceResponse,
  mapResourceResponse,
  CorrectionResponse,
  mapCorrectionResponse,
  resourceChanges,
  ContributionsResponse,
  mapContributionsResponse,
} from './resource-response';
import {
  AssessmentInput,
  ResourceReportInput,
  ResourceStatusInput,
  ReviewDecision,
  Contributions,
  Correction,
  CorrectionInput,
  LocationOption,
  Page,
  Resource,
  ResourceInput,
  ResourceQuery,
} from './resource.models';

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api`;
  private readonly apiBaseUrl = `${environment.apiBaseUrl}/api`;
  private readonly resourceBaseUrl = `${this.apiBaseUrl}/resources`;
  private readonly options = { withCredentials: true };
  list(query: ResourceQuery) {
    return this.resolveLocations(query).pipe(
      switchMap((locations) => {
        const values: Record<string, string | number> = {};
        const { search, q, ...filters } = query;
        for (const [key, value] of Object.entries({
          q: q ?? search ?? '',
          ...filters,
          ...locations,
          page: query.page ?? 1,
          page_size: query.page_size ?? 20,
        })) {
          if (value != null && (key === 'q' || value !== '')) values[key] = value;
        }
        return this.http
          .get<Page<ResourceResponse | Resource>>(this.resourceBaseUrl, {
            ...this.options,
            params: new HttpParams({ fromObject: values }),
          })
          .pipe(map((page) => ({ ...page, items: page.items.map(mapResourceResponse) })));
      }),
    );
  }

  private resolveLocations(location: {
    state?: string | null;
    county?: string | null;
    city?: string | null;
  }) {
    // Accept backend postal codes and names, and translate legacy Census IDs when present.
    const state = location.state ?? '';
    const county = location.county ?? '';
    const city = location.city ?? '';
    const stateOptions = /^\d{2}$/.test(state) ? this.states() : of([]);
    return stateOptions.pipe(
      switchMap((states) => {
        const label = states.find((row) => row.id === state)?.name ?? state;
        const postal =
          Object.entries(US_STATES).find(
            ([, name]) => name.toLowerCase() === stateName(label).toLowerCase(),
          )?.[0] ?? label;
        return forkJoin({
          county: /^\d{5}$/.test(county)
            ? this.counties(state).pipe(
                map((rows) => rows.find((row) => row.id === county)?.name ?? county),
              )
            : of(county),
          city: /^\d{7}$/.test(city)
            ? this.cities(state, county).pipe(
                map((rows) => rows.find((row) => row.id === city)?.name ?? city),
              )
            : of(city),
        }).pipe(
          map((locations) => ({
            state: postal,
            county: locations.county,
            city: locations.city,
          })),
        );
      }),
    );
  }

  detail(id: string) {
    return this.http
      .get<ResourceResponse | Resource>(
        `${this.resourceBaseUrl}/${encodeURIComponent(id)}`,
        this.options,
      )
      .pipe(map(mapResourceResponse));
  }
  create(body: ResourceInput, publicContactConfirmed: boolean) {
    const { state, county, city, website, ...details } = body;
    return this.resolveLocations({
      state: body.scope === 'NATIONAL' ? null : state,
      county: ['COUNTY', 'CITY'].includes(body.scope) ? county : null,
      city: body.scope === 'CITY' ? city : null,
    }).pipe(
      switchMap((location) =>
        this.http
          .post<ResourceResponse | Resource>(
            this.resourceBaseUrl,
            {
              ...details,
              state_code: location.state || null,
              county_name: location.county || null,
              city_name: location.city || null,
              website_url: website,
              public_contact_confirmed: publicContactConfirmed,
            },
            this.options,
          )
          .pipe(map(mapResourceResponse)),
      ),
    );
  }
  duplicates(name: string) {
    return this.http.get<{ items: Resource[] }>(`${this.resourceBaseUrl}/duplicates`, {
      ...this.options,
      params: { name },
    });
  }
  assess(id: string, body: AssessmentInput) {
    return this.http
      .post<ResourceResponse | Resource>(
        `${this.resourceBaseUrl}/${encodeURIComponent(id)}/verifications`,
        { verification: body.assessment },
        this.options,
      )
      .pipe(map(mapResourceResponse));
  }
  withdraw(id: string) {
    return this.http
      .delete<ResourceResponse | Resource>(
        `${this.resourceBaseUrl}/${encodeURIComponent(id)}/verifications`,
        this.options,
      )
      .pipe(map(mapResourceResponse));
  }
  correct(id: string, body: CorrectionInput) {
    return this.http
      .post<CorrectionResponse | Correction>(
        `${this.resourceBaseUrl}/${encodeURIComponent(id)}/corrections`,
        {
          suggested_changes: resourceChanges(body.proposed_changes),
          reason: body.explanation,
          source_url: body.source_url,
          issue_type: 'ACCURACY',
        },
        this.options,
      )
      .pipe(map(mapCorrectionResponse));
  }
  report(id: string, body: ResourceReportInput) {
    return this.http
      .post<CorrectionResponse | Correction>(
        `${this.resourceBaseUrl}/${encodeURIComponent(id)}/reports`,
        body,
        this.options,
      )
      .pipe(map(mapCorrectionResponse));
  }
  adminCorrections(page = 1) {
    return this.http
      .get<Page<CorrectionResponse | Correction>>(`${this.apiBaseUrl}/admin/resource-corrections`, {
        ...this.options,
        params: { status: 'PENDING', page, page_size: 20 },
      })
      .pipe(map((page) => ({ ...page, items: page.items.map(mapCorrectionResponse) })));
  }
  reviewCorrection(id: string, decision: ReviewDecision) {
    return this.http
      .patch<CorrectionResponse | Correction>(
        `${this.apiBaseUrl}/admin/resource-corrections/${encodeURIComponent(id)}`,
        { decision },
        this.options,
      )
      .pipe(map(mapCorrectionResponse));
  }
  updateStatus(id: string, body: ResourceStatusInput) {
    return this.http
      .patch<ResourceResponse | Resource>(
        `${this.apiBaseUrl}/admin/resources/${encodeURIComponent(id)}/status`,
        body,
        this.options,
      )
      .pipe(map(mapResourceResponse));
  }
  own(page = 1) {
    return this.http
      .get<Page<ResourceResponse | Resource>>(`${this.apiBaseUrl}/users/me/resources`, {
        ...this.options,
        params: { page, page_size: 20 },
      })
      .pipe(map((page) => ({ ...page, items: page.items.map(mapResourceResponse) })));
  }
  contributions(page = 1) {
    return this.http
      .get<ContributionsResponse | Contributions>(
        `${this.apiBaseUrl}/users/me/resource-contributions`,
        { ...this.options, params: { page, page_size: 20 } },
      )
      .pipe(map(mapContributionsResponse));
  }
  states() {
    return this.http.get<LocationOption[]>(`${this.base}/locations/states`, this.options);
  }
  counties(state: string) {
    return this.http.get<LocationOption[]>(`${this.base}/locations/counties`, {
      ...this.options,
      params: { state },
    });
  }
  cities(state: string, county: string) {
    return this.http.get<LocationOption[]>(`${this.base}/locations/cities`, {
      ...this.options,
      params: { state, county },
    });
  }
  resolve(state: string, county: string, city: string) {
    return this.http.get<{ state: string; county: string | null; city: string | null }>(
      `${this.base}/locations/resolve`,
      { ...this.options, params: { state, county, city } },
    );
  }
}
