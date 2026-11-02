import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { AccountManagementService, AuthenticatedUser } from '../../services/account-management';
import { CaseClaimPanelComponent } from './case-claim-panel.component';
import { CaseContributionsComponent } from './case-contributions.component';
import { CaseClaimsAdminComponent } from './case-claims-admin.component';
import { ClaimContributionComposerComponent } from './claim-contribution-composer.component';
import { ClaimStatus, TRANSITIONS, claimError } from './case-claims.models';
import { caseClaimsAdminGuard } from './case-claims.guard';
import { safeReturnUrl } from '../../core/auth/return-url';
const base = 'http://localhost:8000/bringthemhome/api';
const user: AuthenticatedUser = {
  id: 'member-1',
  full_name: 'Claimant',
  email: 'claimant@example.com',
  role: 'GENERAL_PUBLIC',
};
const claim = (status: ClaimStatus = 'PENDING') => ({
  id: 'claim-1',
  missing_person_id: 'case-1',
  user_id: 'member-1',
  relationship: 'FAMILY' as const,
  explanation: 'Private explanation for independent verification.',
  status,
  created_at: '2026-10-31T12:00:00Z',
});
const page = (items: unknown[], total = items.length, number = 1) => ({
  items,
  total,
  page: number,
  page_size: 20,
});

describe('Case claim detail workflows', () => {
  let currentUser: BehaviorSubject<AuthenticatedUser | null>;
  let http: HttpTestingController;
  let fixture: ComponentFixture<CaseClaimPanelComponent>;
  const own = () => http.expectOne(`${base}/users/me/case-claims?page=1&page_size=100`);
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  beforeEach(async () => {
    currentUser = new BehaviorSubject<AuthenticatedUser | null>(null);
    TestBed.configureTestingModule({
      imports: [CaseClaimPanelComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AccountManagementService,
          useValue: {
            currentUser$: currentUser.asObservable(),
            isAuthenticated: () => !!currentUser.value,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaseClaimPanelComponent);
    fixture.componentRef.setInput('caseId', 'case-1');
    await fixture.whenStable();
    http.expectOne(`${base}/cases/case-1/contributions?page=1&page_size=20`).flush(page([]));
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
  });
  it('offers anonymous sign-in with a local return URL and never fetches private claims', () => {
    expect(text()).toContain('Sign in to claim this case');
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('a[href^="/login"]')
        ?.getAttribute('href'),
    ).toContain('returnUrl=');
    http.expectNone((request) => request.url.endsWith('/users/me/case-claims'));
  });
  for (const [status, label] of Object.entries({
    PENDING: 'Verification pending',
    APPROVED: 'Verified case access',
    REJECTED: 'Claim rejected',
    REVOKED: 'Verified access revoked',
  })) {
    it(`renders ${status} and only enables contributions for approval`, async () => {
      currentUser.next(user);
      await fixture.whenStable();
      own().flush({ ...page([claim(status as ClaimStatus)]), page_size: 100 });
      await fixture.whenStable();
      expect(text()).toContain(label);
      const composer = (fixture.nativeElement as HTMLElement).querySelector(
        'app-claim-contribution-composer',
      );
      expect(!!composer).toBe(status === 'APPROVED');
      expect(text()).not.toContain('Private explanation for independent verification.');
    });
  }
  it('fails closed on a status error and retries rather than showing no claim', async () => {
    currentUser.next(user);
    await fixture.whenStable();
    own().flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(text()).toContain('Retry claim status');
    expect(text()).not.toContain('Submit claim for verification');
    fixture.componentInstance.reload();
    own().flush({ ...page([]), page_size: 100 });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')?.textContent).toContain(
      'Claim this case',
    );
  });
  it('validates trimmed explanations, prevents duplicates and refreshes on 409', async () => {
    currentUser.next(user);
    await fixture.whenStable();
    own().flush({ ...page([]), page_size: 100 });
    await fixture.whenStable();
    fixture.componentInstance.form.setValue({ relationship: 'FAMILY', explanation: '   short ' });
    fixture.componentInstance.submitClaim();
    http.expectNone((r) => r.method === 'POST');
    fixture.componentInstance.form.controls.explanation.setValue(
      '  A private explanation for verification.  ',
    );
    fixture.componentInstance.submitClaim();
    fixture.componentInstance.submitClaim();
    const request = http.expectOne(`${base}/cases/case-1/claims`);
    expect(request.request.body.explanation).toBe('A private explanation for verification.');
    request.flush({}, { status: 409, statusText: 'Conflict' });
    own().flush({ ...page([claim()]), page_size: 100 });
    await fixture.whenStable();
    expect(text()).toContain('Verification pending');
  });
  it('disables an approved composer on refresh failure and revocation', async () => {
    currentUser.next(user);
    await fixture.whenStable();
    own().flush({ ...page([claim('APPROVED')]), page_size: 100 });
    await fixture.whenStable();
    fixture.componentInstance.reload();
    own().flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.canContribute()).toBe(false);
    fixture.componentInstance.reload();
    own().flush({ ...page([claim('REVOKED')]), page_size: 100 });
    await fixture.whenStable();
    expect(text()).toContain('Verified access revoked');
    expect(fixture.componentInstance.canContribute()).toBe(false);
  });
});

