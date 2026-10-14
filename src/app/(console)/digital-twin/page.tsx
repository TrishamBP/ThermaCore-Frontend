import type { Metadata } from "next";

import { TwinView } from "@/features/digital-twin/TwinView";

export const metadata: Metadata = { title: "Digital Twin" };

export default function DigitalTwinPage() {
  return <TwinView />;
}
