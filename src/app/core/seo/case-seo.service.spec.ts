import { TestBed } from '@angular/core/testing';
import { Title, Meta } from '@angular/platform-browser';
import { CaseSeoService, SITE_ORIGIN } from './case-seo.service';
import { PERSON_PLACEHOLDER } from '../models/missing-person-display';
describe('Public case SEO', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [{ provide: SITE_ORIGIN, useValue: 'https://bringthemhome.example' }],
    }),
  );
  afterEach(() => TestBed.inject(CaseSeoService).clear());
  it('uses backend canonical paths, unique metadata and safe public structured data', () => {
    const api = TestBed.inject(CaseSeoService);
    api.update(
      {
        _id: 'case-1',
        canonical_path: '/missing-persons/jane-doe/case-1',
        full_name: 'JANE DOE',
        missing_from_state: 'NC',
      },
      PERSON_PLACEHOLDER,
    );
    expect(TestBed.inject(Title).getTitle()).toContain('Jane Doe');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://bringthemhome.example/missing-persons/jane-doe/case-1',
    );
    expect(TestBed.inject(Meta).getTag('property="og:url"')?.content).toContain('/jane-doe/case-1');
    expect(
      JSON.parse(document.getElementById('case-structured-data')!.textContent!)['@graph'][0].about
        .name,
    ).toBe('Jane Doe');
    api.update(
      { _id: 'case-2', full_name: '</script><script>alert(1)</script>' },
      PERSON_PLACEHOLDER,
    );
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.getElementById('case-structured-data')!.textContent).not.toContain('</script>');
    expect(
      JSON.parse(document.getElementById('case-structured-data')!.textContent!)['@graph'][0].about
        .name,
    ).toContain('<');
    api.update({ _id: 'case-1', full_name: 'Jane Doe' }, 'data:image/png;base64,abc');
    expect(TestBed.inject(Meta).getTag('property="og:image"')).toBeNull();
    expect(TestBed.inject(Meta).getTag('name="twitter:card"')?.content).toBe('summary');
  });
  it('removes stale canonical and social metadata on errors and navigation', () => {
    const api = TestBed.inject(CaseSeoService);
    api.update({ _id: 'case-1', full_name: 'Jane Doe' }, PERSON_PLACEHOLDER);
    api.unavailable();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex,follow');
    api.clear();
    expect(TestBed.inject(Meta).getTag('property="og:url"')).toBeNull();
  });
});
