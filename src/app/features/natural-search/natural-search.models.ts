import { HttpErrorResponse } from '@angular/common/http';
import {
  MissingPerson,
  PaginatedMissingPersonsResponse,
} from '../../core/models/missing-person.model';

export interface SearchFilters {
  state?: string;
  city?: string;
  age_min?: number;
  age_max?: number;
  gender?: string;
  date_last_seen_after?: string;
  date_last_seen_before?: string;
}
export interface SearchPayload {
  query: string;
  mode: 'semantic' | 'exact';
  filters: SearchFilters;
  page: number;
  page_size: number;
}
export interface SearchResultItem extends MissingPerson {}
export interface SearchResponse extends PaginatedMissingPersonsResponse {
  records: SearchResultItem[];
}
export interface ApiError {
  status: number;
  code: string;
  message: string;
  field_errors?: Record<string, string>;
  retry_after_seconds?: number;
}
export function searchError(error: unknown): ApiError {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  const body = error instanceof HttpErrorResponse ? error.error?.error : null;
  return {
    status,
    code: typeof body?.code === 'string' ? body.code : 'SEARCH_FAILED',
    message:
      status === 400 || status === 422
        ? 'Check your search and filters, then try again.'
        : status === 429
          ? 'Search rate limit exceeded. Please wait a moment before trying again.'
          : status === 0
            ? 'The search connection was interrupted or timed out. Try simpler search keywords or retry.'
            : 'Search is temporarily unavailable. Please try again.',
  };
}
