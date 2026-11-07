/** Persisted lifecycle values are supplied by the server, never inferred from form completion. */
export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'PUBLISHED' | 'ARCHIVED';
export type PersonStatus = 'MISSING' | 'FOUND_PENDING_REVIEW' | 'FOUND';
export interface ReportContext {
  readonly _id: string;
  readonly report_id: string;
  readonly user_id: string;
}
export interface ReportWorkflow {
  id: string;
  version: number;
  status: ReportStatus;
  person_status: PersonStatus;
  rejection_reason?: string | null;
  revision_status?: 'DRAFT' | 'SUBMITTED' | 'REJECTED' | null;
  updated_at: string;
  canonical_path?: string | null;
}
export type ReportAction =
  | 'save'
  | 'submit'
  | 'revise'
  | 'report-found'
  | 'archive'
  | 'approve'
  | 'reject'
  | 'confirm-found'
  | 'reject-found';
export function allowedReportActions(
  report: ReportWorkflow | null,
  administrator = false,
): ReportAction[] {
  if (!report || report.status === 'DRAFT' || report.status === 'REJECTED')
    return administrator ? [] : ['save', 'submit'];
  if (report.status === 'ARCHIVED') return [];
  if (administrator) {
    if (report.status === 'PUBLISHED' && report.person_status === 'FOUND_PENDING_REVIEW')
      return ['confirm-found', 'reject-found'];
    if (report.status === 'PUBLISHED' && report.person_status === 'FOUND') return [];
    if (report.status === 'PUBLISHED' && report.revision_status === 'SUBMITTED')
      return ['approve', 'reject'];
    if (report.status === 'SUBMITTED') return ['approve', 'reject'];
    return [];
  }
  if (report.status === 'PUBLISHED' && report.person_status === 'FOUND') return ['archive'];
  if (report.status === 'PUBLISHED' && report.person_status === 'FOUND_PENDING_REVIEW') return [];
  if (report.status === 'PUBLISHED' && report.revision_status)
    return ['DRAFT', 'REJECTED'].includes(report.revision_status) ? ['save', 'submit'] : [];
  if (report.status === 'PUBLISHED' && report.person_status === 'MISSING')
    return ['revise', 'report-found'];
  return [];
}
