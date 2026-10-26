import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CaseShareComponent } from './case-share.component';
import { CaseShareService } from './case-share.service';

describe('CaseShareComponent', () => {
  it('opens a compact case dialog and reports copy confirmation', async () => {
    TestBed.configureTestingModule({
      imports: [CaseShareComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(CaseShareComponent);
    fixture.componentRef.setInput('caseId', 'case-123');
    fixture.componentRef.setInput('name', 'Jane Doe');
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain(
      'Share this case',
    );
    expect(document.querySelector('mat-dialog-container')?.textContent).toContain('Jane Doe');
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.platform'));
    expect(
      links.map((link) => link.getAttribute('aria-label')?.split('Share on ')[1]?.split(' (')[0]),
    ).toEqual(['WhatsApp', 'Facebook', 'X', 'LinkedIn', 'Reddit', 'Telegram']);
    expect(links.every((link) => link.target === '_blank' && link.rel.includes('noopener'))).toBe(
      true,
    );
    vi.spyOn(TestBed.inject(CaseShareService), 'copy').mockResolvedValue(
      'Case link copied to clipboard.',
    );
    const copy = Array.from(
      document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button'),
    ).find((button) => button.textContent?.includes('Copy link'))!;
    copy.click();
    await fixture.whenStable();
    expect(document.querySelector('mat-dialog-container [role="status"]')!.textContent).toContain(
      'copied',
    );
    const service = TestBed.inject(CaseShareService);
    const copyMessage = vi.spyOn(service, 'copyMessage').mockResolvedValue('Case message copied.');
    const download = vi.spyOn(service, 'downloadImage').mockResolvedValue('Case image downloaded.');
    const action = (text: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')).find(
        (button) => button.textContent?.includes(text),
      )!;
    for (const app of ['Instagram', 'Snapchat', 'Signal']) {
      action(app).click();
      await fixture.whenStable();
      expect(copyMessage).toHaveBeenCalled();
      expect(document.querySelector('mat-dialog-container [role="status"]')!.textContent).toContain(
        app,
      );
    }
    action('Copy message').click();
    await fixture.whenStable();
    expect(copyMessage).toHaveBeenCalledWith(expect.objectContaining({ title: 'Jane Doe' }));
    action('Download case image').click();
    await fixture.whenStable();
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Jane Doe' }),
      '/missing-person-placeholder.svg',
    );
    expect(document.querySelector('mat-dialog-container [role="status"]')!.textContent).toContain(
      'downloaded',
    );
  });
});
