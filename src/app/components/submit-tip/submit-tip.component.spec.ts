import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { SubmitTipComponent } from './submit-tip.component';
import { TipSubmissionService } from './tip-submission.service';

const record = {
  _id: 'case-1',
  caseNumber: 'REF-1',
  summary: { fullName: 'Jane Doe' },
  contacts: {
    investigatingAgencies: [
      { agencyName: 'County Police', agencyPhone: '5551234567', agencyEmail: 'tips@example.org' },
    ],
  },
};

describe('SubmitTipComponent', () => {
  const close = vi.fn();
  let available = false;
  let result: Subject<{ referenceNumber?: string }>;
  const submit = vi.fn(() => result);
  beforeEach(() => {
    available = false;
    result = new Subject();
    close.mockClear();
    submit.mockClear();
    TestBed.configureTestingModule({
      imports: [SubmitTipComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: record },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: TipSubmissionService,
          useValue: {
            get available() {
              return available;
            },
            submit,
          },
        },
      ],
    });
  });
  async function setup() {
    const fixture = TestBed.createComponent(SubmitTipComponent);
    await fixture.whenStable();
    return {
      fixture,
      component: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
    };
  }
  it('shows the selected case and three choices', async () => {
    const { root } = await setup();
    expect(root.textContent).toContain('Jane Doe');
    expect(root.textContent).toContain('REF-1');
    expect(root.querySelectorAll('.option-card')).toHaveLength(3);
  });
  it('requires category, meaningful description and acknowledgment, with optional date/location', async () => {
    const { component } = await setup();
    component.choose('STANDARD');
    component.form.patchValue({
      category: 'Possible Sighting',
      description: '   ',
      acknowledged: true,
    });
    expect(component.form.valid).toBe(false);
    component.form.controls.description.setValue('Saw someone near the station');
    expect(component.form.valid).toBe(true);
    component.form.controls.description.setValue('a'.repeat(5001));
    expect(component.form.valid).toBe(false);
  });
  it('clears and omits personal contact details in anonymous mode', async () => {
    const { component, fixture, root } = await setup();
    component.choose('STANDARD');
    component.form.controls.email.setValue('me@example.org');
    component.choose('ANONYMOUS');
    await fixture.whenStable();
    expect(root.querySelector('[formControlName="email"]')).toBeNull();
    expect(component.request().contact).toBeUndefined();
    expect(component.form.controls.email.value).toBe('');
    expect(root.textContent).toContain('complete technical anonymity cannot be guaranteed');
  });
  it('uses API contact links', async () => {
    const { component, fixture, root } = await setup();
    component.choose('AGENCY');
    await fixture.whenStable();
    expect(root.querySelector('a[href="tel:5551234567"]')).toBeTruthy();
    expect(root.querySelector('a[href="mailto:tips@example.org"]')).toBeTruthy();
  });
  it('disables submission and evidence without backend support', async () => {
    const { component, fixture, root } = await setup();
    component.choose('STANDARD');
    await fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
    component.submit();
    expect(submit).not.toHaveBeenCalled();
  });
  it('preserves data on error, prevents duplicates, and shows only confirmed success', async () => {
    available = true;
    const { component } = await setup();
    component.choose('STANDARD');
    component.form.patchValue({
      category: 'Possible Sighting',
      description: 'At station',
      acknowledged: true,
    });
    component.submit();
    component.submit();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(component.success()).toBeNull();
    result.error(new Error('failed'));
    expect(component.form.controls.description.value).toBe('At station');
    expect(component.error()).toBeTruthy();
    result = new Subject();
    component.submit();
    result.next({ referenceNumber: 'TIP-12' });
    result.complete();
    expect(component.success()?.referenceNumber).toBe('TIP-12');
  });
  it('asks before discarding edits and lets the user keep editing', async () => {
    const { component } = await setup();
    component.choose('STANDARD');
    component.form.controls.description.setValue('Some information');
    component.form.markAsDirty();
    expect(component.canClose()).toBe(false);
    expect(component.discardPrompt()).toBe(true);
    component.discardPrompt.set(false);
    expect(close).not.toHaveBeenCalled();
    component.confirmDiscard();
    expect(close).toHaveBeenCalledOnce();
  });
  it('handles missing agency contacts without inventing links', async () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, { useValue: { _id: 'minimal-case' } });
    const { component, fixture, root } = await setup();
    component.choose('AGENCY');
    await fixture.whenStable();
    expect(root.textContent).toContain('minimal-case');
    expect(root.textContent).toContain('Contact information unavailable');
    expect(root.querySelector('a[href^="tel:"]')).toBeNull();
  });
  it('keeps tip content when returning to the options', async () => {
    const { component } = await setup();
    component.choose('STANDARD');
    component.form.controls.description.setValue('A useful tip');
    component.back();
    component.choose('STANDARD');
    expect(component.form.controls.description.value).toBe('A useful tip');
  });
  it('focuses the discard confirmation and allows cancel without data loss', async () => {
    const { component, fixture, root } = await setup();
    component.choose('STANDARD');
    component.form.controls.description.setValue('A useful tip');
    component.form.markAsDirty();
    component.requestClose();
    await fixture.whenStable();
    expect(root.querySelector('[role="alertdialog"]')).toBeTruthy();
    const keep = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Keep editing'),
    )!;
    keep.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    expect(component.form.controls.description.value).toBe('A useful tip');
    expect(close).not.toHaveBeenCalled();
  });
  it('returns keyboard focus to the online option after Back', async () => {
    const { component, fixture, root } = await setup();
    component.choose('STANDARD');
    await fixture.whenStable();
    component.back();
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('.option-card'));
  });
});
