import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MissingPersonsDetailComponent } from './missing-persons-detail.component';

describe('MissingPersonsDetailComponent', () => {
  it('loads a shared case from its source API page using its string id', async () => {
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
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne((r) => r.params.get('page') === '2');
    req.flush({
      current_page: 2,
      total_pages: 2,
      total_records: 21,
      page_size: 20,
      next_page: null,
      previous_page: 1,
      records: [
        {
          _id: 'abc-123',
          full_name: 'JANE DOE',
          city: 'Charlotte',
          state: 'NC',
          agency: 'County Police',
        },
      ],
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Jane Doe');
    expect(element.textContent).toContain('County Police');
    expect(element.querySelector('.tip-link')?.getAttribute('href')).toContain('personId=abc-123');
    http.verify();
  });

  it('finds a direct link when the case is no longer on the hinted page', async () => {
    TestBed.configureTestingModule({
      imports: [MissingPersonsDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'moved-case' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MissingPersonsDetailComponent);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.params.get('page') === '1')
      .flush({ current_page: 1, total_pages: 2, total_records: 21, page_size: 20, records: [] });
    http
      .expectOne((r) => r.params.get('page') === '2')
      .flush({
        current_page: 2,
        total_pages: 2,
        total_records: 21,
        page_size: 20,
        records: [{ _id: 'moved-case', full_name: 'Found Person' }],
      });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Found Person');
    http.verify();
  });
});
