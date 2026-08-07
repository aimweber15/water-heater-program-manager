# SCEC Water Heater Program Manager

A workflow app for St. Croix Electric Cooperative's water heater sales and load
management program, replacing the two-tab shared spreadsheet described in
Assignment 5A. Built with Next.js (App Router), Supabase (Postgres), and Claude
for the single agentic step — ranking open inquiries by callback urgency.

See the design document (Assignment 5A) for the full process map, field list,
and MVP scope this build implements.

## Screens

- **Dashboard** (`/`) — summary counts, the Needs Attention list (cron-generated
  alerts, grouped internal vs. member-facing), and the Prioritize My Callbacks panel.
- **Record List** (`/records`) — every record, filterable by Open / Closed —
  Complete / Closed — No Sale / All, sorted by last name.
- **Record Detail** (`/records/[id]`) — progressive panels (Member, Inquiry,
  Sale, Install & LMR, Rebate), status-advance control, Close as No Sale, and
  the timestamped notes/contact history.
- **New Inquiry** (`/records/new`) — the intake form.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then apply the schema in
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) via
   the SQL Editor in the Supabase dashboard (or the Supabase CLI, if you have
   the project's database password).

3. **Copy `.env.example` to `.env.local`** and fill in:

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API (not currently used by any code path — the app only talks to Supabase from the server — but reserved for future client-side use) |
   | `SUPABASE_SECRET_KEY` | Project Settings → API. Server-only. Bypasses Row Level Security, same as the legacy `service_role` key. Never expose this to the browser. |
   | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) — powers the "Prioritize My Callbacks" button |
   | `CRON_SECRET` | Any random string. Set the same value in Vercel's project environment variables once deployed — Vercel Cron sends it automatically as `Authorization: Bearer <value>`. Leave blank for local dev. |

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## The daily cron job

[`vercel.json`](vercel.json) schedules `GET /api/cron` once daily. It runs the
four checks from Step 4 of the spec (deadline within 30 days, sold-but-unconfirmed
after 21 days, missing rebate prerequisites, no contact in 7 days) against every
open record and writes results to `record_alerts`. In production on Vercel, set
`CRON_SECRET` as a project environment variable and Vercel will authenticate the
job automatically. You can also trigger it manually — `curl` the route (with the
`Authorization: Bearer $CRON_SECRET` header if set) or hit it from a browser
during local dev when `CRON_SECRET` is unset.

## Data model

One `records` table holds the full Step 3 field list, keyed to an 11-value
`record_status` enum. `record_notes` is the running, timestamped note history —
it also carries logged follow-up attempts (`is_follow_up_attempt = true`) rather
than living in a separate contact-log table, since both are the same shape: a
timestamped note with a who/what. `record_alerts` holds the daily scan's output.
Row Level Security is enabled on all three tables with no policies, so only the
server-side secret key (used by every API route) can read or write — the
publishable key has no access, in case it's ever referenced client-side.

## What's deliberately out of scope

See Step 6 of the design document. In short: no user accounts, no search or
pagination (the workflow carries ~10 open records at a time), no member
database / DERMS / Dairyland portal integrations, no real email sending (the
app logs that the program email was sent, not the sending itself), and one
agentic step only — the pursue-or-close decision at 3 failed attempts stays
with the Member Services Manager, not Claude.
