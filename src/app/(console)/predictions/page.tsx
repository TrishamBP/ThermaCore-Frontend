import type { Metadata } from "next";

import { PredictionsView } from "@/features/predictions/PredictionsView";

export const metadata: Metadata = { title: "Predictions" };

export default function Page() {
  return <PredictionsView />;
}
