"use client";

import { useMutation } from "@tanstack/react-query";
import { Bot, RotateCcw, Send, Square, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { PageHeader } from "@/components/shared/PageHeader";
import { table } from "@/components/shared/table";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHref, useRunId } from "@/hooks/useRun";
import { useAssets } from "@/hooks/useShellQueries";
import { sendCopilotMessage } from "@/lib/api/mutations";
import { SECTION_KEYS, type ChatResponse } from "@/lib/api/schemas/copilot";
import { humanize } from "@/lib/format";

const STARTERS = [
  "Which assets show rising inlet temperatures despite stable workloads in the last 2 hours?",
  "What is the current inlet temperature and workload of SIM-NA-013?",
  "Forecast the inlet temperature of SIM-NA-013.",
  "What should we investigate first?",
  "Show existing recommendations for SIM-NA-018.",
];

type Turn = { id: number; question: string; response?: ChatResponse; error?: unknown };
const CONV_KEY = "thermacore.copilot.conversation";

export function CopilotView() {
  const runId = useRunId();
  const assets = useAssets(runId);
  const [assetId, setAssetId] = useState("");
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const nextId = useRef(1);
  useEffect(() => {
    if (turns.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const chat = useMutation({
    mutationFn: ({ text }: { text: string; turnId: number }) => {
      controller.current = new AbortController();
      return sendCopilotMessage({ message: text, conversationId: conversationId ?? sessionStorage.getItem(CONV_KEY), assetId: assetId || undefined, runId, signal: controller.current.signal });
    },
    onSuccess: (res, { turnId }) => {
      setConversationId(res.conversation_id);
      sessionStorage.setItem(CONV_KEY, res.conversation_id);
      setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, response: res } : x)));
    },
    onError: (error, { turnId }) => setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, error } : x))),
  });

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || chat.isPending) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question: q }]);
    setMessage("");
    chat.mutate({ text: q, turnId: id });
  };

  const reset = () => {
    sessionStorage.removeItem(CONV_KEY);
    setConversationId(null);
    setTurns([]);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        section="AI Copilot"
        title="Operations copilot"
        meta={<span>Answers from the backend copilot over simulated telemetry, forecasts and stored recommendations. Read-only: it cannot change any setting.</span>}
        actions={<Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="size-3.5" aria-hidden /> New conversation</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Conversation" eyebrow={conversationId ? <span className="font-mono normal-case">{conversationId}</span> : "New conversation"} bodyClassName="flex flex-col gap-4">
          {turns.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-fg-3">Try a starter question:</p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="rounded-sm border border-line-strong bg-bg px-2.5 py-1.5 text-left text-xs text-fg-2 hover:border-fg-3 hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ol className="flex flex-col gap-4" aria-live="polite">
            {turns.map((t) => (
              <li key={t.id} className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-line-strong"><User className="size-3.5" aria-hidden /></span>
                  <p className="pt-1 text-sm text-fg">{t.question}</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-accent text-on-accent"><Bot className="size-3.5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    {t.response ? <Answer r={t.response} /> : t.error ? <ErrorBanner error={t.error} title="The copilot could not answer" /> : (
                      <p className="pt-1 text-xs text-fg-3" role="status">Thinking… agent runs can take up to a minute.</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div ref={endRef} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(message);
            }}
            className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-surface pt-3"
          >
            <label htmlFor="copilot-input" className="sr-only">Message</label>
            <textarea
              id="copilot-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(message);
                }
              }}
              rows={2}
              maxLength={2000}
              placeholder="Ask about facility status, anomalies, forecasts or recommendations…"
              className="w-full resize-none rounded-sm border border-line-strong bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-3"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select label="Asset context" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">None (all assets in scope)</option>
                {(assets.data?.items ?? []).map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_id}</option>)}
              </Select>
              {chat.isPending ? (
                <Button variant="secondary" onClick={() => controller.current?.abort()}><Square className="size-3.5" aria-hidden /> Stop</Button>
              ) : (
                <Button variant="primary" type="submit" disabled={!message.trim()}><Send className="size-3.5" aria-hidden /> Ask</Button>
              )}
            </div>
          </form>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="What the copilot can do" eyebrow="Capabilities">
            <ul className="list-disc space-y-1 pl-4 text-xs text-fg-2">
              <li>Summarize current telemetry and trends for assets in scope</li>
              <li>Explain estimator findings and stored recommendations</li>
              <li>Report baseline inlet forecasts and their limitations</li>
              <li>Report optimizer availability (currently unavailable)</li>
            </ul>
            <Notice tone="safety" className="mt-3">It cannot apply setpoints or control equipment. Requests to do so are declined.</Notice>
          </Panel>
          {turns.at(-1)?.response && <InterpretationPanel r={turns.at(-1)!.response!} />}
        </div>
      </div>
    </div>
  );
}

