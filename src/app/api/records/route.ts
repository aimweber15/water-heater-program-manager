import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { recommendSize, defaultFollowUpDate } from "@/lib/rules";

// Postgres enum columns reject "" outright (only a real member of the enum, or
// null, is valid) — form selects submit "" for their unset "—" option, so every
// optional enum/text field coming from the browser has to pass through this.
function emptyToNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() === "" ? null : (value as string | null) ?? null;
}

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("records")
    .select("*, alerts:record_alerts(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ records: data });
}

// New Inquiry form submit (A2/A3/A7 in Step 2): fixed set of fields captured the same
// way every time, then the app stamps inquiry date, computes the size recommendation,
// sets a default follow-up date, and saves at status Inquiry.
export async function POST(req: NextRequest) {
  const body = await req.json();

  const required = ["first_name", "last_name", "account_number", "service_location_number", "contact_method"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  const supabase = supabaseServer();
  const inquiryDate = new Date();

  const record = {
    first_name: body.first_name,
    last_name: body.last_name,
    account_number: body.account_number,
    service_location_number: body.service_location_number,
    phone: emptyToNull(body.phone),
    email: emptyToNull(body.email),
    household_size: body.household_size ?? null,
    has_existing_scec_water_heater: Boolean(body.has_existing_scec_water_heater),
    has_existing_lmr: Boolean(body.has_existing_lmr),

    inquiry_date: inquiryDate.toISOString().slice(0, 10),
    contact_method: body.contact_method,
    size_interest: emptyToNull(body.size_interest),
    size_recommended: recommendSize(body.household_size),
    size_chosen: emptyToNull(body.size_chosen),
    urgency: emptyToNull(body.urgency),
    situation_notes: emptyToNull(body.situation_notes),
    price_check_only: Boolean(body.price_check_only),
    requested_follow_up: Boolean(body.requested_follow_up),

    is_scec_member: Boolean(body.is_scec_member),
    heater_is_electric: Boolean(body.heater_is_electric),
    agreed_to_load_management: Boolean(body.agreed_to_load_management),

    status: "inquiry" as const,
    next_follow_up_date: defaultFollowUpDate(inquiryDate),
  };

  const { data, error } = await supabase.from("records").insert(record).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed the notes history with the intake note, if the rep captured one
  // (Screen 4: "what the member said — this drives AI prioritization").
  if (body.situation_notes) {
    await supabase.from("record_notes").insert({
      record_id: data.id,
      author: body.author ?? "ESR",
      body: body.situation_notes,
      is_follow_up_attempt: false,
    });
  }

  return NextResponse.json({ record: data }, { status: 201 });
}
