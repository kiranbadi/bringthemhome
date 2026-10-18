import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ContactUs } from './contact-us';

describe('ContactUs case tip', () => {
  it('prefills the tip subject with the case id and name from the gallery', async () => {
    TestBed.configureTestingModule({
      imports: [ContactUs],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                type: 'tip',
                personId: 'case-1',
                full_name: 'Jane Doe',
              }),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ContactUs);
    await fixture.whenStable();
    const subject = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[formControlName="subject"]',
    );
    expect(subject?.value).toBe('Tip for Jane Doe (case-1)');
  });
});
