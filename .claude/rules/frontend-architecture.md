# Frontend architecture

Always loaded. Applies to all frontend code.

## Target structure

This is a target, not permission to create empty folders. Create a directory when its first real file lands.

```text
frontend/
├── src/
│   ├── app/                              # routing only: layouts, pages, loading/error boundaries
│   │   ├── (console)/                    # route group: sidebar + top bar (implemented)
│   │   │   ├── layout.tsx                # Sidebar, TopBar (run selector, simulated badge, API status, alerts)
│   │   │   ├── overview/page.tsx         # landing page (`/` redirects here)
│   │   │   ├── telemetry/page.tsx        # ?asset=&range=&metrics=
│   │   │   ├── digital-twin/page.tsx     # ?object=&overlay=
│   │   │   ├── predictions/page.tsx      # ?asset=
│   │   │   ├── optimization/page.tsx     # ?asset=&rec=  (optimizer, fan peers, review queue)
│   │   │   ├── copilot/page.tsx
│   │   │   ├── alerts/page.tsx
│   │   │   └── system/page.tsx
│   │   ├── api/backend/[...path]/route.ts  # same-origin proxy to the FastAPI backend (see api-integration.md)
│   │   ├── globals.css                   # Tailwind + design tokens
│   │   └── layout.tsx                    # <html>, fonts, providers
│   ├── components/                       # domain-agnostic, reusable
│   │   ├── ui/                           # Button, Badge, Dialog, Table, Tabs, Skeleton …
│   │   ├── layout/                       # AppShell, PageHeader, SideNav
│   │   ├── charts/                       # TimeSeriesChart, Sparkline (no API knowledge)
│   │   ├── feedback/                     # ErrorBanner, EmptyState, StaleBanner, UnavailableValue
│   │   └── shared/                       # MetricValue, StatusBadge, TimeRangeSelector, FilterBar
│   ├── features/<page>/                  # overview, telemetry, digital-twin, predictions, optimization,
│   │   ├── *View.tsx                     #   copilot, alerts, system: one View per page + sub-components
│   │   └── lib/                          # pure domain logic (layout index, live store, SSE client), unit tested
│   ├── hooks/                            # useRun (URL run context), useShellQueries (shared queries)
│   ├── lib/
│   │   ├── api/                          # client, errors, endpoints, proxy (pure helpers), reads, mutations, schemas/
│   │   ├── config/                       # env parsing (server.ts is server-only; public.ts)
│   │   ├── format/                       # units, numbers, timestamps (display only)
│   │   ├── status.ts                     # the single status -> tone mapping
│   │   └── query-keys.ts                 # TanStack query-key factory
│   └── test/                             # setup + fixtures (captured backend responses)
├── e2e/                                  # Playwright specs
├── docs/backend-contract.md
├── .env.example
└── package.json, tsconfig.json, next.config.ts, eslint config, vitest config, playwright config
```

Shared hooks go in `src/hooks/` only when two or more features need them. `src/types/` is only for truly global
types; API types live next to their Zod schemas in `lib/api/schemas/`.

## Boundaries

- `app/` files are thin: read params, compose feature components, set metadata. No fetch logic, no business rules.
- Only `lib/api/` performs HTTP. Components and hooks call domain functions such as `getDashboardOverview()`.
- `components/` never imports from `features/` and never knows endpoint shapes; it receives typed props.
- Features may reuse another feature's exported components (the twin inspector reuses `features/telemetry/AssetBlocks`,
  `MetricChart` and `features/predictions/ForecastBlock`); never reach into another feature's `lib/` state.
- Domain logic that decides something (status → colour, freshness label, SSE reducer, layout tree building) is a
  pure function in `features/<domain>/lib/` with unit tests, not inline in JSX.
- One backend domain maps to one `lib/api/<domain>.ts` and one `features/<domain>`. Do not duplicate types across
  features.

## Server vs client components

- Pages and layouts are Server Components (thin). Data views are client components using TanStack Query through the
  proxy: all data is live (refreshed at most once a minute or via SSE), so a server-side first render was not worth a
  second code path.
- `"use client"` for: charts, filters/time-range state, TanStack Query consumers, SSE, dialogs and forms, anything
  using `window`/`localStorage`/`EventSource`/WebGL, and the whole Three.js subtree.
- Push `"use client"` as far down the tree as possible. Pass serializable props only.
- Three.js and other WebGL code load through `next/dynamic(..., { ssr: false })` inside a client component.

## Change discipline

- Read the files you are about to change, and their tests, first.
- Plan before multi-file changes (the `frontend-architect` agent or `/implement-feature`).
- No new dependency, global state library, or abstraction layer without a concrete need and user approval.
- When a decision changes architecture or integration, update this file or `docs/backend-contract.md` in the same
  change.
