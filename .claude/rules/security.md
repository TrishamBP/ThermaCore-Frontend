# Security

Always loaded.

- Secrets: the backend bearer token is `API_AUTH_TOKEN` in `frontend/.env.local` (gitignored), read only by
  server code (`lib/config/server.ts` with `import "server-only"`). Never `NEXT_PUBLIC_*`, never logged, never sent to
  the browser, never in Claude config or fixtures. Do not read or print `.env.local`.
- `.env.example` contains names and safe local defaults only.
- The proxy is an allowlist (see `api-integration.md`): fixed upstream origin, validated path segments, forwarded
  header allowlist, no cookie forwarding, no open redirect/SSRF.
- Rendering: never `dangerouslySetInnerHTML`. Copilot/LLM text, recommendation explanations and backend messages are
  rendered as plain text (or through a sanitizing Markdown renderer only if approved, with raw HTML disabled).
  Links from responses (`recommendations[].link`) are rendered only if they are relative app paths.
- No equipment control UI. Do not build features that imply actuation; review decisions record a review only.
- `reviewer` is free text, not an identity; label it as such and never treat it as authentication.
- Security headers in `next.config.ts`: `Content-Security-Policy` (self; `connect-src 'self'` since the browser only
  talks to the proxy; allow `blob:` / `'wasm-unsafe-eval'` only if Three.js loaders need them), `X-Content-Type-Options:
  nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` minimal.
- Error UI shows `code`, a safe message and `request_id`; never raw stack traces or upstream bodies that are not the
  error envelope.
- Dependencies: ask before adding; prefer well-maintained packages; run `pnpm audit` before milestones and report it.
- Claude Code: do not run mutating backend calls (`POST /recommendations/generate`, `/decisions`,
  `/cooling-model/train`) against the shared store without the user's go-ahead; read-only GETs are fine for contract
  verification.
