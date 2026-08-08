-- B6 (Step 2): Close as No Sale requires a reason from the fixed picklist before it
-- will fire. That was previously enforced only in application code
-- (src/app/api/records/[id]/route.ts) — this adds the same rule at the database level
-- so it holds regardless of write path.
alter table records
  add constraint no_sale_reason_required_when_closed_no_sale
  check (status != 'closed_no_sale' or no_sale_reason is not null);
