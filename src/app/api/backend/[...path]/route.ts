import type { NextRequest } from "next/server";

import { serverConfig } from "@/lib/config/server";
import { buildProxyTarget, errorEnvelope, pickResponseHeaders } from "@/lib/api/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context): Promise<Response> {
  const { path } = await context.params;
  const requestId = request.headers.get("x-request-id");
  const target = buildProxyTarget({
    segments: path,
    search: request.nextUrl.searchParams,
    incoming: request.headers,
    apiOrigin: serverConfig.apiOrigin,
    authToken: serverConfig.authToken,
  });
  if (!target.ok) {
    return Response.json(errorEnvelope(target.code, target.message, requestId), { status: target.status });
  }

  const isStream = target.url.includes("/api/v1/digital-twin/stream");
  // Abort upstream when the browser goes away, so the backend releases the SSE subscriber slot.
  const signal = isStream
    ? request.signal
    : AbortSignal.any([request.signal, AbortSignal.timeout(serverConfig.proxyTimeoutMs)]);

  let upstream: Response;
  try {
    upstream = await fetch(target.url, {
      method: request.method,
      headers: target.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      signal,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (cause) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    return Response.json(
      errorEnvelope(
        timedOut ? "backend_timeout" : "backend_unreachable",
        timedOut ? "The ThermaCore API did not respond in time" : "The ThermaCore API is not reachable",
        requestId,
      ),
      { status: timedOut ? 504 : 502 },
    );
  }

  const headers = pickResponseHeaders(upstream.headers);
  if (isStream) headers.set("cache-control", "no-cache, no-transform");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const POST = proxy;
