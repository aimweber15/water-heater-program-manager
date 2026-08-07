-- SCEC Water Heater Program Manager — initial schema
-- Implements the field list from Assignment 5A, Step 3.

create extension if not exists "pgcrypto";

-- Eleven-value status lifecycle (Step 3 / Step 5 status flow diagram).
-- Ten main-chain values plus one branch exit, closed_no_sale, reachable any time before sold.
create type record_status as enum (
  'inquiry',
  'quoted',
  'sold',
  'picked_up',
  'installed',
  'lmr_scheduled',
  'lmr_verified',
  'rebate_submitted',
  'rebate_paid',
  'closed_complete',
  'closed_no_sale'
);

create type contact_method as enum ('phone', 'website', 'walk_in');

create type water_heater_size as enum ('85', '100');

create type no_sale_reason as enum ('price', 'went_elsewhere', 'no_response', 'not_eligible');

create type rebate_submission_status as enum ('not_ready', 'ready', 'submitted', 'rejected', 'paid');

create type alert_type as enum (
  'deadline_approaching',
  'install_unconfirmed',
  'rebate_incomplete',
  'follow_up_overdue'
);

create type alert_facing as enum ('internal', 'member_facing');

create table records (
  id uuid primary key default gen_random_uuid(),

  -- About the member
  first_name text not null,
  last_name text not null,
  account_number text not null,
  service_location_number text not null,
  phone text,
  email text,
  household_size integer,
  has_existing_scec_water_heater boolean not null default false,
  has_existing_lmr boolean not null default false,

  -- About the inquiry
  inquiry_date date not null default current_date,
  contact_method contact_method not null,
  size_interest water_heater_size,
  size_recommended water_heater_size,
  size_chosen water_heater_size,
  urgency text,
  situation_notes text,
  price_check_only boolean not null default false,
  requested_follow_up boolean not null default false,

  -- Eligibility (Step 2 A4 / wireframe Screen 4 checkboxes)
  is_scec_member boolean not null default false,
  heater_is_electric boolean not null default false,
  agreed_to_load_management boolean not null default false,

  -- About where the record stands
  status record_status not null default 'inquiry',
  status_changed_at timestamptz not null default now(),
  no_sale_reason no_sale_reason,

  -- About contact history
  attempt_count integer not null default 0,
  last_contact_date date,
  next_follow_up_date date,
  escalated boolean not null default false,
  program_email_sent boolean not null default false,
  program_email_sent_date date,

  -- About the sale
  sale_date date,
  service_order_number text,
  price numeric(10, 2),
  order_number text,
  pickup_instructions text,
  date_picked_up date,
  serial_number text,
  billing_notified boolean not null default false,
  billed boolean not null default false,

  -- About installation and the LMR
  installed_date date,
  secondary_meter_required boolean not null default false,
  secondary_meter_in_place boolean not null default false,
  lmr_service_order_date date,
  lmr_service_order_number text,
  lmr_install_date date,
  lmr_communicating boolean not null default false,
  lmr_communicating_verified_date date,

  -- About the rebate
  -- deadline_date is generated rather than stored redundantly: 3 calendar months from sale_date.
  deadline_date date generated always as (sale_date + interval '3 months') stored,
  rebate_status rebate_submission_status not null default 'not_ready',
  rebate_submitted_date date,
  rebate_rejection_reason text,
  rebate_paid_date date,

  -- About what needs attention
  last_scan_at timestamptz,
  last_prioritization_rank integer,
  last_prioritization_urgency text,
  last_prioritization_reason text,
  last_prioritization_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index records_status_idx on records (status);
create index records_next_follow_up_idx on records (next_follow_up_date);
create index records_deadline_idx on records (deadline_date);

-- Timestamped, running note history per record (Step 3 "Free-text notes").
-- Also carries logged follow-up attempts (is_follow_up_attempt = true), since a
-- follow-up is recorded the same way as any other note: who, when, what happened.
create table record_notes (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references records (id) on delete cascade,
  author text not null,
  body text not null,
  is_follow_up_attempt boolean not null default false,
  created_at timestamptz not null default now()
);

create index record_notes_record_id_idx on record_notes (record_id, created_at);

-- Active alerts per record, written by the daily cron scan (Step 3 "About what needs attention").
create table record_alerts (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references records (id) on delete cascade,
  alert_type alert_type not null,
  facing alert_facing not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (record_id, alert_type, resolved)
);

create index record_alerts_record_id_idx on record_alerts (record_id);
create index record_alerts_unresolved_idx on record_alerts (alert_type) where resolved = false;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger records_set_updated_at
  before update on records
  for each row
  execute function set_updated_at();

-- This is a three-internal-staff tool with no end-user auth (Step 6 cuts user
-- accounts/permissions from MVP scope). All application access goes through Next.js
-- API routes using the secret/service-role key, which bypasses RLS regardless of
-- policy. RLS is enabled here with zero policies purely to close off the publishable
-- (anon) key — a browser-exposed key by its NEXT_PUBLIC_ naming convention — from ever
-- reading or writing member PII directly, in case it's referenced client-side later.
alter table records enable row level security;
alter table record_notes enable row level security;
alter table record_alerts enable row level security;
