import type { Metadata } from "next";

import { TelemetryView } from "@/features/telemetry/TelemetryView";

export const metadata: Metadata = { title: "Live Telemetry" };

export default function TelemetryPage() {
  return <TelemetryView />;
}
