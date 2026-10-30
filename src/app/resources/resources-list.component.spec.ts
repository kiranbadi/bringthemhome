import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ResourceService } from './resource.service';
import { ResourcesListComponent } from './resources-list.component';
describe('Public case geography filtering', () => {
  it('resolves incomplete city ancestry before requesting the filtered directory', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ state: '36', city: '3651000' })) },
        },
      ],
    });
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const c = TestBed.createComponent(ResourcesListComponent).componentInstance;
    c.ngOnInit();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((req) => req.url.endsWith('/locations/resolve'))
      .flush({ state: '36', county: null, city: null });
    expect(nav).toHaveBeenCalledWith(['/resources'], {
      queryParams: {
        search: '',
        category: '',
        scope: '',
        state: '36',
        county: null,
        city: null,
        page: 1,
      },
      replaceUrl: true,
    });
    expect(c.locationNotice()).toContain('matched area');
    http.verify();
  });
});

describe('Resource directory empty state', () => {
  it('hides pagination when no resources are returned', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ],
    });
    const fixture = TestBed.createComponent(ResourcesListComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((req) => req.url.endsWith('/resources'))
      .flush({ items: [], total: 0, page: 1, page_size: 20 });
    http.expectOne((req) => req.url.endsWith('/locations/states')).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-paginator')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No resources match');
    http.match(() => true).forEach((req) => req.flush({}));
    http.verify();
  });
});

describe('Resource search with backend location identifiers', () => {
  it('reloads results when Search is clicked with unchanged filters', async () => {
    const api = {
      list: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, page_size: 20 })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: ResourceService, useValue: api },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(false);
    const component = TestBed.createComponent(ResourcesListComponent).componentInstance;
    component.ngOnInit();
    component.search();
    await Promise.resolve();
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('searches postal codes and named locations directly and clears loading', () => {
    const api = {
      list: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, page_size: 20 })),
      resolve: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: ResourceService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                category: 'FAMILY_SUPPORT',
                scope: 'CITY',
                state: 'NC',
                county: 'Wake County',
                city: 'Cary',
              }),
            ),
          },
        },
      ],
    });
    const component = TestBed.createComponent(ResourcesListComponent).componentInstance;
    component.ngOnInit();
    expect(api.resolve).not.toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledWith({
      search: '',
      category: 'FAMILY_SUPPORT',
      scope: 'CITY',
      state: 'NC',
      county: 'Wake County',
      city: 'Cary',
      page: 1,
    });
    expect(component.loading()).toBe(false);
    expect(component.filters.getRawValue().county).toBe('Wake County');
  });
});
