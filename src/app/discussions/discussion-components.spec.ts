import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { DiscussionService } from './discussion.service';
import { DiscussionCreateDialogComponent } from './discussion-create-dialog.component';
import { DiscussionActionsComponent } from './discussion-actions.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Discussion } from './discussion.models';

const topic: Discussion = {
  id: 'topic',
  missing_person_id: 'case',
  user_id: 'author',
  author_name: 'Jane',
  title: 'Update',
  content: 'Public information',
  created_at: '2026-10-26',
  updated_at: '2026-10-26',
  like_count: 4,
  dislike_count: 2,
  current_user_vote: null,
  reply_count: 0,
  attachments: [],
};

describe('Discussion creation', () => {
  it('rejects blank content and prevents duplicate posting while pending', () => {
    const pending = new Subject<Discussion>();
    const create = vi.fn(() => pending);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DiscussionService, useValue: { upload: () => of([]), create } },
        { provide: MAT_DIALOG_DATA, useValue: { caseId: 'case' } },
        { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
      ],
    });
    const fixture = TestBed.createComponent(DiscussionCreateDialogComponent);
    const component = fixture.componentInstance;
    component.publish();
    expect(create).not.toHaveBeenCalled();
    component.form.setValue({ title: '  ', content: '  ' });
    component.publish();
    expect(create).not.toHaveBeenCalled();
    component.form.setValue({ title: 'Public update', content: 'Details' });
    component.publish();
    component.publish();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith('case', {
      title: 'Public update',
      content: 'Details',
      attachment_ids: [],
    });
    pending.next(topic);
    pending.complete();
  });
});

describe('Discussion votes', () => {
  afterEach(() => sessionStorage.clear());
  it('optimistically updates then rolls back on failure', () => {
    sessionStorage.setItem('currentUser', JSON.stringify({ id: 'viewer', role: 'GENERAL_PUBLIC' }));
    const pending = new Subject<never>();
    const vote = vi.fn(() => pending);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DiscussionService, useValue: { vote } }],
    });
    const fixture = TestBed.createComponent(DiscussionActionsComponent);
    fixture.componentRef.setInput('item', topic);
    fixture.componentRef.setInput('kind', 'discussions');
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.updated.subscribe((value) => emitted.push(value));
    fixture.componentInstance.castVote('like');
    expect(emitted[0]).toMatchObject({ like_count: 5, current_user_vote: 'like' });
    fixture.componentRef.setInput('item', { ...topic, reply_count: 9 });
    pending.error(new Error('offline'));
    expect(emitted[1]).toEqual({ ...topic, reply_count: 9 });
    expect(fixture.componentInstance.busy()).toBe(false);
  });
  it('directs visitors to login without sending a vote', () => {
    const vote = vi.fn();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DiscussionService, useValue: { vote } }],
    });
    const fixture = TestBed.createComponent(DiscussionActionsComponent);
    fixture.componentRef.setInput('item', topic);
    fixture.componentRef.setInput('kind', 'discussions');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.castVote('like');
    expect(vote).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
