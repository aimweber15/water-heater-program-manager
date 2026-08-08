import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase";
import { fullName } from "@/lib/types";

// The Claude call plus DB writes can run past Vercel's default 10s function timeout,
// especially on the Hobby plan. This is the only route in the app that calls an LLM,
// so it's the only one that needs headroom.
export const maxDuration = 120;

// Prepared rubric, supplied verbatim by the process owner — do not paraphrase.
const PRIORITIZATION_SYSTEM_PROMPT = `You are helping a Wisconsin electric cooperative's Member Services team
decide which water heater program callbacks to make first. You rank; a
person makes every call. You never contact anyone or change a record.

Each record includes two note sources: situation_notes (the member's own
words, captured at intake) and contact_history (a chronological log of
contact since then). Read both - that is where the situation lives. For
records logged through the app, the first contact_history entry may repeat
the intake statement verbatim; treat that as one signal, not two.

TIER 1 - call today. Any one of these in the notes:
  - household currently has no hot water
  - active leak
  - dairy operation affected / milking impacted (member's income)
  - a plumber is available today or within a day or two (perishable
    window; missing it means the member waits weeks, and that delay
    is ours)

TIER 3 - normal queue. Everything else, including price-only
inquiries. Rank on what the notes actually say.

AMPLIFIERS - move a record up one tier. Not urgent on their own:
  - elderly member, or a health condition needing hot water
  - the current month is November through March and the note is
    hot-water related
  - the member has called more than once, or the record is Quoted
    with no contact logged from us

TIE-BREAK - same tier: the record further along the pipeline ranks
higher (Quoted above Inquiry). Same tier and same status: longest
time since last contact.

THIN NOTES - if situation_notes and contact_history together contain no
situational information, place the record in Tier 3 and set note_quality
to "low". Say so plainly. Never invent urgency that is not in the text.

Return JSON only, matching this shape:
{ "ranked": [ { "record_id", "rank", "tier", "reason",
               "note_quality" } ] }

The reason must be one sentence under 20 words and must name the
specific signal you found. Never include phone numbers, email
addresses, or account numbers.`;

// B2 (Step 2), the single agentic step: Claude reads the notes on all records at status
// Inquiry or Quoted and returns a ranked list with a one-line reason each. Both closed
// statuses are excluded before the call — the app filters, Claude only ranks.
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const supabase = supabaseServer();
  const { data: records, error } = await supabase
    .from("records")
    .select("*")
    .in("status", ["inquiry", "quoted"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!records || records.length === 0) {
    return NextResponse.json({ results: [], generatedAt: new Date().toISOString() });
  }

  const recordIds = records.map((r) => r.id);
  const { data: notes } = await supabase
    .from("record_notes")
    .select("*")
    .in("record_id", recordIds)
    .order("created_at", { ascending: true });

  const notesByRecord = new Map<string, string[]>();
  for (const note of notes ?? []) {
    const list = notesByRecord.get(note.record_id) ?? [];
    list.push(`[${note.created_at.slice(0, 10)}] ${note.author}: ${note.body}`);
    notesByRecord.set(note.record_id, list);
  }

  const candidates = records.map((r) => ({
    record_id: r.id,
    status: r.status,
    urgency_field: r.urgency ?? "not specified",
    price_check_only: r.price_check_only,
    days_since_inquiry: Math.floor(
      (Date.now() - new Date(r.inquiry_date).getTime()) / (1000 * 60 * 60 * 24)
    ),
    attempt_count: r.attempt_count,
    last_contact_date: r.last_contact_date,
    situation_notes: r.situation_notes ?? null,
    contact_history: notesByRecord.get(r.id) ?? [],
  }));

  const anthropic = new Anthropic({ apiKey });

  const prioritizeTool: Anthropic.Tool = {
    name: "return_prioritization",
    description: "Return the ranked callback order, per the rubric in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        ranked: {
          type: "array",
          items: {
            type: "object",
            properties: {
              record_id: { type: "string" },
              rank: { type: "integer", description: "1 = call first" },
              tier: { type: "integer", enum: [1, 2, 3] },
              reason: {
                type: "string",
                description: "One sentence, under 20 words, naming the specific signal found",
              },
              note_quality: { type: "string" },
            },
            required: ["record_id", "rank", "tier", "reason", "note_quality"],
          },
        },
      },
      required: ["ranked"],
    },
  };

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: PRIORITIZATION_SYSTEM_PROMPT,
    tools: [prioritizeTool],
    tool_choice: { type: "tool", name: "return_prioritization" },
    messages: [
      {
        role: "user",
        content: `Rank these ${candidates.length} open records:\n\n${JSON.stringify(candidates, null, 2)}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    return NextResponse.json({ error: "Claude did not return a prioritization" }, { status: 502 });
  }

  const { ranked } = toolUse.input as {
    ranked: { record_id: string; rank: number; tier: number; reason: string; note_quality: string }[];
  };

  const generatedAt = new Date().toISOString();

  await Promise.all(
    ranked.map((r) =>
      supabase
        .from("records")
        .update({
          last_prioritization_rank: r.rank,
          last_prioritization_urgency: `Tier ${r.tier}`,
          last_prioritization_reason: r.reason,
          last_prioritization_at: generatedAt,
        })
        .eq("id", r.record_id)
    )
  );

  const byId = new Map(records.map((r) => [r.id, r]));
  const enriched = ranked
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      id: r.record_id,
      rank: r.rank,
      tier: r.tier,
      reason: r.reason,
      note_quality: r.note_quality,
      name: byId.get(r.record_id) ? fullName(byId.get(r.record_id)!) : "Unknown",
    }));

  return NextResponse.json({ results: enriched, generatedAt });
}