describe('Contribution publication and staged uploads', () => {
  let fixture: ComponentFixture<ClaimContributionComposerComponent>;
  let http: HttpTestingController;
  const file = () => new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
  beforeEach(async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    TestBed.configureTestingModule({
      imports: [ClaimContributionComposerComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClaimContributionComposerComponent);
    fixture.componentRef.setInput('caseId', 'case-1');
    fixture.componentRef.setInput('allowed', true);
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.restoreAllMocks();
  });
  const select = (files = [file()]) => {
    const input = { files, value: '' };
    fixture.componentInstance.select({ target: input } as unknown as Event);
  };
  const completeUpload = (status = 'ready') => {
    http.expectOne(`${base}/cases/case-1/claim-photos/presign`).flush({
      upload_id: 'ticket-id',
      upload_url: 'https://storage.example/image',
      headers: { 'Content-Type': 'image/jpeg' },
    });
    http.expectOne('https://storage.example/image').flush('');
    http.expectOne(`${base}/cases/case-1/claim-photos/complete`).flush({
      id: 'attachment-id',
      status,
      media_type: 'image',
      content_type: 'image/jpeg',
      display_url: 'https://storage.example/display',
    });
  };
  it('supports text-only publication and retains text on recoverable failure', () => {
    fixture.componentInstance.content.setValue(' Information from family. ');
    fixture.componentInstance.publish();
    const request = http.expectOne(`${base}/cases/case-1/contributions`);
    expect(request.request.body).toEqual({ content: 'Information from family.', photo_ids: [] });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.content.value).toContain('Information from family.');
  });
  for (const withText of [false, true]) {
    it(`publishes ready attachment IDs with ${withText ? 'combined text' : 'photos only'}`, () => {
      select();
      fixture.componentInstance.publish();
      http.expectNone((r) => r.url.endsWith('/contributions'));
      completeUpload();
      if (withText) fixture.componentInstance.content.setValue('Additional public information.');
      fixture.componentInstance.publish();
      const request = http.expectOne(`${base}/cases/case-1/contributions`);
      expect(request.request.body.photo_ids).toEqual(['attachment-id']);
      request.flush({ id: 'published' });
      expect(fixture.componentInstance.entries()).toHaveLength(0);
    });
  }
  it('does not publish rejected or unfinished photos', () => {
    select();
    completeUpload('rejected');
    fixture.componentInstance.publish();
    http.expectNone((r) => r.url.endsWith('/contributions'));
    expect(fixture.componentInstance.filesReady()).toBe(false);
  });
  it('retries a failed upload without creating a contribution', () => {
    select();
    http
      .expectOne(`${base}/cases/case-1/claim-photos/presign`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.componentInstance.upload(fixture.componentInstance.entries()[0].key);
    completeUpload();
    http.expectNone((r) => r.url.endsWith('/contributions'));
    expect(fixture.componentInstance.filesReady()).toBe(true);
  });
  it('rejects unsupported/oversized photos and duplicate selections', () => {
    select([new File(['gif'], 'bad.gif', { type: 'image/gif' })]);
    expect(fixture.componentInstance.entries()).toHaveLength(0);
    select([new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })]);
    expect(fixture.componentInstance.entries()).toHaveLength(0);
    const same = file();
    select([same, same]);
    expect(fixture.componentInstance.entries()).toHaveLength(0);
    http.expectNone((r) => r.method === 'POST');
  });
  it('refreshes permissions on 403 and blocks publication after revocation', async () => {
    const refresh = vi.fn();
    fixture.componentInstance.permissionFailure.subscribe(refresh);
    fixture.componentInstance.content.setValue('Keep this draft after access changes.');
    fixture.componentInstance.publish();
    http
      .expectOne(`${base}/cases/case-1/contributions`)
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(refresh).toHaveBeenCalled();
    fixture.componentRef.setInput('allowed', false);
    await fixture.whenStable();
    fixture.componentInstance.publish();
    http.expectNone((r) => r.method === 'POST');
    expect(fixture.componentInstance.content.value).toContain('Keep this draft');
  });
});

