import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TipSubmissionService } from './tip-submission.service';

describe('TipSubmissionService integration boundary', () => {
  it('rejects submission without sending sensitive data to any endpoint', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(TipSubmissionService);
    expect(service.available).toBe(false);
    expect(service.configuration.endpoint).toBeNull();
    let rejected = false;
    service
      .submit({
        missingPersonId: 'case-1',
        submissionType: 'ANONYMOUS',
        tipCategory: 'Other Relevant Information',
        description: 'Information',
      })
      .subscribe({ error: () => (rejected = true) });
    expect(rejected).toBe(true);
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
