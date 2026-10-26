import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TipSubmissionService } from './tip-submission.service';

const metadata = {
  missingPersonId: 'case-1',
  submissionType: 'ANONYMOUS' as const,
  tipCategory: 'Possible Sighting',
  description: 'Information',
  acknowledged: true,
};

describe('TipSubmissionService integration boundary', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('posts JSON metadata and repeated evidence files as multipart form data', () => {
    const service = TestBed.inject(TipSubmissionService);
    expect(service.available).toBe(true);
    const photo = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });
    let reference = '';
    service.submit(metadata, [photo, video]).subscribe((r) => (reference = r.referenceNumber!));
    const req = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/v1/tips',
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect(JSON.parse(req.request.body.get('metadata'))).toEqual({
      missing_person_id: 'case-1',
      submission_type: 'ANONYMOUS',
      tip_category: 'Possible Sighting',
      description: 'Information',
      acknowledged: true,
      willing_to_be_contacted: false,
    });
    expect(req.request.body.getAll('files')).toEqual([photo, video]);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({ reference_number: 'TIP-123' }, { status: 201, statusText: 'Created' });
    expect(reference).toBe('TIP-123');
  });

  it('flattens standard contact details and maps optional fields to snake_case', () => {
    TestBed.inject(TipSubmissionService)
      .submit({
        ...metadata,
        submissionType: 'STANDARD',
        caseNumber: 'CASE-2026-001',
        incidentDate: '2026-10-25',
        incidentTime: '14:30',
        location: 'Station',
        additionalInformation: 'Blue jacket',
        confidenceLevel: 'HIGH',
        contact: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '5551234567',
          preferredContactMethod: 'EMAIL',
          willingToBeContacted: true,
        },
      })
      .subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne(
      'http://localhost:8000/api/v1/tips',
    );
    expect(JSON.parse(req.request.body.get('metadata'))).toEqual({
      missing_person_id: 'case-1',
      case_number: 'CASE-2026-001',
      submission_type: 'STANDARD',
      tip_category: 'Possible Sighting',
      description: 'Information',
      acknowledged: true,
      incident_date: '2026-10-25',
      incident_time: '14:30:00',
      location: 'Station',
      additional_information: 'Blue jacket',
      confidence_level: 'HIGH',
      contact_full_name: 'Jane Doe',
      contact_email: 'jane@example.com',
      contact_phone: '5551234567',
      preferred_contact_method: 'EMAIL',
      willing_to_be_contacted: true,
    });
    req.flush({ reference_number: 'TIP-123' });
  });

  it('rejects malformed success responses', () => {
    let error: unknown;
    TestBed.inject(TipSubmissionService)
      .submit(metadata)
      .subscribe({ error: (e) => (error = e) });
    TestBed.inject(HttpTestingController).expectOne('http://localhost:8000/api/v1/tips').flush({});
    expect(error).toBeInstanceOf(Error);
  });

  it('propagates backend failures', () => {
    let error: unknown;
    TestBed.inject(TipSubmissionService)
      .submit(metadata)
      .subscribe({ error: (e) => (error = e) });
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8000/api/v1/tips')
      .flush({}, { status: 500, statusText: 'Error' });
    expect(error).toBeTruthy();
  });
});
