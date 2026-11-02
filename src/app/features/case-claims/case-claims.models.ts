import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
export type Relationship = 'FAMILY' | 'SELF' | 'LEGAL_GUARDIAN';
export interface Claim {
  id: string;
  missing_person_id: string;
  user_id: string;
  relationship: Relationship;
  explanation: string;
  status: ClaimStatus;
  created_at: string;
}
export interface StaffClaim extends Claim {
  missing_person_name?: string | null;
  review_notes?: string | null;
}
export interface ClaimPhoto {
  id: string;
  media_type: 'image';
  content_type: string;
  display_url: string;
  status: 'pending' | 'ready' | 'rejected';
}
export interface Contribution {
  id: string;
  user_id: string;
  relationship: Relationship;
  content: string;
  created_at: string;
  photos: ClaimPhoto[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface UploadTicket {
  upload_id: string;
  upload_url: string;
  headers: Record<string, string>;
}
export const RELATIONSHIPS: Record<Relationship, string> = {
  FAMILY: 'Family member',
  SELF: 'Self',
  LEGAL_GUARDIAN: 'Legal guardian',
};
export const TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['REVOKED'],
  REJECTED: ['APPROVED'],
  REVOKED: ['APPROVED'],
};
export const isAdministrator = (role: string | undefined) =>
  ['ADMIN', 'ADMINISTRATOR'].includes(role?.toUpperCase() ?? '');
export const trimmedLength =
  (min: number, max: number): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const size = String(control.value ?? '').trim().length;
    return size < min || size > max ? { trimmedLength: true } : null;
  };
export function claimError(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  return (
    (
      {
        401: 'Your session has expired. Sign in again to continue.',
        403: 'Access could not be confirmed. Your claim status will be checked again. If this is a session or CSRF issue, sign in again.',
        404: 'This case or claim is no longer available.',
        409: 'The claim or photo has changed, expired, or already been submitted. Refresh its status before trying again.',
        413: 'The selected photo or request is too large. Photos must be 5 MiB or smaller.',
        422: 'Check the entered details and photo requirements, then try again.',
        429: 'Too many requests. Please wait a moment before trying again.',
        503: 'The service is temporarily unavailable. Your text has been kept; please retry.',
      } as Record<number, string>
    )[status] ?? 'The request could not be completed. Your text has been kept; please retry.'
  );
}
export const needsSignIn = (error: unknown) =>
  error instanceof HttpErrorResponse &&
  (error.status === 401 ||
    (error.status === 403 &&
      /csrf|session/i.test(String(error.error?.detail ?? error.error?.error_message ?? ''))));
export function validateClaimPhoto(file: File): string {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Choose JPEG, PNG, or WebP images only.';
  if (!file.size || file.size > 5 * 1024 * 1024) return 'Choose a nonempty photo of 5 MiB or less.';
  return '';
}
export function safePhotoUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}
