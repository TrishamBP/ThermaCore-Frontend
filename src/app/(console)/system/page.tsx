import type { Metadata } from "next";

import { SystemView } from "@/features/system/SystemView";

export const metadata: Metadata = { title: "System & Data" };

export default function Page() {
  return <SystemView />;
}
