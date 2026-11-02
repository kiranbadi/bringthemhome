import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import {
  EMPTY,
  catchError,
  expand,
  from,
  map,
  mergeMap,
  of,
  reduce,
  switchMap,
  throwError,
  timeout,
  toArray,
} from 'rxjs';
import { MissingPersonService } from '../../core/services/missing-person.service';
import { casePath } from '../../core/models/case-url';
import { environment } from '../../../environments/environment';
import {
  Claim,
  ClaimPhoto,
  ClaimStatus,
  Contribution,
  Page,
  Relationship,
  StaffClaim,
  UploadTicket,
} from './case-claims.models';

@Injectable({ providedIn: 'root' })
export class CaseClaimsService {
  private readonly http = inject(HttpClient);
  // Storage requests intentionally bypass ALL application interceptors.
  private readonly storage = new HttpClient(inject(HttpBackend));
  private readonly document = inject(DOCUMENT);
  private readonly base = `${environment.apiUrl}${environment.apiBaseUrl}/api`;
  private readonly credentials = { withCredentials: true };
  private readonly missingPersons = inject(MissingPersonService);
  private readonly personNames = new Map<string, string>();
  private readonly personPaths = new Map<string, string>();
  private caseUrl(id: string) {
    return `${this.base}/cases/${encodeURIComponent(id)}`;
  }
  myClaims(page = 1) {
    return this.http
      .get<Page<Claim>>(`${this.base}/users/me/case-claims`, {
        ...this.credentials,
        params: { page, page_size: 100 },
      })
      .pipe(timeout(15000));
  }
  findMyClaim(caseId: string) {
    return this.myClaims().pipe(
      expand((page) => {
        if (
          page.items.some((claim) => claim.missing_person_id === caseId) ||
          page.page * page.page_size >= page.total
        )
          return EMPTY;
        if (!page.items.length || page.page_size < 1)
          return throwError(() => new Error('Incomplete claims response'));
        return this.myClaims(page.page + 1);
      }),
      reduce(
        (found: Claim | null, page) =>
          found ?? page.items.find((claim) => claim.missing_person_id === caseId) ?? null,
        null,
      ),
      map((claim) => {
        if (claim && !['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'].includes(claim.status))
          throw new Error('Unknown claim status');
        return claim;
      }),
    );
  }
  claim(id: string, body: { relationship: Relationship; explanation: string }) {
    return this.http
      .post<Claim>(`${this.caseUrl(id)}/claims`, body, this.credentials)
      .pipe(timeout(20000));
  }
  contributions(id: string, page = 1) {
    return this.http
      .get<Page<Contribution>>(`${this.caseUrl(id)}/contributions`, {
        params: { page, page_size: 20 },
      })
      .pipe(timeout(15000));
  }
  contribute(id: string, body: { content: string; photo_ids: string[] }) {
    // Never automatically retry an append-only publication: a lost response may follow a committed write.
    return this.http
      .post<Contribution>(`${this.caseUrl(id)}/contributions`, body, this.credentials)
      .pipe(timeout(30000));
  }
  presign(id: string, file: File) {
    return this.http
      .post<UploadTicket>(
        `${this.caseUrl(id)}/claim-photos/presign`,
        {
          missing_person_id: id,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
        },
        this.credentials,
      )
      .pipe(timeout(15000));
  }
  putPhoto(ticket: UploadTicket, file: File) {
    let url: URL;
    try {
      url = new URL(ticket.upload_url);
    } catch {
      return throwError(() => new Error('Invalid storage URL'));
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      [new URL(environment.apiUrl).origin, this.document.location?.origin].includes(url.origin) ||
      Object.keys(ticket.headers).some((key) =>
        /^(cookie|authorization|x-csrf-token|bth_session|bth_csrf)$/i.test(key),
      )
    ) {
      return throwError(() => new Error('Unsafe storage ticket'));
    }
    return this.storage
      .put(ticket.upload_url, file, {
        headers: ticket.headers,
        withCredentials: false,
        credentials: 'omit',
        responseType: 'text',
      })
      .pipe(timeout(60000));
  }
  complete(id: string, uploadId: string) {
    return this.http
      .post<ClaimPhoto>(
        `${this.caseUrl(id)}/claim-photos/complete`,
        { upload_id: uploadId },
        this.credentials,
      )
      .pipe(timeout(30000));
  }
  adminClaims(status: ClaimStatus, page = 1) {
    return this.http
      .get<Page<StaffClaim>>(`${this.base}/admin/case-claims`, {
        ...this.credentials,
        params: { status, page, page_size: 20 },
      })
      .pipe(
        timeout(15000),
        switchMap((queue) => this.withPersonNames(queue)),
      );
  }
  private withPersonNames(queue: Page<StaffClaim>) {
    for (const claim of queue.items) {
      if (claim.missing_person_name?.trim())
        this.personNames.set(claim.missing_person_id, claim.missing_person_name.trim());
    }
    const missingIds = [...new Set(queue.items.map((claim) => claim.missing_person_id))].filter(
      (id) => !this.personNames.has(id),
    );
    return from(missingIds).pipe(
      mergeMap(
        (id) =>
          this.missingPersons.findMissingPerson(id).pipe(
            timeout(10000),
            map((record) => {
              const name =
                record?.summary?.fullName?.trim() ||
                record?.full_name?.trim() ||
                record?._source?.full_name?.trim();
              if (name) this.personNames.set(id, name);
              if (record) this.personPaths.set(id, casePath(record));
              return name ?? null;
            }),
            catchError(() => of(null)),
          ),
        4,
      ),
      toArray(),
      // A slow name lookup must not prevent staff from reaching the review queue.
      timeout(10000),
      catchError(() => of([])),
      map(() => ({
        ...queue,
        items: queue.items.map((claim) => ({
          ...claim,
          missing_person_name: this.personNames.get(claim.missing_person_id) ?? null,
          canonical_path:
            this.personPaths.get(claim.missing_person_id) ??
            casePath({ _id: claim.missing_person_id, canonical_path: claim.canonical_path }),
        })),
      })),
    );
  }
  review(id: string, status: ClaimStatus, reviewNotes: string) {
    return this.http
      .patch<StaffClaim>(
        `${this.base}/admin/case-claims/${encodeURIComponent(id)}`,
        { status, review_notes: reviewNotes },
        this.credentials,
      )
      .pipe(timeout(20000));
  }
}
