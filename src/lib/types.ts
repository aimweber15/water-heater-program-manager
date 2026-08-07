// Mirrors supabase/migrations/0001_init.sql. Keep in sync by hand — no MVP codegen step.

export type RecordStatus =
  | "inquiry"
  | "quoted"
  | "sold"
  | "picked_up"
  | "installed"
  | "lmr_scheduled"
  | "lmr_verified"
  | "rebate_submitted"
  | "rebate_paid"
  | "closed_complete"
  | "closed_no_sale";

// Ten-step main chain, in order. closed_no_sale is a branch exit, not a chain step,
// and is deliberately excluded from this array — see STATUS_LABELS for its label.
export const STATUS_CHAIN: RecordStatus[] = [
  "inquiry",
  "quoted",
  "sold",
  "picked_up",
  "installed",
  "lmr_scheduled",
  "lmr_verified",
  "rebate_submitted",
  "rebate_paid",
  "closed_complete",
];

export const STATUS_LABELS: Record<RecordStatus, string> = {
  inquiry: "Inquiry",
  quoted: "Quoted",
  sold: "Sold",
  picked_up: "Picked Up",
  installed: "Installed",
  lmr_scheduled: "LMR Scheduled",
  lmr_verified: "LMR Verified",
  rebate_submitted: "Rebate Submitted",
  rebate_paid: "Rebate Paid",
  closed_complete: "Closed — Complete",
  closed_no_sale: "Closed — No Sale",
};

// Closed — No Sale is available at any point before Sold (Step 3).
export const NO_SALE_ELIGIBLE_STATUSES: RecordStatus[] = ["inquiry", "quoted"];

export type ContactMethod = "phone" | "website" | "walk_in";

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone",
  website: "Website",
  walk_in: "Walk-in",
};

export type WaterHeaterSize = "85" | "100";

export type NoSaleReason = "price" | "went_elsewhere" | "no_response" | "not_eligible";

export const NO_SALE_REASON_LABELS: Record<NoSaleReason, string> = {
  price: "Price",
  went_elsewhere: "Went elsewhere",
  no_response: "No response",
  not_eligible: "Not eligible",
};

export type RebateSubmissionStatus = "not_ready" | "ready" | "submitted" | "rejected" | "paid";

export const REBATE_STATUS_LABELS: Record<RebateSubmissionStatus, string> = {
  not_ready: "Not ready",
  ready: "Ready",
  submitted: "Submitted",
  rejected: "Rejected",
  paid: "Paid",
};

export type AlertType =
  | "deadline_approaching"
  | "install_unconfirmed"
  | "rebate_incomplete"
  | "follow_up_overdue";

export type AlertFacing = "internal" | "member_facing";

// Step 3 "About what needs attention" table — who resolves each alert, verbatim.
export const ALERT_CONFIG: Record<
  AlertType,
  { label: string; facing: AlertFacing; resolver: string }
> = {
  deadline_approaching: {
    label: "Deadline approaching",
    facing: "internal",
    resolver: "Whoever owns the next blocking step",
  },
  install_unconfirmed: {
    label: "Install unconfirmed",
    facing: "member_facing",
    resolver: "ESR calls the member",
  },
  rebate_incomplete: {
    label: "Rebate incomplete",
    facing: "internal",
    resolver: "ESR checks SCEC paperwork — serial number, sale date, LMR install date are all ours",
  },
  follow_up_overdue: {
    label: "Follow-up overdue",
    facing: "member_facing",
    resolver: "ESR calls the member",
  },
};

export interface RecordAlert {
  id: string;
  record_id: string;
  alert_type: AlertType;
  facing: AlertFacing;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface RecordNote {
  id: string;
  record_id: string;
  author: string;
  body: string;
  is_follow_up_attempt: boolean;
  created_at: string;
}

export interface WaterHeaterRecord {
  id: string;

  first_name: string;
  last_name: string;
  account_number: string;
  service_location_number: string;
  phone: string | null;
  email: string | null;
  household_size: number | null;
  has_existing_scec_water_heater: boolean;
  has_existing_lmr: boolean;

  inquiry_date: string;
  contact_method: ContactMethod;
  size_interest: WaterHeaterSize | null;
  size_recommended: WaterHeaterSize | null;
  size_chosen: WaterHeaterSize | null;
  urgency: string | null;
  situation_notes: string | null;
  price_check_only: boolean;
  requested_follow_up: boolean;

  is_scec_member: boolean;
  heater_is_electric: boolean;
  agreed_to_load_management: boolean;

  status: RecordStatus;
  status_changed_at: string;
  no_sale_reason: NoSaleReason | null;

  attempt_count: number;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  escalated: boolean;
  program_email_sent: boolean;
  program_email_sent_date: string | null;

  sale_date: string | null;
  service_order_number: string | null;
  price: number | null;
  order_number: string | null;
  pickup_instructions: string | null;
  date_picked_up: string | null;
  serial_number: string | null;
  billing_notified: boolean;
  billed: boolean;

  installed_date: string | null;
  secondary_meter_required: boolean;
  secondary_meter_in_place: boolean;
  lmr_service_order_date: string | null;
  lmr_service_order_number: string | null;
  lmr_install_date: string | null;
  lmr_communicating: boolean;
  lmr_communicating_verified_date: string | null;

  deadline_date: string | null;
  rebate_status: RebateSubmissionStatus;
  rebate_submitted_date: string | null;
  rebate_rejection_reason: string | null;
  rebate_paid_date: string | null;

  last_scan_at: string | null;
  last_prioritization_rank: number | null;
  last_prioritization_urgency: string | null;
  last_prioritization_reason: string | null;
  last_prioritization_at: string | null;

  created_at: string;
  updated_at: string;

  notes?: RecordNote[];
  alerts?: RecordAlert[];
}

export function fullName(r: Pick<WaterHeaterRecord, "first_name" | "last_name">): string {
  return `${r.first_name} ${r.last_name}`;
}
