import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isRebateReady } from "@/lib/rules";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseServer();

  const { data: record, error } = await supabase
    .from("records")
    .select("*, alerts:record_alerts(*)")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const { data: notes } = await supabase
    .from("record_notes")
    .select("*")
    .eq("record_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ record: { ...record, notes: notes ?? [] } });
}

// Field-level update used by the status-advance control, the Sale/Install/LMR/Rebate
// panels, and Close as No Sale (Step 2 C1, D1-D5, E1-E4, B6).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = supabaseServer();

  const { data: existing, error: fetchError } = await supabase
    .from("records")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  // B6: Close as No Sale requires a reason from the fixed picklist before it will fire.
  const targetStatus = body.status ?? existing.status;
  const targetReason = body.no_sale_reason ?? existing.no_sale_reason;
  if (targetStatus === "closed_no_sale" && !targetReason) {
    return NextResponse.json(
      { error: "Closed — No Sale requires a reason." },
      { status: 400 }
    );
  }

  // Optional enum columns reject "" (only a real enum member or null is valid) —
  // select inputs on the detail panels submit "" for their unset "—" option.
  const nullableEnumFields = ["size_interest", "size_chosen"];
  const update: Record<string, unknown> = { ...body };
  for (const field of nullableEnumFields) {
    if (update[field] === "") update[field] = null;
  }
  if (body.status && body.status !== existing.status) {
    update.status_changed_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .from("records")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // E1: recompute rebate readiness from the three prerequisite fields, unless the
  // caller explicitly set rebate_status this request (e.g. submitting/rejecting/paying).
  if (!("rebate_status" in body) && (updated.rebate_status === "not_ready" || updated.rebate_status === "ready")) {
    const ready = isRebateReady(updated);
    const nextStatus = ready ? "ready" : "not_ready";
    if (nextStatus !== updated.rebate_status) {
      const { data: reRead } = await supabase
        .from("records")
        .update({ rebate_status: nextStatus })
        .eq("id", id)
        .select()
        .single();
      return NextResponse.json({ record: reRead });
    }
  }

  return NextResponse.json({ record: updated });
}
