# Water Heater Program Manager

Live app: [water-heater-program-manager.vercel.app](https://water-heater-program-manager.vercel.app)

A workflow app for an electric cooperative's water heater sales and load
management program, replacing a two-tab shared spreadsheet. Built with
Next.js (App Router), Supabase (Postgres), and Claude for the one agentic
step in the workflow — ranking open inquiries by callback urgency.

See the design document (Assignment 5A) for the full process map, field
list, and MVP scope this build implements.

## What it does

Member Services reps (ESRs) use this app to run the water heater program
end to end: log a new inquiry, quote and sell a unit, track pick-up and
installation, confirm load management (LMR) is communicating, and submit
the rebate — all as one record moving through an 11-status lifecycle, from
Inquiry through Closed – Complete (or Closed – No Sale, reachable any time
before a sale closes it out early). Four screens cover this:

- **Dashboard** (`/`) — summary counts, the Needs Attention list (cron-generated
  alerts, grouped internal vs. member-facing), and the Prioritize My Callbacks panel.
- **Record List** (`/records`) — every record, filterable by Open / Closed —
  Complete / Closed — No Sale / All, sorted by last name.
- **Record Detail** (`/records/[id]`) — progressive panels (Member, Inquiry,
  Sale, Install & LMR, Rebate), status-advance control, Close as No Sale, and
  the timestamped notes/contact history.
- **New Inquiry** (`/records/new`) — the intake form.

## Scheduled vs. on-demand

This app has exactly one scheduled job and one on-demand AI call — worth
being explicit about which is which.

**Scheduled — the daily cron job.** [`vercel.json`](vercel.json) runs
`GET /api/cron` once a day with no person involved. It scans every open
record and writes an alert for any of four conditions:

1. **Deadline approaching** — within 30 days of the 3-month rebate
   submission deadline.
2. **Install unconfirmed** — sold more than 21 days ago with no
   installation confirmed.
3. **Rebate incomplete** — past the sale stage but missing a rebate
   prerequisite (serial number, sale date, or LMR install date).
4. **Follow-up overdue** — an open inquiry or quote with no contact
   logged in 7 days.

Alerts are written to `record_alerts` and surfaced on the Dashboard's Needs
Attention list, split into internal vs. member-facing. Nothing here waits
on a person to click anything.

**On-demand — the "Prioritize My Callbacks" button.** This is the app's
one agentic step, and it only runs when an ESR asks for it. Clicking it on
the Dashboard calls `POST /api/prioritize`, which sends every open
Inquiry/Quoted record's notes to Claude. Claude ranks them into a callback
order (Tier 1/2/3) with a one-sentence reason per record, and that's the
whole of its job — it only ranks. It never contacts a member, never writes
to a record beyond the ranking fields, and never runs unattended; a person
makes every call and triggers every ranking.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then apply the schema and any migrations
   in [`supabase/migrations/`](supabase/migrations) in order, via the SQL
   Editor in the Supabase dashboard (or the Supabase CLI, if you have the
   project's database password).

3. **Copy `.env.example` to `.env.local`** and fill in:

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API (not currently used by any code path — the app only talks to Supabase from the server — but reserved for future client-side use) |
   | `SUPABASE_SECRET_KEY` | Project Settings → API. Server-only. Bypasses Row Level Security, same as the legacy `service_role` key. Never expose this to the browser. |
   | `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) — powers the "Prioritize My Callbacks" button |
   | `CRON_SECRET` | Any random string. Set the same value in Vercel's project environment variables once deployed — Vercel Cron sends it automatically as `Authorization: Bearer <value>`. Leave blank for local dev. |

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. **Optional: seed test data.** [`supabase/seed.sql`](supabase/seed.sql)
   has 12 fabricated records covering the full status enum and all four
   cron alert conditions — paste it into the Supabase SQL Editor to try
   the app with realistic data instead of starting empty. Uses relative
   dates (`now() - interval '...'`), so the alert thresholds trip whenever
   it's run, not just on the day it was written. Not deduplicated —
   running it twice inserts the records twice.

## Testing the cron job manually

In production, Vercel Cron authenticates itself automatically using
`CRON_SECRET`. To trigger it by hand instead of waiting for the schedule:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-deployment>/api/cron
```

Locally, with `CRON_SECRET` left unset, the route allows unauthenticated
calls — you can just hit `http://localhost:3000/api/cron` in a browser.

## Data model

One `records` table holds the full Step 3 field list, keyed to an 11-value
`record_status` enum. `record_notes` is the running, timestamped note history —
it also carries logged follow-up attempts (`is_follow_up_attempt = true`) rather
than living in a separate contact-log table, since both are the same shape: a
timestamped note with a who/what. `record_alerts` holds the daily scan's output.
Row Level Security is enabled on all three tables with no policies, so only the
server-side secret key (used by every API route) can read or write — the
publishable key has no access, in case it's ever referenced client-side.

`no_sale_reason` is enforced as required at the database level (not just in
the API route) whenever `status = 'closed_no_sale'`, via a `CHECK` constraint
in [`supabase/migrations/0002_no_sale_reason_check.sql`](supabase/migrations/0002_no_sale_reason_check.sql).

## What's deliberately out of scope

See Step 6 of the design document. In short: no user accounts, no search or
pagination (the workflow carries ~10 open records at a time), no member
database / DERMS / Dairyland portal integrations, no real email sending (the
app logs that the program email was sent, not the sending itself), and one
agentic step only — the pursue-or-close decision at 3 failed attempts stays
with the Member Services Manager, not Claude.