describe('Staff review restrictions', () => {
  let fixture: ComponentFixture<CaseClaimsAdminComponent>;
  let http: HttpTestingController;
  const admin = { ...user, id: 'admin-1', role: 'ADMINISTRATOR' };
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CaseClaimsAdminComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AccountManagementService,
          useValue: { currentUser$: new BehaviorSubject(admin), isAuthenticated: () => true },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaseClaimsAdminComponent);
    await fixture.whenStable();
    http
      .expectOne(`${base}/admin/case-claims?status=PENDING&page=1&page_size=20`)
      .flush(page([claim()]));
    http
      .expectOne('http://localhost:8000/api/v1/missing-persons/case-1')
      .flush({ _id: 'case-1', summary: { fullName: 'Jane Doe' } });
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
  });
  it('shows the missing person name and opens the case in a separate tab', async () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('article h2')?.textContent).toBe('Jane Doe');
    const link = root.querySelector<HTMLAnchorElement>('a[href="/missing-persons/case-1"]')!;
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.getAttribute('aria-label')).toContain('opens in a new tab');
    fixture.componentInstance.select(fixture.componentInstance.queue()!.items[0]);
    await fixture.whenStable();
    expect(root.querySelector('#review-title')?.textContent).toContain('Jane Doe');
  });

  it('requires notes, independent verification and an allowed transition', () => {
    fixture.componentInstance.select(claim());
    fixture.componentInstance.review();
    http.expectNone((r) => r.method === 'PATCH');
    fixture.componentInstance.form.controls.review_notes.setValue(
      'Agency independently confirmed relationship.',
    );
    fixture.componentInstance.review();
    http.expectNone((r) => r.method === 'PATCH');
    fixture.componentInstance.form.controls.verified.setValue(true);
    fixture.componentInstance.review();
    const request = http.expectOne(`${base}/admin/case-claims/claim-1`);
    expect(request.request.body.status).toBe('APPROVED');
    request.flush({});
    http.expectOne(`${base}/admin/case-claims?status=PENDING&page=1&page_size=20`).flush(page([]));
  });
  it('requires a fresh selection after a concurrent review conflict and retains notes', () => {
    fixture.componentInstance.select(claim());
    fixture.componentInstance.form.patchValue({
      review_notes: 'Agency independently confirmed relationship.',
      verified: true,
    });
    fixture.componentInstance.review();
    http
      .expectOne(`${base}/admin/case-claims/claim-1`)
      .flush({}, { status: 409, statusText: 'Conflict' });
    http.expectOne(`${base}/admin/case-claims?status=PENDING&page=1&page_size=20`).flush(page([]));
    fixture.componentInstance.review();
    http.expectNone((request) => request.method === 'PATCH');
    expect(fixture.componentInstance.form.controls.review_notes.value).toBe(
      'Agency independently confirmed relationship.',
    );
    fixture.componentInstance.select(claim('APPROVED'));
    expect(fixture.componentInstance.form.controls.status.value).toBe('REVOKED');
    expect(fixture.componentInstance.form.controls.review_notes.value).toBe(
      'Agency independently confirmed relationship.',
    );
  });

  it('never allows an administrator to review their own claim', () => {
    fixture.componentInstance.select({ ...claim(), user_id: admin.id });
    expect(fixture.componentInstance.selected()).toBeNull();
    http.expectNone((r) => r.method === 'PATCH');
  });
  it('matches exactly the backend status transitions', () => {
    expect(TRANSITIONS).toEqual({
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['REVOKED'],
      REJECTED: ['APPROVED'],
      REVOKED: ['APPROVED'],
    });
  });
  it('uses trusted roles in the route guard and rejects external return URLs', () => {
    expect(
      TestBed.runInInjectionContext(() =>
        caseClaimsAdminGuard(
          {} as ActivatedRouteSnapshot,
          { url: '/admin/case-claims' } as RouterStateSnapshot,
        ),
      ),
    ).toBe(true);
    for (const url of ['https://evil.example', '//evil.example', '/\\evil.example', '/login'])
      expect(safeReturnUrl(url)).toBeNull();
    expect(safeReturnUrl('/missing-persons/case%2Fid#case-claims')).toBe(
      '/missing-persons/case%2Fid#case-claims',
    );
  });
});

