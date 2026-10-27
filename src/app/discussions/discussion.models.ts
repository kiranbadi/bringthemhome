export type Vote = 'like' | 'dislike' | null;
export type ContentKind = 'discussions' | 'comments';
export interface VoteState {
  like_count: number;
  dislike_count: number;
  current_user_vote: Vote;
}
export interface Attachment {
  id: string;
  media_type: 'image' | 'video';
  content_type: string;
  display_url: string;
  status: 'pending' | 'ready' | 'rejected';
}
export interface DiscussionComment extends VoteState {
  id: string;
  discussion_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  attachments: Attachment[];
}
export interface Discussion extends VoteState {
  id: string;
  missing_person_id: string;
  user_id: string;
  author_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  reply_count: number;
  attachments: Attachment[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface ListQuery {
  page: number;
  page_size: number;
  search: string;
  sort: 'newest' | 'oldest' | 'most_liked';
}
export interface CreateComment {
  content: string;
  attachment_ids: string[];
}
export interface CreateDiscussion extends CreateComment {
  title: string;
}
export interface UploadTicket {
  upload_id: string;
  upload_url: string;
  headers: Record<string, string>;
}
export function validateMedia(files: File[]): string {
  if (!files.length) return '';
  const images = files.every((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
  const video = files.length === 1 && files[0].type === 'video/mp4';
  if (!(images && files.length <= 3) && !video)
    return 'Choose up to 3 JPEG, PNG or WebP images, or one MP4 video. Do not mix images and video.';
  if (files.some((f) => f.size > (f.type.startsWith('image/') ? 5 : 25) * 1024 * 1024))
    return 'Images must be 5 MB or less; videos must be 25 MB or less.';
  if (files.some((f) => f.size === 0)) return 'Empty files cannot be uploaded.';
  return '';
}
export function optimisticVote(state: VoteState, vote: Vote): VoteState {
  return {
    like_count: Math.max(
      0,
      state.like_count - Number(state.current_user_vote === 'like') + Number(vote === 'like'),
    ),
    dislike_count: Math.max(
      0,
      state.dislike_count -
        Number(state.current_user_vote === 'dislike') +
        Number(vote === 'dislike'),
    ),
    current_user_vote: vote,
  };
}
export function readyMedia(attachments: Attachment[]): Attachment[] {
  return attachments.filter(
    (a) =>
      a.status === 'ready' &&
      /^https?:\/\//i.test(a.display_url) &&
      ((a.media_type === 'image' &&
        ['image/jpeg', 'image/png', 'image/webp'].includes(a.content_type)) ||
        (a.media_type === 'video' && a.content_type === 'video/mp4')),
  );
}
