import { STREAM_EVENT_TYPES, streamEventSchema, type StreamEvent } from "@/lib/api/schemas/twin";

export type StreamStatus = "connecting" | "live" | "reconnecting" | "polling" | "stopped";

export interface EventSourceLike {
  addEventListener(type: string, listener: (e: MessageEvent<string>) => void): void;
  close(): void;
  onerror: ((e: Event) => void) | null;
}

export type TwinStreamOptions = {
  url: string;
  onEvent: (event: StreamEvent) => void;
  /** Full state re-fetch needed (resync_required, API restart, or reconnect after a gap). */
  onResync: (reason: string) => void;
  onStatus: (status: StreamStatus) => void;
  createEventSource?: (url: string) => EventSourceLike;
  random?: () => number;
  /** No event for this long → treat the connection as dead (server heartbeats every 15 s). */
  heartbeatTimeoutMs?: number;
  /** After this many consecutive failures, report "polling" (the view falls back to polling /state). */
  pollingAfterFailures?: number;
};

const DATA_EVENTS = new Set(STREAM_EVENT_TYPES.filter((t) => t !== "heartbeat" && t !== "resync_required"));

export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return Math.round(base * (0.5 + random() * 0.5));
}

/**
 * Live twin updates over SSE.
 * - dedupe by event id (ids are global per API process and have gaps by design; replayed events may arrive
 *   with ids lower than the first heartbeat, so a seen-set is used instead of a monotonic check)
 * - API restart detection: first id on a new connection ≤ the highest id seen before → resync
 * - every reconnect resyncs (cheap; guarantees no missed state) and sends last_event_id for replay
 */
export class TwinStream {
  private es: EventSourceLike | null = null;
  private attempt = 0;
  private connections = 0;
  private maxSeenId: number | null = null;
  private lastDataId: number | null = null;
  private firstOnConnection = true;
  private seen = new Set<number>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private readonly opts: Required<Omit<TwinStreamOptions, "createEventSource">> & Pick<TwinStreamOptions, "createEventSource">;

  constructor(options: TwinStreamOptions) {
    this.opts = { random: Math.random, heartbeatTimeoutMs: 35_000, pollingAfterFailures: 4, ...options };
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.es?.close();
    this.es = null;
    this.opts.onStatus("stopped");
  }

  private connect(): void {
    if (this.stopped) return;
    this.opts.onStatus(this.connections === 0 ? "connecting" : this.attempt >= this.opts.pollingAfterFailures ? "polling" : "reconnecting");
    const url = this.lastDataId !== null ? `${this.opts.url}?last_event_id=${this.lastDataId}` : this.opts.url;
    const create = this.opts.createEventSource ?? ((u: string) => new EventSource(u) as unknown as EventSourceLike);
    const es = create(url);
    this.es = es;
    this.firstOnConnection = true;
    this.connections += 1;
    for (const type of STREAM_EVENT_TYPES) {
      es.addEventListener(type, (e) => this.onMessage(e));
    }
    es.onerror = () => this.fail();
    this.armWatchdog();
  }

  private onMessage(e: MessageEvent<string>): void {
    if (this.stopped) return;
    let parsed: StreamEvent;
    try {
      const r = streamEventSchema.safeParse(JSON.parse(e.data));
      if (!r.success) return;
      parsed = r.data;
    } catch {
      return;
    }
    this.armWatchdog();

    if (this.firstOnConnection) {
      this.firstOnConnection = false;
      const restarted = this.maxSeenId !== null && parsed.id <= this.maxSeenId;
      if (restarted) {
        this.seen.clear();
        this.lastDataId = null;
        this.maxSeenId = null;
        this.opts.onResync("API restarted (event ids reset)");
      } else if (this.connections > 1) {
        this.opts.onResync("reconnected");
      }
      this.attempt = 0;
      this.opts.onStatus("live");
    }

    if (this.seen.has(parsed.id)) return;
    this.seen.add(parsed.id);
    if (this.seen.size > 2000) this.seen = new Set([...this.seen].slice(-1000));
    this.maxSeenId = Math.max(this.maxSeenId ?? 0, parsed.id);
    if (DATA_EVENTS.has(parsed.event as never)) this.lastDataId = Math.max(this.lastDataId ?? 0, parsed.id);

    if (parsed.event === "resync_required") {
      this.opts.onResync(typeof parsed.data.reason === "string" ? parsed.data.reason : "resync required");
    } else if (parsed.event !== "heartbeat") {
      this.opts.onEvent(parsed);
    }
  }

  private fail(): void {
    if (this.stopped) return;
    this.es?.close();
    this.es = null;
    this.clearTimers();
    this.attempt += 1;
    this.opts.onStatus(this.attempt >= this.opts.pollingAfterFailures ? "polling" : "reconnecting");
    this.retryTimer = setTimeout(() => this.connect(), backoffDelay(this.attempt - 1, this.opts.random));
  }

  private armWatchdog(): void {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => this.fail(), this.opts.heartbeatTimeoutMs);
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.retryTimer = null;
    this.watchdog = null;
  }
}
