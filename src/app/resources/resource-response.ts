import { stateName } from '../core/models/us-state-display';
import {
  Assessment,
  Correction,
  CorrectionInput,
  Contributions,
  Page,
  Resource,
} from './resource.models';

/** Resource fields returned by the existing application's API. */
export interface ResourceResponse extends Omit<
  Resource,
  | 'state'
  | 'county'
  | 'city'
  | 'state_name'
  | 'website'
  | 'status'
  | 'confirmation_count'
  | 'dispute_count'
  | 'current_user_assessment'
  | 'last_verified_at'
  | 'is_owner'
> {
  state_code: string | null;
  website_url: string | null;
  verification_status: Resource['status'];
  accurate_count: number;
  inaccurate_count: number;
  current_user_verification: Assessment | null;
  last_verified_at?: string | null;
  is_owner?: boolean;
}

/** Normalize at the HTTP boundary so templates share one resource model. */
export function mapResourceResponse(response: ResourceResponse | Resource): Resource {
  if (!('verification_status' in response)) return response;
  return {
    ...response,
    state: response.state_code,
    state_name: response.state_code ? stateName(response.state_code) : null,
    county: response.county_name,
    city: response.city_name,
    website: response.website_url,
    status: response.verification_status,
    confirmation_count: response.accurate_count,
    dispute_count: response.inaccurate_count,
    current_user_assessment: response.current_user_verification,
    last_verified_at: response.last_verified_at ?? null,
    is_owner: response.is_owner ?? false,
  };
}

export interface CorrectionResponse {
  id: string;
  resource_id: string;
  suggested_changes: Record<string, unknown>;
  reason: string;
  source_url: string | null;
  issue_type: 'ACCURACY' | 'PRIVACY';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  reviewed_at: string | null;
}
const changeKeys: Record<string, string> = {
  state: 'state_code',
  county: 'county_name',
  city: 'city_name',
  website: 'website_url',
};
export function resourceChanges(
  changes: CorrectionInput['proposed_changes'],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(changes).map(([key, value]) => [changeKeys[key] ?? key, value]),
  );
}
export function mapCorrectionResponse(response: CorrectionResponse | Correction): Correction {
  if (!('suggested_changes' in response)) return response;
  const inverse = Object.fromEntries(
    Object.entries(changeKeys).map(([key, value]) => [value, key]),
  );
  return {
    ...response,
    explanation: response.reason,
    proposed_changes: Object.fromEntries(
      Object.entries(response.suggested_changes).map(([key, value]) => [
        inverse[key] ?? key,
        value,
      ]),
    ),
    review_note: null,
  };
}
export interface ContributionsResponse {
  submitted_resources: Page<ResourceResponse>;
  verifications: Page<{ resource_id: string; verification: Assessment; updated_at: string }>;
  corrections: Page<CorrectionResponse>;
}
export function mapContributionsResponse(
  response: ContributionsResponse | Contributions,
): Contributions {
  if (!('verifications' in response)) return response;
  return {
    assessments: {
      ...response.verifications,
      items: response.verifications.items.map((row) => ({
        ...row,
        assessment: row.verification,
        resource_name: row.resource_id,
      })),
    },
    corrections: {
      ...response.corrections,
      items: response.corrections.items.map(mapCorrectionResponse),
    },
  };
}
