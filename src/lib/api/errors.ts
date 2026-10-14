import { z } from "zod";

const envelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  }),
  request_id: z.string().nullable().optional(),
});

export type ErrorDetail = Record<string, unknown>;

/** Every backend failure, normalized. `code` and `requestId` are preserved for the UI. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: readonly ErrorDetail[];
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: readonly ErrorDetail[] | null;
    requestId?: string | null;
    retryable?: boolean;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryable = init.retryable ?? false;
  }
}

const RETRYABLE_STATUS = new Set([502, 503, 504]);

/** Builds an ApiError from a non-2xx response body (the backend error envelope, if present). */
export function errorFromResponse(
  status: number,
  body: unknown,
  headerRequestId: string | null,
  method: string,
): ApiError {
  const parsed = envelopeSchema.safeParse(body);
  const idempotent = method === "GET";
  if (parsed.success) {
    const { error, request_id } = parsed.data;
    return new ApiError({
      status,
      code: error.code,
      message: error.message,
      details: error.details ?? null,
      requestId: request_id ?? headerRequestId,
      retryable: idempotent && RETRYABLE_STATUS.has(status) && error.code !== "stream_capacity_reached",
    });
  }
  return new ApiError({
    status,
    code: "unexpected_response",
    message: `Unexpected response from the backend (HTTP ${status})`,
    requestId: headerRequestId,
    retryable: idempotent && RETRYABLE_STATUS.has(status),
  });
}

export function networkError(cause: unknown, method: string): ApiError {
  const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
  return new ApiError({
    status: 0,
    code: timedOut ? "timeout" : "network_error",
    message: timedOut ? "The request timed out" : "Could not reach the ThermaCore API",
    retryable: method === "GET",
  });
}

export function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  return new ApiError({
    status: 0,
    code: "client_error",
    message: cause instanceof Error ? cause.message : "Unexpected error",
  });
}
