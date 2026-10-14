"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorBanner } from "@/components/feedback/ErrorBanner";
import { Notice } from "@/components/feedback/Notice";
import { QueryView } from "@/components/feedback/QueryView";
import { KeyValueList } from "@/components/shared/KeyValueList";
import { table } from "@/components/shared/table";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getRecommendation } from "@/lib/api/reads";
import { recordDecision } from "@/lib/api/mutations";
import {
  REVIEWER_PATTERN,
  REVIEW_DECISIONS,
  type Evidence,
  type RecommendationDetail,
  type ReviewDecision,
} from "@/lib/api/schemas/recommendations";
import { formatEventTime, formatWithUnit, humanize } from "@/lib/format";
import { qk } from "@/lib/query-keys";

const DECISION_COPY: Record<ReviewDecision, { label: string; explain: string }> = {
  APPROVED_FOR_EVALUATION: {
    label: "Approve for evaluation",
    explain: "Approves a supervised real-world evaluation. Nothing is executed; any change is a manual operator action.",
  },
  REJECTED: { label: "Reject", explain: "Records that the recommendation should not be pursued." },
  DEFERRED: { label: "Defer", explain: "Records that the decision is postponed (e.g. wait for the next window)." },
};

export function RecommendationDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: qk.recommendation(id), queryFn: ({ signal }) => getRecommendation({ id, signal }) });
  return (
    <Panel
      eyebrow={<span className="font-mono normal-case">{id}</span>}
      title="Recommendation"
      actions={<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
    >
      <QueryView query={detail} skeleton={<PanelSkeleton rows={10} />} errorTitle="Could not load the recommendation">
        {(d) => <DetailBody d={d} />}
      </QueryView>
    </Panel>
  );
}

