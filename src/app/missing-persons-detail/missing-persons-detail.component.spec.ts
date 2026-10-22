import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
    expect(root.querySelector('.tip-link')?.getAttribute('href')).toContain('personId=abc-123');
    expect(root.querySelector('.tip-link')?.getAttribute('href')).toContain('full_name=JANE%20DOE');
    expect(root.textContent).toContain('Unknown');
    http.expectNone((request) => request.url.endsWith('/api/v1/missing-persons'));
  });

  it('supports the confirmed flat response without extra requests', async () => {
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({
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
});
