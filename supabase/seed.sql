-- Seed data for manual/local testing (Assignment 5A). All names, account numbers,
-- and notes below are fabricated for demonstration purposes — no real member data.
--
-- Dates are relative to now()/current_date so the four daily cron alert checks
-- (src/lib/alerts.ts) trip correctly whenever this is run, not just on the day it
-- was written.
--
-- Re-running this script is safe with respect to *dates* staying valid, but it is
-- NOT deduplicated — there's no natural key beyond the generated id, so running it
-- twice inserts 24 records, not 12. Delete the prior batch first for a clean re-seed.

-- ============================================================
-- Records 1-12
-- ============================================================
insert into records (
  first_name, last_name, account_number, service_location_number, phone,
  household_size, is_scec_member, heater_is_electric, agreed_to_load_management,
  has_existing_scec_water_heater, has_existing_lmr,
  inquiry_date, contact_method, size_interest, urgency, situation_notes, price_check_only,
  status, no_sale_reason,
  sale_date, installed_date, serial_number, lmr_install_date,
  lmr_communicating, lmr_communicating_verified_date,
  rebate_status, rebate_submitted_date, rebate_paid_date,
  billing_notified, billed,
  attempt_count, last_contact_date, next_follow_up_date
) values

-- 1: Quoted, dairy operation, thick notes — Tier 1 material for the Claude call.
(
  'Jorge', 'Alvarez', '500101', '5001', '608-555-0101',
  5, true, true, true,
  false, false,
  (now() - interval '4 days')::date, 'phone', '100', 'High - active milking operation affected',
  'No hot water since Tuesday, dairy operation, milking affected.', false,
  'quoted', null,
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  1, (current_date - 2), (current_date + 5)
),

-- 2: Inquiry, elderly member alone — Tier 1/2 material.
(
  'Delphine', 'Osei', '500202', '5002', '608-555-0102',
  1, true, true, true,
  false, false,
  (now() - interval '3 days')::date, 'phone', null, 'Elderly member living alone',
  'No hot water, elderly member living alone.', false,
  'inquiry', null,
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  1, (current_date - 1), (current_date + 6)
),

-- 3: Inquiry, active leak — Tier 1/2 material.
(
  'Marcus', 'Villanueva', '500303', '5003', '608-555-0103',
  3, true, true, true,
  false, false,
  (now() - interval '2 days')::date, 'website', null, null,
  'Water heater leaking into the basement, has a bucket under it.', false,
  'inquiry', null,
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  1, (current_date - 1), (current_date + 6)
),

-- 4: Quoted, price-check-only, explicitly low urgency — Tier 3/4 material.
(
  'Teresa', 'Okonkwo', '500404', '5004', '608-555-0104',
  null, true, true, false,
  false, false,
  (now() - interval '5 days')::date, 'phone', null, null,
  'Just checking price for down the road, no rush.', true,
  'quoted', null,
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, (current_date + 2)
),

-- 5: Inquiry, deliberately thin note — should rank Tier 3 on weak signal.
(
  'Wendell', 'Krantz', '500505', '5005', null,
  null, false, false, false,
  false, false,
  (now() - interval '1 day')::date, 'phone', null, null,
  'Called about heater.', false,
  'inquiry', null,
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, (current_date + 6)
),

-- 6: Sold ~24 days ago, not installed -> trips F2 install_unconfirmed (>21 days).
-- This also trips F3 rebate_incomplete, since serial_number/lmr_install_date are
-- genuinely missing at this stage — that's correct real-world behavior, not a bug,
-- so it's left as-is rather than fabricating rebate progress that hasn't happened.
(
  'Priya', 'Chandrasekaran', '600606', '6006', '608-555-0606',
  4, true, true, true,
  false, false,
  (now() - interval '30 days')::date, 'phone', null, null,
  'Sold, awaiting installation.', false,
  'sold', null,
  (now() - interval '24 days')::date, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, null
),

-- 7: Sold, deadline ~25 days out -> trips F1 deadline_approaching (<=30 days).
-- sale_date is ~65 days ago to land the generated deadline_date at +25 days.
-- LMR is deliberately left incomplete (not scheduled, not verified) — that's the
-- actual situation the deadline alert exists to warn about: the 3-month rebate
-- clock is running out and load management still isn't in place. Serial number
-- is set since it's recorded at pick-up, which has already happened; installed_date
-- and lmr_install_date stay null since status hasn't advanced past "sold" yet.
-- As a consequence this also trips F2 (no installed_date, >21 days since sale) and
-- F3 (lmr_install_date missing) — genuinely, not artificially: a record this far
-- overdue on LMR really would be flagged on all three.
(
  'Otis', 'Bramwell', '600707', '6007', '608-555-0707',
  4, true, true, true,
  false, false,
  (now() - interval '95 days')::date, 'phone', null, null,
  'Sold and picked up; LMR and rebate submission still outstanding.', false,
  'sold', null,
  (now() - interval '3 months' + interval '25 days')::date, null,
  'SN-70071', null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, null
),

