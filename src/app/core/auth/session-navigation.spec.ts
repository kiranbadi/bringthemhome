import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { csrfInterceptor } from './csrf.interceptor';
import { routes } from '../../app.routes';
import { AccountManagementService } from '../../services/account-management';

const user = {
  id: 'user-1',
  email: 'jane@example.com',
  full_name: 'Jane Doe',
  role: 'GENERAL_PUBLIC',
};

const reportEndpoint = 'http://localhost:8000/bringthemhome/api/v2/person-reports';
const draft = {
  _id: 'a1afe20f-8892-5f14-ac02-5364a83c4386',
  report_id: 'VFMFQNM29S',
  user_id: user.email,
  report_status: 'DRAFT',
};

const mediaEndpoint = `${reportEndpoint}/media`;

function flushEmptyMedia(http: HttpTestingController): void {
  const request = http.expectOne(mediaEndpoint);
  expect(request.request.body.action).toBe('get_media');
  request.flush(
    { error_message: 'Media section not found.' },
    { status: 404, statusText: 'Not Found' },
  );
}

const previewSections = [
  ['identity', 'Identity', 'identity_section'],
  ['physical-description', 'Physical description', 'physical_description_section'],
  ['social-media', 'Social media', 'social_media_section'],
  ['educational-history', 'Educational history', 'educational_history_section'],
  ['employment-history', 'Employment history', 'employment_history_section'],
  ['last-seen', 'Last seen', 'last_seen_section'],
  [
    'possible-sighting-locations',
    'Possible sighting locations',
    'possible_sighting_locations_section',
  ],
  ['case-and-contact', 'Case and contact', 'case_and_contact_section'],
] as const;

function flushPreviewSections(
  http: HttpTestingController,
  saved: Record<string, unknown> = {},
  skip = '',
): void {
  for (const [path, label, key] of previewSections) {
    if (path === skip) continue;
    const request = http.expectOne(`${reportEndpoint}/${path}`);
    if (key in saved) {
      request.flush({ [key]: saved[key] });
    } else {
      request.flush(
        { error_message: `${label} section not found.` },
        { status: 404, statusText: 'Not Found' },
      );
    }
  }
}

