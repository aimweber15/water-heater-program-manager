import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { defaultFollowUpDate, ESCALATION_ATTEMPT_THRESHOLD } from "@/lib/rules";

// B3/B4 (Step 2): log a follow-up attempt (or a plain note). A follow-up attempt
// increments the counter, resets the follow-up date, and flags escalation at 3 —
// counting and date arithmetic, no judgment.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const supabase = supabaseServer();

  if (!body.body || !body.author) {
    return NextResponse.json({ error: "author and body are required" }, { status: 400 });
  }

  const isFollowUpAttempt = Boolean(body.is_follow_up_attempt);

  const { data: note, error: noteError } = await supabase
    .from("record_notes")
    .insert({
      record_id: id,
      author: body.author,
      body: body.body,
      is_follow_up_attempt: isFollowUpAttempt,
    })
    .select()
    .single();

  if (noteError) {
    return NextResponse.json({ error: noteError.message }, { status: 500 });
  }

  if (isFollowUpAttempt) {
    const { data: existing, error: fetchError } = await supabase
      .from("records")
      .select("attempt_count")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const nextAttemptCount = existing.attempt_count + 1;
    const today = new Date();

    const { data: updated, error: updateError } = await supabase
      .from("records")
      .update({
        attempt_count: nextAttemptCount,
        last_contact_date: today.toISOString().slice(0, 10),
        next_follow_up_date: defaultFollowUpDate(today),
        escalated: nextAttemptCount >= ESCALATION_ATTEMPT_THRESHOLD,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ note, record: updated }, { status: 201 });
  }

  return NextResponse.json({ note }, { status: 201 });
}
