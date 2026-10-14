"use client";

import { ErrorBanner } from "@/components/feedback/ErrorBanner";

export default function ConsoleError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorBanner error={error} title="This view failed to render" onRetry={reset} />;
}
