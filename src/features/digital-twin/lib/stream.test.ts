import { TwinStream, backoffDelay, type EventSourceLike } from "./stream";

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, ((e: MessageEvent<string>) => void)[]>();
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, l: (e: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), l]);
  }
  close() {
    this.closed = true;
  }
  emit(id: number, event: string, data: Record<string, unknown> = {}) {
    const payload = JSON.stringify({ id, event, asset_id: null, timestamp: "2026-10-14T00:00:00Z", data });
    for (const l of this.listeners.get(event) ?? []) l({ data: payload } as MessageEvent<string>);
  }
  fail() {
    this.onerror?.(new Event("error"));
  }
}

function setup() {
  FakeEventSource.instances = [];
  const onEvent = vi.fn();
  const onResync = vi.fn();
  const onStatus = vi.fn();
  const stream = new TwinStream({
    url: "/api/backend/v1/digital-twin/stream",
    onEvent,
    onResync,
    onStatus,
    createEventSource: (u) => new FakeEventSource(u),
    random: () => 1,
  });
  return { stream, onEvent, onResync, onStatus, es: () => FakeEventSource.instances.at(-1)! };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TwinStream", () => {
  it("goes live on the first heartbeat and forwards data events only", () => {
    const { stream, onEvent, onStatus, es } = setup();
    stream.start();
    es().emit(1, "heartbeat", { subscribed: true });
    es().emit(2, "telemetry_update", { object_id: "srv-001" });
    expect(onStatus).toHaveBeenLastCalledWith("live");
    expect(onEvent).toHaveBeenCalledTimes(1);
    stream.stop();
  });

  it("drops duplicate ids but accepts replayed lower ids after the heartbeat", () => {
    const { stream, onEvent, es } = setup();
    stream.start();
    es().emit(10, "heartbeat");
    es().emit(7, "telemetry_update", { object_id: "a" });
    es().emit(7, "telemetry_update", { object_id: "a" });
    expect(onEvent).toHaveBeenCalledTimes(1);
    stream.stop();
  });

  it("passes resync_required to onResync", () => {
    const { stream, onResync, es } = setup();
    stream.start();
    es().emit(1, "heartbeat");
    es().emit(2, "resync_required", { reason: "client too slow; events dropped" });
    expect(onResync).toHaveBeenCalledWith("client too slow; events dropped");
    stream.stop();
  });

  it("reconnects with backoff, sends last_event_id and resyncs", () => {
    const { stream, onResync, onStatus, es } = setup();
    stream.start();
    es().emit(1, "heartbeat");
    es().emit(5, "alert_created", { asset_id: "SIM-NA-001" });
    es().fail();
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    vi.advanceTimersByTime(backoffDelay(0, () => 1));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(es().url).toContain("last_event_id=5");
    es().emit(9, "heartbeat");
    expect(onResync).toHaveBeenCalledWith("reconnected");
    stream.stop();
  });

  it("detects an API restart when ids go backwards on a new connection", () => {
    const { stream, onResync, es } = setup();
    stream.start();
    es().emit(40, "heartbeat");
    es().fail();
    vi.advanceTimersByTime(1000);
    es().emit(1, "heartbeat");
    expect(onResync).toHaveBeenCalledWith("API restarted (event ids reset)");
    stream.stop();
  });

  it("treats a silent connection as dead after the heartbeat timeout", () => {
    const { stream, es } = setup();
    stream.start();
    const first = es();
    first.emit(1, "heartbeat");
    vi.advanceTimersByTime(35_000);
    expect(first.closed).toBe(true);
    stream.stop();
  });

  it("reports polling after repeated failures; backoff is jittered and capped", () => {
    const { stream, onStatus, es } = setup();
    stream.start();
    for (let i = 0; i < 4; i++) {
      es().fail();
      vi.advanceTimersByTime(30_000);
    }
    expect(onStatus).toHaveBeenCalledWith("polling");
    expect(backoffDelay(20, () => 1)).toBe(30_000);
    expect(backoffDelay(0, () => 0)).toBe(500);
    stream.stop();
  });

  it("stop closes the connection and nothing reconnects", () => {
    const { stream, es } = setup();
    stream.start();
    const first = es();
    stream.stop();
    expect(first.closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
