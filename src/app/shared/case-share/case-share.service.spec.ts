import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CaseShareService } from './case-share.service';

describe('CaseShareService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  it('copies the complete prepared message and link', async () => {
    const service = TestBed.inject(CaseShareService);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const data = service.data('case-1', 'Jane Doe', 'NC');
      expect(await service.copyMessage(data)).toContain('copied');
      expect(writeText).toHaveBeenCalledWith(`${data.text} ${data.url}`);
      writeText.mockRejectedValue(new Error('Denied'));
      expect(await service.copyMessage(data)).toBe(`Copy this message: ${data.text} ${data.url}`);
    } finally {
      if (previous) Object.defineProperty(navigator, 'clipboard', previous);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
  it('encodes the case path and shares public text through platform links', () => {
    const service = TestBed.inject(CaseShareService);
    const data = service.data('case/1', 'Jane & Doe', 'Main St, NC');
    expect(new URL(data.url).pathname).toBe('/missing-persons/case%2F1');
    expect(data.text).toContain('Jane & Doe');
    expect(data.text).toContain('Main St, NC');
    const links = service.links(data);
    expect(links.map((link) => link.label)).toEqual([
      'WhatsApp',
      'Facebook',
      'X',
      'LinkedIn',
      'Reddit',
      'Telegram',
    ]);
    expect(new URL(links[0].url).searchParams.get('text')).toBe(`${data.text} ${data.url}`);
    expect(new URL(links[1].url).searchParams.get('u')).toBe(data.url);
    expect(new URL(links[2].url).searchParams.get('url')).toBe(data.url);
    expect(new URL(links[3].url).searchParams.get('url')).toBe(data.url);
    expect(new URL(links[4].url).searchParams.get('url')).toBe(data.url);
    expect(new URL(links[4].url).searchParams.get('title')).toBe('Help find Jane & Doe');
    expect(new URL(links[5].url).searchParams.get('url')).toBe(data.url);
    expect(new URL(links[5].url).searchParams.get('text')).toBe(data.text);
  });
});
