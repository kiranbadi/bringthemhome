import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ResourceService } from './resource.service';
import { csrfInterceptor } from '../core/auth/csrf.interceptor';
import { resourceForm, resourcePayload } from './resource-form';

describe('Resource contracts and workflows', () => {
  let service: ResourceService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.setItem('csrf_token', 'csrf');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ResourceService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('searches resources with q, named locations and pagination', () => {
    service
      .list({
        search: 'keyword',
        category: 'FAMILY_SUPPORT',
        scope: 'CITY',
        state: '36',
        county: '36061',
        city: '3651000',
      })
      .subscribe();
    http
      .expectOne((req) => req.url.endsWith('/locations/states'))
      .flush([{ id: '36', name: 'New York' }]);
    http
      .expectOne((req) => req.url.endsWith('/locations/counties'))
      .flush([{ id: '36061', name: 'New York County' }]);
    http
      .expectOne((req) => req.url.endsWith('/locations/cities'))
      .flush([{ id: '3651000', name: 'New York city' }]);
    const r = http.expectOne(
      '/bringthemhome/api/resources?q=keyword&category=FAMILY_SUPPORT&scope=CITY&state=NY&county=New%20York%20County&city=New%20York%20city&page=1&page_size=20',
    );
    expect(r.request.method).toBe('GET');
    expect(r.request.params.has('search')).toBe(false);
    r.flush({ items: [], total: 0, page: 1, page_size: 20 });
  });
  it('preserves named locations and custom pagination without lookups', () => {
    service
      .list({
        search: '',
        state: 'NY',
        county: 'New York',
        city: 'New York',
        page: 2,
        page_size: 10,
      })
      .subscribe();
    const r = http.expectOne((req) => req.url.endsWith('/api/resources'));
    expect(r.request.params.get('state')).toBe('NY');
    expect(r.request.params.get('county')).toBe('New York');
    expect(r.request.params.get('city')).toBe('New York');
    expect(r.request.params.get('q')).toBe('');
    expect(r.request.params.has('category')).toBe(false);
    expect(r.request.params.has('scope')).toBe(false);
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.get('page_size')).toBe('10');
    r.flush({ items: [], total: 0, page: 2, page_size: 10 });
  });
  it('sends every search parameter and preserves backend location identifiers', () => {
    service
      .list({
        q: '',
        category: 'FAMILY_SUPPORT',
        scope: 'CITY',
        state: 'NC',
        county: 'Wake County',
        city: 'Cary',
        page: 1,
        page_size: 20,
      })
      .subscribe();
    const request = http.expectOne(
      '/bringthemhome/api/resources?q=&category=FAMILY_SUPPORT&scope=CITY&state=NC&county=Wake%20County&city=Cary&page=1&page_size=20',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    expect(request.request.withCredentials).toBe(true);
    request.flush({ items: [], total: 0, page: 1, page_size: 20 });
  });
  it('omits unselected filters that the backend rejects but includes q and pagination', () => {
    service.list({}).subscribe();
    const request = http.expectOne('/bringthemhome/api/resources?q=&page=1&page_size=20');
    request.flush({ items: [], total: 0, page: 1, page_size: 20 });
  });
  it('loads details from the prefixed endpoint and maps backend resource fields', () => {
    const received = vi.fn();
    service.detail('7aa14de5-5b6a-4383-a947-2a8e3a10929a').subscribe(received);
    const request = http.expectOne(
      '/bringthemhome/api/resources/7aa14de5-5b6a-4383-a947-2a8e3a10929a',
    );
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      id: '7aa14de5-5b6a-4383-a947-2a8e3a10929a',
      name: 'Family support',
      description: 'Public support',
      category: 'FAMILY_SUPPORT',
      scope: 'CITY',
      state_code: 'NC',
      county_name: 'Wake County',
      city_name: 'Cary',
      website_url: 'https://example.org',
      verification_status: 'COMMUNITY_CONFIRMED',
      accurate_count: 4,
      inaccurate_count: 1,
      current_user_verification: 'ACCURATE',
      last_confirmed_at: '2026-10-29T12:00:00Z',
      created_at: '2026-10-27T12:00:00Z',
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Family support',
        state: 'NC',
        state_name: 'North Carolina',
        county: 'Wake County',
        county_name: 'Wake County',
        city: 'Cary',
        city_name: 'Cary',
        website: 'https://example.org',
        status: 'COMMUNITY_CONFIRMED',
        confirmation_count: 4,
        dispute_count: 1,
        current_user_assessment: 'ACCURATE',
        last_verified_at: null,
      }),
    );
  });
  it('maps directory results using the same backend contract', () => {
    const received = vi.fn();
    service.list({}).subscribe(received);
    const request = http.expectOne('/bringthemhome/api/resources?q=&page=1&page_size=20');
    request.flush({
      items: [
        {
          id: 'r1',
          state_code: null,
          county_name: null,
          city_name: null,
          website_url: null,
          verification_status: 'UNVERIFIED',
          accurate_count: 0,
          inaccurate_count: 0,
          current_user_verification: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        items: [
          expect.objectContaining({
            id: 'r1',
            state: null,
            state_name: null,
            website: null,
            status: 'UNVERIFIED',
            confirmation_count: 0,
            dispute_count: 0,
            current_user_assessment: null,
          }),
        ],
      }),
    );
  });
  it('submits with existing session and CSRF; never sets verification status', () => {
    const form = resourceForm();
    form.patchValue({
      name: 'Public support',
      description: 'Help for families',
      category: 'FAMILY_SUPPORT',
      scope: 'NATIONAL',
      website: 'https://example.org',
      source_url: 'https://example.org/about',
    });
    service.create(resourcePayload(form), true).subscribe();
    const r = http.expectOne('/bringthemhome/api/resources');
    expect(r.request.withCredentials).toBe(true);
    expect(r.request.headers.get('X-CSRF-Token')).toBe('csrf');
    expect(r.request.body).toEqual({
      name: 'Public support',
      description: 'Help for families',
      category: 'FAMILY_SUPPORT',
      scope: 'NATIONAL',
      state_code: null,
      county_name: null,
      city_name: null,
      phone: null,
      email: null,
      website_url: 'https://example.org',
      address: null,
      source_url: 'https://example.org/about',
      public_contact_confirmed: true,
    });
    r.flush({});
  });
  it('maps Census selections to postal state code and location names for creation', () => {
    const f = resourceForm();
    f.patchValue({
      name: 'Public support',
      description: 'Help',
      category: 'FAMILY_SUPPORT',
      scope: 'CITY',
      state: '36',
      county: '36061',
      city: '3651000',
      website: 'https://example.org',
      source_url: 'https://example.org/about',
    });
    service.create(resourcePayload(f), true).subscribe();
    http
      .expectOne((r) => r.url.endsWith('/locations/states'))
      .flush([{ id: '36', name: 'New York' }]);
    http
      .expectOne((r) => r.url.endsWith('/locations/counties'))
      .flush([{ id: '36061', name: 'New York County' }]);
    http
      .expectOne((r) => r.url.endsWith('/locations/cities'))
      .flush([{ id: '3651000', name: 'New York city' }]);
    const request = http.expectOne('/bringthemhome/api/resources');
    expect(request.request.body.state_code).toBe('NY');
    expect(request.request.body.county_name).toBe('New York County');
    expect(request.request.body.city_name).toBe('New York city');
    expect(request.request.body.state).toBeUndefined();
    expect(request.request.body.website).toBeUndefined();
    request.flush({});
  });
  it('creates a city resource with canonical backend locations and maps the response', () => {
    const form = resourceForm();
    form.patchValue({
      name: 'Public support',
      description: 'Help for families',
      category: 'FAMILY_SUPPORT',
      scope: 'CITY',
      state: 'NC',
      county: 'Wake County',
      city: 'Cary',
      phone: '555-0100',
      email: 'support@example.org',
      website: 'https://example.org',
      address: 'Public office',
      source_url: 'https://example.org/about',
    });
    const received = vi.fn();
    service.create(resourcePayload(form), true).subscribe(received);
    const request = http.expectOne('/bringthemhome/api/resources');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Token')).toBe('csrf');
    expect(request.request.body).toEqual({
      name: 'Public support',
      description: 'Help for families',
      category: 'FAMILY_SUPPORT',
      scope: 'CITY',
      state_code: 'NC',
      county_name: 'Wake County',
      city_name: 'Cary',
      phone: '555-0100',
      email: 'support@example.org',
      website_url: 'https://example.org',
      address: 'Public office',
      source_url: 'https://example.org/about',
      public_contact_confirmed: true,
    });
    request.flush({
      ...request.request.body,
      id: 'created',
      verification_status: 'UNVERIFIED',
      accurate_count: 0,
      inaccurate_count: 0,
      current_user_verification: null,
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'created',
        state: 'NC',
        state_name: 'North Carolina',
        county: 'Wake County',
        city: 'Cary',
        website: 'https://example.org',
        status: 'UNVERIFIED',
        confirmation_count: 0,
      }),
    );
  });
  it('sends reports separately and maps the suggestion response', () => {
    const received = vi.fn();
    service
      .report('r1', { reason: 'Outdated phone', issue_type: 'ACCURACY', source_url: null })
      .subscribe(received);
    const request = http.expectOne('/bringthemhome/api/resources/r1/reports');
    expect(request.request.body).toEqual({
      reason: 'Outdated phone',
      issue_type: 'ACCURACY',
      source_url: null,
    });
    expect(request.request.headers.get('X-CSRF-Token')).toBe('csrf');
    request.flush({
      id: 's1',
      resource_id: 'r1',
      suggested_changes: {},
      reason: 'Outdated phone',
      source_url: null,
      issue_type: 'ACCURACY',
      status: 'PENDING',
      created_at: '2026-10-29T12:00:00Z',
      reviewed_at: null,
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: 'Outdated phone',
        proposed_changes: {},
        status: 'PENDING',
      }),
    );
  });
  it('calls the admin review and status APIs with their documented contracts', () => {
    service.adminCorrections(2).subscribe();
    http
      .expectOne('/bringthemhome/api/admin/resource-corrections?status=PENDING&page=2&page_size=20')
      .flush({ items: [], total: 0, page: 2, page_size: 20 });
    service.reviewCorrection('s1', 'ACCEPTED').subscribe();
    const review = http.expectOne('/bringthemhome/api/admin/resource-corrections/s1');
    expect(review.request.method).toBe('PATCH');
    expect(review.request.body).toEqual({ decision: 'ACCEPTED' });
    expect(review.request.headers.get('X-CSRF-Token')).toBe('csrf');
    review.flush({
      id: 's1',
      resource_id: 'r1',
      suggested_changes: {},
      reason: 'Update',
      status: 'ACCEPTED',
    });
    service
      .updateStatus('r1', {
        verification_status: 'OFFICIALLY_VERIFIED',
        reason: 'Official source',
        source_url: 'https://example.org',
      })
      .subscribe();
    const status = http.expectOne('/bringthemhome/api/admin/resources/r1/status');
    expect(status.request.method).toBe('PATCH');
    expect(status.request.body).toEqual({
      verification_status: 'OFFICIALLY_VERIFIED',
      reason: 'Official source',
      source_url: 'https://example.org',
    });
    status.flush({
      verification_status: 'OFFICIALLY_VERIFIED',
      accurate_count: 0,
      inaccurate_count: 0,
      state_code: null,
    });
  });
  it('maps correction fields to backend names without changing the source of the listing', () => {
    const received = vi.fn();
    service
      .correct('r1', {
        explanation: 'Official update',
        source_url: 'https://example.org/source',
        proposed_changes: {
          state: 'NC',
          county: 'Wake County',
          city: 'Cary',
          website: 'https://example.org',
        },
      })
      .subscribe(received);
    const request = http.expectOne('/bringthemhome/api/resources/r1/corrections');
    expect(request.request.body).toEqual({
      reason: 'Official update',
      source_url: 'https://example.org/source',
      issue_type: 'ACCURACY',
      suggested_changes: {
        state_code: 'NC',
        county_name: 'Wake County',
        city_name: 'Cary',
        website_url: 'https://example.org',
      },
    });
    request.flush({
      id: 'c1',
      resource_id: 'r1',
      reason: 'Official update',
      suggested_changes: request.request.body.suggested_changes,
      status: 'PENDING',
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: 'Official update',
        proposed_changes: {
          state: 'NC',
          county: 'Wake County',
          city: 'Cary',
          website: 'https://example.org',
        },
      }),
    );
  });
  it('loads own listings and contribution history from prefixed endpoints', () => {
    const own = vi.fn(),
      history = vi.fn();
    service.own().subscribe(own);
    http.expectOne('/bringthemhome/api/users/me/resources?page=1&page_size=20').flush({
      items: [
        {
          id: 'r1',
          verification_status: 'UNVERIFIED',
          state_code: 'NC',
          accurate_count: 2,
          inaccurate_count: 0,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    expect(own).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'r1', status: 'UNVERIFIED', confirmation_count: 2 })],
      }),
    );
    service.contributions().subscribe(history);
    http.expectOne('/bringthemhome/api/users/me/resource-contributions?page=1&page_size=20').flush({
      submitted_resources: { items: [] },
      verifications: {
        items: [
          { resource_id: 'r1', verification: 'ACCURATE', updated_at: '2026-10-29T12:00:00Z' },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
      corrections: { items: [], total: 0, page: 1, page_size: 20 },
    });
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({
        assessments: expect.objectContaining({
          items: [expect.objectContaining({ resource_id: 'r1', assessment: 'ACCURATE' })],
        }),
      }),
    );
  });
  it('requires contact, source and hierarchical location', () => {
    const f = resourceForm();
    f.patchValue({
      name: 'Name',
      description: 'Description',
      category: 'FAMILY_SUPPORT',
      scope: 'CITY',
      state: '36',
      source_url: 'https://example.org',
    });
    expect(f.invalid).toBe(true);
    f.patchValue({ county: '36061', city: '3651000', email: 'public@example.org' });
    expect(f.valid).toBe(true);
    f.patchValue({ source_url: 'javascript:bad' });
    expect(f.invalid).toBe(true);
  });
  it('replaces and withdraws assessments using authoritative server response', () => {
    const received = vi.fn();
    service.assess('r1', { assessment: 'ACCURATE' }).subscribe(received);
    const r = http.expectOne('/bringthemhome/api/resources/r1/verifications');
    expect(r.request.body).toEqual({ verification: 'ACCURATE' });
    expect(r.request.headers.get('X-CSRF-Token')).toBe('csrf');
    expect(r.request.withCredentials).toBe(true);
    r.flush({
      verification_status: 'COMMUNITY_CONFIRMED',
      accurate_count: 1,
      inaccurate_count: 0,
      current_user_verification: 'ACCURATE',
      state_code: 'NC',
      county_name: 'Wake County',
      city_name: 'Cary',
      website_url: null,
      can_verify: true,
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'COMMUNITY_CONFIRMED',
        confirmation_count: 1,
        current_user_assessment: 'ACCURATE',
        can_verify: true,
      }),
    );
    service.withdraw('r1').subscribe(received);
    const d = http.expectOne('/bringthemhome/api/resources/r1/verifications');
    expect(d.request.method).toBe('DELETE');
    expect(d.request.headers.get('X-CSRF-Token')).toBe('csrf');
    d.flush({
      verification_status: 'UNVERIFIED',
      accurate_count: 0,
      inaccurate_count: 0,
      current_user_verification: null,
      state_code: null,
      county_name: null,
      city_name: null,
      website_url: null,
    });
    expect(received).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'UNVERIFIED',
        confirmation_count: 0,
        current_user_assessment: null,
      }),
    );
  });
  it('submits corrections separately from the published resource', () => {
    service
      .correct('r1', {
        explanation: 'Official update',
        source_url: 'https://example.org',
        proposed_changes: { name: 'New name' },
      })
      .subscribe();
    const r = http.expectOne('/bringthemhome/api/resources/r1/corrections');
    expect(r.request.method).toBe('POST');
    expect(r.request.body.suggested_changes.name).toBe('New name');
    r.flush({ status: 'PENDING' });
  });
});
