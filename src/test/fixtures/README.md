# Test fixtures

Captured from the running backend on 2026-10-14 (read-only GETs, plus `POST /cooling/predict` and
`POST /cooling-optimizer/recommend`, which do not write to the store). Run: `sim-c9944cc35156` (20 assets, 24 h),
unless the file name says otherwise. Values are simulated telemetry.

Do not edit these to make a test pass. If the contract changes, recapture and update the schemas and
`docs/backend-contract.md`.
