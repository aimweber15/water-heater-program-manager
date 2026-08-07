import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { evaluateAlerts } from "@/lib/alerts";
import { isRebateReady } from "@/lib/rules";
import type { WaterHeaterRecord } from "@/lib/types";

// Step 4: one daily job performing all four flag checks, replacing the weekly manual
// spreadsheet review. Vercel Cron sends `Authorization: Bearer $CRON_SECRET` — see
// vercel.json for the schedule.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = supabaseServer();
  const now = new Date();

  const { data: records, error } = await supabase
    .from("records")
    .select("*")
    .neq("status", "closed_complete")
    .neq("status", "closed_no_sale");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let recordsScanned = 0;
  let alertsCreated = 0;
  let alertsResolved = 0;

  for (const record of records as WaterHeaterRecord[]) {
    recordsScanned += 1;
    const evaluated = evaluateAlerts(record, now);
    const evaluatedTypes = new Set(evaluated.map((a) => a.alert_type));

    const { data: activeAlerts } = await supabase
      .from("record_alerts")
      .select("*")
      .eq("record_id", record.id)
      .eq("resolved", false);

    const activeTypes = new Set((activeAlerts ?? []).map((a) => a.alert_type));

    for (const alert of evaluated) {
      if (!activeTypes.has(alert.alert_type)) {
        await supabase.from("record_alerts").insert({
          record_id: record.id,
          alert_type: alert.alert_type,
          facing: alert.facing,
          resolved: false,
        });
        alertsCreated += 1;
      }
    }

    for (const active of activeAlerts ?? []) {
      if (!evaluatedTypes.has(active.alert_type)) {
        await supabase
          .from("record_alerts")
          .update({ resolved: true, resolved_at: now.toISOString() })
          .eq("id", active.id);
        alertsResolved += 1;
      }
    }

    const updates: Record<string, unknown> = { last_scan_at: now.toISOString() };

    if (record.rebate_status === "not_ready" || record.rebate_status === "ready") {
      const ready = isRebateReady(record);
      updates.rebate_status = ready ? "ready" : "not_ready";
    }

    await supabase.from("records").update(updates).eq("id", record.id);
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    recordsScanned,
    alertsCreated,
    alertsResolved,
  });
}
