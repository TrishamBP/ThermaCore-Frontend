import type { Metadata } from "next";

import { OptimizationView } from "@/features/optimization/OptimizationView";

export const metadata: Metadata = { title: "Optimization" };

export default function Page() {
  return <OptimizationView />;
}
