import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchPayload, SearchResponse } from './natural-search.models';

@Injectable({ providedIn: 'root' })
export class NaturalSearchService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}${environment.apiBaseUrl}/api/v1/search/natural`;
  search(payload: SearchPayload) {
    return this.http
      .post<SearchResponse>(this.endpoint, payload, { withCredentials: true })
      .pipe(timeout(20_000));
  }
}
