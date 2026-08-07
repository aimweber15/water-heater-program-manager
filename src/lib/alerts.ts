import type { AlertFacing, AlertType, WaterHeaterRecord } from "@/lib/types";
import { ALERT_CONFIG } from "@/lib/types";

// Thresholds locked in Appendix A, Q2 of the spec — do not change without a new
// process-owner review. Step 4 lists these as the four daily cron conditions.
export const DEADLINE_APPROACHING_DAYS = 30;
export const INSTALL_UNCONFIRMED_DAYS = 21;
export const FOLLOW_UP_OVERDUE_DAYS = 7;

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export interface EvaluatedAlert {
  alert_type: AlertType;
  facing: AlertFacing;
}

/**
 * Step 4's four daily checks, evaluated for a single record against "now".
 * Pure function so the cron route and any UI preview can share it.
 */
export function evaluateAlerts(record: WaterHeaterRecord, now: Date = new Date()): EvaluatedAlert[] {
  const alerts: EvaluatedAlert[] = [];
  const isOpen = record.status !== "closed_complete" && record.status !== "closed_no_sale";

  if (!isOpen) return alerts;

  // F1 — within 30 days of the 3-month deadline.
  if (record.deadline_date) {
    const deadline = new Date(record.deadline_date);
    const daysRemaining = daysBetween(now, deadline);
    if (daysRemaining <= DEADLINE_APPROACHING_DAYS) {
      alerts.push({ alert_type: "deadline_approaching", facing: ALERT_CONFIG.deadline_approaching.facing });
    }
  }

  // F2 — sold, no install confirmed after 21 days.
  const soldStatuses = ["sold", "picked_up"];
  if (soldStatuses.includes(record.status) && record.sale_date) {
    const daysSinceSale = daysBetween(new Date(record.sale_date), now);
    if (daysSinceSale > INSTALL_UNCONFIRMED_DAYS && !record.installed_date) {
      alerts.push({ alert_type: "install_unconfirmed", facing: ALERT_CONFIG.install_unconfirmed.facing });
    }
  }

  // F3 — sold records missing a rebate prerequisite (serial number, sale date, LMR install date).
  const pastSale = STATUS_ORDER[record.status] >= STATUS_ORDER["sold"];
  if (pastSale && record.status !== "closed_no_sale") {
    const missingPrereq = !record.serial_number || !record.sale_date || !record.lmr_install_date;
    if (missingPrereq && record.rebate_status !== "submitted" && record.rebate_status !== "paid") {
      alerts.push({ alert_type: "rebate_incomplete", facing: ALERT_CONFIG.rebate_incomplete.facing });
    }
  }

  // F4 — inquiries with no contact logged in 7 days.
  if (record.status === "inquiry" || record.status === "quoted") {
    const lastTouch = record.last_contact_date ? new Date(record.last_contact_date) : new Date(record.inquiry_date);
    const daysSinceContact = daysBetween(lastTouch, now);
    if (daysSinceContact >= FOLLOW_UP_OVERDUE_DAYS) {
      alerts.push({ alert_type: "follow_up_overdue", facing: ALERT_CONFIG.follow_up_overdue.facing });
    }
  }

  return alerts;
}

const STATUS_ORDER: Record<string, number> = {
  inquiry: 0,
  quoted: 1,
  sold: 2,
  picked_up: 3,
  installed: 4,
  lmr_scheduled: 5,
  lmr_verified: 6,
  rebate_submitted: 7,
  rebate_paid: 8,
  closed_complete: 9,
  closed_no_sale: -1,
};

export function daysUntil(dateStr: string | null, now: Date = new Date()): number | null {
  if (!dateStr) return null;
  return daysBetween(now, new Date(dateStr));
}
