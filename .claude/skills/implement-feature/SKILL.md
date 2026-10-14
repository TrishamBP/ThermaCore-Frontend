---
name: implement-feature
description: End-to-end workflow for implementing a ThermaCore frontend feature or change — inspect requirements and existing code, identify affected modules, propose a minimal plan, implement with tests, verify, and summarize files changed and remaining risks. Use for any non-trivial frontend change.
---

# Implement a feature

## 1. Understand

- Restate the requirement in one or two sentences, with explicit non-goals.
- Read `.claude/CLAUDE.md`, `.claude/rules/frontend-architecture.md`, and every rule file whose scope the change
  touches (rules scoped by `paths` only load once a matching file is read, so read them explicitly when creating new
  files).
- Find related code: `Grep`/`Glob` for the feature folder, shared components, existing API functions and tests.
  Do not duplicate what exists.
- If the feature consumes backend data, confirm each endpoint/field in `docs/backend-contract.md`; anything not
  verified there → run `/integrate-api` first.

## 2. Plan (wait for approval if the change spans > 3 files, adds a dependency, or changes a contract/architecture)

- Affected modules (paths, new vs modified), server/client split, state placement, UI states to cover, tests.
- Smallest change that delivers the requirement; no speculative abstractions or rewrites.
- For large or cross-feature work, the `frontend-architect` agent can produce/review the plan.

## 3. Implement

- Follow the layer order: contract/types → domain logic (pure, tested) → hooks → components → route wiring.
- Every data view: loading, empty, error, stale, unavailable, populated. Simulated-data and human-review semantics
  preserved (see CLAUDE.md "Non-negotiable product truths").
- Tokens only for styling; accessible markup.

## 4. Verify

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e     # if a critical flow changed
```
Optionally run `pnpm dev` with the backend up and check the view manually (state what you checked).

## 5. Report

- Files created/modified (paths).
- Commands run and their actual results (copy failures verbatim).
- Contract assumptions and any discrepancies recorded in `docs/backend-contract.md`.
- Remaining risks, follow-ups, anything not verified.

## Done when

Typecheck, lint and tests were run and pass (or failures are reported honestly), all UI states exist, docs are
updated where architecture/integration changed, and no unverified backend field is used.
