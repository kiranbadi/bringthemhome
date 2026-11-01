import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NaturalSearchService } from './natural-search.service';
import { csrfInterceptor } from '../../core/auth/csrf.interceptor';
import { AccountManagementService } from '../../services/account-management';

describe('Natural search API', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: AccountManagementService, useValue: { csrfToken: 'test-csrf' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('posts typed filters and credentials through the existing CSRF interceptor', () => {
    const payload = {
      query: 'NamUs #MP48192',
      mode: 'exact' as const,
      filters: { state: 'NC' },
      page: 1,
      page_size: 20,
    };
    TestBed.inject(NaturalSearchService).search(payload).subscribe();
    const req = http.expectOne('http://localhost:8000/bringthemhome/api/v1/search/natural');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('test-csrf');
    expect(req.request.body).toEqual(payload);
    req.flush({
      records: [],
      total_records: 0,
      total_pages: 0,
      current_page: 1,
      page_size: 20,
      next_page: null,
      previous_page: null,
    });
  });
});
