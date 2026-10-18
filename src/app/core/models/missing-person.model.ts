export interface EmbeddedImages {
  data_urls: string[];
}

export interface MissingPerson {
  _id: string;
  full_name: string;
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
