/**
 * Pure helpers for the same-origin proxy (src/app/api/backend/[...path]/route.ts).
 * Kept framework-free so the allowlist logic is unit-testable.
 */

const SEGMENT = /^[A-Za-z0-9._:-]+$/;
/** Admin-only or unsupported in the UI. */
const BLOCKED_PATHS = new Set(["cooling-model/train"]);
const FORWARD_REQUEST_HEADERS = ["accept", "content-type", "x-request-id", "last-event-id"] as const;
const FORWARD_RESPONSE_HEADERS = ["content-type", "cache-control", "x-request-id", "x-accel-buffering"] as const;

export type ProxyTarget =
  | { ok: true; url: string; headers: Headers }
  | { ok: false; status: number; code: string; message: string };

/** Validates the path (v1/... only), builds the upstream URL and the forwarded header set. */
export function buildProxyTarget(input: {
  segments: readonly string[];
  search: URLSearchParams;
  incoming: Headers;
  apiOrigin: string;
  authToken?: string | undefined;
}): ProxyTarget {
  const [version, ...rest] = input.segments;
  if (version !== "v1" || rest.length === 0) {
    return { ok: false, status: 404, code: "not_found", message: "Unknown API path" };
  }
  if (!rest.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) {
    return { ok: false, status: 400, code: "bad_request", message: "Invalid API path" };
  }
  const path = rest.join("/");
  if (BLOCKED_PATHS.has(path)) {
    return { ok: false, status: 403, code: "forbidden", message: "This operation is not available from the console" };
  }

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = input.incoming.get(name);
    if (value) headers.set(name, value);
  }
  // Manual SSE reconnects cannot set headers on EventSource; they pass ?last_event_id= instead.
  const search = new URLSearchParams(input.search);
  const lastEventId = search.get("last_event_id");
  search.delete("last_event_id");
  if (lastEventId && /^\d{1,12}$/.test(lastEventId) && !headers.has("last-event-id")) {
    headers.set("last-event-id", lastEventId);
  }
  if (input.authToken) headers.set("authorization", `Bearer ${input.authToken}`);

  const qs = search.toString();
  return { ok: true, url: `${input.apiOrigin}/api/v1/${path}${qs ? `?${qs}` : ""}`, headers };
}

export function pickResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

export function errorEnvelope(code: string, message: string, requestId: string | null) {
  return { error: { code, message, details: null }, request_id: requestId };
}
