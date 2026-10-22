import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { MissingPersonsGalleryComponent } from './missing-persons-gallery.component';

describe('MissingPersonsGalleryComponent', () => {
  let fixture: ComponentFixture<MissingPersonsGalleryComponent>;
  let http: HttpTestingController;
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
    await TestBed.configureTestingModule({
      imports: [MissingPersonsGalleryComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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
    expect(element().querySelector('a.tip-link')?.getAttribute('href')).toContain(
      'personId=case-1',
    );
    expect(button('Previous').disabled).toBe(true);
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
