import { ALERT_CONFIG, AlertType } from "@/lib/types";

export function AlertPill({ type }: { type: AlertType }) {
  const config = ALERT_CONFIG[type];
  const color = config.facing === "internal" ? "bg-slate-200 text-slate-700" : "bg-orange-100 text-orange-800";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {config.label}
    </span>
  );
}
