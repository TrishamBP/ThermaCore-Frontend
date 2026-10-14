---
paths:
  - "src/**/*.tsx"
---

# Accessibility

Target: WCAG 2.2 AA.

- Semantic HTML first (`button`, `nav`, `main`, `table`, `th scope`), ARIA only to fill gaps.
- Every interactive element is keyboard reachable with a visible focus ring (2 px `--tc-fg` `#FBFF12` outline with
  offset; never `outline: none` without a replacement).
- Text contrast ≥ 4.5:1 (3:1 for large text and UI component boundaries). The palette in
  `styling-and-design-system.md` is pre-checked; do not introduce new colour pairs without checking them.
- Status is never colour-only: icon + text label. Charts use line style (solid vs dashed for predicted) and markers in
  addition to colour.
- Unavailable values: visible "—" plus accessible text, e.g. `aria-label="Cooling efficiency: not measured"`.
- Charts: a text summary (latest, min, max, trend) and a "view as table" toggle for the plotted data.
- Data tables: `<caption>` or `aria-label`, sortable headers use `aria-sort`.
- Live regions: connection status and new-alert notices use `aria-live="polite"`, rate-limited; never announce every
  telemetry update.
- Dialogs (review decision confirmation): focus trapped, `Esc` closes, focus returns to the trigger, the dialog title
  states the decision.
- Forms: labels bound to inputs, errors linked via `aria-describedby`, backend 422 `details[].loc` mapped to fields.
- Digital twin: the accessible asset list is the complete alternative to the canvas (see
  `threejs-digital-twin.md`).
- Respect `prefers-reduced-motion`. No content flashes more than 3 times per second.
- Copilot answers render as structured text (headings for sections, lists for evidence), readable by screen readers;
  streaming/progress state announced once.
