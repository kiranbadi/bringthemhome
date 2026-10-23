import { CaseLocation, MissingPersonDetail } from '../core/models/missing-person-detail.model';

export function displayValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not provided';
  if (typeof value === 'string') return value.trim() || 'Not provided';
  if (Array.isArray(value))
    return (
      value
        .map(displayValue)
        .filter((v) => v !== 'Not provided')
        .join(', ') || 'Not provided'
    );
  return 'Not provided';
}

function calendarDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}

function yearsSince(date: Date, today: Date): number {
  return (
    today.getFullYear() -
    date.getFullYear() -
    (today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
      ? 1
      : 0)
  );
}

export function currentAge(record: Partial<MissingPersonDetail>, today = new Date()): string {
  const birth = calendarDate(record.demographics?.dateOfBirth);
  if (birth && birth <= today) return String(yearsSince(birth, today));
  const missingDate = calendarDate(
    record.circumstances?.dateOfLastContact ?? record._source?.missing_since,
  );
  const missingAge = record.demographics?.missingAge;
  if (missingDate && missingDate <= today && typeof missingAge === 'number' && missingAge >= 0) {
    return `${missingAge + yearsSince(missingDate, today)} (estimated)`;
  }
  return 'Unknown';
}

export function locationMapUrl(location: CaseLocation | null | undefined): string | null {
  if (!location) return null;
  const lat = location.coordinates?.latitude;
  const lon = location.coordinates?.longitude;
  const coordinates =
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    Math.abs(lon) <= 180;
  const address =
    location.address?.trim() ||
    location.location?.trim() ||
    [location.city, location.county, location.state, location.postalCode]
      .filter((v) => v?.trim())
      .join(', ');
  const validAddress = /^(unknown|not provided|not reported|n\/a)$/i.test(address) ? '' : address;
  const query = coordinates ? `${lat},${lon}` : validAddress;
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

export function publicImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z\d+/=\s]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function phoneLink(value: unknown): string | null {
  if (typeof value !== 'string' || !value || !/^\+?[\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15
    ? `tel:${value.startsWith('+') ? '+' : ''}${digits}`
    : null;
}

export function emailLink(value: unknown): string | null {
  return typeof value === 'string' && value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? `mailto:${value}`
    : null;
}

// An opt-in UI shape for the otherwise unspecified sample media arrays. Unknown,
// private or unmarked objects are deliberately excluded from the public gallery.
export interface PublicCaseMedia {
  url: string;
  isPublic: true;
  name?: string;
  fileType?: string;
}

export function isPublicCaseMedia(value: unknown): value is PublicCaseMedia {
  if (!isPublicCaseRecord(value)) return false;
  const record = value;
  if (typeof record['url'] !== 'string') return false;
  if (record['name'] != null && typeof record['name'] !== 'string') return false;
  if (record['fileType'] != null && typeof record['fileType'] !== 'string') return false;
  try {
    return ['https:', 'http:'].includes(new URL(record['url']).protocol);
  } catch {
    return false;
  }
}

export function isPublicCaseRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record['isPublic'] === true &&
    record['private'] !== true &&
    record['restricted'] !== true &&
    record['isRestricted'] !== true
  );
}
