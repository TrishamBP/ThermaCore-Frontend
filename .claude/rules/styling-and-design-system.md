---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "tailwind.config.*"
  - "postcss.config.*"
---

# Styling and design system

ThermaCore is a dark, technical operations console: dense, calm, precise. The interface must state operational
status accurately; it must never make simulated data look production-verified.

## Palette (user-specified: dark navy background, `#FBFF12` text and accent)

Contrast ratios below were computed (WCAG 2.x) against `bg`/`surface`/`raised`. All text and status colours are
≥ 4.5:1 on all three (lowest: critical on raised 4.96); `--tc-border` is decorative only (1.5:1) and must not be the
sole boundary of a control.

| Token | Hex | Use | Contrast on bg / surface / raised |
|---|---|---|---|
| `--tc-bg` | `#070D1F` | app background (deep navy) | — |
| `--tc-surface` | `#0C1630` | panels, cards, table body | — |
| `--tc-raised` | `#13203F` | hover rows, popovers, inputs | — |
| `--tc-border` | `#22325A` | hairline dividers (decorative only) | — |
| `--tc-border-strong` | `#5A71AA` | input/control borders (meets 3:1 non-text contrast) | 4.0 / 3.7 / 3.4 |
| `--tc-fg` | `#FBFF12` | primary text, headings, key values, primary accent, focus ring | 17.9 / 16.6 / 14.9 |
| `--tc-fg-secondary` | `#D9DC6A` | secondary text, labels | 13.3 / 12.3 / 11.0 |
| `--tc-fg-muted` | `#A3A66A` | captions, units, axis labels, timestamps | 7.6 / 7.0 / 6.3 |
| `--tc-on-accent` | `#070D1F` | text on `#FBFF12` fills (primary buttons) | 17.9 |

The accent and the primary text share `#FBFF12`, so hierarchy comes from size, weight and the secondary/muted
tints, not from extra hues. Use the accent fill sparingly: the primary action per view, the selected nav item and
the selected twin object. No gradients, glassmorphism, glows or decorative animation.

## Semantic status colours (never reuse the accent yellow for status)

| Token | Hex | Meaning | Pair with |
|---|---|---|---|
| `--tc-status-healthy` | `#2EE59D` | NORMAL, WITHIN_LIMIT, FRESH, OK | check icon |
| `--tc-status-warning` | `#FF9F1C` (amber, distinct from the yellow accent) | WARNING, APPROACHING_LIMIT, ELEVATED, `INCONCLUSIVE` | triangle icon |
| `--tc-status-critical` | `#FF4D5E` | CRITICAL, ABOVE_LIMIT, HIGH_THERMAL_LOAD | octagon icon |
| `--tc-status-stale` | `#A78BFA` | STALE freshness, `pipeline_stale` | clock icon |
| `--tc-status-unavailable` | `#8C95AA` | UNAVAILABLE, NO_DATA, not measured, not applicable | dashed outline / hatch + "—" |
| `--tc-status-info` | `#4FD1FF` | INFO, predicted values (`is_predicted`), model output | dashed line / "Predicted" tag |
| `--tc-status-restricted` | `#8C95AA` + lock icon | RESTRICTED (out of scope) | lock icon |

Status is never conveyed by colour alone: always icon and/or text label too. A single
`features/*/lib/status.ts`-style mapping per domain feeds `StatusBadge`; components never pick colours ad hoc.
Twin overlay `bands` statuses (`cool/normal/warm/hot`, `low/medium/high`) use a separate sequential overlay scale
(defined once in `features/digital-twin/lib/overlay-scale.ts`), and the legend says these are visual bands, not
equipment limits.

## Tokens and Tailwind

- Define tokens once as CSS variables in `src/app/globals.css` and expose them to Tailwind (Tailwind v4: `@theme`
  block; v3: `theme.extend` referencing `var(--tc-…)`). Components use token classes (`bg-surface`, `text-fg-muted`,
  `border-border`, `text-status-critical`), **never raw hex** or arbitrary colour values.
- Spacing: Tailwind 4 px scale; dense layouts use 2/3/4 (8/12/16 px) gaps; page padding 6 (24 px) desktop, 4 mobile.
- Radii: `--tc-radius-sm 4px` (badges, inputs), `--tc-radius-md 6px` (cards, panels). No pill-shaped cards.
- Shadows: none on surfaces; one subtle `--tc-shadow-popover` for floating layers only.
- Borders: 1 px `--tc-border` between panels; separate regions with surface contrast before borders.
- Typography: one sans for UI (e.g. Inter or Geist via `next/font`) and one mono for values, IDs and timestamps
  (e.g. JetBrains Mono or Geist Mono). Scale: 12 (captions), 13 (table body), 14 (body), 16 (section title),
  20 (page title), 28 (KPI value). Numeric values use `tabular-nums`. Units are rendered smaller, in
  `--tc-fg-muted`, next to the value.
- Dark only. Respect `prefers-reduced-motion` (disable non-essential transitions and twin camera easing).

## Reusable patterns (build once in `components/`, reuse everywhere)

- **KpiCard**: label, value + unit, `assets_reporting` coverage ("5 of 5 assets"), min/max, optional note, status.
  Compact (no oversized cards). Null value → `UnavailableValue`.
- **StatusBadge**: icon + label + semantic colour from the mapping.
- **MetricValue / UnavailableValue**: formats value + unit; null shows "—" plus the reason (tooltip and
  accessible text), never 0.
- **TimeSeriesChart**: Recharts line/area with gaps for `count: 0` (`connectNulls={false}`), optional min–max band,
  predicted series dashed in `--tc-status-info`, axes in muted tokens, tooltip showing unit and bucket.
- **DataTable**: compact rows (32–36 px), sticky header, sortable columns, mono IDs, right-aligned numbers,
  "load more" for cursor pagination.
- **AssetInspectionPanel**: header (IDs, type, freshness), latest values, cooling state + findings, history chart,
  forecast with persistence comparison, alerts, recommendations, provenance (generator, seed).
- **TimeRangeSelector** (presets bounded by the backend max range, simulated event time label) and **FilterBar**.
- **AlertList**, **RecommendationEvidencePanel** (evidence grouped by `kind`, missing evidence, uncertainty,
  invalidation conditions, explanation source).
- **Skeleton** (shape of final content), **EmptyState** (what is empty and why, next step), **ErrorBanner**
  (message, `code`, `request_id` copy button, retry when safe), **StaleBanner**.
- **ConfirmDialog** for review decisions: states the exact decision value and that no equipment command is sent.
- **SimulatedDataBadge**: persistent in the app shell header.

## Responsive

- Desktop-first console (≥ 1280 px): multi-column grids, side inspection panel.
- Tablet (768–1279): two columns, inspection panel as a sheet.
- Small (< 768): single column, tables become stacked rows, twin replaced by default with the accessible asset list
  (canvas still available on demand).