describe('Persisted account navigation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    sessionStorage.clear();
    for (const name of ['bth_report_context', '_id', 'report_id', 'user_id']) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  });

  for (const path of ['/account-management', '/login', '/account/management']) {
    it(`opens the account dashboard from ${path} with a persisted session`, async () => {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      sessionStorage.setItem('csrf_token', 'persisted-token');
      const harness = await RouterTestingHarness.create(path);
      expect(harness.routeNativeElement?.textContent).toContain('My Account');
      expect(harness.routeNativeElement?.querySelector('app-registration')).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/account/management');
      expect(sessionStorage.getItem('csrf_token')).toBe('persisted-token');
    });
  }

  it('keeps the session when navigating away and returning through the header link', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/myaccount');
    await harness.navigateByUrl('/support-us');
    await harness.navigateByUrl('/account-management');
    expect(harness.routeNativeElement?.textContent).toContain('My Account');
    expect(sessionStorage.getItem('currentUser')).toBe(JSON.stringify(user));
  });

  it('rejects an expired session on reload before opening a protected route', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('bth_session_expires_at', new Date(Date.now() - 1_000).toISOString());
    await RouterTestingHarness.create('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(sessionStorage.getItem('currentUser')).toBeNull();
  });

  it('redirects a guest to login without a redirect loop', async () => {
    const harness = await RouterTestingHarness.create('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
  });

  it('redirects guests opening the report route to Login', async () => {
    const harness = await RouterTestingHarness.create('/missing-person-report');
    expect(TestBed.inject(Router).url).toBe(
      '/login?reason=report-account-required&returnUrl=%2Fmissing-person-report',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
    expect(harness.routeNativeElement?.querySelector('[role="status"]')?.textContent).toContain(
      'Only signed-in users with a registered account can create a missing person report.',
    );
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(reportEndpoint);
  });

  it('does not show the report notice on ordinary login visits or after leaving the report login', async () => {
    const harness = await RouterTestingHarness.create('/login');
    expect(harness.routeNativeElement?.querySelector('.report-login-notice')).toBeNull();
    await harness.navigateByUrl('/missing-person-report');
    expect(harness.routeNativeElement?.querySelector('.report-login-notice')).not.toBeNull();
    await harness.navigateByUrl('/login');
    expect(harness.routeNativeElement?.querySelector('.report-login-notice')).toBeNull();
  });

  it.each(['combined', 'individual'])(
    'reuses matching %s report cookies without a POST',
    async (format) => {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      const context = {
        _id: draft._id,
        report_id: draft.report_id,
        user_id: user.email.toUpperCase(),
      };
      const cookies =
        format === 'combined' ? { bth_report_context: JSON.stringify(context) } : context;
      for (const [key, value] of Object.entries(cookies)) {
        document.cookie = `${key}=${encodeURIComponent(value)}; Path=/`;
      }
      const harness = await RouterTestingHarness.create('/missing-person-report');
      flushEmptyMedia(TestBed.inject(HttpTestingController));
      TestBed.inject(HttpTestingController).expectNone(reportEndpoint);
      expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
    },
  );

  it.each([
    JSON.stringify({ ...draft, user_id: 'other@example.com' }),
    JSON.stringify({ report_id: draft.report_id, user_id: user.email }),
    '{invalid JSON',
  ])('creates a draft if the report cookie is unusable (%s)', async (cookie) => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    document.cookie = `bth_report_context=${encodeURIComponent(cookie)}; Path=/`;
    const harness = await RouterTestingHarness.create('/missing-person-report');
    TestBed.inject(HttpTestingController).expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(TestBed.inject(HttpTestingController));
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
  });

  it('opens the workspace only after creating a draft for the signed-in account', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
    const request = TestBed.inject(HttpTestingController).expectOne(reportEndpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ user_id: user.email });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    request.flush(draft, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();
    flushEmptyMedia(TestBed.inject(HttpTestingController));
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
    await harness.navigateByUrl('/myaccount');
    await harness.navigateByUrl('/missing-person-report');
    flushEmptyMedia(TestBed.inject(HttpTestingController));
    TestBed.inject(HttpTestingController).expectNone(reportEndpoint);
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
  });

  it('keeps the workspace closed on failure and supports an explicit retry', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-missing-person-report')).toBeNull();
    const retry =
      harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.report-retry');
    retry!.click();
    retry!.click();
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain(draft.report_id);
  });

  it('saves Identity with the draft context and session before advancing', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement!;
    const identityEndpoint = `${reportEndpoint}/identity`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    page.querySelectorAll<HTMLButtonElement>('.section-nav button')[1].click();
    const read = http.expectOne(identityEndpoint);
    expect(read.request.body).toEqual({ action: 'get_identity', identity: context });
    read.flush(
      { error_message: 'Identity section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    const form = page.querySelector('[formcontrolname="firstName"]')!.closest('form')!;
    const next = Array.from(form.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Next'),
    )!;
    const progress = page.querySelector('.section-progress')!;

    next.click();
    http.expectNone(identityEndpoint);
    await harness.fixture.whenStable();
    expect(progress.textContent).toContain('Section 2 of 10');

    const fields = {
      firstName: 'Jordan',
      lastName: 'Rivera',
      dateOfBirth: '2008-04-15',
      ageWhenMissing: '16',
      currentAge: '18',
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = form.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const alias = form.querySelector<HTMLInputElement>('[formarrayname="aliases"] input')!;
    alias.value = ' Jordy ';
    alias.dispatchEvent(new Event('input', { bubbles: true }));
    next.click();
    next.click();

    const save = http.expectOne(identityEndpoint);
    expect(save.request.method).toBe('POST');
    expect(save.request.withCredentials).toBe(true);
    expect(save.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(save.request.detectContentTypeHeader()).toBe('application/json');
    expect(save.request.body).toEqual({
      action: 'create_identity',
      identity: {
        _id: draft._id,
        report_id: draft.report_id,
        user_id: draft.user_id,
        ...fields,
        middleName: '',
        aliases: ['Jordy'],
      },
    });
    expect(progress.textContent).toContain('Section 2 of 10');
    save.flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('Could not save');
    expect(progress.textContent).toContain('Section 2 of 10');

    next.click();
    const retry = http.expectOne(identityEndpoint);
    expect(retry.request.body).toEqual(save.request.body);
    retry.flush({}, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${reportEndpoint}/physical-description`)
      .flush(
        { error_message: 'Physical description section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(progress.textContent).toContain('Section 3 of 10');

    page.querySelectorAll<HTMLButtonElement>('.section-nav button')[1].click();
    await harness.fixture.whenStable();
    next.click();
    http.expectNone(identityEndpoint);
    await harness.fixture.whenStable();
    expect(progress.textContent).toContain('Section 3 of 10');

    page.querySelectorAll<HTMLButtonElement>('.section-nav button')[1].click();
    await harness.fixture.whenStable();
    alias.value = '';
    alias.dispatchEvent(new Event('input', { bubbles: true }));
    next.click();
    const update = http.expectOne(identityEndpoint);
    expect(update.request.body).toEqual({
      action: 'update_identity',
      identity: { ...context, aliases: [] },
    });
    expect(update.request.withCredentials).toBe(true);
    expect(update.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    update.flush({});
    await harness.fixture.whenStable();
    expect(progress.textContent).toContain('Section 3 of 10');

    await harness.navigateByUrl('/myaccount');
    await harness.navigateByUrl('/missing-person-report');
    flushEmptyMedia(TestBed.inject(HttpTestingController));
    const reopened = harness.routeNativeElement!;
    reopened.querySelectorAll<HTMLButtonElement>('.section-nav button')[1].click();
    const reload = http.expectOne(identityEndpoint);
    expect(reload.request.body).toEqual({ action: 'get_identity', identity: context });
    reload.flush({ identity_section: { ...fields, middleName: '', aliases: ['Another alias'] } });
    await harness.fixture.whenStable();
    expect(reopened.querySelector<HTMLInputElement>('[formcontrolname="firstName"]')!.value).toBe(
      fields.firstName,
    );
    expect(reopened.querySelector<HTMLInputElement>('[formarrayname="aliases"] input')!.value).toBe(
      'Another alias',
    );
  });

  it('creates and updates Physical Description with the draft session', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const page = harness.routeNativeElement!;
    const physicalEndpoint = `${reportEndpoint}/physical-description`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const openPhysical = () =>
      page.querySelectorAll<HTMLButtonElement>('.section-nav button')[2].click();
    openPhysical();
    const read = http.expectOne(physicalEndpoint);
    expect(read.request.body).toEqual({
      action: 'get_physical_description',
      physicalDescription: context,
    });
    read.flush(
      { error_message: 'Physical description section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    const form = page.querySelector('[formcontrolname="height"]')!.closest('form')!;
    const next = Array.from(form.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Next'),
    )!;
    const progress = page.querySelector('.section-progress')!;
    const enter = (name: string, value: string) => {
      const input = form.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    enter('height', '5 ft 6 in');
    enter('languages', 'English, Spanish');
    enter('otherIdentifiers', 'Glasses');
    next.click();
    const create = http.expectOne(physicalEndpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.withCredentials).toBe(true);
    expect(create.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(create.request.body).toEqual({
      action: 'create_physical_description',
      physicalDescription: {
        ...context,
        gender: '',
        sexAtBirth: '',
        raceEthnicity: '',
        raceEthnicityOther: '',
        height: '5 ft 6 in',
        weight: '',
        hairColor: '',
        hairColorOther: '',
        eyeColor: '',
        complexion: '',
        scarsMarksTattoos: '',
        medicalConditions: '',
        medications: '',
        disabilities: '',
        languages: 'English, Spanish',
        otherIdentifiers: 'Glasses',
      },
    });
    expect(progress.textContent).toContain('Section 3 of 10');
    create.flush({}, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${reportEndpoint}/social-media`)
      .flush(
        { error_message: 'Social media section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(progress.textContent).toContain('Section 4 of 10');

    openPhysical();
    await harness.fixture.whenStable();
    enter('otherIdentifiers', '');
    next.click();
    const update = http.expectOne(physicalEndpoint);
    expect(update.request.body).toEqual({
      action: 'update_physical_description',
      physicalDescription: { ...context, otherIdentifiers: '' },
    });
    update.flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('Could not save');
    expect(progress.textContent).toContain('Section 3 of 10');
    next.click();
    const retry = http.expectOne(physicalEndpoint);
    expect(retry.request.body).toEqual(update.request.body);
    retry.flush({});
    await harness.fixture.whenStable();
    expect(progress.textContent).toContain('Section 4 of 10');
  });

  it('loads, creates, and clears Social Media profiles with the draft session', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const socialEndpoint = `${reportEndpoint}/social-media`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const openSocial = () =>
      harness
        .routeNativeElement!.querySelectorAll<HTMLButtonElement>('.section-nav button')[3]
        .click();
    openSocial();
    const read = http.expectOne(socialEndpoint);
    expect(read.request.body).toEqual({ action: 'get_social_media', socialMedia: context });
    read.flush(
      { error_message: 'Social media section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();

    const form = () =>
      harness.routeNativeElement!.querySelector('[formcontrolname="platform"]')!.closest('form')!;
    const next = () =>
      Array.from(form().querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Next'))!
        .click();
    const handle = () => form().querySelector<HTMLInputElement>('[formcontrolname="handle"]')!;
    const enterHandle = (value: string) => {
      handle().value = value;
      handle().dispatchEvent(new Event('input', { bubbles: true }));
    };
    const profiles = [
      {
        platform: '',
        profileUrl: '',
        handle: '@jordy',
        onlineAlias: '',
        messagingApp: '',
        notes: '',
      },
    ];
    enterHandle('@jordy');
    next();
    const create = http.expectOne(socialEndpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.withCredentials).toBe(true);
    expect(create.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(create.request.body).toEqual({
      action: 'create_social_media',
      socialMedia: { ...context, profiles },
    });
    create.flush({}, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${reportEndpoint}/educational-history`)
      .flush(
        { error_message: 'Educational history section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();

    await harness.navigateByUrl('/myaccount');
    await harness.navigateByUrl('/missing-person-report');
    flushEmptyMedia(TestBed.inject(HttpTestingController));
    openSocial();
    http.expectOne(socialEndpoint).flush({ social_media_section: { profiles } });
    await harness.fixture.whenStable();
    expect(handle().value).toBe('@jordy');

    enterHandle('');
    next();
    const update = http.expectOne(socialEndpoint);
    expect(update.request.body).toEqual({
      action: 'update_social_media',
      socialMedia: { ...context, profiles: [] },
    });
    update.flush({});
    http
      .expectOne(`${reportEndpoint}/educational-history`)
      .flush(
        { error_message: 'Educational history section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('.section-progress')?.textContent).toContain(
      'Section 5 of 10',
    );
  });

  it('saves and replaces Educational History records with the draft session', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const endpoint = `${reportEndpoint}/educational-history`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const page = harness.routeNativeElement!;
    const openEducation = () =>
      page.querySelectorAll<HTMLButtonElement>('.section-nav button')[4].click();
    openEducation();
    const read = http.expectOne(endpoint);
    expect(read.request.body).toEqual({
      action: 'get_educational_history',
      educationalHistory: context,
    });
    read.flush(
      { error_message: 'Educational history section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    const school = page.querySelector<HTMLInputElement>('[formcontrolname="schoolName"]')!;
    const next = Array.from(school.closest('form')!.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Next'),
    )!;
    const enterSchool = (value: string) => {
      school.value = value;
      school.dispatchEvent(new Event('input', { bubbles: true }));
    };
    enterSchool('Example High School');
    next.click();
    const create = http.expectOne(endpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.withCredentials).toBe(true);
    expect(create.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(create.request.body).toEqual({
      action: 'create_educational_history',
      educationalHistory: {
        ...context,
        records: [
          {
            schoolName: 'Example High School',
            schoolDistrict: '',
            gradeLevel: '',
            studentId: '',
            educationStatus: '',
            schoolContacts: '',
            startDate: '',
            endDate: '',
            notes: '',
          },
        ],
      },
    });
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 5 of 10');
    create.flush({}, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${reportEndpoint}/employment-history`)
      .flush(
        { error_message: 'Employment history section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 6 of 10');

    openEducation();
    await harness.fixture.whenStable();
    enterSchool('');
    next.click();
    const update = http.expectOne(endpoint);
    expect(update.request.body).toEqual({
      action: 'update_educational_history',
      educationalHistory: { ...context, records: [] },
    });
    update.flush({});
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 6 of 10');
  });

  it('creates and updates Employment History records through the report wizard', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const endpoint = `${reportEndpoint}/employment-history`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const page = harness.routeNativeElement!;
    const openEmployment = () =>
      page.querySelectorAll<HTMLButtonElement>('.section-nav button')[5].click();
    openEmployment();
    const read = http.expectOne(endpoint);
    expect(read.request.body).toEqual({
      action: 'get_employment_history',
      employmentHistory: context,
    });
    read.flush(
      { error_message: 'Employment history section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    const employer = page.querySelector<HTMLInputElement>('[formcontrolname="currentEmployer"]')!;
    const next = Array.from(employer.closest('form')!.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Next'),
    )!;
    const enterEmployer = (value: string) => {
      employer.value = value;
      employer.dispatchEvent(new Event('input', { bubbles: true }));
    };
    enterEmployer('Example Market');
    next.click();
    const create = http.expectOne(endpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.withCredentials).toBe(true);
    expect(create.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(create.request.body).toEqual({
      action: 'create_employment_history',
      employmentHistory: {
        ...context,
        records: [
          {
            currentEmployer: 'Example Market',
            jobTitle: '',
            workLocation: '',
            workSchedule: '',
            supervisorContact: '',
            previousEmployers: '',
            employmentNotes: '',
          },
        ],
      },
    });
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 6 of 10');
    create.flush({}, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${reportEndpoint}/last-seen`)
      .flush(
        { error_message: 'Last seen section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 7 of 10');

    openEmployment();
    await harness.fixture.whenStable();
    enterEmployer('');
    next.click();
    const update = http.expectOne(endpoint);
    expect(update.request.body).toEqual({
      action: 'update_employment_history',
      employmentHistory: { ...context, records: [] },
    });
    update.flush({});
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 7 of 10');
  });

  it('restores Last Seen and saves only the changed circumstances fields', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const endpoint = `${reportEndpoint}/last-seen`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const page = harness.routeNativeElement!;
    page.querySelectorAll<HTMLButtonElement>('.section-nav button')[6].click();
    const read = http.expectOne(endpoint);
    expect(read.request.body).toEqual({ action: 'get_last_seen', lastSeen: context });
    read.flush({
      last_seen_section: {
        date: '2026-11-06',
        location: 'Example Station',
        lastContact: { date: '2026-11-06', time: '14:30' },
        itemsLeftBehind: [{ item: 'Backpack', details: 'At home' }],
      },
    });
    await harness.fixture.whenStable();

    const input = (name: string) =>
      page.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
    expect(input('lastSeenLocation').value).toBe('Example Station');
    expect(input('item').value).toBe('Backpack');
    const next = Array.from(
      input('lastSeenLocation').closest('form')!.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Next'))!;
    const time = input('lastContactTime');
    time.value = '15:00';
    time.dispatchEvent(new Event('input', { bubbles: true }));
    next.click();
    const update = http.expectOne(endpoint);
    expect(update.request.withCredentials).toBe(true);
    expect(update.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(update.request.body).toEqual({
      action: 'update_last_seen',
      lastSeen: { ...context, lastContact: { date: '2026-11-06', time: '15:00' } },
    });
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 7 of 10');
    update.flush({});
    http
      .expectOne(`${reportEndpoint}/possible-sighting-locations`)
      .flush(
        { error_message: 'Possible sighting locations section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 8 of 10');
  });

  it('loads and saves Possible Sighting Locations before advancing', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const endpoint = `${reportEndpoint}/possible-sighting-locations`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const page = harness.routeNativeElement!;
    const openSightings = () =>
      page.querySelectorAll<HTMLButtonElement>('.section-nav button')[7].click();
    openSightings();
    const read = http.expectOne(endpoint);
    expect(read.request.body).toEqual({
      action: 'get_possible_sighting_locations',
      possibleSightingLocations: context,
    });
    read.flush(
      { error_message: 'Possible sighting locations section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    const location = page.querySelector<HTMLInputElement>('[formcontrolname="locationName"]')!;
    const next = Array.from(location.closest('form')!.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Next'),
    )!;
    const enterLocation = (value: string) => {
      location.value = value;
      location.dispatchEvent(new Event('input', { bubbles: true }));
    };
    enterLocation('Example Station');
    next.click();
    const create = http.expectOne(endpoint);
    expect(create.request.method).toBe('POST');
    expect(create.request.withCredentials).toBe(true);
    expect(create.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(create.request.body).toEqual({
      action: 'create_possible_sighting_locations',
      possibleSightingLocations: {
        ...context,
        records: [
          {
            sightingDate: '',
            sightingTime: '',
            locationName: 'Example Station',
            address: '',
            city: '',
            state: '',
            latitude: '',
            longitude: '',
            reportedBy: '',
            notes: '',
          },
        ],
      },
    });
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 8 of 10');
    create.flush({}, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${reportEndpoint}/case-and-contact`)
      .flush(
        { error_message: 'Case and contact section not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 9 of 10');

    openSightings();
    await harness.fixture.whenStable();
    enterLocation('');
    next.click();
    const update = http.expectOne(endpoint);
    expect(update.request.body).toEqual({
      action: 'update_possible_sighting_locations',
      possibleSightingLocations: { ...context, records: [] },
    });
    update.flush({});
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 9 of 10');
  });

  it('saves Case and Contact before preview and updates changed fields', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();

    const endpoint = `${reportEndpoint}/case-and-contact`;
    const context = { _id: draft._id, report_id: draft.report_id, user_id: draft.user_id };
    const page = harness.routeNativeElement!;
    const openContacts = () =>
      page.querySelectorAll<HTMLButtonElement>('.section-nav button')[8].click();
    openContacts();
    const read = http.expectOne(endpoint);
    expect(read.request.body).toEqual({ action: 'get_case_and_contact', caseAndContact: context });
    read.flush(
      { error_message: 'Case and contact section not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    const input = (name: string) =>
      page.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
    const preview = Array.from(
      input('reporterName').closest('form')!.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Preview'))!;
    const enter = (name: string, value: string) => {
      const field = input(name);
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    preview.click();
    http.expectNone(endpoint);
    enter('transportation', 'Bus');
    enter('companions', 'Sam Example');
    enter('reporterName', 'Jane Doe');
    enter('reporterPhone', '919-555-0100');
    enter('reporterEmail', user.email);
    preview.click();
    const create = http.expectOne(endpoint);
    expect(create.request.withCredentials).toBe(true);
    expect(create.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(create.request.body).toEqual({
      action: 'create_case_and_contact',
      caseAndContact: {
        ...context,
        transportation: 'Bus',
        companions: 'Sam Example',
        records: [
          {
            lawEnforcementAgency: '',
            caseNumber: '',
            officerName: '',
            officerPhone: '',
            reporterRelationship: '',
            reporterName: 'Jane Doe',
            reporterPhone: '919-555-0100',
            reporterEmail: user.email,
            urgentSafetyNotes: '',
          },
        ],
      },
    });
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 9 of 10');
    create.flush({}, { status: 201, statusText: 'Created' });
    flushPreviewSections(http, {}, 'case-and-contact');
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 10 of 10');

    openContacts();
    await harness.fixture.whenStable();
    enter('transportation', 'On foot');
    preview.click();
    const update = http.expectOne(endpoint);
    expect(update.request.body).toEqual({
      action: 'update_case_and_contact',
      caseAndContact: { ...context, transportation: 'On foot' },
    });
    update.flush({});
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 10 of 10');
  });

  it('uploads files to S3 and submits the report with only their metadata', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('csrf_token', 'report-csrf');
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush(draft);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();
    const page = harness.routeNativeElement!;
    const nav = page.querySelectorAll<HTMLButtonElement>('.section-nav button');
    nav[9].click();
    flushPreviewSections(http, {
      identity_section: { firstName: 'Jordan', lastName: 'Rivera' },
      last_seen_section: { date: '2026-11-06', location: 'Example Station' },
      case_and_contact_section: {
        records: [
          { reporterName: 'Jane', reporterPhone: '919-555-0100', reporterEmail: user.email },
        ],
      },
    });
    await harness.fixture.whenStable();
    const edit = (label: string) =>
      Array.from(page.querySelectorAll<HTMLButtonElement>('.review-links button'))
        .find((button) => button.textContent?.includes(label))!
        .click();
    const button = (root: ParentNode, label: string) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((item) =>
        item.textContent?.includes(label),
      )!;
    edit('Edit Identity');
    await harness.fixture.whenStable();
    const firstName = page.querySelector<HTMLInputElement>('[formcontrolname="firstName"]')!;
    firstName.value = 'Jordyn';
    firstName.dispatchEvent(new Event('input', { bubbles: true }));
    button(firstName.closest('form')!, 'Save and return to preview').click();
    const identity = http.expectOne(`${reportEndpoint}/identity`);
    expect(identity.request.body.action).toBe('update_identity');
    identity.flush({});
    await harness.fixture.whenStable();
    expect(page.querySelector('.section-progress')?.textContent).toContain('Section 10 of 10');

    edit('Edit Pictures and Videos');
    await harness.fixture.whenStable();
    const fileInput = page.querySelector<HTMLInputElement>('input[accept="image/*"]')!;
    const file = new File(['sample'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    const videoInput = page.querySelector<HTMLInputElement>('input[accept="video/*"]')!;
    const video = new File(['sample'], 'clip.mp4', { type: 'video/mp4' });
    Object.defineProperty(videoInput, 'files', { value: [video], configurable: true });
    videoInput.dispatchEvent(new Event('change', { bubbles: true }));
    page.querySelector<HTMLInputElement>('mat-checkbox input[type="checkbox"]')!.click();
    const saveMedia = button(fileInput.closest('form')!, 'Save and return to preview');
    saveMedia.click();
    const incomplete = http.expectOne((request) => request.url === `${mediaEndpoint}/upload`);
    incomplete.flush({});
    http.expectNone(mediaEndpoint);
    await harness.fixture.whenStable();
    expect(page.textContent).toContain('Could not upload every file to S3');
    saveMedia.click();
    const upload = http.expectOne((request) => request.url === `${mediaEndpoint}/upload`);
    expect(upload.request.withCredentials).toBe(true);
    expect(upload.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    expect(upload.request.body.get('file')).toBe(file);
    expect(upload.request.params.get('_id')).toBe(draft._id);
    expect(upload.request.params.get('_id')).toBe(incomplete.request.params.get('_id'));
    expect(upload.request.params.has('client_id')).toBe(false);
    const url = `${mediaEndpoint}/files/${draft._id}/${'a'.repeat(64)}`;
    upload.flush({ url }, { status: 201, statusText: 'Created' });
    const uploadVideo = http.expectOne((request) => request.url === `${mediaEndpoint}/upload`);
    expect(uploadVideo.request.params.get('kind')).toBe('video');
    expect(uploadVideo.request.body.get('file')).toBe(video);
    expect(uploadVideo.request.params.get('_id')).toBe(draft._id);
    const videoUrl = `s3://report-bucket/media/person-reports/${draft._id}/${'b'.repeat(64)}`;
    uploadVideo.flush({ url: videoUrl }, { status: 201, statusText: 'Created' });
    const media = http.expectOne(mediaEndpoint);
    expect(media.request.body).toMatchObject({
      action: 'create_media',
      media: {
        photos: [{ url }],
        videos: [{ url: videoUrl }],
        consentToUseMedia: true,
      },
    });
    expect(media.request.body.media.photos[0]).not.toHaveProperty('client_id');
    expect(media.request.body.media.videos[0]).not.toHaveProperty('client_id');
    media.flush({}, { status: 201, statusText: 'Created' });
    await harness.fixture.whenStable();

    const submitEndpoint = `${reportEndpoint}/submit`;
    const submit = button(page, 'Submit for administrator review');
    const confirmSubmission = async () => {
      submit.click();
      await harness.fixture.whenStable();
      http.expectNone(submitEndpoint);
      const dialog = TestBed.inject(MatDialog).openDialogs[0];
      const closed = firstValueFrom(dialog.afterClosed());
      document
        .querySelector<HTMLFormElement>('mat-dialog-container form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await closed;
      return http.expectOne(submitEndpoint);
    };
    const request = await confirmSubmission();
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-Token')).toBe('report-csrf');
    const payload = request.request.body;
    expect(request.request.detectContentTypeHeader()).toBe('application/json');
    expect(payload).toMatchObject({
      action: 'submit_report',
      report: {
        _id: draft._id,
        report_id: draft.report_id,
        user_id: draft.user_id,
        media: {
          consentToUseMedia: true,
          photos: [{ name: 'photo.jpg', url }],
          videos: [{ name: 'clip.mp4', url: videoUrl }],
        },
        missingPersonDetails: { identity: { firstName: 'Jordyn', lastName: 'Rivera' } },
      },
    });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(page.textContent).toContain('Could not submit the report');
    const retry = await confirmSubmission();
    expect(retry.request.body).toEqual(payload);
    retry.flush({ ...draft, report_status: 'SUBMITTED' });
    await harness.fixture.whenStable();
    expect(page.textContent).toContain('Awaiting administrator review');
    expect(page.querySelector('.review-links')?.textContent).toContain('View Identity');
    expect(document.cookie).not.toContain('bth_report_context=');
  });

  it('restores saved media using the document ID in the draft cookie', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const { _id, report_id, user_id } = draft;
    const context = { _id, report_id, user_id };
    document.cookie = `bth_report_context=${encodeURIComponent(JSON.stringify(context))}; Path=/`;
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const photo = {
      url: `${mediaEndpoint}/files/${_id}/${'a'.repeat(64)}`,
      name: 'saved-photo.jpg',
      size_bytes: 1024,
      size: '1 KB',
      type: 'image/jpeg',
    };
    const restore = async () => {
      const read = http.expectOne(mediaEndpoint);
      expect(read.request.body).toEqual({ action: 'get_media', media: context });
      read.flush({ media_section: { photos: [photo], consentToUseMedia: true } });
      await harness.fixture.whenStable();
      const list = harness.routeNativeElement?.querySelector('[aria-label="Uploaded photos"]');
      expect(list?.textContent).toContain('saved-photo.jpg');
      expect(list?.textContent).toContain('Stored in S3');
    };
    await restore();
    await harness.navigateByUrl('/myaccount');
    await harness.navigateByUrl('/missing-person-report');
    await restore();
    http.expectNone(reportEndpoint);
    http.expectNone(`${mediaEndpoint}/upload`);
  });

  it('keeps the queue available during review and opens the next report after a decision', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify({ ...user, role: 'ADMIN' }));
    sessionStorage.setItem('csrf_token', 'review-csrf');
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create('/admin/person-reports');
    const queue = `${reportEndpoint}/admin/review`;
    const report = { ...draft, name: 'Jordan Rivera', report_status: 'SUBMITTED' };
    const nextReport = { ...report, _id: 'next-report', report_id: 'NEXT', name: 'Avery Chen' };
    http
      .expectOne((request) => request.url === queue)
      .flush({ items: [report, nextReport], total: 2 });
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    const button = (label: string) =>
      Array.from(root.querySelectorAll('button')).find((item) =>
        item.textContent?.includes(label),
      )!;
    button('Jordan Rivera').click();
    const detail = `${queue}/${report._id}`;
    http.expectOne(detail).flush({
      ...report,
      can_review: true,
      version: 7,
      sections: {
        identity_section: { firstName: '', aliases: [] },
        media_section: { photos: [], videos: [], notes: ' ' },
        last_seen_section: { location: 'Example Station' },
        case_and_contact_section: {
          records: [{ reporterName: 'Jane Doe' }, { reporterName: 'Sam Example' }],
        },
      },
    });
    await harness.fixture.whenStable();
    expect(button('Jordan Rivera').getAttribute('aria-current')).toBe('true');
    expect(button('Avery Chen')).toBeDefined();
    expect(root.textContent).toContain('Example Station');
    expect(root.textContent).not.toContain('Photos and videos');
    expect(root.textContent).not.toContain('Physical description');
    expect(root.textContent).not.toContain('Identity');
    const records = Array.from(root.querySelectorAll('.record'));
    expect(records.map((record) => record.querySelector('dt')?.textContent?.trim())).toEqual([
      'Reporter Name',
      'Reporter Name',
    ]);
    expect(records.map((record) => record.querySelector('dd')?.textContent?.trim())).toEqual([
      'Jane Doe',
      'Sam Example',
    ]);
    button('Return for changes').click();
    await harness.fixture.whenStable();
    const dialog = TestBed.inject(MatDialog).openDialogs[0];
    const form = document.querySelector<HTMLFormElement>('mat-dialog-container form')!;
    const reason = form.querySelector<HTMLTextAreaElement>('textarea')!;
    reason.value = 'Please confirm the last seen date.';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    const closed = firstValueFrom(dialog.afterClosed());
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await closed;
    const save = http.expectOne(detail);
    expect(save.request.headers.get('X-CSRF-Token')).toBe('review-csrf');
    expect(save.request.body).toEqual({
      decision: 'REJECT',
      version: 7,
      reason: 'Please confirm the last seen date.',
    });
    save.flush({ ...report, report_status: 'REJECTED' });
    http.expectOne((request) => request.url === queue).flush({ items: [nextReport], total: 1 });
    http.expectOne(`${queue}/${nextReport._id}`).flush({
      ...nextReport,
      can_review: true,
      version: 4,
      sections: { last_seen_section: { location: 'Example Park' } },
    });
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Report returned for changes.');
    expect(button('Avery Chen').getAttribute('aria-current')).toBe('true');
    expect(root.textContent).toContain('Example Park');
  });

  it('shows the review reason when the owner reopens a returned report', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create('/account/person-reports');
    const mine = `${reportEndpoint}/mine`;
    const report = {
      ...draft,
      report_status: 'REJECTED',
      rejection_reason: 'Please confirm the last seen date.',
    };
    http.expectOne((request) => request.url === mine).flush({ items: [report], total: 1 });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain(report.rejection_reason);
    const edit = Array.from(harness.routeNativeElement!.querySelectorAll('a')).find((link) =>
      link.textContent?.includes('Edit and resubmit'),
    )!;
    expect(edit.getAttribute('href')).toBe(`/missing-person-report/${report._id}`);
    await harness.navigateByUrl(edit.getAttribute('href')!);
    http.expectOne(`${mine}/${report._id}`).flush(report);
    await harness.fixture.whenStable();
    flushEmptyMedia(http);
    await harness.fixture.whenStable();
    http.expectNone(reportEndpoint);
    expect(harness.routeNativeElement?.textContent).toContain('Changes required');
    expect(harness.routeNativeElement?.textContent).toContain(report.rejection_reason);
  });

  it('returns to sign-in when the server rejects an expired report session', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/missing-person-report');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(reportEndpoint).flush({}, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fmissing-person-report');
    expect(harness.routeNativeElement?.textContent).toContain('Sign In');
    expect(sessionStorage.getItem('currentUser')).toBeNull();
    http.expectNone(reportEndpoint);
  });

  it('requires login again only after explicit logout', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const harness = await RouterTestingHarness.create('/account/management');
    const service = TestBed.inject(AccountManagementService);
    service.logout().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8000/bringthemhome/auth/logout')
      .flush('');
    await harness.navigateByUrl('/support-us');
    await harness.navigateByUrl('/account/management');
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
