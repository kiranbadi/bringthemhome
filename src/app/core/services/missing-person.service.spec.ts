import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { MissingPersonService } from './missing-person.service';
import { environment } from '../../../environments/environment';

describe('MissingPersonService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('defaults to page one with twenty records and supports dynamic page sizes', () => {
    const service = TestBed.inject(MissingPersonService);
    const http = TestBed.inject(HttpTestingController);
    service.getMissingPersons().subscribe();
    const initial = http.expectOne(
      `${environment.apiUrl}/api/v1/missing-persons?page=1&page_size=20`,
    );
    expect(initial.request.method).toBe('GET');
    initial.flush({ records: [] });
    service.getMissingPersons(3, 10).subscribe();
    http
      .expectOne(`${environment.apiUrl}/api/v1/missing-persons?page=3&page_size=10`)
      .flush({ records: [] });
  });

  it('logs request failures and propagates the HTTP error for retry UI', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let status = 0;
    TestBed.inject(MissingPersonService)
      .getMissingPersons()
      .subscribe({ error: (error) => (status = error.status) });
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/api/v1/missing-persons'))
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(status).toBe(503);
    expect(log).toHaveBeenCalledWith(
      'Unable to load missing persons',
      expect.objectContaining({ status: 503 }),
    );
    log.mockRestore();
  });
});
