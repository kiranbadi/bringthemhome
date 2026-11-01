import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AccountDashboard } from './account-dashboard';

describe('My Account profile', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AccountDashboard],
      providers: [provideRouter([]), provideHttpClient()],
    });
  });
  afterEach(() => sessionStorage.clear());

  const render = async (user: object) => {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    const fixture = TestBed.createComponent(AccountDashboard);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the persisted signed-in user instead of sample details', async () => {
    const root = await render({
      id: '42',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'GENERAL_PUBLIC',
      phone: '+12025550123',
    });
    const profile = root.querySelector('[aria-labelledby="profile-title"]')!;
    expect(profile.textContent).toContain('Jane Doe');
    expect(profile.textContent).toContain('jane@example.com');
    expect(profile.textContent).toContain('+12025550123');
    expect(profile.textContent).toContain('General Public');
    expect(root.textContent).not.toContain('Verified Account Holder');
    expect(root.textContent).not.toContain('verified@example.com');
    expect(root.textContent).not.toContain('Approved');
  });

  it('handles missing optional details without inventing profile data', async () => {
    const root = await render({ id: '42', email: 'jane@example.com' });
    const profile = root.querySelector('[aria-labelledby="profile-title"]')!;
    expect(profile.textContent).toContain('Not provided');
    expect(profile.textContent).not.toContain('undefined');
    expect(profile.textContent).not.toContain('555');
  });

  it('keeps report creation and resource contributions available', async () => {
    const root = await render({
      id: '42',
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'GENERAL_PUBLIC',
    });
    expect(root.querySelector('main a[href="/missing-person-report"]')).toBeTruthy();
    expect(root.querySelector('main a[href="/account/resource-contributions"]')).toBeTruthy();
  });
});
