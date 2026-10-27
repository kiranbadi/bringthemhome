import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CaseDiscussionBoardComponent } from './case-discussion-board.component';
import { DiscussionDetailComponent } from './discussion-detail.component';
import { DiscussionService } from './discussion.service';

describe('Routed case discussions', () => {
  const parent = {
    paramMap: of(convertToParamMap({ id: 'case-one' })),
    snapshot: { paramMap: convertToParamMap({ id: 'case-one' }) },
  };
  it('loads only the route case and renders an empty state', async () => {
    const list = vi.fn(() => of({ items: [], total: 0, page: 1, page_size: 10 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { parent } },
        { provide: DiscussionService, useValue: { list } },
      ],
    });
    const fixture = TestBed.createComponent(CaseDiscussionBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(list).toHaveBeenCalledWith(
      'case-one',
      expect.objectContaining({ page: 1, search: '', sort: 'newest' }),
    );
    expect(fixture.nativeElement.textContent).toContain('No discussions yet');
  });
  it('refuses a discussion belonging to a different case and never loads its replies', async () => {
    const comments = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { parent, paramMap: of(convertToParamMap({ discussionId: 'topic' })) },
        },
        {
          provide: DiscussionService,
          useValue: {
            detail: () => of({ id: 'topic', missing_person_id: 'other-case' }),
            comments,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DiscussionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('does not belong to this case');
    expect(comments).not.toHaveBeenCalled();
  });
});

describe('Reply posting', () => {
  afterEach(() => sessionStorage.clear());
  it('keeps a failed reply draft and prevents duplicate submissions', async () => {
    sessionStorage.setItem('currentUser', JSON.stringify({ id: 'user', role: 'GENERAL_PUBLIC' }));
    const { Subject } = await import('rxjs');
    const pending = new Subject<never>();
    const reply = vi.fn(() => pending);
    const topic = {
      id: 'topic',
      missing_person_id: 'case',
      user_id: 'author',
      author_name: 'Jane',
      title: 'Update',
      content: 'Details',
      created_at: '2026-10-26',
      updated_at: '2026-10-26',
      like_count: 0,
      dislike_count: 0,
      current_user_vote: null,
      reply_count: 0,
      attachments: [],
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { paramMap: of(convertToParamMap({ id: 'case' })) },
            paramMap: of(convertToParamMap({ discussionId: 'topic' })),
          },
        },
        {
          provide: DiscussionService,
          useValue: {
            detail: () => of(topic),
            comments: () => of({ items: [], total: 0 }),
            upload: () => of([]),
            reply,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DiscussionDetailComponent);
    fixture.detectChanges();
    fixture.componentInstance.content.setValue('  Helpful public information  ');
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith('topic', {
      content: 'Helpful public information',
      attachment_ids: [],
    });
    pending.error(new Error('offline'));
    expect(fixture.componentInstance.content.value).toContain('Helpful public information');
    expect(fixture.componentInstance.posting()).toBe(false);
  });
});

describe('Discussion route reuse', () => {
  it('clears the old draft and cancels uploads before opening another topic', () => {
    sessionStorage.setItem('currentUser', JSON.stringify({ id: 'user', role: 'GENERAL_PUBLIC' }));
    const params = new Subject<ReturnType<typeof convertToParamMap>>();
    const upload = new Subject<string[]>();
    const reply = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { paramMap: of(convertToParamMap({ id: 'case' })) },
            paramMap: params,
          },
        },
        {
          provide: DiscussionService,
          useValue: {
            detail: (id: string) =>
              of({ id, missing_person_id: 'case', attachments: [], reply_count: 0 }),
            comments: () => of({ items: [], total: 0 }),
            upload: () => upload,
            reply,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DiscussionDetailComponent);
    params.next(convertToParamMap({ discussionId: 'a' }));
    const component = fixture.componentInstance;
    component.content.setValue('Draft for a');
    component.files = [new File(['x'], 'private-to-a.jpg', { type: 'image/jpeg' })];
    component.postReply();
    component.checking.set(true);
    params.next(convertToParamMap({ discussionId: 'b' }));
    expect(component.content.value).toBe('');
    expect(component.files).toEqual([]);
    expect(component.checking()).toBe(false);
    expect(component.posting()).toBe(false);
    upload.next(['old-upload']);
    expect(reply).not.toHaveBeenCalled();
    fixture.destroy();
    sessionStorage.clear();
  });
});
