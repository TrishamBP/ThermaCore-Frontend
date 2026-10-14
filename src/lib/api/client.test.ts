import { z } from "zod";

import { apiRequest, buildQuery } from "./client";
import { ApiError } from "./errors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-request-id": "hdr" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildQuery", () => {
  it("skips undefined/null/empty, joins arrays, serializes dates as UTC ISO", () => {
    expect(buildQuery({ a: undefined, b: null, c: "", d: ["x", "y"], e: new Date("2026-01-01T00:00:00Z"), f: 0 })).toBe(
      "?d=x%2Cy&e=2026-01-01T00%3A00%3A00.000Z&f=0",
    );
    expect(buildQuery({})).toBe("");
  });
});

describe("apiRequest", () => {
  it("validates the response with the schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ status: "ok" })));
    await expect(apiRequest("/health", { schema: z.object({ status: z.literal("ok") }) })).resolves.toEqual({ status: "ok" });
  });

  it("raises contract_mismatch when the response does not match", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ status: 3 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(apiRequest("/health", { schema: z.object({ status: z.string() }) })).rejects.toMatchObject({
      code: "contract_mismatch",
      requestId: "hdr",
    });
  });

  it("normalizes the backend error envelope (GET 503 is retryable)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "database_unavailable", message: "down", details: null }, request_id: "rid" }, 503)));
    const err = await apiRequest("/assets", { schema: z.unknown() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 503, code: "database_unavailable", requestId: "rid", retryable: true });
  });

  it("POST errors are never retryable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "database_unavailable", message: "down" }, request_id: "rid" }, 503)));
    const err = await apiRequest("/recommendations/generate", { method: "POST", body: {}, schema: z.unknown() }).catch((e: unknown) => e);
    expect(err).toMatchObject({ retryable: false });
  });

  it("maps network failures to network_error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(apiRequest("/health", { schema: z.unknown() })).rejects.toMatchObject({ code: "network_error", retryable: true });
  });

  it("sends JSON bodies and a request id through the same-origin proxy", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => json({}));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("/copilot/chat", { method: "POST", body: { message: "hi" }, schema: z.unknown() });
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = init!.headers as Record<string, string>;
    expect(url).toBe("/api/backend/v1/copilot/chat");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Request-ID"]).toMatch(/^[0-9a-f]{32}$/);
    expect(init!.body).toBe('{"message":"hi"}');
  });
});
