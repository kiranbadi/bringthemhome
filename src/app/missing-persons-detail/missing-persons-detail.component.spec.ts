import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { SubmitTipComponent } from '../components/submit-tip/submit-tip.component';
import { MissingPersonsDetailComponent } from './missing-persons-detail.component';

const endpoint = 'http://localhost:8000/api/v1/missing-persons/abc-123';

describe('MissingPersonsDetailComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MissingPersonsDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'abc-123' })),
            queryParamMap: of(convertToParamMap({ page: '2' })),
          },
        },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads one detail response for summary and all seven sections and preserves Submit Tip', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    request.flush({
      _id: 'abc-123',
      summary: {
        fullName: 'JANE DOE',
        lastKnownLocation: 'ROWAN, NC',
        reportingAgency: 'County Police',
        dateReported: '2017-02-14',
      },
      demographics: { missingAge: 0, currentAge: 7 },
    });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Jane Doe');
    expect(root.textContent).toContain('County Police');
    expect(root.querySelectorAll('mat-expansion-panel')).toHaveLength(7);
    (root.querySelector('.tip-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1));
    const dialog = TestBed.inject(MatDialog).openDialogs[0];
    expect(dialog.componentInstance).toBeInstanceOf(SubmitTipComponent);
    expect(dialog.componentInstance.record._id).toBe('abc-123');
    expect(dialog.componentInstance.fullName).toBe('JANE DOE');
    dialog.close();
    expect(root.textContent).toContain('Unknown');
    http.expectNone((request) => request.url.endsWith('/api/v1/missing-persons'));
  });

  it('supports the confirmed flat response without extra requests', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush({
      _id: 'abc-123',
      full_name: 'LEGACY PERSON',
      agency: 'Legacy Agency',
      'hair color': 'Brown',
      'age missing': '0',
    });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Legacy Person');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Legacy Agency');
  });

  it('tries all distinct embedded photos before the placeholder and resets on reload', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    const primary = 'https://example.com/broken.jpg';
    const first = 'data:image/png;base64,AAAA';
    const second = 'data:image/jpeg;base64,BBBB';
    http.expectOne(endpoint).flush({
      _id: 'abc-123',
      summary: { primaryImageUrl: primary },
      embedded_images: { data_urls: ['invalid', first, second] },
      _source: { embedded_images: { data_urls: [first] } },
    });
    await fixture.whenStable();
    const image = fixture.nativeElement.querySelector('.person-summary > img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe(primary);
    for (const expected of [first, second, '/missing-person-placeholder.svg']) {
      image.dispatchEvent(new Event('error'));
      await fixture.whenStable();
      expect(image.getAttribute('src')).toBe(expected);
    }
    image.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(image.getAttribute('src')).toBe('/missing-person-placeholder.svg');
    fixture.componentInstance.retry();
    http.expectOne(endpoint).flush({
      _id: 'abc-123', embedded_images: { data_urls: [first] },
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.person-summary > img').getAttribute('src')).toBe(first);
  });

  it('preserves the unavailable state on 404', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Case unavailable');
  });

  it('preserves error and retry behavior', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(endpoint).flush({}, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')).toBeTruthy();
    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Try again'))!
      .click();
    http.expectOne(endpoint).flush({ _id: 'abc-123', full_name: 'Retry Person' });
    await fixture.whenStable();
    expect(root.textContent).toContain('Retry Person');
  });
  it('checks unsaved changes for Escape and backdrop dismissal', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({ _id: 'abc-123', full_name: 'Jane Doe' });
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.tip-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1));
    const dialog = TestBed.inject(MatDialog).openDialogs[0];
    const component = dialog.componentInstance as SubmitTipComponent;
    component.choose('STANDARD');
    component.form.controls.description.setValue('Relevant information');
    component.form.markAsDirty();
    document
      .querySelector('mat-dialog-container')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(component.discardPrompt()).toBe(true);
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    component.discardPrompt.set(false);
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await fixture.whenStable();
    expect(component.discardPrompt()).toBe(true);
    const closed = firstValueFrom(dialog.afterClosed());
    component.confirmDiscard();
    await closed;
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(0);
  });
  it('does not open a case dialog after leaving the detail page while the chunk loads', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne(endpoint).flush({ _id: 'abc-123' });
    await fixture.whenStable();
    const dialogs = TestBed.inject(MatDialog);
    const pending = fixture.componentInstance.openSubmitTip({ _id: 'abc-123' });
    fixture.destroy();
    await pending;
    expect(dialogs.openDialogs).toHaveLength(0);
  });
});
