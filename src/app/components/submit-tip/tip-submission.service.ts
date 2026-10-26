import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { SubmitTipRequest, SubmitTipResponse } from './tip-submission.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TipSubmissionService {
  private readonly http = inject(HttpClient);
  readonly configuration = environment.tipSubmission;
  readonly available = !!this.configuration.endpoint;

  submit(request: SubmitTipRequest, files: readonly File[] = []): Observable<SubmitTipResponse> {
    if (!this.available)
      return throwError(() => new Error('Online tip submission is unavailable.'));
    const body = new FormData();
    // Let the browser supply Content-Type with the multipart boundary.
    const contact = request.submissionType === 'STANDARD' ? request.contact : undefined;
    body.append(
      'metadata',
      JSON.stringify({
        missing_person_id: request.missingPersonId,
        case_number: request.caseNumber,
        submission_type: request.submissionType,
        tip_category: request.tipCategory,
        description: request.description,
        acknowledged: request.acknowledged,
        incident_date: request.incidentDate,
        incident_time:
          request.incidentTime?.length === 5 ? `${request.incidentTime}:00` : request.incidentTime,
        location: request.location,
        additional_information: request.additionalInformation,
        confidence_level: request.confidenceLevel,
        contact_full_name: contact?.fullName,
        contact_email: contact?.email,
        contact_phone: contact?.phone,
        preferred_contact_method: contact?.preferredContactMethod,
        willing_to_be_contacted: contact?.willingToBeContacted ?? false,
      }),
    );
    for (const file of files) body.append('files', file, file.name);
    return this.http
      .post<unknown>(`${environment.apiUrl}${this.configuration.endpoint}`, body)
      .pipe(
        map((response) => {
          if (
            !response ||
            typeof response !== 'object' ||
            !('reference_number' in response) ||
            typeof response.reference_number !== 'string' ||
            !response.reference_number.trim()
          ) {
            throw new Error('The server did not confirm a tip reference.');
          }
          return { referenceNumber: response.reference_number };
        }),
      );
  }
}
