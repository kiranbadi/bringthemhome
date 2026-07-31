import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
});
