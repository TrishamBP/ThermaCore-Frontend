---
paths:
  - "src/features/**"
  - "src/hooks/**"
  - "src/lib/**"
  - "src/app/**/*.tsx"
---

# State management

Pick the smallest tool that fits. In order:

1. **Server state** (anything from the backend) → TanStack Query. Never copy query data into `useState` or a global
   store "to cache it".
2. **Shareable view state** (run, time range, filters, selected asset/object, overlay type, active tab) → URL search
   params. Parse/validate them with Zod in one hook per page (`useDashboardParams`).
3. **Local UI state** (open dialog, hover, form draft) → `useState`/`useReducer` in the component that owns it.
4. **High-frequency live state** (digital-twin SSE updates) → a small external store read with selectors
   (`useSyncExternalStore`, or Zustand if approved). Rationale: thousands of updates must not rerender the page tree
   or invalidate TanStack queries on every event.
5. React Context only for stable, rarely changing values (config, QueryClient, theme). Never put telemetry in context.

## Rules

- One source of truth per piece of data. Derived values are computed (selectors), not stored.
- Live twin store: keyed by `object_id`; each entry keeps `lastEventId`, `last_telemetry_timestamp`, and the latest
  compact state. Apply a `telemetry_update` only if its `last_telemetry_timestamp` is newer than the stored one, and an
  `asset_status_change` (which has no timestamp) only if its event `id` is greater than the entry's `lastEventId`
  (protects against replays and duplicates). Reducers are pure functions in `features/digital-twin/lib/` with unit tests.
- `resync_required` / detected restart → replace the store from a fresh `GET /digital-twin/state`, don't merge.
- SSE events may invalidate TanStack queries, but debounced and targeted: `recommendation_created` → recommendation
  lists; `alert_created` → alerts; `telemetry_update` for the **selected** asset → its inspection query (≤ 1 per 10 s).
- Selection state (selected twin object) lives in the URL (`?object=srv-013`) so it survives reloads and is shareable.
- Forms: controlled inputs with local state; validate with the same constraints as the backend (reviewer pattern
  `^[\w .@-]+$`, 1–100 chars; note ≤ 2000; message 1–2000) before submitting, and still render backend 422 details.
- Never persist operational data to `localStorage`. Allowed: UI preferences (collapsed panels, chosen overlay), copilot
  `conversation_id` in `sessionStorage` (it expires server-side after 1 h anyway).
