/** Display labels only. Keep state codes unchanged in forms, routes and API payloads. */
export const US_STATES: Readonly<Record<string, string>> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
  AA: 'Armed Forces Americas',
  AE: 'Armed Forces Europe',
  AP: 'Armed Forces Pacific',
  AS: 'American Samoa',
  FM: 'Federated States of Micronesia',
  GU: 'Guam',
  MH: 'Republic of the Marshall Islands',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  PW: 'Palau (the Republic of Palau)',
  VI: 'U.S. Virgin Islands',
};

export function stateName(value: string | null | undefined): string {
  const text = value?.trim() ?? '';
  return (
    US_STATES[text.toUpperCase()] ??
    Object.values(US_STATES).find((name) => name.toLowerCase() === text.toLowerCase()) ??
    text
  );
}

/** Expand state segments, never arbitrary two-letter words inside a place name. */
export function formatLocation(value: string | null | undefined): string {
  return (value?.trim() ?? '')
    .replace(
      /(^|,\s*)([a-z]{2})(?=\s*(?:\d{5}(?:-\d{4})?)?(?:,|$))/gi,
      (_, separator: string, code: string) => `${separator}${stateName(code)}`,
    )
    .replace(/,\s*/g, ', ');
}
