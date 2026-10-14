import type { ChartRow } from "@/components/charts/TimeSeriesChart";
import type { Overview } from "@/lib/api/schemas/dashboard";
import { parseTime } from "@/lib/format";

/** Overview trend points → chart rows. Missing metric values stay null (chart gaps). */
export function trendRows(points: Overview["trends"]["points"], keys: readonly string[]): ChartRow[] {
  const rows: ChartRow[] = [];
  for (const p of points) {
    const t = parseTime(p.bucket_start);
    if (t === null) continue;
    const row: ChartRow = { t };
    for (const k of keys) {
      const v = p[k];
      row[k] = typeof v === "number" ? v : null;
    }
    rows.push(row);
  }
  return rows;
}
