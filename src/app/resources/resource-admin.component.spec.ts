import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ResourceAdminComponent } from './resource-admin.component';
import { AccountManagementService } from '../services/account-management';
import { csrfInterceptor } from '../core/auth/csrf.interceptor';
import { Resource } from './resource.models';

function setup(role = 'ADMIN') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([csrfInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: AccountManagementService,
        useValue: { currentUser$: of({ role }), isAuthenticated: () => true, csrfToken: 'csrf' },
      },
    ],
  });
  const fixture = TestBed.createComponent(ResourceAdminComponent);
  fixture.componentRef.setInput('resource', {
    id: 'r1',
    status: 'UNVERIFIED',
    listing_status: 'ACTIVE',
  } as Resource);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}
describe('Resource admin actions', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('does not render controls or call admin APIs for non-admin users', () => {
    const { fixture, http } = setup('USER');
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    http.expectNone((req) => req.url.includes('/admin/'));
  });
  it('loads the queue and submits an explicit review decision', () => {
    const { fixture, http } = setup();
    http
      .expectOne('/bringthemhome/api/admin/resource-corrections?status=PENDING&page=1&page_size=20')
      .flush({
        items: [
          {
            id: 's1',
            resource_id: 'r1',
            reason: 'Update',
            suggested_changes: { name: 'Updated' },
            status: 'PENDING',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      });
    fixture.componentInstance.review('s1', 'ACCEPTED');
    const request = http.expectOne('/bringthemhome/api/admin/resource-corrections/s1');
    expect(request.request.body).toEqual({ decision: 'ACCEPTED' });
    expect(request.request.headers.get('X-CSRF-Token')).toBe('csrf');
    request.flush({
      id: 's1',
      resource_id: 'r1',
      reason: 'Update',
      suggested_changes: {},
      status: 'ACCEPTED',
    });
    http.expectOne('/bringthemhome/api/resources/r1').flush({ id: 'r1', status: 'UNVERIFIED' });
    http
      .expectOne((req) => req.url.endsWith('/admin/resource-corrections'))
      .flush({ items: [], total: 0, page: 1, page_size: 20 });
  });
  it('requires a reason before changing resource status', () => {
    const { fixture, http } = setup();
    http
      .expectOne((req) => req.url.endsWith('/admin/resource-corrections'))
      .flush({ items: [], total: 0, page: 1, page_size: 20 });
    fixture.componentInstance.saveStatus();
    http.expectNone((req) => req.method === 'PATCH');
    fixture.componentInstance.form.patchValue({
      reason: 'Reviewed official source',
      source_url: 'https://example.org',
      verification_status: 'OFFICIALLY_VERIFIED',
    });
    fixture.componentInstance.saveStatus();
    const request = http.expectOne('/bringthemhome/api/admin/resources/r1/status');
    expect(request.request.body).toEqual({
      reason: 'Reviewed official source',
      source_url: 'https://example.org',
      verification_status: 'OFFICIALLY_VERIFIED',
      listing_status: 'ACTIVE',
    });
    request.flush({
      id: 'r1',
      verification_status: 'OFFICIALLY_VERIFIED',
      state_code: null,
      accurate_count: 0,
      inaccurate_count: 0,
    });
  });
});
