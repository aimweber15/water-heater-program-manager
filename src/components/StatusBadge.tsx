import { RecordStatus, STATUS_LABELS } from "@/lib/types";

const COLORS: Record<RecordStatus, string> = {
  inquiry: "bg-slate-100 text-slate-700",
  quoted: "bg-sky-100 text-sky-700",
  sold: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-indigo-100 text-indigo-700",
  installed: "bg-amber-100 text-amber-700",
  lmr_scheduled: "bg-amber-100 text-amber-700",
  lmr_verified: "bg-emerald-100 text-emerald-700",
  rebate_submitted: "bg-emerald-100 text-emerald-700",
  rebate_paid: "bg-emerald-100 text-emerald-700",
  closed_complete: "bg-green-100 text-green-800",
  closed_no_sale: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