function DetailBody({ d }: { d: RecommendationDetail }) {
  const r = d.recommendation;
  const grouped = groupEvidence(r.evidence);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={r.severity} />
          <StatusBadge status={r.status} />
          <StatusBadge status={d.review_status} />
          <StatusBadge status="INFO" label={humanize(r.type)} />
        </div>
        <h3 className="text-base font-semibold text-fg">{r.title}</h3>
        <p className="text-sm leading-relaxed text-fg-2">{r.recommended_action}</p>
        <div className="text-[11px] text-fg-3">
          {r.asset_id} · window {formatEventTime(r.observation_window_start)} → {formatEventTime(r.observation_window_end)} ·
          explanation: {humanize(r.explanation_source)}
        </div>
      </div>

      <Notice tone="safety" title="Human review required.">
        Recommendation-only. Recording a decision does not send any command to equipment (automatic_control_executed: false).
      </Notice>

      {r.status === "INCONCLUSIVE" && r.missing_evidence.length > 0 && (
        <Notice tone="warn" title="Inconclusive — missing evidence:">
          <ul className="mt-1 list-disc space-y-0.5 pl-4">{r.missing_evidence.map((m) => <li key={m}>{m}</li>)}</ul>
        </Notice>
      )}

      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">Evidence</h4>
        {r.evidence.length === 0 ? (
          <p className="text-xs text-fg-3">No evidence items.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([kind, items]) => (
              <div key={kind}>
                <div className="mb-1 text-[11px] text-fg-2">{humanize(kind)} ({items.length})</div>
                <div className={table.wrap}>
                  <table className={table.table}>
                    <tbody>
                      {items.map((e) => (
                        <tr key={e.evidence_id} className={table.tr}>
                          <td className={`${table.tdId} text-[11px]`}>{e.evidence_id}</td>
                          <td className={`${table.td} text-[12px]`}>
                            <div className="font-mono text-fg">{e.metric}</div>
                            {e.interpretation && <div className="text-[11px] text-fg-3">{e.interpretation}</div>}
                          </td>
                          <td className={table.tdNum}>
                            {typeof e.observed_value === "number" ? formatWithUnit(e.observed_value, e.unit, 3) : e.observed_value === null ? <span className="text-na">—</span> : String(e.observed_value)}
                          </td>
                          <td className={`${table.td} text-[11px]`}>{e.agent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <KeyValueList
        items={[
          { key: "unc", label: "Uncertainty", value: <StatusBadge status={r.uncertainty.level} label={humanize(r.uncertainty.level)} /> },
          { key: "energy", label: "Energy impact", value: <span className="text-na" title={r.energy_impact_status}>{r.estimated_energy_impact === null || r.estimated_energy_impact === undefined ? "Not measured" : formatWithUnit(r.estimated_energy_impact, r.energy_unit)}</span> },
          { key: "set", label: `Current ${r.setting_name ?? "setting"}`, value: formatWithUnit(r.current_setting ?? null, r.setting_name === "fan_speed_rpm" ? "rpm" : null) },
          { key: "cand", label: "Candidate setting", value: r.candidate_setting === null || r.candidate_setting === undefined ? "none" : formatWithUnit(r.candidate_setting, "rpm") },
        ]}
      />
      <p className="text-[11px] leading-relaxed text-fg-3">{r.uncertainty.basis}</p>

      <ListBlock title="Conditions that invalidate this recommendation" items={r.conditions_that_invalidate_recommendation} />
      <ListBlock title="Constraints checked" items={r.constraints_checked} />
      <ListBlock title="Validation warnings" items={r.validation_warnings} />
      <ListBlock title="Limitations" items={r.uncertainty.limitations} />
      {r.explanation?.why_human_review && <Notice tone="info" title="Why human review:">{r.explanation.why_human_review}</Notice>}

      <DecisionForm d={d} />

      <div>
        <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">Decision history ({d.decisions.length})</h4>
        {d.decisions.length === 0 ? (
          <p className="text-xs text-fg-3">No decisions recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...d.decisions].reverse().map((x) => (
              <li key={x.decision_id} className="rounded-sm border border-line bg-bg px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={x.decision} />
                  <span className="font-mono text-[11px] text-fg-3">{new Date(x.decided_at).toLocaleString("en-GB")}</span>
                </div>
                <div className="mt-1 text-fg-2">reviewer (free text): <span className="font-mono text-fg">{x.reviewer}</span></div>
                {x.note && <div className="mt-0.5 text-fg-3">{x.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">{title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-fg-2">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

function groupEvidence(evidence: readonly Evidence[]): [string, Evidence[]][] {
  const m = new Map<string, Evidence[]>();
  for (const e of evidence) m.set(e.kind, [...(m.get(e.kind) ?? []), e]);
  const order = ["measured", "derived", "model_prediction", "rule_finding", "configuration", "unavailable"];
  return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
}

function DecisionForm({ d }: { d: RecommendationDetail }) {
  const qc = useQueryClient();
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<ReviewDecision | null>(null);
  const id = d.recommendation.recommendation_id;
  const mutation = useMutation({
    mutationFn: (decision: ReviewDecision) => recordDecision({ recommendationId: id, decision, reviewer: reviewer.trim(), note: note.trim() || undefined }),
    onSuccess: () => {
      setPending(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: qk.recommendation(id) });
      void qc.invalidateQueries({ queryKey: ["recommendations", "list"] });
    },
  });
  const reviewerValid = reviewer.trim().length > 0 && reviewer.trim().length <= 100 && REVIEWER_PATTERN.test(reviewer.trim());
  return (
    <div className="rounded-sm border border-line-strong bg-bg p-3">
      <h4 className="text-[13px] font-semibold text-fg">Record a review decision</h4>
      <p className="mt-0.5 text-[11px] text-fg-3">Each submission appends a decision. The reviewer name is free text and is not tied to authentication.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-fg-3">
          Reviewer
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            maxLength={100}
            placeholder="e.g. operator-1"
            aria-invalid={reviewer.length > 0 && !reviewerValid}
            aria-describedby="reviewer-help"
            className="mt-1 block h-8 w-full rounded-sm border border-line-strong bg-surface px-2 font-mono text-xs text-fg"
          />
          <span id="reviewer-help" className="mt-0.5 block text-[10px]">Letters, digits, space, . @ - _</span>
        </label>
        <label className="text-xs text-fg-3">
          Note (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            className="mt-1 block h-8 w-full rounded-sm border border-line-strong bg-surface px-2 text-xs text-fg"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {REVIEW_DECISIONS.map((dec) => (
          <Button key={dec} size="sm" variant={dec === "APPROVED_FOR_EVALUATION" ? "primary" : "secondary"} disabled={!reviewerValid || mutation.isPending} onClick={() => setPending(dec)}>
            {DECISION_COPY[dec].label}
          </Button>
        ))}
      </div>
      {mutation.isError && <div className="mt-2"><ErrorBanner error={mutation.error} title="Decision not recorded" /></div>}
      {mutation.isSuccess && <div className="mt-2"><Notice tone="safety">{mutation.data.message}</Notice></div>}
      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Record “${pending}”?` : ""}
        confirmLabel="Record decision"
        pending={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && mutation.mutate(pending)}
      >
        {pending && (
          <>
            <p>{DECISION_COPY[pending].explain}</p>
            <p className="rounded-sm border border-line bg-bg px-2.5 py-2 font-mono text-xs text-fg">
              {pending} · {id} · reviewer “{reviewer.trim()}”
            </p>
            <p className="text-xs text-fg-3">No equipment command will be sent. This action appends a review record and cannot be undone.</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

export function EmptyQueue() {
  return (
    <EmptyState title="No recommendations match these filters">
      Run an analysis for an asset to create recommendations. They always require human review.
    </EmptyState>
  );
}