function Answer({ r }: { r: ChatResponse }) {
  const href = useHref();
  const metricsTables = Object.entries(r.metrics).filter(([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object") as [string, Record<string, unknown>[]][];
  return (
    <div className="space-y-3">
      {r.interpretation && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-3">
          {r.interpretation.time_basis && <span>Time basis: <span className="text-fg-2">{r.interpretation.time_basis}</span></span>}
          <span>Assets: <span className="font-mono text-fg-2">{r.interpretation.all_assets ? "all in scope" : (r.interpretation.asset_ids ?? []).join(", ") || "—"}</span></span>
        </div>
      )}
      {r.clarification_needed && <Notice tone="warn" title="Clarification needed:">The copilot is asking you a question.</Notice>}
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg">{r.answer}</p>
      {SECTION_KEYS.filter((k) => (r.sections[k]?.length ?? 0) > 0).map((k) => (
        <div key={k}>
          <h4 className="text-[11px] font-semibold tracking-wide text-fg-3 uppercase">{humanize(k)}</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-fg-2">{r.sections[k]!.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </div>
      ))}
      {metricsTables.map(([name, rows]) => (
        <details key={name} className="rounded-sm border border-line">
          <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-fg-2">Table: {humanize(name)} ({rows.length} rows)</summary>
          <div className={`${table.wrap} max-h-64 overflow-y-auto`}>
            <table className={table.table}>
              <thead><tr>{Object.keys(rows[0]!).slice(0, 8).map((k) => <th key={k} className={table.th}>{humanize(k)}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={table.tr}>
                    {Object.values(row).slice(0, 8).map((v, j) => (
                      <td key={j} className={`${table.td} text-[12px]`}>{v === null ? "—" : typeof v === "number" ? Number(v.toFixed(4)) : typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      {r.recommendations.length > 0 && (
        <div>
          <h4 className="text-[11px] font-semibold tracking-wide text-fg-3 uppercase">Linked recommendations</h4>
          <ul className="mt-1 space-y-0.5 text-xs">
            {r.recommendations.map((rec, i) => {
              const id = typeof rec.recommendation_id === "string" ? rec.recommendation_id : null;
              return (
                <li key={id ?? i}>
                  {id ? <Link className="text-fg underline-offset-4 hover:underline" href={href("/optimization", { rec: id })}>{String(rec.title ?? id)}</Link> : String(rec.title ?? "recommendation")}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {r.warnings.length > 0 && <Notice tone="stale" title="Data / model notes:">{r.warnings.join(" · ")}</Notice>}
      <div className="flex flex-wrap gap-2 text-[10px] text-fg-3">
        <StatusBadge status="INFO" label={`mode: ${String(r.agent_execution_summary.mode ?? "—")}`} />
        <StatusBadge status="INFO" label={`answer source: ${String(r.agent_execution_summary.answer_source ?? r.interpretation?.source ?? "—")}`} />
        {r.read_only && <StatusBadge status="OK" label="read-only" />}
      </div>
    </div>
  );
}

function InterpretationPanel({ r }: { r: ChatResponse }) {
  return (
    <Panel title="Evidence" eyebrow="Cited in the last answer" bodyClassName="p-0">
      {r.evidence.length === 0 ? (
        <p className="p-4 text-xs text-fg-3">No evidence items returned.</p>
      ) : (
        <div className={`${table.wrap} max-h-[420px] overflow-y-auto`}>
          <table className={table.table}>
            <tbody>
              {r.evidence.map((e, i) => (
                <tr key={String(e.id ?? e.evidence_id ?? i)} className={table.tr}>
                  <td className={`${table.tdId} text-[11px]`}>{String(e.id ?? e.evidence_id ?? `E${i + 1}`)}</td>
                  <td className={`${table.td} text-[11px]`}>
                    <div className="text-fg">{e.metric ?? humanize(e.kind)}</div>
                    <div className="text-fg-3">{humanize(e.kind)} · {e.source ?? ""}</div>
                  </td>
                  <td className={`${table.tdNum} text-[12px]`}>
                    {e.value === null || e.value === undefined ? "—" : typeof e.value === "number" ? `${Number(e.value.toFixed(4))} ${e.unit ?? ""}` : String(e.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
