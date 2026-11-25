import { JsonPipe, KeyValuePipe } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { RouterLink } from "@angular/router";
import {
  catchError,
  exhaustMap,
  filter,
  Observable,
  Subscription,
  startWith,
  switchMap,
  take,
  throwError,
  timer,
} from "rxjs";
import { environment } from "../../../environments/environment";
import { NavigationHeader } from "../../shared/navigation-header/navigation-header";

const endpoint = `${environment.apiBaseUrl}/scrapers/nccmp/source-check`;
const jobs = {
  check: {
    endpoint,
    finishedEvent: "source-check-finished",
    label: "source check",
  },
  deletion: {
    endpoint: `${endpoint}/delete`,
    finishedEvent: "case-deletion-finished",
    label: "case deletion",
  },
} as const;
type JobKind = keyof typeof jobs;
type Job = (typeof jobs)[JobKind];

const outcomes = {
  completed: "Completed",
  partial: "Partially completed",
  failed: "Failed",
} as const;

interface SourceCheckStatus {
  job_id?: string;
  status: string;
  counts?: Record<string, number | undefined> | null;
  deleted?: number;
  already_missing?: number;
  marked?: number;
}

type FinishedCheck = SourceCheckStatus & { status: keyof typeof outcomes };

function isFinished(value: unknown): value is FinishedCheck {
  if (!value || typeof value !== "object" || !("status" in value)) return false;
  return (
    value.status === "completed" ||
    value.status === "partial" ||
    value.status === "failed"
  );
}

@Component({
  selector: "app-source-check",
  imports: [
    JsonPipe,
    KeyValuePipe,
    MatButtonModule,
    NavigationHeader,
    RouterLink,
  ],
  templateUrl: "./source-check.component.html",
  styleUrl: "./source-check.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceCheckComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly credentials = { withCredentials: true };
  private resultsRequest?: Subscription;

  readonly outcomes = outcomes;
  readonly jobKind = signal<JobKind>("check");
  readonly jobId = signal<string | null>(null);
  readonly tracking = signal(false);
  readonly polling = signal(false);
  readonly jobError = signal("");
  readonly outcome = signal<FinishedCheck | null>(null);
  readonly results = signal<{ data: unknown } | null>(null);
  readonly loadingResults = signal(false);
  readonly resultsError = signal("");

  readonly isEmptyList = (data: unknown) =>
    Array.isArray(data) && data.length === 0;

  ngOnInit(): void {
    this.loadResults();
  }

  start(): void {
    this.startJob("check");
  }

  confirmDeletion(): void {
    if (this.tracking() || this.jobId()) return;
    if (
      window.confirm(
        "Remove expired NCCMP cases from MissingLives? This action cannot be undone.",
      )
    ) {
      this.startJob("deletion");
    }
  }

  private startJob(kind: JobKind): void {
    if (this.tracking() || this.jobId()) return;
    const job = jobs[kind];
    this.jobKind.set(kind);
    this.tracking.set(true);
    this.jobError.set("");
    this.outcome.set(null);
    this.http
      .post<{ job_id: string }>(job.endpoint, {}, this.credentials)
      .pipe(
        switchMap((response) => {
          if (!response?.job_id?.trim()) {
            return throwError(() => new Error("Missing source-check job ID"));
          }
          this.jobId.set(response.job_id);
          return this.finishedEvent(job, response.job_id).pipe(
            catchError(() => this.checkStatus(job, response.job_id)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (outcome) => this.finish(outcome),
        error: () => this.trackingFailed(),
      });
  }

  resumeTracking(): void {
    const jobId = this.jobId();
    if (!jobId || this.tracking()) return;
    this.tracking.set(true);
    this.jobError.set("");
    this.checkStatus(jobs[this.jobKind()], jobId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (outcome) => this.finish(outcome),
        error: () => this.trackingFailed(),
      });
  }

  loadResults(): void {
    this.resultsRequest?.unsubscribe();
    this.loadingResults.set(true);
    this.resultsError.set("");
    this.resultsRequest = this.http
      .get<unknown>(`${endpoint}/results`, this.credentials)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.results.set({ data });
          this.loadingResults.set(false);
        },
        error: () => {
          this.resultsError.set(
            "Could not load the latest findings. Try refreshing the results.",
          );
          this.loadingResults.set(false);
        },
      });
  }

  private finishedEvent(job: Job, jobId: string): Observable<FinishedCheck> {
    return new Observable<FinishedCheck>((subscriber) => {
      const stream = new EventSource(
        `${job.endpoint}/events/${encodeURIComponent(jobId)}`,
        this.credentials,
      );
      stream.addEventListener(job.finishedEvent, (event) => {
        try {
          const data: unknown = JSON.parse(
            (event as MessageEvent<string>).data,
          );
          if (!isFinished(data))
            throw new Error("Invalid source-check outcome");
          subscriber.next(data);
        } catch (error) {
          subscriber.error(error);
        }
      });
      stream.addEventListener("error", () =>
        subscriber.error(new Error("Source-check stream disconnected")),
      );
      return () => stream.close();
    }).pipe(take(1));
  }

  private checkStatus(job: Job, jobId: string): Observable<FinishedCheck> {
    this.polling.set(true);
    return timer(3000, 3000).pipe(
      startWith(0),
      exhaustMap(() =>
        this.http.get<SourceCheckStatus>(
          `${job.endpoint}/status`,
          this.credentials,
        ),
      ),
      filter(
        (status): status is FinishedCheck =>
          isFinished(status) && (!status.job_id || status.job_id === jobId),
      ),
      take(1),
    );
  }

  private finish(outcome: FinishedCheck): void {
    if (this.jobKind() === "deletion") {
      const counts = {
        deleted: outcome.deleted ?? outcome.counts?.["deleted"],
        already_missing:
          outcome.already_missing ?? outcome.counts?.["already_missing"],
        marked: outcome.marked ?? outcome.counts?.["marked"],
      };
      this.outcome.set({ ...outcome, counts });
    } else {
      this.outcome.set(outcome);
    }
    this.jobId.set(null);
    this.polling.set(false);
    this.tracking.set(false);
    this.loadResults();
  }

  private trackingFailed(): void {
    this.polling.set(false);
    this.tracking.set(false);
    this.jobError.set(
      this.jobId()
        ? "Could not check the job status. Check status again to resume tracking."
        : `Could not start the ${jobs[this.jobKind()].label}. Try again.`,
    );
  }
}
