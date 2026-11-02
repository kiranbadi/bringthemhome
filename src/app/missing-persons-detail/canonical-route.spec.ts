import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MissingPersonsDetailComponent } from './missing-persons-detail.component';
describe('Canonical case navigation', () => {
  it('loads by the unchanged ID and replaces a legacy route with the backend canonical path', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'missing-persons/:slug/:id', component: MissingPersonsDetailComponent },
          { path: 'missing-persons/:id', component: MissingPersonsDetailComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/missing-persons/case-1');
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('http://localhost:8000/api/v1/missing-persons/case-1')
      .flush({
        _id: 'case-1',
        full_name: 'JANE DOE',
        canonical_path: '/missing-persons/jane-doe-nc/case-1',
      });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/missing-persons/jane-doe-nc/case-1');
    // Moving between the two route declarations may create a fresh component.
    for (const request of http.match('http://localhost:8000/api/v1/missing-persons/case-1'))
      request.flush({
        _id: 'case-1',
        full_name: 'JANE DOE',
        canonical_path: '/missing-persons/jane-doe-nc/case-1',
      });
    await harness.fixture.whenStable();
    expect(document.title).toContain('Jane Doe');
    harness.fixture.destroy();
    for (const request of http.match(() => true))
      if (!request.cancelled) request.flush({ items: [], total: 0 });
    http.verify();
  });
});
