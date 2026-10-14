import { buildProxyTarget, pickResponseHeaders } from "./proxy";

const base = { apiOrigin: "http://127.0.0.1:8000", search: new URLSearchParams(), incoming: new Headers() };

describe("proxy allowlist", () => {
  it("maps /v1/... to the backend /api/v1/... and keeps the query", () => {
    const t = buildProxyTarget({ ...base, segments: ["v1", "assets", "SIM-NA-013", "telemetry"], search: new URLSearchParams("interval=5m") });
    expect(t).toMatchObject({ ok: true, url: "http://127.0.0.1:8000/api/v1/assets/SIM-NA-013/telemetry?interval=5m" });
  });

  it.each([[["v2", "health"]], [["v1"]], [["v1", ".."]], [["v1", "a b"]], [["v1", "http:", "", "evil.com"]]])("rejects %j", (segments) => {
    expect(buildProxyTarget({ ...base, segments }).ok).toBe(false);
  });

  it("blocks the admin training endpoint", () => {
    expect(buildProxyTarget({ ...base, segments: ["v1", "cooling-model", "train"] })).toMatchObject({ ok: false, status: 403 });
  });

  it("forwards only allowlisted headers (no cookies, no browser authorization)", () => {
    const incoming = new Headers({ cookie: "s=1", "content-type": "application/json", "x-request-id": "abc", authorization: "Bearer browser" });
    const t = buildProxyTarget({ ...base, segments: ["v1", "copilot", "chat"], incoming });
    if (!t.ok) throw new Error("expected ok");
    expect(t.headers.get("cookie")).toBeNull();
    expect(t.headers.get("authorization")).toBeNull();
    expect(t.headers.get("x-request-id")).toBe("abc");
  });

  it("injects the server-side token only when configured", () => {
    const t = buildProxyTarget({ ...base, segments: ["v1", "health"], authToken: "secret" });
    if (!t.ok) throw new Error("expected ok");
    expect(t.headers.get("authorization")).toBe("Bearer secret");
  });

  it("moves last_event_id from the query to the Last-Event-ID header", () => {
    const t = buildProxyTarget({ ...base, segments: ["v1", "digital-twin", "stream"], search: new URLSearchParams("last_event_id=42") });
    if (!t.ok) throw new Error("expected ok");
    expect(t.url).toBe("http://127.0.0.1:8000/api/v1/digital-twin/stream");
    expect(t.headers.get("last-event-id")).toBe("42");
  });

  it("copies only safe response headers", () => {
    const h = pickResponseHeaders(new Headers({ "content-type": "text/event-stream", "x-request-id": "r1", "set-cookie": "x" }));
    expect(h.get("content-type")).toBe("text/event-stream");
    expect(h.get("set-cookie")).toBeNull();
  });
});
