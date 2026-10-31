import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PhotoComparisonResponse } from './photo-comparison.types';

@Injectable({ providedIn: 'root' })
export class PhotoComparisonService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}${environment.apiBaseUrl}/photo-review/compare`;

  comparePhotos(referencePhoto: File, comparisonPhoto: File): Observable<PhotoComparisonResponse> {
    const formData = new FormData();
    formData.append('reference_photo', referencePhoto);
    formData.append('uploaded_photo', comparisonPhoto);

    const headers = new HttpHeaders({
      Accept: 'application/json',
    });

    return this.http.post<PhotoComparisonResponse>(this.endpoint, formData, { headers });
  }
}
