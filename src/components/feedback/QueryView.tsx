"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { PanelSkeleton } from "@/components/ui/Skeleton";

import { ErrorBanner } from "./ErrorBanner";

export type QueryViewProps<T> = {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  errorTitle?: string;
};

/** Renders loading / error / data for one query, consistently everywhere. */
export function QueryView<T>({ query, children, skeleton, errorTitle }: QueryViewProps<T>) {
  if (query.isPending) return <>{skeleton ?? <PanelSkeleton />}</>;
  if (query.isError) {
    return <ErrorBanner error={query.error} title={errorTitle} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
