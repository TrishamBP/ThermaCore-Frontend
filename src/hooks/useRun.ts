"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const RUN_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

/** Selected simulation run from the URL (`?run=`). Undefined = the backend's default (latest) run. */
export function useRunId(): string | undefined {
  const run = useSearchParams().get("run");
  return run && RUN_PATTERN.test(run) ? run : undefined;
}

/** Updates search params without adding history entries. `null` removes a key. */
export function useSetSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
}

/** Builds a console link that keeps the selected run. */
export function useHref() {
  const run = useRunId();
  return useCallback(
    (path: string, extra?: Record<string, string>) => {
      const p = new URLSearchParams(extra);
      if (run) p.set("run", run);
      const qs = p.toString();
      return qs ? `${path}?${qs}` : path;
    },
    [run],
  );
}
