import { BehaviorSubject } from 'rxjs';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SubmitTipComponent } from '../components/submit-tip/submit-tip.component';
import { vi } from 'vitest';
import { MissingPersonsGalleryComponent } from './missing-persons-gallery.component';

describe('MissingPersonsGalleryComponent', () => {
  let fixture: ComponentFixture<MissingPersonsGalleryComponent>;
  let http: HttpTestingController;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const endpoint = 'http://localhost:8000/api/v1/missing-persons';
  const record = {
    _id: 'case-1',
    full_name: 'JANE DOE',
    city: null,
    location: 'Mecklenburg County',
    state: 'NC',
    'date reported': '2026-07-26',
    embedded_images: { data_urls: [] as string[] },
  };
  const page = (current = 1, records = [record]) => ({
    total_records: 21,
    total_pages: 2,
    current_page: current,
    page_size: 20,
    next_page: current === 1 ? 2 : null,
    previous_page: current === 1 ? null : 1,
    records,
  });
  const element = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(element().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
  const request = (number = 1) =>
    http.expectOne(
      (r) =>
        r.url === endpoint &&
        r.params.get('page') === String(number) &&
        r.params.get('page_size') === '20',
    );

  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [MissingPersonsGalleryComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MissingPersonsGalleryComponent);
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('loads page one, renders nullable location and placeholder, and links the real case identity', async () => {
    expect(element().textContent).toContain('Loading');
    request().flush(page());
    await fixture.whenStable();
    expect(element().textContent).toContain('Jane Doe');
    expect(element().textContent).toContain('Mecklenburg County, NC');
    expect(element().querySelector('img')?.getAttribute('src')).toContain(
      'missing-person-placeholder.svg',
    );
    expect(element().querySelector('a.details-link')?.getAttribute('href')).toBe(
      '/missing-persons/case-1',
    );
    expect(element().querySelector('button.tip-link')).toBeTruthy();
    expect(button('Previous').disabled).toBe(true);
  });

  it('opens the shared tip modal with full case details without navigating', async () => {
    request().flush(page());
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    element().querySelector<HTMLButtonElement>('.tip-link')!.click();
    const detail = {
      ...record,
      contacts: { investigatingAgencies: [{ agencyName: 'Police', agencyPhone: '5551234567' }] },
    };
    http.expectOne(`${endpoint}/case-1`).flush(detail);
    await fixture.whenStable();
    await vi.waitFor(() => expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1));
    const dialog = TestBed.inject(MatDialog).openDialogs[0];
    expect(dialog.componentInstance).toBeInstanceOf(SubmitTipComponent);
    expect(dialog.componentInstance.record).toEqual(detail);
    expect(navigate).not.toHaveBeenCalled();
    TestBed.inject(MatDialog).closeAll();
  });
  it('shows a retryable error when tip case details cannot load', async () => {
    request().flush(page());
    await fixture.whenStable();
    element().querySelector<HTMLButtonElement>('.tip-link')!.click();
    http.expectOne(`${endpoint}/case-1`).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(element().textContent).toContain('The tip form could not be opened');
    expect(element().querySelector<HTMLButtonElement>('.tip-link')!.disabled).toBe(false);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });

  it('uses server page metadata for next and previous requests and prevents out-of-range jumps', async () => {
    request().flush(page());
    await fixture.whenStable();
    button('Next').click();
    await fixture.whenStable();
    expect(button('Next').disabled).toBe(true);
    request(2).flush(page(2));
    await fixture.whenStable();
    expect(element().textContent).toContain('Page 2 of 2 (Total Records: 21)');
    expect(button('Next').disabled).toBe(true);
    const jump = element().querySelector<HTMLInputElement>('input[type="number"]')!;
    jump.value = '3';
    button('Go').click();
    http.expectNone((r) => r.url === endpoint);
    button('Previous').click();
    await fixture.whenStable();
    request().flush(page());
  });

  it('shows a retry action after a failed request and recovers to an empty state', async () => {
    request().flush('offline', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(element().querySelector('[role="alert"]')?.textContent).toContain('could not load');
    button('Try again').click();
    await fixture.whenStable();
    request().flush({ ...page(1, []), total_records: 0, total_pages: 0, next_page: null });
    await fixture.whenStable();
    expect(element().textContent).toContain('No missing persons');
    expect(element().querySelector('nav.pagination')).toBeNull();
  });

  it('replaces broken images and tolerates invalid dates and absent demographics', async () => {
    request().flush(
      page(1, [
        {
          ...record,
          'date reported': 'invalid',
          embedded_images: { data_urls: ['data:image/png;base64,broken'] },
        },
      ]),
    );
    await fixture.whenStable();
    element().querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(element().querySelector('img')?.getAttribute('src')).toContain(
      'missing-person-placeholder.svg',
    );
    expect(element().textContent).toContain('Date unavailable');
    expect(element().textContent).not.toContain('undefined');
  });

  it('renders search records and retains filters when paging with detail links by id', async () => {
    request().flush(page());
    queryParams.next(
      convertToParamMap({ search: 'true', state: 'NC', photo_available: 'false', page: '1' }),
    );
    const searchRequest = http.expectOne((r) => r.url === `${endpoint}/search`);
    expect(searchRequest.request.params.get('state')).toBe('NC');
    expect(searchRequest.request.params.get('photo_available')).toBe('false');
    searchRequest.flush({
      ...page(),
      records: [
        {
          _id: 'search-id',
          full_name: 'JANE DOE',
          photo_url: null,
          reported_at: '2026-07-19',
          missing_since: null,
          age_when_missing: 0,
          current_age: 14,
          sex: 'Female',
          race: 'White',
          missing_from_city: null,
          missing_from_state: 'NC',
        },
      ],
    });
    await fixture.whenStable();
    expect(element().textContent).toContain('Search results');
    expect(element().textContent).toContain('Age missing: 0');
    expect(element().textContent).toContain('Age now: 14');
    expect(element().textContent).toContain('Female');
    expect(element().textContent).toContain('NC');
    expect(element().querySelector('a.details-link')?.getAttribute('href')).toBe(
      '/missing-persons/search-id',
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    button('Next').click();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: 2 }, queryParamsHandling: 'merge' }),
    );
    queryParams.next(
      convertToParamMap({ search: 'true', state: 'NC', photo_available: 'false', page: '2' }),
    );
    const next = http.expectOne(
      (r) => r.url === `${endpoint}/search` && r.params.get('page') === '2',
    );
    expect(next.request.params.get('state')).toBe('NC');
    next.flush(page(2));
  });

  it('shares through the Web Share API and copies the case link when sharing fails', async () => {
    request().flush(page());
    await fixture.whenStable();
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      await fixture.componentInstance.share(record);
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'JANE DOE',
          url: expect.stringMatching(/\/missing-persons\/case-1$/),
        }),
      );
      expect(writeText).not.toHaveBeenCalled();
      share.mockRejectedValue(new Error('Unavailable'));
      await fixture.componentInstance.share(record);
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/missing-persons\/case-1$/));
      await fixture.whenStable();
      expect(element().querySelector('[role="status"]')?.textContent).toContain('copied');
      share.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
      writeText.mockClear();
      await fixture.componentInstance.share(record);
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, 'share');
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
