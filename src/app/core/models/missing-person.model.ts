export interface EmbeddedImages {
  data_urls: string[];
}

export interface MissingPerson {
  _id: string;
  full_name: string;
  photo_url?: string | null;
  missing_since?: string | null;
  age_when_missing?: number | null;
  current_age?: number | null;
  sex?: string | null;
  missing_from_city?: string | null;
  missing_from_state?: string | null;
  embedded_images?: EmbeddedImages;
  'age now'?: string;
  'age missing'?: string;
  gender?: string;
  race?: string;
  weight?: string;
  height?: string;
  'eye color'?: string;
  'hair color'?: string;
  'date reported'?: string;
  reported_at?: string;
  location?: string;
  city?: string | null;
  state?: string | null;
  agency?: string;
  'agency phone'?: string;
}

export interface PaginatedMissingPersonsResponse {
  total_records: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next_page: number | null;
  previous_page: number | null;
  records: MissingPerson[];
}

export interface MissingPersonSearchFilters {
  reported_start_date?: string;
  reported_end_date?: string;
  race?: string;
  gender?: string;
  eye_color?: string;
  hair_color?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  age_missing_min?: number;
  age_missing_max?: number;
  age_now_min?: number;
  age_now_max?: number;
  agency?: string;
  photo_available?: boolean;
  alert_type?: string;
  city?: string;
  state?: string;
  country?: string;
  sort_by?: string;
}

export const SEARCH_FILTER_KEYS: readonly (keyof MissingPersonSearchFilters)[] = [
  'reported_start_date',
  'reported_end_date',
  'race',
  'gender',
  'eye_color',
  'hair_color',
  'first_name',
  'middle_name',
  'last_name',
  'age_missing_min',
  'age_missing_max',
  'age_now_min',
  'age_now_max',
  'agency',
  'photo_available',
  'alert_type',
  'city',
  'state',
  'country',
  'sort_by',
];
