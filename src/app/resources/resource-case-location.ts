import { MissingPersonDetail } from '../core/models/missing-person-detail.model';
export function publicResourceLocation(record: MissingPersonDetail): Record<string, string> {
  const location = record.circumstances?.lastKnownLocation;
  if (location?.visibility !== 'PUBLIC' || !location.state) return {};
  const result: Record<string, string> = { state: location.state };
  if (location.county) result['county'] = location.county;
  if (location.city) result['city'] = location.city;
  return result;
}