describe('Public contribution feed', () => {
  let fixture: ComponentFixture<CaseContributionsComponent>;
  let http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CaseContributionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CaseContributionsComponent);
    fixture.componentRef.setInput('caseId', 'case-1');
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
  });
  it('renders public text safely, labels verified relationships and paginates', async () => {
    const first = http.expectOne(`${base}/cases/case-1/contributions?page=1&page_size=20`);
    expect(first.request.withCredentials).toBe(false);
    first.flush(
      page(
        [
          {
            id: 'contribution-1',
            user_id: 'member-1',
            relationship: 'FAMILY' as const,
            content: '<img src=x onerror=alert(1)>',
            created_at: '2026-10-31T12:00:00Z',
            photos: [],
          },
        ],
        21,
      ),
    );
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Provided by a verified claimant');
    expect(root.querySelector('.content')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(root.querySelector('.content img')).toBeNull();
    fixture.componentInstance.load(2);
    http.expectOne(`${base}/cases/case-1/contributions?page=2&page_size=20`).flush(page([], 21, 2));
    expect(fixture.componentInstance.page()).toBe(2);
  });
  it('refreshes signed image links and distinguishes errors from empty contributions', async () => {
    http
      .expectOne(`${base}/cases/case-1/contributions?page=1&page_size=20`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Retry contributions');
    fixture.componentInstance.load(1);
    http.expectOne(`${base}/cases/case-1/contributions?page=1&page_size=20`).flush(page([]));
    fixture.componentRef.setInput('refresh', 1);
    await fixture.whenStable();
    http.expectOne(`${base}/cases/case-1/contributions?page=1&page_size=20`).flush(page([]));
    expect(fixture.componentInstance.error()).toBe('');
  });
});

for (const status of [401, 403, 404, 409, 413, 422, 429, 503]) {
  it(`provides useful claim errors for HTTP ${status}`, () => {
    expect(claimError(new HttpErrorResponse({ status }))).not.toBe('');
  });
}
