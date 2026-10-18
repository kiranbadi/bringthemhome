import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  defaultIfEmpty,
  filter,
  map,
  of,
  range,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { MissingPerson, PaginatedMissingPersonsResponse } from '../models/missing-person.model';

@Injectable({ providedIn: 'root' })
export class MissingPersonService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/api/v1/missing-persons`;

  findMissingPerson(id: string, sourcePage = 1): Observable<MissingPerson | null> {
    return this.getMissingPersons(sourcePage).pipe(
      switchMap((response) => {
        const match = response.records.find((record) => record._id === id);
        if (match) return of(match);
        // A shared link must survive records moving between pages. Fetch sequentially
        // and stop at the first match until the API offers a lookup-by-ID endpoint.
        return range(1, response.total_pages).pipe(
          filter((page) => page !== response.current_page),
          concatMap((page) => this.getMissingPersons(page)),
          map((page) => page.records.find((record) => record._id === id)),
          filter((record): record is MissingPerson => record !== undefined),
          take(1),
          defaultIfEmpty(null),
        );
      }),
    );
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
