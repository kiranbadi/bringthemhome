import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CaseClaimsService } from './case-claims.service';
import { csrfInterceptor } from '../../core/auth/csrf.interceptor';
import { AccountManagementService } from '../../services/account-management';

describe('Case claims API', () => {
  let http: HttpTestingController;
  let api: CaseClaimsService;
  const base = 'http://localhost:8000/bringthemhome/api';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: AccountManagementService, useValue: { csrfToken: 'private-csrf' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CaseClaimsService);
  });
  afterEach(() => http.verify());
  it('resolves full names from real case details while keeping queue order', () => {
    let names: (string | null | undefined)[] = [];
    api
      .adminClaims('PENDING')
      .subscribe((page) => (names = page.items.map((claim) => claim.missing_person_name)));
    http.expectOne(`${base}/admin/case-claims?status=PENDING&page=1&page_size=20`).flush({
      items: [
        { id: 'claim-a', missing_person_id: 'case/a' },
        { id: 'claim-b', missing_person_id: 'case-b' },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    });
    http
      .expectOne('http://localhost:8000/api/v1/missing-persons/case-b')
      .flush({ _id: 'case-b', full_name: 'John Smith' });
    http
      .expectOne('http://localhost:8000/api/v1/missing-persons/case%2Fa')
      .flush({ _id: 'case/a', summary: { fullName: 'Jane Doe' } });
    expect(names).toEqual(['Jane Doe', 'John Smith']);
  });
  it('keeps claims reviewable when a case name cannot be loaded', () => {
    let count = 0;
    api.adminClaims('PENDING').subscribe((page) => (count = page.items.length));
    http
      .expectOne(`${base}/admin/case-claims?status=PENDING&page=1&page_size=20`)
      .flush({
        items: [{ id: 'claim-a', missing_person_id: 'case-a' }],
        total: 1,
        page: 1,
        page_size: 20,
      });
    http
      .expectOne('http://localhost:8000/api/v1/missing-persons/case-a')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(count).toBe(1);
  });
  it('searches later own-claim pages before concluding no claim exists', () => {
    let status = '';
    api.findMyClaim('case/id').subscribe((claim) => (status = claim?.status ?? 'none'));
    http
      .expectOne(`${base}/users/me/case-claims?page=1&page_size=100`)
      .flush({ items: [{ missing_person_id: 'another' }], total: 101, page: 1, page_size: 100 });
    http.expectOne(`${base}/users/me/case-claims?page=2&page_size=100`).flush({
      items: [{ missing_person_id: 'case/id', status: 'APPROVED' }],
      total: 101,
      page: 2,
      page_size: 100,
    });
    expect(status).toBe('APPROVED');
  });
  it('uses encoded document IDs and sends only writable claim fields', () => {
    api
      .claim('case/id', {
        relationship: 'FAMILY',
        explanation: 'Private relationship explanation.',
      })
      .subscribe();
    const request = http.expectOne(`${base}/cases/case%2Fid/claims`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Token')).toBe('private-csrf');
    expect(Object.keys(request.request.body)).toEqual(['relationship', 'explanation']);
    request.flush({ id: 'claim-1', status: 'PENDING' });
  });
  it('sends bytes and only signed headers to storage, bypassing application interceptors', () => {
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    api
      .putPhoto(
        {
          upload_id: 'upload-1',
          upload_url: 'https://storage.example/photo?signature=123',
          headers: { 'Content-Type': 'image/jpeg' },
        },
        file,
      )
      .subscribe();
    const request = http.expectOne('https://storage.example/photo?signature=123');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBe(file);
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.credentials).toBe('omit');
    expect(request.request.headers.keys()).toEqual(['Content-Type']);
    request.flush('');
  });
  it('does not treat status failures as no claim', () => {
    let failed = false;
    api.findMyClaim('case-1').subscribe({ error: () => (failed = true) });
    http
      .expectOne(`${base}/users/me/case-claims?page=1&page_size=100`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failed).toBe(true);
  });
});
