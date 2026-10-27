import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

describe('Discussion navigation', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('preserves the case link and renders its board on a separate page', async () => {
    const harness = await RouterTestingHarness.create('/missing-persons/case-one/discussions');
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('http://localhost:8000/api/v1/missing-persons/case-one')
      .flush({ _id: 'case-one', summary: { fullName: 'Jane Doe' } });
    harness.detectChanges();
    await harness.fixture.whenStable();
    http
      .expectOne((r) => r.url.endsWith('/api/cases/case-one/discussions'))
      .flush({ items: [], total: 0, page: 1, page_size: 10 });
    harness.detectChanges();
    const root = harness.routeNativeElement!;
    expect(root.textContent).toContain('Community Discussions');
    expect(root.textContent).toContain('Submit a Confidential Tip');
    expect(root.querySelector('a[href="/missing-persons/case-one"]')?.textContent).toContain(
      'Jane Doe',
    );
    expect(root.querySelector('app-case-profile-sections')).toBeNull();
  });
});
