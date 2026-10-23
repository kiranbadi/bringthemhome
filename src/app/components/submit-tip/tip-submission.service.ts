import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { SubmitTipRequest, SubmitTipResponse } from './tip-submission.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TipSubmissionService {
  readonly configuration = environment.tipSubmission;
  // An endpoint setting alone cannot establish a supported API contract.
  readonly available = false;

  submit(_request: SubmitTipRequest): Observable<SubmitTipResponse> {
    return throwError(() => new Error('Online tip submission is not available yet.'));
  }
}
