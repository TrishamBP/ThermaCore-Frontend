---
paths:
  - "src/**/*.{ts,tsx}"
  - "e2e/**/*.ts"
  - "*.config.{ts,mts}"
---

# TypeScript

- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`,
  `exactOptionalPropertyTypes: true`, `forceConsistentCasingInFileNames: true`; path alias `@/*` → `src/*`.
- No `any`. Use `unknown` and narrow. No non-null `!` on API data; handle the `null` case explicitly.
- No `as` casts on API responses. Types come from Zod: `export type Overview = z.infer<typeof overviewSchema>`.
- Model backend enums as string-literal unions copied from the backend source (`Literal[...]` in the Pydantic
  schema), for example `type ReviewDecision = "APPROVED_FOR_EVALUATION" | "REJECTED" | "DEFERRED"`. Keep them in
  one `lib/api/schemas/<domain>.ts` file. Handle unknown future values with a fallback branch (`exhaustive` switch
  + default rendering the raw value), never by crashing.
- Nullable fields stay `T | null`. Do not widen to optional or default them to `0`, `""` or `[]` in the data layer.
- Branded IDs where confusion is likely: `AssetId` (`SIM-NA-013`) vs `ObjectId` (`srv-013`) in twin code.
- Timestamps stay ISO strings in API types; convert to `Date`/epoch ms in one formatter or selector.
- Exhaustive `switch` over unions with a `never` check helper.
- Exports: named exports; `export type` for types. Default exports only where Next.js requires them (pages,
  layouts, route handlers' config).
- Discriminated unions for UI states: `{ status: "loading" } | { status: "error"; error: ApiError } | …` when
  TanStack Query's states are not enough.
- Prefer `readonly` arrays/props for data passed down the tree.
