import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DiscussionService, DISCUSSION_UPLOAD_BACKEND } from './discussion.service';
import { HttpBackend, HttpXhrBackend } from '@angular/common/http';
import { csrfInterceptor } from '../core/auth/csrf.interceptor';
import { validateMedia, optimisticVote } from './discussion.models';

describe('Discussion API contract', () => {
  let service: DiscussionService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.setItem('csrf_token', 'test-csrf');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: DISCUSSION_UPLOAD_BACKEND, useExisting: HttpBackend },
      ],
    });
    service = TestBed.inject(DiscussionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('encodes string case identifiers and supplies pagination and search', () => {
    service
      .list('case/123', { page: 2, page_size: 10, search: 'public', sort: 'most_liked' })
      .subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/cases/case%2F123/discussions'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('search')).toBe('public');
    req.flush({ items: [], total: 0, page: 2, page_size: 10 });
  });
  it('posts only content and attachment IDs with session and CSRF', () => {
    service
      .create('abc', { title: 'A public update', content: 'Details', attachment_ids: ['ready-1'] })
      .subscribe();
    const req = http.expectOne('http://localhost:8000/api/cases/abc/discussions');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Token')).toBe('test-csrf');
    expect(req.request.body).toEqual({
      title: 'A public update',
      content: 'Details',
      attachment_ids: ['ready-1'],
    });
    req.flush({});
  });
  it('removes a vote with DELETE and accepts authoritative counts', () => {
    service.vote('comments', 'a/b', null).subscribe((value) => expect(value.like_count).toBe(8));
    const req = http.expectOne('http://localhost:8000/api/comments/a%2Fb/vote');
    expect(req.request.method).toBe('DELETE');
    req.flush({ like_count: 8, dislike_count: 1, current_user_vote: null });
  });
  it('soft deletes using the proposed DELETE endpoint', () => {
    service.remove('discussions', 'one').subscribe();
    const req = http.expectOne('http://localhost:8000/api/discussions/one');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});

describe('discussion media and vote rules', () => {
  it('rejects mixed media, extra images and oversized files', () => {
    const image = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const video = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    expect(validateMedia([image, video])).toBeTruthy();
    expect(validateMedia([image, image, image, image])).toBeTruthy();
    expect(
      validateMedia([
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
      ]),
    ).toBeTruthy();
    expect(validateMedia([image])).toBe('');
  });
  it('switches and removes votes without double counting', () => {
    const initial = { like_count: 2, dislike_count: 3, current_user_vote: 'like' as const };
    expect(optimisticVote(initial, 'dislike')).toEqual({
      like_count: 1,
      dislike_count: 4,
      current_user_vote: 'dislike',
    });
    expect(optimisticVote(initial, null)).toEqual({
      like_count: 1,
      dislike_count: 3,
      current_user_vote: null,
    });
  });
});

describe('authorized media upload', () => {
  let service: DiscussionService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.setItem('csrf_token', 'private-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: DISCUSSION_UPLOAD_BACKEND, useExisting: HttpBackend },
      ],
    });
    service = TestBed.inject(DiscussionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('uploads without session headers and returns only validated attachment IDs', () => {
    const result = vi.fn();
    service
      .upload([new File(['x'], 'photo.jpg', { type: 'image/jpeg' })], 'case', () => {})
      .subscribe(result);
    const presign = http.expectOne('http://localhost:8000/api/discussion-uploads/presign');
    expect(presign.request.body.missing_person_id).toBe('case');
    presign.flush({
      upload_id: 'upload-one',
      upload_url: 'https://s3.example.com/file?signed=1',
      headers: { 'Content-Type': 'image/jpeg' },
    });
    const upload = http.expectOne('https://s3.example.com/file?signed=1');
    expect(upload.request.withCredentials).toBe(false);
    expect(upload.request.headers.has('X-CSRF-Token')).toBe(false);
    upload.flush('');
    http
      .expectOne('http://localhost:8000/api/discussion-uploads/complete')
      .flush({ id: 'ready-one', status: 'ready' });
    expect(result).toHaveBeenCalledWith(['ready-one']);
  });
  it('never publishes a rejected attachment', () => {
    const result = vi.fn();
    const error = vi.fn();
    service
      .upload([new File(['x'], 'photo.jpg', { type: 'image/jpeg' })], 'case', () => {})
      .subscribe({ next: result, error });
    http
      .expectOne('http://localhost:8000/api/discussion-uploads/presign')
      .flush({ upload_id: 'upload', upload_url: 'https://s3.example.com/upload', headers: {} });
    http.expectOne('https://s3.example.com/upload').flush('');
    http
      .expectOne('http://localhost:8000/api/discussion-uploads/complete')
      .flush({ id: 'rejected', status: 'rejected' });
    expect(result).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe('asynchronous media scanning', () => {
  it('waits for pending validation using the same upload ID', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DISCUSSION_UPLOAD_BACKEND, useExisting: HttpBackend },
      ],
    });
    const service = TestBed.inject(DiscussionService);
    const http = TestBed.inject(HttpTestingController);
    const next = vi.fn();
    const error = vi.fn();
    service
      .upload([new File(['x'], 'photo.jpg', { type: 'image/jpeg' })], 'case', () => {})
      .subscribe({ next, error });
    http.expectOne('http://localhost:8000/api/discussion-uploads/presign').flush({
      upload_id: 'same-upload',
      upload_url: 'https://s3.example.com/upload',
      headers: {},
    });
    http.expectOne('https://s3.example.com/upload').flush('');
    http
      .expectOne('http://localhost:8000/api/discussion-uploads/complete')
      .flush({ id: 'attachment', status: 'pending' });
    expect(error).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    const poll = http.expectOne('http://localhost:8000/api/discussion-uploads/complete');
    expect(poll.request.body).toEqual({ upload_id: 'same-upload' });
    poll.flush({ id: 'attachment', status: 'ready' });
    expect(next).toHaveBeenCalledWith(['attachment']);
    http.verify();
    vi.useRealTimers();
  });
});

describe('upload transport', () => {
  it('uses an isolated XHR backend because Angular FetchBackend rejects upload progress', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    expect(TestBed.inject(DISCUSSION_UPLOAD_BACKEND)).toBeInstanceOf(HttpXhrBackend);
  });
});
