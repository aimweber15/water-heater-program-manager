"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { WaterHeaterRecord, fullName } from "@/lib/types";
import { daysUntil } from "@/lib/alerts";
import { formatDate } from "@/lib/format";

type Filter = "open" | "closed_complete" | "closed_no_sale" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "closed_complete", label: "Closed — Complete" },
  { id: "closed_no_sale", label: "Closed — No Sale" },
  { id: "all", label: "All" },
];

export default function RecordListPage() {
  const [records, setRecords] = useState<WaterHeaterRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");

  useEffect(() => {
    fetch("/api/records")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setRecords(data.records);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load records"));
  }, []);

  const filtered = useMemo(() => {
    if (!records) return [];
    let rows = records;
    if (filter === "closed_complete") rows = rows.filter((r) => r.status === "closed_complete");
    else if (filter === "closed_no_sale") rows = rows.filter((r) => r.status === "closed_no_sale");
    else if (filter === "open")
      rows = rows.filter((r) => r.status !== "closed_complete" && r.status !== "closed_no_sale");
    // Sorts by last name (Step 5: "Member Name sorts by last name").
    return [...rows].sort((a, b) => a.last_name.localeCompare(b.last_name));
  }, [records, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Record List</h1>
        <p className="mt-1 text-sm text-slate-500">Every record, for when you want everything rather than only what&apos;s flagged.</p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              filter === f.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Member Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Contact</th>
              <th className="px-4 py-3">Next Follow-up</th>
              <th className="px-4 py-3">Days Since Sale</th>
              <th className="px-4 py-3">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records === null && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {records !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No records in this view.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const daysSinceSale = r.sale_date
                ? Math.floor((Date.now() - new Date(r.sale_date).getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const deadlineDays = daysUntil(r.deadline_date);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/records/${r.id}`} className="font-medium text-slate-900 hover:underline">
                      {fullName(r)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.last_contact_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.next_follow_up_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{daysSinceSale ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.deadline_date ? `${formatDate(r.deadline_date)} (${deadlineDays}d)` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
