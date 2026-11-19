import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RelatedSitesAdminComponent } from './related-sites-admin.component';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AccountManagementService } from '../services/account-management';
import { ResourceService } from './resource.service';
import { ResourcesListComponent } from './resources-list.component';
import { RELATED_SITES_API, RelatedSitesService } from './related-sites.service';
import { environment } from '../../environments/environment';

describe('Related sites backend default', () => {
  it('sends add requests to the backend without a configuration override', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(RelatedSitesService);
    const http = TestBed.inject(HttpTestingController);
    expect(service.usesPlaceholder).toBe(false);
    const input = { name: 'Example', url: 'https://example.org' };
    service.create(input).subscribe();
    const request = http.expectOne(
      `${environment.apiUrl}${environment.apiBaseUrl}/api/admin/related-sites`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual(input);
    request.flush({ ...input, id: 'site-1' });
    http.verify();
  });
});

describe('Related sites visibility', () => {
  it('shows management only for admins and hides it when their role changes', async () => {
    const user = new BehaviorSubject<{ role: string } | null>(null);
    TestBed.configureTestingModule({
      imports: [ResourcesListComponent],
      providers: [
        {
          provide: RELATED_SITES_API,
          useValue: { url: '/api/admin/related-sites', usePlaceholder: true },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AccountManagementService,
          useValue: {
            currentUser$: user.asObservable(),
            isAuthenticated: () => user.value !== null,
          },
        },
        {
          provide: ResourceService,
          useValue: {
            list: () => of({ items: [], total: 0, page: 1 }),
            states: () => of([]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ResourcesListComponent);
    const root = fixture.nativeElement as HTMLElement;
    const api = vi.spyOn(TestBed.inject(RelatedSitesService), 'list');
    await fixture.whenStable();
    expect(root.querySelector('app-related-sites-admin')).toBeNull();
    api.mockClear();
    user.next({ role: 'USER' });
    await fixture.whenStable();
    expect(root.querySelector('app-related-sites-admin')).toBeNull();
    expect(api).not.toHaveBeenCalled();
    user.next({ role: 'ADMIN' });
    await fixture.whenStable();
    expect(root.querySelector('app-related-sites-admin')).toBeTruthy();
    expect(api).toHaveBeenCalledOnce();
    user.next(null);
    await fixture.whenStable();
    expect(root.querySelector('app-related-sites-admin')).toBeNull();
  });
});

describe('Related sites admin', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [RelatedSitesAdminComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RELATED_SITES_API,
          useValue: { url: '/api/admin/related-sites', usePlaceholder: true },
        },
      ],
    }),
  );

  it('adds, edits, and confirms deletion using the placeholder API', async () => {
    const fixture = TestBed.createComponent(RelatedSitesAdminComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    const launcher = fixture.nativeElement as HTMLElement;
    expect(launcher.querySelector('form')).toBeNull();
    launcher.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    const root = document.querySelector<HTMLElement>('mat-dialog-container')!;
    expect(root.querySelector('form')).toBeTruthy();
    component.form.setValue({
      name: ' Example site ',
      url: ' https://example.org ',
    });
    component.save();
    await fixture.whenStable();
    expect(component.sites()).toEqual([
      { id: 'site-1', name: 'Example site', url: 'https://example.org' },
    ]);
    root.querySelector<HTMLButtonElement>('[aria-label="Edit Example site"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector('li form')).toBeTruthy();
    component.form.patchValue({ name: 'Updated site' });
    component.save();
    await fixture.whenStable();
    expect(root.querySelector('.site-details strong')?.textContent).toBe('Updated site');
    root.querySelector<HTMLButtonElement>('[aria-label="Delete Updated site"]')!.click();
    await fixture.whenStable();
    expect(component.sites()).toHaveLength(1);
    const confirm = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirm delete'),
    )!;
    confirm.click();
    await fixture.whenStable();
    expect(component.sites()).toEqual([]);
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('opens the sites list from View related sites and closes it', async () => {
    const fixture = TestBed.createComponent(RelatedSitesAdminComponent);
    await fixture.whenStable();
    const launcher = fixture.nativeElement as HTMLElement;
    const view = Array.from(launcher.querySelectorAll('button')).find((button) =>
      /view related sites/i.test(button.textContent ?? ''),
    )!;
    view.click();
    await fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('mat-dialog-container')!;
    expect(dialog.textContent).toContain('No related sites added yet.');
    expect(dialog.querySelector('form')).toBeNull();
    dialog.querySelector<HTMLButtonElement>('[mat-dialog-close]')!.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.querySelector('mat-dialog-container')).toBeNull());
  });

  it('rejects blank names and unsafe website links', async () => {
    const fixture = TestBed.createComponent(RelatedSitesAdminComponent);
    await fixture.whenStable();
    for (const values of [
      { name: '  ', url: 'https://example.org' },
      { name: 'Example', url: 'javascript:alert(1)' },
    ]) {
      fixture.componentInstance.form.setValue(values);
      fixture.componentInstance.save();
      expect(fixture.componentInstance.form.invalid).toBe(true);
      expect(fixture.componentInstance.sites()).toEqual([]);
    }
  });

  it('paginates the list and returns to the previous page after deleting the last row', async () => {
    const fixture = TestBed.createComponent(RelatedSitesAdminComponent);
    const component = fixture.componentInstance;
    const api = TestBed.inject(RelatedSitesService);
    for (let index = 1; index <= 11; index++) {
      api.create({ name: `Site ${index}`, url: `https://example.org/${index}` }).subscribe();
    }
    await fixture.whenStable();
    const view = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((button) => /view related sites/i.test(button.textContent ?? ''))!;
    view.click();
    await fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('mat-dialog-container')!;
    expect(dialog.querySelectorAll('.site-details')).toHaveLength(10);
    dialog.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
    await fixture.whenStable();
    expect(dialog.querySelectorAll('.site-details')).toHaveLength(1);
    expect(dialog.querySelector('.site-details strong')?.textContent).toBe('Site 11');
    component.remove(component.visibleSites()[0]);
    await fixture.whenStable();
    expect(component.currentPage()).toBe(0);
    expect(dialog.querySelectorAll('.site-details')).toHaveLength(10);
    expect(dialog.querySelector('[aria-label="Next page"]')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('uses credentialed CRUD requests when the placeholder is disabled', () => {
    TestBed.overrideProvider(RELATED_SITES_API, {
      useValue: {
        url: '/bringthemhome/api/admin/related-sites',
        usePlaceholder: false,
      },
    });
    const service = TestBed.inject(RelatedSitesService);
    const http = TestBed.inject(HttpTestingController);
    const input = { name: 'Example', url: 'https://example.org' };
    service.list().subscribe();
    service.create(input).subscribe();
    service.update('site-1', input).subscribe();
    service.delete('site-1').subscribe();
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const request = http.expectOne((r) => r.method === method);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.url).toBe(
        '/bringthemhome/api/admin/related-sites' +
          (['PUT', 'DELETE'].includes(method) ? '/site-1' : ''),
      );
      if (['POST', 'PUT'].includes(method)) expect(request.request.body).toEqual(input);
      request.flush(
        method === 'GET' ? [] : method === 'DELETE' ? null : { ...input, id: 'site-1' },
      );
    }
    http.verify();
  });
});
