import { currentAge, locationMapUrl, publicImageUrl, displayValue } from './case-profile-format';

describe('Case profile display', () => {
  const today = new Date(2026, 9, 22);
  it('calculates exact calendar age from birth date with birthday boundaries', () => {
    expect(currentAge({ demographics: { dateOfBirth: '2000-10-23' } }, today)).toBe('25');
    expect(currentAge({ demographics: { dateOfBirth: '2000-10-22' } }, today)).toBe('26');
  });
  it('estimates only from disappearance age and date, retaining zero age', () => {
    expect(
      currentAge(
        { demographics: { missingAge: 0 }, circumstances: { dateOfLastContact: '2017-02-14' } },
        today,
      ),
    ).toBe('9 (estimated)');
    expect(
      currentAge(
        {
          demographics: { currentAge: 7, missingAge: 0 },
          _source: { reported_at: '2017-02-14', created_at: '2026-10-22' },
        },
        today,
      ),
    ).toBe('Unknown');
  });
  it('rejects invalid and future dates', () => {
    expect(currentAge({ demographics: { dateOfBirth: '2000-02-30' } }, today)).toBe('Unknown');
    expect(currentAge({ demographics: { dateOfBirth: '2030-01-01' } }, today)).toBe('Unknown');
  });
  it('creates a map URL from confirmed coordinates or location text only', () => {
    expect(locationMapUrl({ coordinates: { latitude: 0, longitude: 0 } })).toContain('query=0%2C0');
    expect(locationMapUrl({ location: 'ROWAN, NC' })).toContain('query=ROWAN%2C%20NC');
    expect(locationMapUrl({ coordinates: { latitude: 999, longitude: 5 } })).toBeNull();
    expect(locationMapUrl({})).toBeNull();
  });
  it('formats missing values, booleans and zero without rendering objects', () => {
    expect(displayValue(0)).toBe('0');
    expect(displayValue(false)).toBe('No');
    expect(displayValue(true)).toBe('Yes');
    expect(displayValue(null)).toBe('Not provided');
    expect(displayValue('Unknown')).toBe('Unknown');
    expect(displayValue({ private: 'hidden' })).toBe('Not provided');
  });
  it('only accepts safe image URLs', () => {
    expect(publicImageUrl('javascript:alert(1)')).toBeNull();
    expect(publicImageUrl('data:text/html;base64,a')).toBeNull();
    expect(publicImageUrl('https://example.com/photo.jpg')).toBeTruthy();
    expect(publicImageUrl('data:image/png;base64,AAAA')).toBeTruthy();
  });
});
