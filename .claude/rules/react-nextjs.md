---
paths:
  - "src/**/*.tsx"
  - "src/app/**"
  - "next.config.*"
---

# React and Next.js

## App Router

- Pages and layouts are Server Components unless they need client behaviour. Keep them thin (see
  `frontend-architecture.md`).
- Every data route segment has `loading.tsx` (skeleton matching the final layout) and `error.tsx` (client
  component, shows `ErrorBanner` with retry via `reset()`), plus `not-found.tsx` where a 404 is meaningful
  (unknown asset, recommendation, layout object).
- Live operational data is never statically cached: server-side fetches use `cache: "no-store"` (the backend sends
  `Cache-Control: no-store`), and pages that read it are dynamic. Do not use ISR for telemetry.
- Route params are validated (asset ID pattern `^[A-Za-z0-9._:-]{1,64}$`, recommendation `^rec-[0-9a-f]{20}$`)
  before calling the backend; invalid → `notFound()`.
- URL is the source of truth for shareable view state: selected run, time range, filters, selected twin object,
  overlay type (`useSearchParams` + `router.replace`, no history spam).
- Server Actions are not used for backend mutations; mutations go through `lib/api` from client components so that
  pending/error states and request IDs are handled uniformly.

## Components

- One component per file; file name = component name. Props typed with an exported `XProps` type.
- Composition over configuration: prefer `children`/slots to boolean-prop explosions.
- No data fetching inside `components/`; features pass data in.
- No derived state in `useState`; compute during render or `useMemo` when expensive.
- `useEffect` only to synchronize with external systems (SSE, WebGL, timers). Every effect that subscribes cleans
  up. Effects must be safe under React Strict Mode double-invocation in development (no duplicate SSE
  connections, polls or POSTs).
- Keys are stable backend IDs, never array indexes for dynamic lists.
- Lists with > ~200 rows use virtualization only if measured to be slow; ask before adding a library.
- Long-running mutations (`/recommendations/generate`, copilot) show progress, can be cancelled
  (`AbortController`), and keep the form state on failure.

## Performance

- `next/dynamic` with `ssr: false` for the Three.js canvas and heavy chart panels below the fold.
- Memoize chart data transforms keyed on the response object, not on every render.
- Avoid context providers that change on every telemetry update; use selectors (see `state-management.md`).
- Images via `next/image`; fonts via `next/font` (self-hosted, no layout shift).
