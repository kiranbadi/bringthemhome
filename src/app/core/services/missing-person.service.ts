import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, REQUEST_CONTEXT, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { MissingPersonDetail } from '../models/missing-person-detail.model';
import { environment } from '../../../environments/environment';
import {
  MissingPersonSearchFilters,
  SEARCH_FILTER_KEYS,
  PaginatedMissingPersonsResponse,
} from '../models/missing-person.model';

@Injectable({ providedIn: 'root' })
export class MissingPersonService {
  private readonly context = inject(REQUEST_CONTEXT, { optional: true }) as {
    caseRecord?: MissingPersonDetail;
    caseStatus?: number;
  } | null;
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/v1/missing-persons`;

  findMissingPerson(id: string): Observable<MissingPersonDetail | null> {
    if (this.context?.caseRecord?._id === id) return of(this.context.caseRecord);
    if (this.context?.caseStatus === 404) return of(null);
    if (this.context?.caseStatus)
      return throwError(() => new HttpErrorResponse({ status: this.context!.caseStatus }));
    return this.http
      .get<MissingPersonDetail>(`${this.endpoint}/${encodeURIComponent(id)}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 404 ? of(null) : throwError(() => error),
        ),
      );
  }

  searchMissingPersons(
    filters: MissingPersonSearchFilters,
    page = 1,
    pageSize = 20,
  ): Observable<PaginatedMissingPersonsResponse> {
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    for (const key of SEARCH_FILTER_KEYS) {
      const value = filters[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value).trim());
      }
    }
    return this.http.get<PaginatedMissingPersonsResponse>(`${this.endpoint}/search`, {
      params,
      headers: { Accept: 'application/json' },
    });
  }

  getMissingPersons(page = 1, pageSize = 20): Observable<PaginatedMissingPersonsResponse> {
    const params = new HttpParams().set('page', page).set('page_size', pageSize);
    return this.http.get<PaginatedMissingPersonsResponse>(this.endpoint, { params }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Unable to load missing persons', {
          status: error.status,
          message: error.message,
        });
        return throwError(() => error);
      }),
    );
  }
}
