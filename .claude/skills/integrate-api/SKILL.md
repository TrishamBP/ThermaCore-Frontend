---
name: integrate-api
description: Integrate a ThermaCore backend endpoint into the frontend — inspect the FastAPI route and Pydantic schemas in ../data_engineering, capture a real response, document the contract, implement the Zod schema, typed client function and query/mutation hook, handle loading/empty/unavailable/error states, and add mocked contract tests. Use before any UI consumes a new endpoint or field.
---

# Integrate an API endpoint

Read `.claude/rules/api-integration.md` and `docs/backend-contract.md` first.

## 1. Inspect the implementation (read-only)

- Route: `../data_engineering/src/app/<domain>/router.py` (method, path, query/body models, `responses=`).
- Models: the domain `schemas.py` / inline Pydantic classes, and nested `data_engineering.*` models they reference
  (e.g. `data_engineering/cooling/models.py`, `data_engineering/recommendations/schemas.py`).
- Untyped responses (`-> dict`, `dict[str, Any]`): read the service function that builds the dict.
- Errors: domain `exceptions.py`, `app/exceptions.py`, auth (`app/common/security/auth.py`).

## 2. Verify live

```bash
curl -s http://127.0.0.1:8000/api/v1/health
curl -s http://127.0.0.1:8000/openapi.json > /tmp/openapi.json      # check the operation + params
MSYS_NO_PATHCONV=1 curl -s "http://127.0.0.1:8000/api/v1/<path>?<params>"   # read-only GETs only
```
- Also trigger the main error cases with GETs (unknown ID → 404, bad param → 422) and capture the envelopes.
- For POST endpoints: `/copilot/chat` and `/digital-twin/analyze` use read-only store connections (in-memory
  conversation only); `/cooling/predict`, `/cooling/optimize` and `/cooling-optimizer/recommend` open a read-write
  session but no write calls exist in `app/cooling/service.py` (checked 2026-10-14). These may be called for
  verification. **Ask the user before** calling `/recommendations/generate`,
  `/recommendations/{id}/decisions`, or `/cooling-model/train` (they write or are admin-only).
- If the backend is not running, say so; do not proceed on documentation alone without flagging it.

## 3. Document

Update the endpoint row in `docs/backend-contract.md`: method/path, params/body, response (fields the UI uses),
errors, UI states, refresh/invalidation. Add discrepancies to the table (implementation wins).

## 4. Implement

1. Fixture: save the captured response to `src/test/fixtures/<domain>/<case>.json` (+ capture date and run ID in the
   fixtures README). Add edge fixtures (empty, unavailable, error envelope).
2. Zod schema + inferred types in `src/lib/api/schemas/<domain>.ts`.
3. Path builder in `src/lib/api/endpoints.ts`; function in `src/lib/api/<domain>.ts` using `apiRequest` (typed query,
   `signal`, timeout). Reads and mutations are separate functions.
4. Hook in `src/features/<domain>/hooks/` (query key factory, polling/invalidations per the contract doc; mutations
   `retry: 0`).
5. State mapping helpers (status → badge, null → unavailable) as pure functions.

## 5. Test

- Schema parses each fixture; unknown enum value degrades gracefully; extra fields tolerated.
- `apiRequest` error normalization for the endpoint's error codes (code + request ID preserved).
- Hook/component with MSW: loading, empty, error, unavailable, populated.
- Run `pnpm typecheck && pnpm lint && pnpm test`; report actual results.

## Done when

The contract is verified against code and a live response, documented, implemented with runtime validation, and
covered by passing mocked tests — with no field the backend does not return.
