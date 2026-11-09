import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { ReportActionDialog } from './report-action-dialog';
import { ReportSummary } from './report-workflow';

type ReviewDetails = ReportSummary & {
  version: number;
  can_review: boolean;
  sections: Record<string, Record<string, unknown>> & {
    media_section?: {
      photos?: { name: string; url: string }[];
      videos?: { name: string; url: string }[];
      notes?: string;
    };
  };
};

const sectionLabels = {
  last_seen_section: 'Last seen and circumstances',
  identity_section: 'Identity',
  physical_description_section: 'Physical description',
  social_media_section: 'Social media',
  educational_history_section: 'Educational history',
  employment_history_section: 'Employment history',
  possible_sighting_locations_section: 'Possible sightings',
  case_and_contact_section: 'Case and contact',
};

function fieldLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
}

interface ReviewField {
  key: string;
  label: string;
  text: string;
  records: ReviewField[][];
}

function reviewFields(value: object): ReviewField[] {
  return Object.entries(value).flatMap(([key, field]) => {
    const items: unknown[] = Array.isArray(field) ? field : [field];
    const records = items
      .filter((item): item is object => !!item && typeof item === 'object')
      .map(reviewFields)
      .filter((record) => record.length > 0);
    const text = items
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ');
    return text || records.length ? [{ key, label: fieldLabel(key), text, records }] : [];
  });
}

@Component({
  imports: [DatePipe, MatButtonModule, NavigationHeader, NgTemplateOutlet, RouterLink],
  templateUrl: './report-review-page.html',
  styleUrl: './report-review-page.scss',
})
export class ReportReviewPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly administrator = inject(ActivatedRoute).snapshot.data['administrator'] === true;
  private readonly endpoint = `${environment.apiUrl}${environment.apiBaseUrl}/api/v2/person-reports/${this.administrator ? 'admin/review' : 'mine'}`;

  protected readonly reports = signal<ReportSummary[]>([]);
  protected readonly selected = signal<ReviewDetails | null>(null);
  protected readonly loadingQueue = signal(false);
  protected readonly loadingReport = signal(false);
  protected readonly loading = computed(() => this.loadingQueue() || this.loadingReport());
  protected readonly deciding = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly pageSize = 20;
  private readonly queuePanel = viewChild<ElementRef<HTMLElement>>('queuePanel');
  private readonly reportPanel = viewChild<ElementRef<HTMLElement>>('reportPanel');
  protected readonly media = computed(() => {
    const media = this.selected()?.sections.media_section;
    return media?.photos?.length || media?.videos?.length || media?.notes?.trim() ? media : null;
  });
  protected readonly fields = computed(() => {
    const sections = this.selected()?.sections ?? {};
    return Object.entries(sectionLabels)
      .map(([key, label]) => ({ key, label, values: reviewFields(sections[key] ?? {}) }))
      .filter((section) => section.values.length > 0);
  });

  ngOnInit(): void {
    this.loadPage(1);
  }

  protected statusLabel(status: ReportSummary['report_status']): string {
    switch (status) {
      case 'SUBMITTED':
        return 'Awaiting review';
      case 'APPROVED':
        return 'Approved · publication pending';
      case 'REJECTED':
        return 'Changes requested';
      case 'PUBLISHED':
        return 'Published';
      case 'ARCHIVED':
        return 'Archived';
      default:
        return 'Draft';
    }
  }

  protected loadPage(page: number, nextIndex?: number): void {
    if (this.loading() || this.deciding()) return;
    this.selected.set(null);
    this.loadingQueue.set(true);
    this.error.set('');
    this.http
      .get<{ items: ReportSummary[]; total: number }>(this.endpoint, {
        withCredentials: true,
        params: { page, size: this.pageSize },
      })
      .pipe(
        timeout(15_000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingQueue.set(false)),
      )
      .subscribe({
        next: ({ items, total }) => {
          this.reports.set(items);
          this.total.set(total);
          this.page.set(page);
          const next =
            nextIndex === undefined ? undefined : items[Math.min(nextIndex, items.length - 1)];
          if (next) {
            this.loadingQueue.set(false);
            this.openReport(next._id);
          }
        },
        error: () => this.error.set('Could not load the reports. Please try again.'),
      });
  }

  protected openReport(documentId: string): void {
    if (this.loading() || this.deciding()) return;
    this.error.set('');
    this.loadingReport.set(true);
    this.http
      .get<ReviewDetails>(`${this.endpoint}/${encodeURIComponent(documentId)}`, {
        withCredentials: true,
      })
      .pipe(
        timeout(15_000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingReport.set(false)),
      )
      .subscribe({
        next: (report) => {
          this.selected.set(report);
          this.reportPanel()?.nativeElement.focus();
        },
        error: () => this.error.set('Could not open this report. Please try again.'),
      });
  }

  protected focusQueue(): void {
    this.queuePanel()?.nativeElement.focus();
  }

  protected decide(decision: 'APPROVE' | 'REJECT'): void {
    const report = this.selected();
    if (!report?.can_review || this.loading() || this.deciding()) return;
    this.deciding.set(true);
    this.dialog
      .open(ReportActionDialog, {
        data: decision === 'APPROVE' ? 'approve' : 'reject',
        width: '30rem',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: { reason: string } | undefined) => {
        if (result) this.saveDecision(report, decision, result.reason.trim());
        else this.deciding.set(false);
      });
  }

  private saveDecision(
    report: ReviewDetails,
    decision: 'APPROVE' | 'REJECT',
    reason: string,
  ): void {
    this.error.set('');
    this.notice.set('');
    this.http
      .post<ReportSummary>(
        `${this.endpoint}/${encodeURIComponent(report._id)}`,
        { decision, version: report.version, reason },
        { withCredentials: true },
      )
      .pipe(
        timeout(30_000),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deciding.set(false)),
      )
      .subscribe({
        next: (saved) => {
          this.notice.set(
            saved.report_status === 'PUBLISHED'
              ? 'Report published.'
              : 'Report returned for changes.',
          );
          this.deciding.set(false);
          const index = this.reports().findIndex((item) => item._id === report._id);
          const lastPage = Math.max(1, Math.ceil((this.total() - 1) / this.pageSize));
          this.loadPage(Math.min(this.page(), lastPage), Math.max(index, 0));
        },
        error: (error: unknown) => {
          const message =
            error instanceof HttpErrorResponse
              ? (error.error?.error_message ?? error.error?.detail)
              : undefined;
          this.error.set(
            typeof message === 'string'
              ? message
              : 'Could not save the decision. Refresh the report before retrying.',
          );
        },
      });
  }
}
