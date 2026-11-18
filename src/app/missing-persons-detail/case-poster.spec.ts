import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { PDFDocument } from 'pdf-lib';
import { CasePosterDialog } from './case-poster-dialog';
import { posterData, posterPdf } from './case-poster';

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4XcAAAAASUVORK5CYII=';

describe('Case posters', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps the public API fields and preserves zero ages', () => {
    const record = {
      _id: 'case-1', full_name: 'JANE DOE', age_when_missing: 0, current_age: 2,
      height: "5'6''", weight: '120', 'eye color': 'Brown', 'hair color': 'Black',
      agency: 'Example Police', 'agency phone': '555-0100', missing_since: '2024-01-01',
      missing_from_city: 'Raleigh', missing_from_state: 'NC',
    };
    const data = posterData(record, 'javascript:alert(1)', 'https://www.missinglives.com');
    expect(data.name).toBe('Jane Doe');
    expect(data.missingAge).toBe('0');
    expect(data.currentAge).toBe('2');
    expect(data.phone).toBe('555-0100');
    expect(data.lastSeen).toContain('2024-01-01');
    expect(data.caseUrl).toBe('https://www.missinglives.com/missing-persons/case-1');
    expect(data.imageUrl).toBeNull();
    expect(record.full_name).toBe('JANE DOE');
  });

  it('creates a single US Letter PDF from the poster image', async () => {
    const bytes = await posterPdf(pixel);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });

  it('requires acknowledgement before exporting a poster with a missing photo or phone', async () => {
    vi.spyOn(CasePosterDialog.prototype, 'prepare').mockResolvedValue(undefined);
    const data = posterData({ _id: 'case-1', full_name: 'JANE DOE' }, null, 'https://www.missinglives.com');
    TestBed.configureTestingModule({
      imports: [CasePosterDialog],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
    });
    const fixture = TestBed.createComponent(CasePosterDialog);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.image.set(pixel);
    component.photoMissing.set(true);
    await fixture.whenStable();
    expect(component.ready()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('no public police contact number');
    const checkbox = fixture.debugElement.query(By.css('mat-checkbox'));
    checkbox.triggerEventHandler('change', { checked: true });
    await fixture.whenStable();
    expect(component.ready()).toBe(true);
  });
});
