import { MissingPerson } from './missing-person.model';

export const PERSON_PLACEHOLDER = '/missing-person-placeholder.svg';

export function personLocation(person: MissingPerson): string {
  const parts = [person.city, person.location, person.state]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean);
  return (
    parts
      .filter(
        (value, index) =>
          parts.findIndex((part) => part.toLowerCase() === value.toLowerCase()) === index,
      )
      .join(', ') || 'Location unavailable'
  );
}

export function personReportedDate(person: MissingPerson): string {
  const raw = person['date reported']?.trim() || person.reported_at?.trim();
  if (!raw) return 'Date unavailable';
  // Parse date-only values locally to avoid shifting a day west of UTC.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        date,
      );
}
