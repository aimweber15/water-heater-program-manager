import type { WaterHeaterSize } from "@/lib/types";

// A6 (Step 2): "a household-size threshold, not judgment." The spec confirms this is a
// rule (Appendix A, Q3) but doesn't name the exact cutoff. Households of 3 or fewer get
// the smaller tank; this is the one number in the app an SCEC admin may want to tune.
const SIZE_THRESHOLD_HOUSEHOLD_SIZE = 3;

export function recommendSize(householdSize: number | null | undefined): WaterHeaterSize | null {
  if (!householdSize || householdSize < 1) return null;
  return householdSize <= SIZE_THRESHOLD_HOUSEHOLD_SIZE ? "85" : "100";
}

// A5 (Step 2): price tier is a binary lookup, higher if the household already has an
// SCEC-purchased water heater. Actual dollar figures are set by SCEC staff at quote time
// (Stage 3 of Step 1 — "ESR quotes the price"), so this only reports which tier applies.
export type PriceTier = "standard" | "existing_customer";

export function priceTier(hasExistingScecWaterHeater: boolean): PriceTier {
  return hasExistingScecWaterHeater ? "existing_customer" : "standard";
}

// A3 (Step 2): "today's date plus a fixed interval." Matches the Step 4 F4 threshold
// (7 days with no contact logged) so a fresh inquiry becomes overdue exactly when the
// default follow-up window closes, not before.
const DEFAULT_FOLLOW_UP_DAYS = 7;

export function defaultFollowUpDate(fromDate: Date = new Date()): string {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + DEFAULT_FOLLOW_UP_DAYS);
  return d.toISOString().slice(0, 10);
}

// B4 (Step 2): "At 3 attempts over 3 weeks, app flags the record for Member Services
// Manager review." The 3-week window is a soft signal in this MVP — the count is what's
// enforced, since there's no reliable single "attempt timestamp" to window against
// beyond attempt_count itself (each attempt already carries its own note timestamp).
export const ESCALATION_ATTEMPT_THRESHOLD = 3;

// E1 (Step 2): rebate readiness is three fields present or not, no interpretation.
export function isRebateReady(record: {
  serial_number: string | null;
  sale_date: string | null;
  lmr_install_date: string | null;
}): boolean {
  return Boolean(record.serial_number && record.sale_date && record.lmr_install_date);
}
