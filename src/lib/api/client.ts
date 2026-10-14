import type { z } from "zod";

import { publicConfig } from "@/lib/config/public";

import { ApiError, errorFromResponse, isAbortError, networkError } from "./errors";

export type QueryValue = string | number | boolean | Date | readonly string[] | null | undefined;
export type QueryParams = Readonly<Record<string, QueryValue>>;

export interface RequestOptions<S extends z.ZodType> {
  method?: "GET" | "POST";
  query?: QueryParams;
  body?: unknown;
  schema: S;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = { GET: 15_000, POST: 90_000 } as const;

/** Serializes typed query params. Undefined/null are skipped: the backend rejects unknown or empty params. */
export function buildQuery(query: QueryParams | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (value instanceof Date) params.set(key, value.toISOString());
    else if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function newRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function mergeSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** The only function in the app that performs HTTP to the ThermaCore API. */
export async function apiRequest<S extends z.ZodType>(path: string, options: RequestOptions<S>): Promise<z.output<S>> {
  const method = options.method ?? "GET";
  const url = `${publicConfig.apiBaseUrl}${path}${buildQuery(options.query)}`;
  const headers: Record<string, string> = { Accept: "application/json", "X-Request-ID": newRequestId() };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: mergeSignals(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS[method]),
      cache: "no-store",
    });
  } catch (cause) {
    if (isAbortError(cause) && options.signal?.aborted) throw cause;
    throw networkError(cause, method);
  }

  const requestId = response.headers.get("x-request-id");
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) throw errorFromResponse(response.status, body, requestId, method);

  const parsed = options.schema.safeParse(body);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[thermacore] contract mismatch for ${method} ${path}`, parsed.error.issues);
    }
    throw new ApiError({
      status: response.status,
      code: "contract_mismatch",
      message: "The API response did not match the expected contract",
      requestId,
    });
  }
  return parsed.data;
}
