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

    expect(compiled.textContent).toContain('Search Missing Children Posters');
    expect(compiled.textContent).toContain('Refine:');
    expect(compiled.textContent).toContain('Search Near Me');
  });
});
