import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { ResourceFormComponent } from './resource-form.component';
import { ResourceVerificationComponent } from './resource-verification.component';
import { Resource } from './resource.models';

const resource: Resource = {
  id: 'r1',
  name: 'Public family help',
  description: 'Public support',
  category: 'FAMILY_SUPPORT',
  scope: 'NATIONAL',
  state: null,
  county: null,
  city: null,
  phone: null,
  email: null,
  website: 'https://example.org',
  address: null,
  source_url: 'https://example.org',
  state_name: null,
  county_name: null,
  city_name: null,
  status: 'UNVERIFIED',
  is_owner: false,
  confirmation_count: 0,
  dispute_count: 0,
  current_user_assessment: null,
  last_confirmed_at: null,
  last_verified_at: null,
  created_at: '2026-10-27T12:00:00Z',
};
function setup(id: string | null = null) {
  sessionStorage.setItem('currentUser', JSON.stringify({ id: 'helper' }));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
      },
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return TestBed.inject(HttpTestingController);
}
describe('Resource submission and correction UI workflows', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
  });
  it('submits directly once and shows success without navigating away', () => {
    const http = setup();
    const c = TestBed.createComponent(ResourceFormComponent).componentInstance;
    c.publicContactConfirmed.setValue(true);
    c.form.patchValue({
      name: resource.name,
      description: resource.description,
      category: resource.category,
      website: resource.website!,
      source_url: resource.source_url,
    });
    c.submit();
    c.submit();
    http.expectNone((req) => req.url.endsWith('/resources/duplicates'));
    const request = http.expectOne('/bringthemhome/api/resources');
    expect(request.request.method).toBe('POST');
    expect(c.success()).toBe('');
    request.flush({ ...resource, is_owner: true });
    expect(c.success()).toContain('successfully');
    expect(c.busy()).toBe(false);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    c.submit();
    http.expectNone((req) => req.method === 'POST');
  });
  it('sends a POST through the rendered form submit event and displays success', () => {
    const http = setup();
    const fixture = TestBed.createComponent(ResourceFormComponent);
    const c = fixture.componentInstance;
    c.publicContactConfirmed.setValue(true);
    c.form.patchValue({
      name: resource.name,
      description: resource.description,
      category: resource.category,
      website: resource.website!,
      source_url: resource.source_url,
    });
    fixture.detectChanges();
    http.expectOne((req) => req.url.endsWith('/locations/states')).flush([]);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    const request = http.expectOne('/bringthemhome/api/resources');
    expect(request.request.method).toBe('POST');
    expect(event.defaultPrevented).toBe(true);
    request.flush({ ...resource, is_owner: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.success-panel').textContent).toContain(
      'successfully',
    );
  });
  it('requires public contact confirmation before review or submission', () => {
    const http = setup();
    const c = TestBed.createComponent(ResourceFormComponent).componentInstance;
    c.form.patchValue({
      name: resource.name,
      description: resource.description,
      category: resource.category,
      website: resource.website!,
      source_url: resource.source_url,
    });
    c.submit();
    expect(c.publicContactConfirmed.touched).toBe(true);
    http.expectNone((req) => req.url.includes('/resources'));
    c.publicContactConfirmed.setValue(true);
    c.submit();
    http.expectOne('/bringthemhome/api/resources').flush({}, { status: 500, statusText: 'Error' });
    c.publicContactConfirmed.setValue(false);
    c.submit();
    http.expectNone((req) => req.method === 'POST');
  });
  it('requires a changed field and explanation, posts only a pending correction', () => {
    const http = setup('r1');
    const c = TestBed.createComponent(ResourceFormComponent).componentInstance;
    http.expectOne('/bringthemhome/api/resources/r1').flush(resource);
    c.submit();
    http.expectNone((req) => req.method === 'POST');
    c.form.controls.name.setValue('Updated name');
    c.explanation.setValue('Updated official listing');
    c.submit();
    const request = http.expectOne('/bringthemhome/api/resources/r1/corrections');
    expect(request.request.body.suggested_changes).toEqual({ name: 'Updated name' });
    request.flush({ id: 'c1', status: 'PENDING' });
    http.expectNone((req) => req.method === 'PATCH');
  });
  it('shows actionable API errors and allows retry after rejection', () => {
    const http = setup();
    const c = TestBed.createComponent(ResourceFormComponent).componentInstance;
    c.publicContactConfirmed.setValue(true);
    c.form.patchValue({
      name: resource.name,
      description: resource.description,
      category: resource.category,
      website: resource.website!,
      source_url: resource.source_url,
    });
    c.submit();
    http
      .expectOne('/bringthemhome/api/resources')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(c.busy()).toBe(false);
    expect(c.error()).toContain('sign in');
  });
});
describe('Resource assessment UI workflows', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
  });
  it('shows a login prompt for anonymous contribution attempts', () => {
    setup();
    sessionStorage.clear();
    const f = TestBed.createComponent(ResourceVerificationComponent);
    f.componentRef.setInput('resource', resource);
    f.detectChanges();
    f.componentInstance.accurate();
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('sign in');
    TestBed.inject(HttpTestingController).expectNone((req) => req.method === 'POST');
  });
  it('prevents creator assessments and hides confirmation controls', () => {
    setup();
    const f = TestBed.createComponent(ResourceVerificationComponent);
    f.componentRef.setInput('resource', { ...resource, is_owner: true });
    f.detectChanges();
    f.componentInstance.accurate();
    expect(f.nativeElement.textContent).toContain('cannot assess');
    TestBed.inject(HttpTestingController).expectNone((req) => req.method === 'POST');
  });
  it('respects a backend denial without submitting assessments or reports', () => {
    const http = setup();
    const fixture = TestBed.createComponent(ResourceVerificationComponent);
    fixture.componentRef.setInput('resource', {
      ...resource,
      can_verify: false,
      can_suggest_correction: false,
    });
    fixture.detectChanges();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.slice(0, 2).every((button) => button.disabled)).toBe(true);
    fixture.componentInstance.accurate();
    fixture.componentInstance.report();
    expect(fixture.componentInstance.showIssue()).toBe(false);
    http.expectNone((req) => req.method === 'POST');
  });
  it('allows reporting when verification is denied but suggestions are permitted', () => {
    const http = setup();
    const fixture = TestBed.createComponent(ResourceVerificationComponent);
    fixture.componentRef.setInput('resource', {
      ...resource,
      can_verify: false,
      can_suggest_correction: true,
    });
    fixture.componentInstance.report();
    expect(fixture.componentInstance.showIssue()).toBe(true);
    fixture.componentInstance.issue.controls.reason.setValue('Outdated contact');
    fixture.componentInstance.inaccurate();
    http
      .expectOne('/bringthemhome/api/resources/r1/reports')
      .flush({ id: 's1', status: 'PENDING' });
    expect(fixture.componentInstance.message()).toContain('review');
  });
  it('opens the report form without sending a request and clears the previous error', () => {
    const http = setup();
    const fixture = TestBed.createComponent(ResourceVerificationComponent);
    fixture.componentRef.setInput('resource', { ...resource, can_verify: true });
    fixture.componentInstance.error.set('This resource is unavailable.');
    fixture.componentInstance.report();
    expect(fixture.componentInstance.showIssue()).toBe(true);
    expect(fixture.componentInstance.error()).toBe('');
    http.expectNone((req) => req.method === 'POST');
  });
  it('requires a report reason and submits a suggestion without changing verification counts', () => {
    const http = setup();
    const f = TestBed.createComponent(ResourceVerificationComponent);
    f.componentRef.setInput('resource', resource);
    const updated = vi.fn();
    f.componentInstance.updated.subscribe(updated);
    f.componentInstance.inaccurate();
    http.expectNone((req) => req.method === 'POST');
    f.componentInstance.issue.controls.reason.setValue('Phone is disconnected');
    f.componentInstance.inaccurate();
    const r = http.expectOne('/bringthemhome/api/resources/r1/reports');
    expect(r.request.body).toEqual({
      reason: 'Phone is disconnected',
      issue_type: 'ACCURACY',
      source_url: null,
    });
    r.flush({
      id: 's1',
      resource_id: 'r1',
      suggested_changes: {},
      reason: 'Phone is disconnected',
      source_url: null,
      issue_type: 'ACCURACY',
      status: 'PENDING',
      created_at: '2026-10-29T12:00:00Z',
      reviewed_at: null,
    });
    expect(updated).not.toHaveBeenCalled();
    expect(f.componentInstance.message()).toContain('review');
  });
});
