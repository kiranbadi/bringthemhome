import { Injectable } from '@angular/core';
import { Observable, map, timer } from 'rxjs';

export interface PhotoQualityResponse {
  readonly mode: 'demo';
  readonly reference: { readonly name: string; readonly sizeBytes: number };
  readonly comparison: { readonly name: string; readonly sizeBytes: number };
  readonly message: string;
}

@Injectable({ providedIn: 'root' })
export class PhotoQuality {
  checkPhotos(referencePhoto: File, comparisonPhoto: File): Observable<PhotoQualityResponse> {
    // Local demo contract only; replace after the quality-check API is defined.
    // Snapshot metadata so the delayed response does not retain the image files.
    const response: PhotoQualityResponse = {
      mode: 'demo',
      reference: { name: referencePhoto.name, sizeBytes: referencePhoto.size },
      comparison: { name: comparisonPhoto.name, sizeBytes: comparisonPhoto.size },
      message: 'Demo response only. Image quality has not been analyzed.',
    };
    return timer(800).pipe(map(() => response));
  }
}
