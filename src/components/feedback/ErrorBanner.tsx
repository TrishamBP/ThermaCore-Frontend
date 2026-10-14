"use client";

import { AlertOctagon, Copy, RotateCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { toApiError } from "@/lib/api/errors";

export type ErrorBannerProps = { error: unknown; onRetry?: () => void; title?: string; compact?: boolean };

/** Shows the backend error code, message and request ID (copyable), plus retry when safe. */
export function ErrorBanner({ error, onRetry, title = "Could not load data", compact }: ErrorBannerProps) {
  const e = toApiError(error);
  const [copied, setCopied] = useState(false);
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-sm border border-crit/50 bg-crit/10 px-3 py-2.5 text-sm">
      <AlertOctagon className="mt-0.5 size-4 shrink-0 text-crit" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-crit">{title}</div>
        <div className="text-fg-2">{e.message}</div>
        {!compact && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-3">
            <span>code: {e.code}{e.status ? ` · HTTP ${e.status}` : ""}</span>
            {e.requestId && (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-fg"
                onClick={() => {
                  void navigator.clipboard?.writeText(e.requestId ?? "");
                  setCopied(true);
                }}
              >
                request_id: {e.requestId} <Copy className="size-3" aria-hidden />
                <span className="sr-only">copy request ID</span>
                {copied && <span className="text-ok">copied</span>}
              </button>
            )}
          </div>
        )}
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}
