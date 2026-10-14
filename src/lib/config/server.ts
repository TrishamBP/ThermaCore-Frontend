import "server-only";
import { z } from "zod";

const schema = z.object({
  API_ORIGIN: z.url().default("http://127.0.0.1:8000"),
  API_AUTH_TOKEN: z.string().optional(),
  API_PROXY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(120_000),
});

const parsed = schema.parse({
  API_ORIGIN: process.env.API_ORIGIN || undefined,
  API_AUTH_TOKEN: process.env.API_AUTH_TOKEN || undefined,
  API_PROXY_TIMEOUT_MS: process.env.API_PROXY_TIMEOUT_MS || undefined,
});

/** Server-only configuration (never exposed to the browser). */
export const serverConfig = {
  apiOrigin: parsed.API_ORIGIN.replace(/\/+$/, ""),
  authToken: parsed.API_AUTH_TOKEN,
  proxyTimeoutMs: parsed.API_PROXY_TIMEOUT_MS,
} as const;
