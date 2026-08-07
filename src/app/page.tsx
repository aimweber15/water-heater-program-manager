"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertPill } from "@/components/AlertPill";
import { ALERT_CONFIG, WaterHeaterRecord, fullName } from "@/lib/types";
import { daysUntil, DEADLINE_APPROACHING_DAYS } from "@/lib/alerts";

interface PrioritizeResult {
  id: string;
  rank: number;
  tier: number;
  reason: string;
  note_quality: string;
  name: string;
}

const OPEN_STATUSES = new Set([
  "inquiry",
  "quoted",
  "sold",
  "picked_up",
  "installed",
  "lmr_scheduled",
  "lmr_verified",
  "rebate_submitted",
  "rebate_paid",
]);

export default function DashboardPage() {
  const [records, setRecords] = useState<WaterHeaterRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [prioritizing, setPrioritizing] = useState(false);
  const [prioritizeError, setPrioritizeError] = useState<string | null>(null);
  const [results, setResults] = useState<PrioritizeResult[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function loadRecords() {
    try {
      const res = await fetch("/api/records");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load records");
      setRecords(data.records);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load records");
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  async function runPrioritize() {
    setPrioritizing(true);
    setPrioritizeError(null);
    try {
      const res = await fetch("/api/prioritize", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Prioritization failed");
      setResults(data.results);
      setGeneratedAt(data.generatedAt);
    } catch (err) {
      setPrioritizeError(err instanceof Error ? err.message : "Prioritization failed");
    } finally {
      setPrioritizing(false);
    }
  }

  const counts = useMemo(() => {
    if (!records) return null;
    const open = records.filter((r) => OPEN_STATUSES.has(r.status));
    const needsAttention = open.filter((r) => (r.alerts ?? []).some((a) => !a.resolved));
    const escalated = open.filter((r) => r.escalated);
    const deadlineApproaching = open.filter((r) => {
      const d = daysUntil(r.deadline_date);
      return d !== null && d <= DEADLINE_APPROACHING_DAYS;
    });
    return {
      open: open.length,
      needsAttention: needsAttention.length,
      escalated: escalated.length,
      deadlineApproaching: deadlineApproaching.length,
    };
  }, [records]);

  const attentionRows = useMemo(() => {
    if (!records) return [];
    const rows: { record: WaterHeaterRecord; alertType: keyof typeof ALERT_CONFIG }[] = [];
    for (const r of records) {
      for (const a of r.alerts ?? []) {
        if (!a.resolved) rows.push({ record: r, alertType: a.alert_type });
      }
    }
    return rows;
  }, [records]);

  const internalAttention = attentionRows.filter((r) => ALERT_CONFIG[r.alertType].facing === "internal");
  const memberAttention = attentionRows.filter((r) => ALERT_CONFIG[r.alertType].facing === "member_facing");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Who needs me today?</p>
      </div>

      {loadError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCount label="Open records" value={counts?.open} />
        <SummaryCount label="Needs attention" value={counts?.needsAttention} />
        <SummaryCount label="Escalated for review" value={counts?.escalated} />
        <SummaryCount label="Deadline within 30 days" value={counts?.deadlineApproaching} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-medium">Needs Attention</h2>
          {records === null ? (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          ) : attentionRows.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-700">All clear — nothing needs attention right now.</p>
          ) : (
            <div className="mt-4 space-y-5">
              {memberAttention.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Member-facing
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {memberAttention.map((row, i) => (
                      <AttentionRow key={i} row={row} />
                    ))}
                  </ul>
                </div>
              )}
              {internalAttention.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Internal</h3>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {internalAttention.map((row, i) => (
                      <AttentionRow key={i} row={row} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Prioritize My Callbacks</h2>
            <button
              onClick={runPrioritize}
              disabled={prioritizing}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {prioritizing ? "Ranking…" : "Prioritize My Callbacks"}
            </button>
          </div>

          {prioritizeError && (
            <p className="mt-3 text-sm text-rose-600">{prioritizeError}</p>
          )}

          {prioritizing && (
            <p className="mt-4 text-sm text-slate-400">Claude is reading the notes on open records…</p>
          )}

          {!prioritizing && results === null && !prioritizeError && (
            <p className="mt-4 text-sm text-slate-400">
              Click the button to have Claude rank open inquiries by how critical the member&apos;s situation is.
            </p>
          )}

          {!prioritizing && results !== null && results.length === 0 && (
            <p className="mt-4 text-sm text-emerald-700">No open inquiries to prioritize right now.</p>
          )}

          {!prioritizing && results !== null && results.length > 0 && (
            <div className="mt-4 space-y-3">
              {generatedAt && (
                <p className="text-xs text-slate-400">
                  Generated {new Date(generatedAt).toLocaleString()}
                </p>
              )}
              <ol className="space-y-2">
                {results.map((r) => (
                  <li key={r.id} className="rounded-md border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <Link href={`/records/${r.id}`} className="font-medium hover:underline">
                        {r.rank}. {r.name}
                      </Link>
                      <TierBadge tier={r.tier} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
                    {r.note_quality === "low" && (
                      <p className="mt-1 text-xs text-amber-600">Low note quality — situational detail was thin.</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold">{value ?? "—"}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function AttentionRow({ row }: { row: { record: WaterHeaterRecord; alertType: keyof typeof ALERT_CONFIG } }) {
  return (
    <li className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Link href={`/records/${row.record.id}`} className="text-sm font-medium hover:underline">
          {fullName(row.record)}
        </Link>
        <StatusBadge status={row.record.status} />
      </div>
      <AlertPill type={row.alertType} />
    </li>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const colors: Record<number, string> = {
    1: "bg-rose-100 text-rose-700",
    2: "bg-amber-100 text-amber-700",
    3: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] ?? colors[3]}`}>
      Tier {tier}
    </span>
  );
}
