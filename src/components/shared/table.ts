/** Shared compact data-table classes. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full border-collapse text-[13px]",
  th: "sticky top-0 z-[1] border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-medium tracking-wide whitespace-nowrap text-fg-3 uppercase",
  thNum: "sticky top-0 z-[1] border-b border-line bg-surface px-3 py-2 text-right text-[11px] font-medium tracking-wide whitespace-nowrap text-fg-3 uppercase",
  tr: "border-b border-line/60 last:border-0 hover:bg-raised/60",
  trSelected: "border-b border-line/60 bg-raised last:border-0",
  td: "px-3 py-2 align-middle whitespace-nowrap text-fg-2",
  tdNum: "px-3 py-2 text-right align-middle font-mono whitespace-nowrap text-fg tabular",
  tdId: "px-3 py-2 align-middle font-mono whitespace-nowrap text-fg",
} as const;
