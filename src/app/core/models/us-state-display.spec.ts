import { formatLocation, stateName, US_STATES } from './us-state-display';

describe('US state display', () => {
  it('contains every state and Washington DC', () => {
    expect(Object.keys(US_STATES)).toHaveLength(62);
    expect(stateName('NC')).toBe('North Carolina');
    expect(stateName('ny')).toBe('New York');
    expect(stateName('CA')).toBe('California');
    expect(stateName('DC')).toBe('District of Columbia');
    expect(stateName(' north carolina ')).toBe('North Carolina');
  });
  it.each([
    ['AA', 'Armed Forces Americas'],
    ['AE', 'Armed Forces Europe'],
    ['AP', 'Armed Forces Pacific'],
    ['AS', 'American Samoa'],
    ['FM', 'Federated States of Micronesia'],
    ['GU', 'Guam'],
    ['MH', 'Republic of the Marshall Islands'],
    ['MP', 'Northern Mariana Islands'],
    ['PR', 'Puerto Rico'],
    ['PW', 'Palau (the Republic of Palau)'],
    ['VI', 'U.S. Virgin Islands'],
  ])('expands %s in state labels and locations', (code, name) => {
    expect(stateName(code)).toBe(name);
    expect(stateName(` ${code.toLowerCase()} `)).toBe(name);
    expect(formatLocation(`Location, ${code}`)).toBe(`Location, ${name}`);
  });
  it('expands states in comma-separated locations and keeps ZIP codes', () => {
    expect(formatLocation('Wake, NC')).toBe('Wake, North Carolina');
    expect(formatLocation('Portland,OR 97201')).toBe('Portland, Oregon 97201');
    expect(formatLocation('Austin, tx, USA')).toBe('Austin, Texas, USA');
  });
  it('does not replace abbreviations inside place names or prose', () => {
    expect(formatLocation('IN THE WOODS')).toBe('IN THE WOODS');
    expect(formatLocation('ORANGE COUNTY, CA')).toBe('ORANGE COUNTY, California');
    expect(formatLocation('Toronto, ON')).toBe('Toronto, ON');
    expect(formatLocation(null)).toBe('');
  });
});
