import { Suspense, type ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { PanelSkeleton } from "@/components/ui/Skeleton";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded-sm bg-accent px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Suspense fallback={<div className="hidden w-60 lg:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 border-b border-line" />}>
          <TopBar />
        </Suspense>
        <main id="main" className="min-w-0 flex-1 p-4 lg:p-6">
          <Suspense fallback={<PanelSkeleton rows={8} />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
