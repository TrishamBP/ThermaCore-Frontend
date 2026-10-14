import { FlaskConical } from "lucide-react";

/** Persistent indicator that every value in the console is simulated. */
export function SimulatedBadge({ runId }: { runId?: string | null | undefined }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border border-ok/40 bg-ok/10 px-2 py-1 text-[11px] font-semibold tracking-wide text-ok uppercase"
      title="All telemetry is synthetic (simulator-generated). Nothing shown is a measurement of real equipment."
    >
      <FlaskConical className="size-3.5" aria-hidden />
      Demo / Simulated
      {runId && <span className="font-mono font-normal normal-case text-ok/80">· {runId}</span>}
    </span>
  );
}
