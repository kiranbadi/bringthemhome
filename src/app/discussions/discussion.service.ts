import {
  HttpBackend,
  HttpClient,
  HttpEventType,
  HttpParams,
  HttpXhrBackend,
} from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  EMPTY,
  Observable,
  concatMap,
  expand,
  filter,
  from,
  map,
  switchMap,
  take,
  tap,
  throwError,
  timer,
  toArray,
} from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Attachment,
  ContentKind,
  CreateComment,
  CreateDiscussion,
  Discussion,
  DiscussionComment,
  ListQuery,
  Page,
  UploadTicket,
  Vote,
  VoteState,
  validateMedia,
} from './discussion.models';

// Angular 22 uses Fetch by default, which cannot report upload progress.
export const DISCUSSION_UPLOAD_BACKEND = new InjectionToken<HttpBackend>(
  'Discussion upload backend',
  {
    providedIn: 'root',
    factory: () => inject(HttpXhrBackend),
  },
);

@Injectable({ providedIn: 'root' })
export class DiscussionService {
  private readonly http = inject(HttpClient);
  // Presigned S3 requests must bypass application authentication interceptors.
  private readonly uploadHttp = new HttpClient(inject(DISCUSSION_UPLOAD_BACKEND));
  private readonly base = `${environment.apiUrl}/api`;
  private path(kind: ContentKind, id: string): string {
    return `${this.base}/${kind}/${encodeURIComponent(id)}`;
  }
  list(caseId: string, query: ListQuery): Observable<Page<Discussion>> {
    return this.http.get<Page<Discussion>>(
      `${this.base}/cases/${encodeURIComponent(caseId)}/discussions`,
      { params: new HttpParams({ fromObject: { ...query } }), withCredentials: true },
    );
  }
  create(caseId: string, body: CreateDiscussion): Observable<Discussion> {
    return this.http.post<Discussion>(
      `${this.base}/cases/${encodeURIComponent(caseId)}/discussions`,
      body,
      { withCredentials: true },
    );
  }
  detail(id: string): Observable<Discussion> {
    return this.http.get<Discussion>(this.path('discussions', id), { withCredentials: true });
  }
  comments(id: string, page = 1): Observable<Page<DiscussionComment>> {
    return this.http.get<Page<DiscussionComment>>(`${this.path('discussions', id)}/comments`, {
      params: { page, page_size: 20 },
      withCredentials: true,
    });
  }
  reply(id: string, body: CreateComment): Observable<DiscussionComment> {
    return this.http.post<DiscussionComment>(`${this.path('discussions', id)}/comments`, body, {
      withCredentials: true,
    });
  }
  vote(kind: ContentKind, id: string, vote: Vote): Observable<VoteState> {
    const url = `${this.path(kind, id)}/vote`;
    return vote === null
      ? this.http.delete<VoteState>(url, { withCredentials: true })
      : this.http.put<VoteState>(url, { vote }, { withCredentials: true });
  }
  remove(kind: ContentKind, id: string): Observable<void> {
    return this.http.delete<void>(this.path(kind, id), { withCredentials: true });
  }
  report(kind: ContentKind, id: string, reason: string): Observable<void> {
    return this.http.post<void>(
      `${this.path(kind, id)}/report`,
      { reason },
      { withCredentials: true },
    );
  }
  upload(files: File[], caseId: string, progress: (percent: number) => void): Observable<string[]> {
    const invalid = validateMedia(files);
    if (invalid) return throwError(() => new Error(invalid));
    return from(files).pipe(
      concatMap((file, index) =>
        this.http
          .post<UploadTicket>(
            `${this.base}/discussion-uploads/presign`,
            {
              missing_person_id: caseId,
              filename: file.name,
              content_type: file.type,
              size_bytes: file.size,
            },
            { withCredentials: true },
          )
          .pipe(
            switchMap((ticket) =>
              this.uploadHttp
                .put(ticket.upload_url, file, {
                  headers: ticket.headers,
                  observe: 'events',
                  reportProgress: true,
                  responseType: 'text',
                  withCredentials: false,
                })
                .pipe(
                  tap((event) => {
                    if (event.type === HttpEventType.UploadProgress)
                      progress(
                        Math.round(
                          (100 * (index + event.loaded / (event.total || file.size))) /
                            files.length,
                        ),
                      );
                  }),
                  filter((event) => event.type === HttpEventType.Response),
                  switchMap(() => this.completeUpload(ticket.upload_id)),
                  map((attachment) => {
                    if (attachment.status !== 'ready')
                      throw new Error(
                        'This attachment was rejected. Remove it and try another file.',
                      );
                    progress(Math.round((100 * (index + 1)) / files.length));
                    return attachment.id;
                  }),
                ),
            ),
          ),
      ),
      toArray(),
    );
  }
  private completeUpload(uploadId: string): Observable<Attachment> {
    const complete = () =>
      this.http.post<Attachment>(
        `${this.base}/discussion-uploads/complete`,
        { upload_id: uploadId },
        { withCredentials: true },
      );
    return complete().pipe(
      expand((attachment, index) => {
        if (attachment.status !== 'pending') return EMPTY;
        if (index >= 29)
          return throwError(
            () =>
              new Error(
                'Media validation is taking longer than expected. Please try again later, or remove the attachment.',
              ),
          );
        return timer(2000).pipe(switchMap(complete));
      }),
      filter((attachment) => attachment.status !== 'pending'),
      take(1),
    );
  }
}
