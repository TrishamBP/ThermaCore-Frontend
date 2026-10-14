import type { Metadata } from "next";

import { CopilotView } from "@/features/copilot/CopilotView";

export const metadata: Metadata = { title: "AI Copilot" };

export default function Page() {
  return <CopilotView />;
}
