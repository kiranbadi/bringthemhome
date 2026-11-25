import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { csrfInterceptor } from "../../core/auth/csrf.interceptor";
import { AccountManagementService } from "../../services/account-management";
import { SourceCheckComponent } from "./source-check.component";

const endpoint = "/bringthemhome/scrapers/nccmp/source-check";

class TestEventSource extends EventTarget {
  static latest: TestEventSource;
  readonly close = vi.fn();

  constructor(
    readonly url: string,
    readonly options: EventSourceInit,
  ) {
    super();
    TestEventSource.latest = this;
  }
}

describe("SourceCheckComponent", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", TestEventSource);
    TestBed.configureTestingModule({
      imports: [SourceCheckComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    vi.spyOn(
      TestBed.inject(AccountManagementService),
      "csrfToken",
      "get",
    ).mockReturnValue("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.inject(HttpTestingController).verify();
  });

  async function prepare() {
    const fixture = TestBed.createComponent(SourceCheckComponent);
    const http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.expectOne(endpoint + "/results").flush([]);
    return { fixture, http };
  }

  async function start() {
    const { fixture, http } = await prepare();
    fixture.componentInstance.start();
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe("POST");
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get("X-CSRF-Token")).toBe("test-token");
    request.flush({ job_id: "job 1" }, { status: 202, statusText: "Accepted" });
    expect(TestEventSource.latest.url).toBe(endpoint + "/events/job%201");
    expect(TestEventSource.latest.options.withCredentials).toBe(true);
    return { fixture, http, stream: TestEventSource.latest };
  }

  it("starts deletion only after confirmation and displays all deletion counts", async () => {
    const { fixture, http } = await prepare();
    const deletion = endpoint + "/delete";
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fixture.componentInstance.confirmDeletion();
    http.expectNone(deletion);

    confirm.mockReturnValue(true);
    fixture.componentInstance.confirmDeletion();
    const request = http.expectOne(deletion);
    expect(request.request.method).toBe("POST");
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get("X-CSRF-Token")).toBe("test-token");
    request.flush(
      { job_id: "delete 1" },
      { status: 202, statusText: "Accepted" },
    );

    const stream = TestEventSource.latest;
    expect(stream.url).toBe(deletion + "/events/delete%201");
    expect(stream.options.withCredentials).toBe(true);
    stream.dispatchEvent(
      new MessageEvent("case-deletion-finished", {
        data: JSON.stringify({
          status: "completed",
          deleted: 3,
          already_missing: 0,
          marked: 4,
        }),
      }),
    );
    http.expectOne(endpoint + "/results").flush([]);
    await fixture.whenStable();
    expect(stream.close).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain(
      "Case deletion outcome",
    );
    expect(fixture.nativeElement.textContent).toContain("deleted 3");
    expect(fixture.nativeElement.textContent).toContain("already missing 0");
    expect(fixture.nativeElement.textContent).toContain("marked 4");
  });

  it("uses the deletion status endpoint after its stream disconnects", async () => {
    const { fixture, http } = await prepare();
    const deletion = endpoint + "/delete";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fixture.componentInstance.confirmDeletion();
    http
      .expectOne(deletion)
      .flush({ job_id: "delete-2" }, { status: 202, statusText: "Accepted" });
    const stream = TestEventSource.latest;
    stream.dispatchEvent(new Event("error"));
    http.expectNone(endpoint + "/status");
    const status = http.expectOne(deletion + "/status");
    expect(status.request.withCredentials).toBe(true);
    status.flush({
      status: "partial",
      counts: { deleted: 1, already_missing: 0, marked: 2 },
    });
    http.expectOne(endpoint + "/results").flush([]);
    expect(fixture.componentInstance.outcome()?.counts?.["deleted"]).toBe(1);
    expect(stream.close).toHaveBeenCalledOnce();
  });

  it("closes the stream and reloads findings when the check finishes", async () => {
    const { fixture, http, stream } = await start();
    stream.dispatchEvent(
      new MessageEvent("source-check-finished", {
        data: JSON.stringify({ status: "partial", counts: { checked: 12 } }),
      }),
    );
    http.expectOne(endpoint + "/results").flush([{ case_id: "case-1" }]);
    await fixture.whenStable();
    expect(stream.close).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain("Partially completed");
    expect(fixture.nativeElement.textContent).toContain("12");
    expect(fixture.nativeElement.textContent).toContain("case-1");
  });

  it("checks status after a disconnect without starting a second job", async () => {
    const { fixture, http, stream } = await start();
    stream.dispatchEvent(new Event("error"));
    fixture.componentInstance.start();
    http.expectNone(endpoint);
    http
      .expectOne(endpoint + "/status")
      .flush({ job_id: "job 1", status: "failed" });
    http.expectOne(endpoint + "/results").flush([]);
    await fixture.whenStable();
    expect(stream.close).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain("Failed");
  });

  it("keeps polling while the job is running and stops after completion", async () => {
    const { fixture, http, stream } = await start();
    vi.useFakeTimers();
    try {
      stream.dispatchEvent(new Event("error"));
      const status = http.expectOne(endpoint + "/status");
      expect(status.request.withCredentials).toBe(true);
      status.flush({ job_id: "job 1", status: "running" });
      http.expectNone(endpoint + "/results");

      await vi.advanceTimersByTimeAsync(3000);
      http
        .expectOne(endpoint + "/status")
        .flush({ job_id: "job 1", status: "completed" });
      http.expectOne(endpoint + "/results").flush([]);
      expect(fixture.componentInstance.tracking()).toBe(false);

      await vi.advanceTimersByTimeAsync(3000);
      http.expectNone(endpoint + "/status");
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes the active stream when leaving the page", async () => {
    const { fixture, stream } = await start();
    fixture.destroy();
    expect(stream.close).toHaveBeenCalledOnce();
  });
});
