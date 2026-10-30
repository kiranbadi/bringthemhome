import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { SearchableSelectComponent } from './searchable-select.component';
import { ResourceLocationsComponent } from './resource-locations.component';
import { resourceForm } from './resource-form';
describe('Cascading resource locations', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('keeps child selectors disabled until their parents are selected', () => {
    const f = TestBed.createComponent(ResourceLocationsComponent);
    f.componentRef.setInput('form', resourceForm());
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/locations/states'))
      .flush([{ id: '36', name: 'New York' }]);
    f.detectChanges();
    const controls = f.debugElement
      .queryAll(By.directive(SearchableSelectComponent))
      .map((x) => x.componentInstance as SearchableSelectComponent);
    expect(controls[1].text.disabled).toBe(true);
    expect(controls[2].text.disabled).toBe(true);
  });
  it('expands territory and military codes in dropdown labels while preserving IDs', () => {
    const f = TestBed.createComponent(ResourceLocationsComponent);
    f.componentRef.setInput('form', resourceForm());
    f.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne((req) => req.url.endsWith('/locations/states'))
      .flush([
        { id: '66', name: 'GU' },
        { id: 'AA', name: 'AA' },
      ]);
    f.detectChanges();
    const selector = f.debugElement.query(By.directive(SearchableSelectComponent))
      .componentInstance as SearchableSelectComponent;
    expect(selector.options()).toEqual([
      { id: '66', name: 'Guam' },
      { id: 'AA', name: 'Armed Forces Americas' },
    ]);
  });
  it('clears descendants and cancels stale county requests after a state change', () => {
    const f = TestBed.createComponent(ResourceLocationsComponent);
    const form = resourceForm();
    f.componentRef.setInput('form', form);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((req) => req.url.endsWith('/locations/states'))
      .flush([
        { id: '36', name: 'New York' },
        { id: '06', name: 'California' },
      ]);
    form.patchValue({ state: '36' });
    const stale = http.expectOne((req) => req.url.endsWith('/locations/counties'));
    form.patchValue({ state: '06' });
    f.componentInstance.stateChanged();
    expect(stale.cancelled).toBe(true);
    expect(form.controls.county.value).toBe('');
    expect(form.controls.city.value).toBe('');
    http
      .expectOne((req) => req.url.endsWith('/locations/counties'))
      .flush([{ id: '06001', name: 'Alameda County' }]);
    expect(f.componentInstance.counties()[0].id).toBe('06001');
  });
});
