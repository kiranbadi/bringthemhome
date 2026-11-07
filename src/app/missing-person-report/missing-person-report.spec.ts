import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { MissingPersonReport } from './missing-person-report';
import { allowedReportActions, ReportWorkflow } from './report-workflow';
interface ReportHarness {
  detailsForm: FormGroup;
  mediaForm: FormGroup;
  aliases: FormArray;
  employmentHistory: FormArray;
  caseContacts: FormArray;
  possibleSightings: FormArray;
  addAlias(): void;
  addEmployment(): void;
  addContact(): void;
  addPossibleSighting(): void;
  removeContact(i: number): void;
  removeEmployment(i: number): void;
  buildReportPayload(): {
    media: unknown;
    missingPersonDetails: {
      identity: { aliases: string[] };
      physicalDescription: { raceEthnicityOther: string; hairColorOther: string };
      employmentHistory: unknown[];
      caseAndReporterContact: unknown[];
    };
  };
  requestAction(action: string): void;
  sectionState(i: number): string;
  sectionChanged(i: number): void;
}
const workflow = (
  status: ReportWorkflow['status'],
  person_status: ReportWorkflow['person_status'] = 'MISSING',
): ReportWorkflow => ({
  id: 'report-1',
  version: 1,
  updated_at: '2026-11-02T12:00:00Z',
  status,
  person_status,
});
describe('Report workspace', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [MissingPersonReport],
      providers: [provideRouter([]), provideHttpClient()],
    }),
  );
  function create() {
    const fixture = TestBed.createComponent(MissingPersonReport);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance as unknown as ReportHarness };
  }
  it.each([
    ['image', 'image/jpeg', 5 * 1024 * 1024, '5 MB'],
    ['video', 'video/mp4', 25 * 1024 * 1024, '25 MB'],
  ])('limits %s file sizes while keeping valid selections', async (kind, type, limit, label) => {
    const fixture = TestBed.createComponent(MissingPersonReport);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector(
      `input[accept="${kind}/*"]`,
    ) as HTMLInputElement;
    function select(files: File[]) {
      Object.defineProperty(input, 'files', { configurable: true, value: files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Override only size so boundary tests do not allocate large file buffers.
    function file(name: string, size: number) {
      const result = new File(['x'], name, { type });
      Object.defineProperty(result, 'size', { value: size });
      return result;
    }
    select([file('accepted', limit), file('too-large', limit + 1)]);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const media = component.getPayload().media;
    expect(kind === 'image' ? media.photos : media.videos).toHaveLength(1);
    expect(component.uploadFiles.size).toBe(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      `too-large exceeds the ${label} limit`,
    );
    expect(input.value).toBe('');
    select([file('another-valid', 1024)]);
    await fixture.whenStable();
    expect(component.uploadFiles.size).toBe(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('preserves aliases and every repeatable record in the payload', () => {
    const { page } = create();
    page.aliases.at(0).setValue(' Izzy ');
    page.addAlias();
    page.aliases.at(1).setValue('Moon');
    page.addEmployment();
    page.employmentHistory.at(0).patchValue({ currentEmployer: 'First' });
    page.employmentHistory.at(1).patchValue({ currentEmployer: 'Second' });
    page.addContact();
    page.caseContacts.at(1).patchValue({ reporterName: 'Second reporter' });
    page.detailsForm.patchValue({
      raceEthnicity: 'Other',
      raceEthnicityOther: 'Details',
      hairColor: 'Other',
      hairColorOther: 'Two tone',
    });
    const payload = page.buildReportPayload();
    expect(payload.missingPersonDetails.identity.aliases).toEqual(['Izzy', 'Moon']);
    expect(payload.missingPersonDetails.employmentHistory).toHaveLength(2);
    expect(payload.missingPersonDetails.caseAndReporterContact).toHaveLength(2);
    expect(payload.missingPersonDetails.physicalDescription.hairColorOther).toBe('Two tone');
    page.detailsForm.patchValue({ raceEthnicity: 'White', hairColor: 'Black' });
    expect(
      page.buildReportPayload().missingPersonDetails.physicalDescription.raceEthnicityOther,
    ).toBe('');
  });
  it('round-trips an editable draft with repeated fields and restores it read-only for review', () => {
    const { fixture, page } = create();
    page.detailsForm.patchValue({ firstName: 'Jane', lastName: 'Doe' });
    page.addEmployment();
    page.employmentHistory.at(1).patchValue({ currentEmployer: 'Second employer' });
    page.addContact();
    page.caseContacts.at(1).patchValue({
      reporterName: 'Second reporter',
      reporterPhone: '555',
      reporterEmail: 'second@example.com',
    });
    const payload = fixture.componentInstance.getPayload();
    fixture.componentInstance.loadPayload(payload);
    expect(fixture.componentInstance.getPayload()).toEqual(payload);
    fixture.componentRef.setInput('workflow', workflow('SUBMITTED'));
    fixture.detectChanges();
    fixture.componentInstance.loadPayload(payload);
    expect(page.detailsForm.disabled).toBe(true);
    expect(fixture.componentInstance.getPayload()).toEqual(payload);
  });

  it('highlights whitespace-only Other details and clears errors when another option is chosen', () => {
    const { page } = create();
    page.detailsForm.patchValue({
      raceEthnicity: 'Other',
      raceEthnicityOther: '   ',
      hairColor: 'Other',
      hairColorOther: '   ',
    });
    expect(page.detailsForm.get('raceEthnicityOther')!.hasError('required')).toBe(true);
    expect(page.detailsForm.get('hairColorOther')!.hasError('required')).toBe(true);
    page.detailsForm.patchValue({ raceEthnicity: 'White', hairColor: 'Black' });
    expect(page.detailsForm.get('raceEthnicityOther')!.valid).toBe(true);
    expect(page.detailsForm.get('hairColorOther')!.valid).toBe(true);
  });
  it('keeps found cases read-only even if an old draft revision remains', () => {
    const { fixture, page } = create();
    const found = { ...workflow('PUBLISHED', 'FOUND'), revision_status: 'DRAFT' as const };
    fixture.componentRef.setInput('workflow', found);
    fixture.detectChanges();
    expect(page.detailsForm.disabled).toBe(true);
    expect(allowedReportActions(found)).toEqual(['archive']);
  });

  it('preserves detailed circumstances and local event times across draft restoration', () => {
    const { fixture, page } = create();
    page.detailsForm.patchValue({
      lastSeenDate: '2026-11-01',
      lastSeenTime: '19:30',
      lastContactDate: '2026-11-01',
      lastContactTime: '20:15',
      timezone: 'America/New_York',
      classification: 'endangered_medical',
      streetAddress: '4200 Six Forks Rd',
      locationType: 'shopping_center',
      lastSeenWithName: 'Alex',
      lastSeenWithRelationship: 'coworker',
      lastSeenWithPhone: '919-555-0144',
      riskFactors: ['insulin_dependent', 'phone_powered_off'],
      additionalContext: 'Did not arrive home.',
      circumstances: 'Last seen after a shift.',
    });
    const items = page.detailsForm.get('itemsLeftBehind') as FormArray;
    items.at(0).patchValue({ item: 'Daily medication', details: 'At home' });
    const payload = fixture.componentInstance.getPayload();
    expect(payload.missingPersonDetails.lastSeen.time).toBe('19:30');
    expect(payload.missingPersonDetails.lastSeen.timezone).toBe('America/New_York');
    expect(payload.missingPersonDetails.lastSeen.lastContact).toEqual({
      date: '2026-11-01',
      time: '20:15',
    });
    expect(payload.missingPersonDetails.lastSeen.itemsLeftBehind).toEqual([
      { item: 'Daily medication', details: 'At home' },
    ]);
    fixture.componentInstance.loadPayload(payload);
    expect(fixture.componentInstance.getPayload()).toEqual(payload);
  });
  it('validates optional timezone and Other circumstances details', () => {
    const { fixture, page } = create();
    page.detailsForm.patchValue({
      timezone: 'Not/A_Timezone',
      locationType: 'other',
      locationTypeOther: '  ',
      riskFactors: ['other'],
      riskFactorsOther: '  ',
    });
    expect(page.detailsForm.get('timezone')!.hasError('timezone')).toBe(true);
    expect(page.detailsForm.get('locationTypeOther')!.hasError('required')).toBe(true);
    expect(page.detailsForm.get('riskFactorsOther')!.hasError('required')).toBe(true);
    page.detailsForm.patchValue({ timezone: '', locationType: 'unknown', riskFactors: [] });
    expect(page.detailsForm.get('timezone')!.valid).toBe(true);
    expect(page.detailsForm.get('locationTypeOther')!.valid).toBe(true);
    expect(
      fixture.componentInstance.getPayload().missingPersonDetails.lastSeen.riskFactorsOther,
    ).toBe('');
  });

  it('hides stale Other details from preview after switching to known options', () => {
    const { fixture, page } = create();
    page.detailsForm.patchValue({
      locationType: 'other',
      locationTypeOther: 'A unique location detail',
      riskFactors: ['other'],
      riskFactorsOther: 'A unique risk detail',
    });
    page.detailsForm.patchValue({ locationType: 'home', riskFactors: ['phone_powered_off'] });
    const preview = fixture.nativeElement.querySelectorAll(
      '.section-nav button',
    )[9] as HTMLButtonElement;
    preview.click();
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('.workspace-content').textContent as string;
    expect(summary).not.toContain('A unique location detail');
    expect(summary).not.toContain('A unique risk detail');
    expect(summary).toContain('Phone powered off or unreachable');
  });

  it('enforces all record limits in handlers and retains at least one record', () => {
    const { page } = create();
    for (let i = 0; i < 30; i++) {
      page.addEmployment();
      page.addPossibleSighting();
      page.addContact();
    }
    expect(page.employmentHistory.length).toBe(25);
    expect(page.possibleSightings.length).toBe(25);
    expect(page.caseContacts.length).toBe(10);
    for (let i = 0; i < 30; i++) {
      page.removeEmployment(0);
      page.removeContact(0);
    }
    expect(page.employmentHistory.length).toBe(1);
    expect(page.caseContacts.length).toBe(1);
  });
  it('never claims to save or submit while integration is unavailable', () => {
    const { fixture, page } = create();
    const emit = vi.spyOn(fixture.componentInstance.actionRequested, 'emit');
    page.requestAction('save');
    page.requestAction('submit');
    expect(emit).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('will not be saved');
  });
  it('makes submitted records read-only and exposes administrator feedback', () => {
    const { fixture, page } = create();
    fixture.componentRef.setInput('workflow', {
      ...workflow('REJECTED'),
      rejection_reason: 'Please clarify the location',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Please clarify the location');
    fixture.componentRef.setInput('workflow', workflow('SUBMITTED'));
    fixture.detectChanges();
    expect(page.detailsForm.disabled).toBe(true);
    const before = page.employmentHistory.length;
    page.addEmployment();
    expect(page.employmentHistory.length).toBe(before);
  });
  it('calculates readiness per section and supports jumping directly between sections', () => {
    const { fixture, page } = create();
    expect(page.sectionState(6)).toBe('Not started');
    page.detailsForm.patchValue({ firstName: 'Jane', lastName: 'Doe' });
    expect(page.sectionState(1)).toBe('Complete');
    expect(page.sectionState(8)).toBe('Not started');
    const button = fixture.nativeElement.querySelectorAll(
      '.section-nav button',
    )[5] as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-current')).toBe('step');
  });
});
describe('Server-authoritative report actions', () => {
  it('separates draft, review, revision, found confirmation and archive transitions', () => {
    expect(allowedReportActions(workflow('DRAFT'))).toEqual(['save', 'submit']);
    expect(allowedReportActions(workflow('SUBMITTED'))).toEqual([]);
    expect(allowedReportActions(workflow('SUBMITTED'), true)).toEqual(['approve', 'reject']);
    expect(allowedReportActions(workflow('PUBLISHED'))).toEqual(['revise', 'report-found']);
    expect(allowedReportActions({ ...workflow('PUBLISHED'), revision_status: 'DRAFT' })).toEqual([
      'save',
      'submit',
    ]);
    expect(allowedReportActions(workflow('PUBLISHED', 'FOUND_PENDING_REVIEW'), true)).toEqual([
      'confirm-found',
      'reject-found',
    ]);
    expect(allowedReportActions(workflow('PUBLISHED', 'FOUND'))).toEqual(['archive']);
    expect(allowedReportActions(workflow('ARCHIVED', 'FOUND'))).toEqual([]);
  });
});
