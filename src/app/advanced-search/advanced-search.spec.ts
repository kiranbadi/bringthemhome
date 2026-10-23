import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AdvancedSearch } from './advanced-search';

describe('AdvancedSearch', () => {
  let component: AdvancedSearch;
  let fixture: ComponentFixture<AdvancedSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdvancedSearch],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdvancedSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the advanced search controls', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Search Criteria');
    expect(compiled.textContent).toContain('Selected Criteria');
    expect(compiled.textContent).toContain('Sort By');
    expect(compiled.textContent).toContain('Most Recent');
  });
  it('submits backend filter names and explicit age bounds to the gallery', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const controls = fixture.nativeElement as HTMLElement;
    const set = (name: string, value: string) => {
      const input = controls.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('firstName', ' Jane ');
    set('ageMissingMin', '10');
    set('ageMissingMax', '18');
    controls
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(navigate).toHaveBeenCalledWith(['/missing-persons'], {
      queryParams: {
        search: 'true',
        page: 1,
        page_size: 20,
        first_name: 'Jane',
        age_missing_min: '10',
        age_missing_max: '18',
        sort_by: 'most_recent',
      },
    });
  });

  it('prevents submission of reversed date ranges', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const element = fixture.nativeElement as HTMLElement;
    for (const [id, value] of [
      ['reported-start-date', '2026-10-23'],
      ['reported-end-date', '2026-01-01'],
    ]) {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    element
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(navigate).not.toHaveBeenCalled();
  });
});