-- 8: Sold recently, serial missing -> trips F3 rebate_incomplete only.
-- sale_date is recent enough (5 days) to stay clear of F1 and F2.
(
  'Nadia', 'Fitzgerald', '600808', '6008', '608-555-0808',
  2, true, true, true,
  false, false,
  (now() - interval '5 days')::date, 'phone', null, null,
  'Sold, unit not yet picked up.', false,
  'sold', null,
  (now() - interval '5 days')::date, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, null
),

-- 9: Inquiry, 9 days no contact -> trips F4 follow_up_overdue (>=7 days).
-- No sale_date, so F1/F2/F3 don't apply regardless.
(
  'Grant', 'Belcourt', '600909', '6009', null,
  null, true, true, false,
  false, false,
  (now() - interval '9 days')::date, 'phone', null, null,
  'Interested, has not been reachable since first call.', false,
  'inquiry', null,
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, (current_date - 2)
),

-- 10: LMR Verified, fully caught up on prereqs.
(
  'Simone', 'Achterberg', '700010', '7000', '608-555-1010',
  4, true, true, true,
  false, false,
  (now() - interval '45 days')::date, 'phone', null, null,
  'Fully installed, LMR verified, awaiting rebate submission.', false,
  'lmr_verified', null,
  (now() - interval '40 days')::date, (now() - interval '30 days')::date,
  'SN-70010', (now() - interval '20 days')::date,
  true, (now() - interval '15 days')::date,
  'ready', null, null,
  false, false,
  0, (current_date - 15), null
),

-- 11: Closed - Complete, all the way through the lifecycle.
(
  'Harriet', 'Loomis', '700011', '7001', '608-555-1111',
  3, true, true, true,
  false, false,
  (now() - interval '110 days')::date, 'phone', null, null,
  'Fully complete: installed, LMR verified, rebate paid.', false,
  'closed_complete', null,
  (now() - interval '100 days')::date, (now() - interval '90 days')::date,
  'SN-70011', (now() - interval '85 days')::date,
  true, (now() - interval '80 days')::date,
  'paid', (now() - interval '75 days')::date, (now() - interval '60 days')::date,
  true, true,
  0, (current_date - 60), null
),

-- 12: Closed - No Sale, reason 'price' — exercises the no_sale_reason CHECK constraint.
(
  'Denny', 'Okafor', '700012', '7002', '608-555-1212',
  null, true, true, false,
  false, false,
  (now() - interval '10 days')::date, 'phone', null, null,
  'Priced out the unit and installation, decided it was too expensive right now.', false,
  'closed_no_sale', 'price',
  null, null, null, null,
  false, null,
  'not_ready', null, null,
  false, false,
  0, null, null
);

-- ============================================================
-- record_notes for records 1-3 (foreign keys resolved by name match, not id)
-- ============================================================
insert into record_notes (record_id, author, body, is_follow_up_attempt, created_at)
select r.id, n.author, n.body, n.is_follow_up_attempt, n.created_at
from (
  values
    ('Jorge', 'Alvarez', 'ESR Monroe',
     'Initial call: no hot water since Tuesday, dairy operation, says milking affected.',
     false, now() - interval '4 days'),
    ('Jorge', 'Alvarez', 'ESR Monroe',
     'Follow-up call, still without hot water, quote provided for 100-gallon unit.',
     true, now() - interval '2 days'),
    ('Jorge', 'Alvarez', 'ESR Delgado',
     'Member confirmed install date works for their schedule, unit still not delivered yet.',
     false, now() - interval '1 day'),

    ('Delphine', 'Osei', 'ESR Monroe',
     'Member''s daughter called on her behalf, said mother lives alone and has had no hot water for two days.',
     false, now() - interval '3 days'),
    ('Delphine', 'Osei', 'ESR Monroe',
     'Called to check in, quote not yet sent, prioritizing given member is elderly and alone.',
     true, now() - interval '1 day'),

    ('Marcus', 'Villanueva', 'ESR Delgado',
     'Submitted via website form: water heater leaking into the basement, member placed a bucket under it to catch the water.',
     false, now() - interval '2 days'),
    ('Marcus', 'Villanueva', 'ESR Delgado',
     'Called member to confirm details, leak is slow but steady, no immediate flooding risk noted.',
     true, now() - interval '1 day')
) as n(first_name, last_name, author, body, is_follow_up_attempt, created_at)
join records r on r.first_name = n.first_name and r.last_name = n.last_name;
