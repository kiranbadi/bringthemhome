import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

describe('Policy pages', () => {
  it('routes Terms and Privacy independently and binds the right content on navigation', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withComponentInputBinding())],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/terms');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Terms & Conditions');
    expect(harness.routeNativeElement?.textContent).toContain('not an emergency service');
    await harness.navigateByUrl('/privacy');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Privacy Policy');
    expect(harness.routeNativeElement?.textContent).toContain('including its password');
    expect(harness.routeNativeElement?.textContent).toContain('Interim draft');
  });
});
