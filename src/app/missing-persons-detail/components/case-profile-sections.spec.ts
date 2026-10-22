import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatExpansionPanel } from '@angular/material/expansion';
import { MatDialog } from '@angular/material/dialog';
import { CaseProfileSections } from './case-profile-sections';

const sample = {
  _id: 'case-1',
  summary: { fullName: 'Example Person' },
  demographics: {
    missingAge: 0,
    dateOfBirth: '2000-01-01',
    heightInches: 74,
    weight: { value: 8, unit: null },
  },
  circumstances: {
    lastKnownLocation: { location: 'ROWAN, NC', missingFromTribalLand: false },
    circumstancesOfDisappearance: 'A long source narrative.',
  },
  clothingAndAccessories: {
    items: [{ shirt: 'Example top', footwear: 'Example footwear' }, { accessories: 'Example hat' }],
  },
  transportation: {
    vehicles: [{ make: 'Example make', color: 'Example color' }, { transportationType: 'Walking' }],
  },
  contacts: {
    investigatingAgencies: [
      {
        agencyName: 'Public agency',
        agencyPhone: '(704) 638-5333',
        agencyEmail: 'agency@example.com',
      },
    ],
  },
  _source: { image_urls: ['https://example.com/case.jpg'] },
  // Unknown or restricted media/contact shapes must not leak into the public UI.
  imagesAndDocuments: {
    documents: [
      { privateUrl: 'https://example.com/private.pdf', restricted: true },
      {
        url: 'https://example.com/sample-public.pdf',
        name: 'Sample public document',
        fileType: 'PDF',
        isPublic: true,
      },
    ],
  },
  contactsPrivate: 'Do not display this',
};

describe('Case profile sections', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [CaseProfileSections] }));
  it('renders seven sections, with the first two expanded and the rest collapsed', async () => {
    const fixture = TestBed.createComponent(CaseProfileSections);
    fixture.componentRef.setInput('record', sample);
    await fixture.whenStable();
    const panels = fixture.debugElement
      .queryAll(By.directive(MatExpansionPanel))
      .map((node) => node.componentInstance as MatExpansionPanel);
    expect(panels).toHaveLength(7);
    expect(panels.map((panel) => panel.expanded)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    buttons.find((button) => button.textContent?.includes('Expand All'))!.click();
    await fixture.whenStable();
    expect(panels.every((panel) => panel.expanded)).toBe(true);
    buttons.find((button) => button.textContent?.includes('Collapse All'))!.click();
    await fixture.whenStable();
    expect(panels.every((panel) => !panel.expanded)).toBe(true);
  });

  it('shows zero/false, source arrays, valid links and no edit controls or private data', async () => {
    const fixture = TestBed.createComponent(CaseProfileSections);
    fixture.componentRef.setInput('record', sample);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('0');
    expect(root.textContent).toContain('No');
    expect(root.textContent).toContain('unit not provided');
    expect(root.textContent).toContain('Example top');
    expect(root.textContent).toContain('Example make');
    expect(root.querySelector('a[href="tel:7046385333"]')).toBeTruthy();
    expect(root.querySelector('a[href="mailto:agency@example.com"]')).toBeTruthy();
    expect(root.querySelector('a[target="_blank"]')?.getAttribute('href')).toContain(
      'google.com/maps',
    );
    expect(root.querySelectorAll('input,textarea,select')).toHaveLength(0);
    expect(root.textContent).not.toContain('Do not display this');
    expect(root.querySelector('a[href*="private.pdf"]')).toBeNull();
    expect(root.querySelector('a[href*="sample-public.pdf"]')?.textContent).toContain(
      'View Document',
    );
  });

  it('opens an image preview and replaces broken thumbnails with the shared placeholder', async () => {
    const fixture = TestBed.createComponent(CaseProfileSections);
    fixture.componentRef.setInput('record', sample);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.image-preview')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    TestBed.inject(MatDialog).closeAll();
    root.querySelector('.image-preview img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(root.querySelector('.image-preview img')?.getAttribute('src')).toBe(
      '/missing-person-placeholder.svg',
    );
    expect(root.querySelector<HTMLButtonElement>('.image-preview')?.disabled).toBe(true);
  });

  it('never renders nested private contact records and links allowed public contact fields', async () => {
    const fixture = TestBed.createComponent(CaseProfileSections);
    fixture.componentRef.setInput('record', {
      _id: 'public',
      contacts: {
        additionalPublicContacts: [
          {
            isPublic: true,
            name: 'Public desk',
            phone: '7046385333',
            email: 'desk@example.com',
            privateContact: { isRestricted: true, email: 'private@example.com' },
          },
        ],
      },
    });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('private@example.com');
    expect(root.textContent).toContain('Public desk');
    expect(root.querySelector('a[href="tel:7046385333"]')).toBeTruthy();
    expect(root.querySelector('a[href="mailto:desk@example.com"]')).toBeTruthy();
  });

  it('shows empty states for incomplete records', async () => {
    const fixture = TestBed.createComponent(CaseProfileSections);
    fixture.componentRef.setInput('record', { _id: 'empty' });
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Not provided');
    expect(root.textContent).toContain('Unknown');
    expect(root.textContent).toContain('No transportation information available.');
    expect(root.textContent).toContain('No public images or documents available.');
  });
});
