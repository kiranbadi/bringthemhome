import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a single broad search field', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = Array.from(compiled.querySelectorAll('mat-label')).map((label) =>
      label.textContent?.trim(),
    );

    expect(labels).toContain('Search missing persons');
    expect(labels).not.toEqual(expect.arrayContaining(['Full Name', 'Zipcode', 'City', 'State']));
  });

  it('should render missing person cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.person-card').length).toBe(8);
    expect(compiled.textContent).toContain('Ava Johnson');
    expect(compiled.textContent).toContain('Last seen Jan 14, 2026');
  });

  it('should render paginator for the static data source', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('mat-paginator')).toBeTruthy();
    expect(compiled.textContent).not.toContain('Showing 12 missing persons.');
  });
});
