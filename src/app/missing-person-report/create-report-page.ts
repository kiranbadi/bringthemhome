import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, DOCUMENT, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccountManagementService } from '../services/account-management';
import { NavigationHeader } from '../shared/navigation-header/navigation-header';
import { MissingPersonReport } from './missing-person-report';
import { ReportContext } from './report-workflow';

const REPORT_CONTEXT_COOKIE = 'bth_report_context';

function matchingReportContext(
  candidate: Partial<ReportContext> | null | undefined,
  email: string,
): ReportContext | null {
  if (
    typeof candidate?._id !== 'string' ||
    !candidate._id.trim() ||
    typeof candidate.report_id !== 'string' ||
    !candidate.report_id.trim() ||
    typeof candidate.user_id !== 'string' ||
    candidate.user_id.trim().toLowerCase() !== email
  ) {
    return null;
  }
  return { _id: candidate._id.trim(), report_id: candidate.report_id.trim(), user_id: email };
}

@Component({
  imports: [MatButtonModule, RouterLink, NavigationHeader, MissingPersonReport],
  template: `
    @if (reportContext(); as report) {
      <app-missing-person-report [reportContext]="report" />
    } @else {
      <app-navigation-header />
      <main>
        <h1>Create Missing Person Report</h1>
        @if (pending()) {
          <p role="status">Creating your report…</p>
        } @else {
          <p role="alert">{{ error() }}</p>
          @if (signInRequired()) {
            <a
              matButton="filled"
              routerLink="/login"
              [queryParams]="{ returnUrl: '/missing-person-report' }"
              >Sign in</a
            >
          } @else {
            <button matButton="filled" type="button" class="report-retry" (click)="createReport()">
              Try again
            </button>
          }
          <a matButton routerLink="/myaccount">My Account</a>
        }
      </main>
    }
  `,
  styles: `
    main {
      max-width: 75rem;
      margin-inline: auto;
      padding: 1.5rem;
    }
  `,
})
export class CreateReportPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly reportContext = signal<ReportContext | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly signInRequired = signal(false);

  ngOnInit(): void {
    this.createReport();
  }

  protected createReport(): void {
    if (this.pending() || this.reportContext()) return;
    const email = this.account.currentUser?.email?.trim().toLowerCase();
    if (!email) {
      this.requireSignIn();
      return;
    }

    const existing = this.readReportCookie(email);
    if (existing) {
      this.reportContext.set(existing);
      return;
    }

    this.error.set('');
    this.pending.set(true);
    this.http
      .post<ReportContext & { report_status: 'DRAFT' }>(
        `${environment.apiUrl}${environment.apiBaseUrl}/api/v2/person-reports`,
        { user_id: email },
        { withCredentials: true },
      )
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => {
          this.pending.set(false);
          const context = matchingReportContext(draft, email);
          if (!context || draft.report_status !== 'DRAFT') {
            this.error.set('The server did not return a valid draft. Please try again.');
            return;
          }
          const value = encodeURIComponent(JSON.stringify(context));
          const secure = this.document.location.protocol === 'https:' ? '; Secure' : '';
          this.document.cookie = `${REPORT_CONTEXT_COOKIE}=${value}; Path=/; SameSite=Lax${secure}`;
          this.reportContext.set(context);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.requireSignIn();
          } else {
            this.error.set('Could not create your report. Please try again.');
          }
        },
      });
  }

  private readReportCookie(email: string): ReportContext | null {
    const cookies = this.document.cookie.split(';').map((cookie) => cookie.trim());
    const read = (name: string): string | undefined => {
      const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
      return match === undefined ? undefined : decodeURIComponent(match.slice(name.length + 1));
    };

    try {
      const combined = read(REPORT_CONTEXT_COOKIE);
      const candidate =
        combined === undefined
          ? { _id: read('_id'), report_id: read('report_id'), user_id: read('user_id') }
          : JSON.parse(combined);
      return matchingReportContext(candidate, email);
    } catch {
      return null;
    }
  }

  private requireSignIn(): void {
    this.account.clearLocalSession();
    this.signInRequired.set(true);
    this.error.set('Your session has expired. Sign in to create a report.');
  }
}
