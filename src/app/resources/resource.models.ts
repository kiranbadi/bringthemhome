export const CATEGORIES = {
  LAW_ENFORCEMENT: 'Law Enforcement',
  MISSING_PERSON_ORGANIZATION: 'Missing Person Organization',
  SEARCH_AND_RESCUE: 'Search and Rescue',
  FAMILY_SUPPORT: 'Family Support',
  COMMUNITY_AWARENESS: 'Community Awareness',
  GOVERNMENT_RESOURCE: 'Government Resource',
} as const;
export const SCOPES = {
  NATIONAL: 'National',
  STATE: 'Statewide',
  COUNTY: 'County',
  CITY: 'City',
} as const;
export const STATUSES = {
  UNVERIFIED: 'Not Yet Verified',
  COMMUNITY_CONFIRMED: 'Community Confirmed',
  NEEDS_REVIEW: 'Information Disputed',
  OFFICIALLY_VERIFIED: 'Officially Verified',
} as const;
export type Category = keyof typeof CATEGORIES;
export type Scope = keyof typeof SCOPES;
export type Assessment = 'ACCURATE' | 'INACCURATE';
export interface ResourceInput {
  name: string;
  description: string;
  category: Category;
  scope: Scope;
  state: string | null;
  county: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  source_url: string;
}
export interface Resource extends ResourceInput {
  id: string;
  status: keyof typeof STATUSES;
  state_name: string | null;
  county_name: string | null;
  city_name: string | null;
  is_owner: boolean;
  can_verify?: boolean;
  can_suggest_correction?: boolean;
  listing_status?: 'ACTIVE' | 'HIDDEN';
  confirmation_count: number;
  dispute_count: number;
  current_user_assessment: Assessment | null;
  last_confirmed_at: string | null;
  last_verified_at: string | null;
  created_at: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface ResourceQuery {
  q?: string;
  search?: string;
  category?: string;
  scope?: string;
  state?: string;
  county?: string;
  city?: string;
  page?: number;
  page_size?: number;
}
export interface LocationOption {
  id: string;
  name: string;
}
export interface CorrectionInput {
  explanation: string;
  source_url: string;
  proposed_changes: Partial<Omit<ResourceInput, 'source_url'>>;
}
export interface Correction extends Omit<CorrectionInput, 'source_url'> {
  source_url: string | null;
  id: string;
  resource_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'APPROVED' | 'REJECTED';
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}
export interface AssessmentInput {
  assessment: Assessment;
  reason?: string;
  source_url?: string | null;
  proposed_changes?: CorrectionInput['proposed_changes'];
}
export interface Contributions {
  assessments: Page<{
    resource_id: string;
    resource_name: string;
    assessment: Assessment;
    updated_at: string;
  }>;
  corrections: Page<Correction>;
}
export function coverage(r: Resource): string {
  return r.scope === 'NATIONAL'
    ? 'Nationwide'
    : [r.city_name, r.county_name, r.state_name].filter(Boolean).join(', ');
}
export function safeWebUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
export function resourceError(error: unknown): string {
  const status = (error as { status?: number })?.status;
  return (
    (
      {
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to perform this action.',
        404: 'This resource is unavailable.',
        409: 'This information changed. Reload and try again.',
        429: 'Too many resource actions. Please wait before trying again.',
        422: 'Please check the fields, public contact information, and location selections.',
      } as Record<number, string>
    )[status ?? 0] ?? 'We could not complete the request. Please try again.'
  );
}

export function emailLink(email: string): string {
  return 'mailto:' + encodeURIComponent(email);
}

export interface ResourceReportInput {
  reason: string;
  issue_type: 'ACCURACY' | 'PRIVACY';
  source_url: string | null;
}
export interface ResourceStatusInput {
  listing_status?: 'ACTIVE' | 'HIDDEN';
  verification_status?: Resource['status'];
  reason: string;
  source_url?: string | null;
}
export type ReviewDecision = 'ACCEPTED' | 'REJECTED';
