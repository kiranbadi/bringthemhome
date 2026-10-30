import { emailLink, safeWebUrl } from './resource.models';
describe('Public resource links', () => {
  it('encodes email addresses so they cannot inject mailto headers', () => {
    expect(emailLink('help?bcc=attacker@example.org')).toBe(
      'mailto:help%3Fbcc%3Dattacker%40example.org',
    );
  });
  it('rejects executable schemes and embedded URL credentials', () => {
    expect(safeWebUrl('javascript:alert(1)')).toBeNull();
    expect(safeWebUrl('https://name:password@example.org')).toBeNull();
  });
});
