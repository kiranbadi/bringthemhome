import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import {
  NaturalSearchHeroComponent,
  VOICE_INPUT,
  VoiceInput,
} from './natural-search-hero.component';
import { searchError } from './natural-search.models';
import { HttpErrorResponse } from '@angular/common/http';

describe('Natural search hero', () => {
  let fixture: ComponentFixture<NaturalSearchHeroComponent>;
  let http: HttpTestingController;
  let voice: VoiceInput;

  const base = 'http://localhost:8000/bringthemhome/api/v1/search/natural';
  beforeEach(async () => {
    voice = { start: vi.fn(), abort: vi.fn(), onresult: null, onerror: null, onend: null };
    TestBed.configureTestingModule({
      imports: [NaturalSearchHeroComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VOICE_INPUT, useValue: () => voice },
      ],
    });
    fixture = TestBed.createComponent(NaturalSearchHeroComponent);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify();
  });
  const root = () => fixture.nativeElement as HTMLElement;

  it('prevents whitespace-only searches with inline feedback', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.form.controls.query.setValue('   ');
    fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
    expect(root().querySelector('mat-error')?.textContent).toContain('Enter a description');
    http.expectNone((req) => req.url.includes(base));
  });

  it('submits a trimmed query using the existing natural endpoint contract', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.form.controls.query.setValue(' NamUs #MP48192 ');
    fixture.componentInstance.submit();
    expect(navigate).toHaveBeenCalledWith(['/missing-persons'], {
      queryParams: { nl_query: 'NamUs #MP48192', nl_mode: 'semantic', page: 1 },
    });
  });

  it('renders only a query field and search actions without auxiliary API requests', async () => {
    fixture.componentInstance.form.controls.query.setValue('teenagers in NC');
    await fixture.whenStable();
    expect(root().querySelectorAll('input')).toHaveLength(1);
    expect(
      root().querySelector(
        'mat-expansion-panel, mat-select, mat-chip-listbox, mat-autocomplete, mat-button-toggle-group',
      ),
    ).toBeNull();
    http.expectNone((request) => request.url.includes(base));
  });

  it('prevents duplicate submission while searching', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.form.controls.query.setValue('Raleigh');
    fixture.componentRef.setInput('busy', true);
    fixture.componentInstance.submit();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('fills the query from voice without automatically submitting', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    fixture.componentInstance.toggleVoice();
    expect(voice.start).toHaveBeenCalled();
    expect(fixture.componentInstance.listening()).toBe(true);
    voice.onresult?.('teenage girl in Raleigh');
    voice.onend?.();
    await fixture.whenStable();
    expect(fixture.componentInstance.form.controls.query.value).toBe('teenage girl in Raleigh');
    expect(fixture.componentInstance.listening()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('handles permission failures and releases the microphone on destroy', async () => {
    const snackbar = vi.spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    fixture.componentInstance.toggleVoice();
    voice.onerror?.();
    await fixture.whenStable();
    expect(fixture.componentInstance.listening()).toBe(false);
    expect(snackbar).toHaveBeenCalled();
    fixture.destroy();
    expect(voice.abort).toHaveBeenCalled();
  });

  it('announces rate limits and keeps input on service failure with retry', async () => {
    fixture.componentInstance.form.controls.query.setValue('elderly man', { emitEvent: false });
    const snackbar = vi.spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    fixture.componentRef.setInput('apiError', searchError(new HttpErrorResponse({ status: 429 })));
    await fixture.whenStable();
    expect(snackbar).toHaveBeenCalledWith(
      'Search rate limit exceeded. Please wait a moment before trying again.',
      'Dismiss',
      { duration: 8000 },
    );
    fixture.componentRef.setInput('apiError', searchError(new HttpErrorResponse({ status: 503 })));
    await fixture.whenStable();
    const retry = vi.fn();
    fixture.componentInstance.retrySearch.subscribe(retry);
    [...root().querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Retry search'))!
      .click();
    expect(retry).toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.query.value).toBe('elderly man');
  });

  it('shows malformed request errors inline and a network fallback', async () => {
    fixture.componentInstance.form.controls.query.setValue('person in NC', { emitEvent: false });
    fixture.componentRef.setInput('apiError', searchError(new HttpErrorResponse({ status: 422 })));
    await fixture.whenStable();
    expect(root().querySelector('mat-error')?.textContent).toContain('Check your search');
    expect(searchError(new HttpErrorResponse({ status: 0 })).message).toContain(
      'simpler search keywords',
    );
  });
});
