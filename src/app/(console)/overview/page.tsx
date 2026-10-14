import type { Metadata } from "next";

import { OverviewView } from "@/features/overview/OverviewView";

export const metadata: Metadata = { title: "Operations Overview" };

export default function OverviewPage() {
  return <OverviewView />;
}
