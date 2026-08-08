"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  CONTACT_METHOD_LABELS,
  NO_SALE_REASON_LABELS,
  REBATE_STATUS_LABELS,
  STATUS_CHAIN,
  STATUS_LABELS,
  NoSaleReason,
  RecordStatus,
  WaterHeaterRecord,
  fullName,
} from "@/lib/types";
import { daysUntil } from "@/lib/alerts";
import { formatCurrency, formatDate, formatDaysRemaining } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertPill } from "@/components/AlertPill";
import {
  CheckboxField,
  DateField,
  NumberField,
  Panel,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/fields";

function statusIndex(status: RecordStatus): number {
  return STATUS_CHAIN.indexOf(status);
}

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [record, setRecord] = useState<WaterHeaterRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/records/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load record");
      return;
    }
    setRecord(data.record);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(fields: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (error && !record) {
    return <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  }

  if (!record) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  const idx = statusIndex(record.status);
  const pastSale = record.status === "closed_no_sale" ? false : idx >= statusIndex("sold");
  const pastInstall = record.status === "closed_no_sale" ? false : idx >= statusIndex("installed");
  const isOpenBeforeSold = record.status === "inquiry" || record.status === "quoted";
  const deadlineDays = daysUntil(record.deadline_date);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/records" className="text-sm text-slate-500 hover:underline">
            ← Record List
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{fullName(record)}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={record.status} />
            <span className="text-xs text-slate-400">Since {formatDate(record.status_changed_at)}</span>
            {record.escalated && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                Escalated for MSM review
              </span>
            )}
          </div>
        </div>
        <StatusControl record={record} saving={saving} onAdvance={(s) => patch({ status: s })} />
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {(record.alerts ?? []).some((a) => !a.resolved) && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
          {(record.alerts ?? [])
            .filter((a) => !a.resolved)
            .map((a) => (
              <AlertPill key={a.id} type={a.alert_type} />
            ))}
        </div>
      )}

      <MemberPanel record={record} onSave={patch} />
      <InquiryPanel record={record} onSave={patch} />

      {isOpenBeforeSold && <CloseAsNoSalePanel onClose={(reason) => patch({ status: "closed_no_sale", no_sale_reason: reason })} />}

      <SalePanel record={record} greyed={!pastSale} onSave={patch} />
      <InstallLmrPanel record={record} greyed={!pastSale} onSave={patch} />
      <RebatePanel record={record} greyed={!pastInstall} deadlineDays={deadlineDays} onSave={patch} />

      <ContactHistoryPanel record={record} onLogged={load} />
    </div>
  );
}

function StatusControl({
  record,
  saving,
  onAdvance,
}: {
  record: WaterHeaterRecord;
  saving: boolean;
  onAdvance: (status: RecordStatus) => void;
}) {
  if (record.status === "closed_no_sale") return null;
  const idx = statusIndex(record.status);
  const next = STATUS_CHAIN[idx + 1];
  if (!next) return null;

  return (
    <button
      onClick={() => onAdvance(next)}
      disabled={saving}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
    >
      Advance to {STATUS_LABELS[next]}
    </button>
  );
}

function CloseAsNoSalePanel({ onClose }: { onClose: (reason: NoSaleReason) => void }) {
  const [reason, setReason] = useState<string>("");
  return (
    <div className="flex items-center justify-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <SelectField
        label=""
        value={reason}
        onChange={setReason}
        options={Object.entries(NO_SALE_REASON_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <button
        disabled={!reason}
        onClick={() => onClose(reason as NoSaleReason)}
        className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
      >
        Close as No Sale
      </button>
    </div>
  );
}

function MemberPanel({ record, onSave }: { record: WaterHeaterRecord; onSave: (f: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState(record);
  useEffect(() => setDraft(record), [record]);

  return (
    <Panel
      title="Member"
      action={
        <SaveButton
          onClick={() =>
            onSave({
              first_name: draft.first_name,
              last_name: draft.last_name,
              account_number: draft.account_number,
              service_location_number: draft.service_location_number,
              phone: draft.phone,
              email: draft.email,
              household_size: draft.household_size,
              has_existing_scec_water_heater: draft.has_existing_scec_water_heater,
              has_existing_lmr: draft.has_existing_lmr,
            })
          }
        />
      }
    >
      <TextField label="First name" value={draft.first_name} onChange={(v) => setDraft({ ...draft, first_name: v })} />
      <TextField label="Last name" value={draft.last_name} onChange={(v) => setDraft({ ...draft, last_name: v })} />
      <TextField label="Account number" value={draft.account_number} onChange={(v) => setDraft({ ...draft, account_number: v })} />
      <TextField
        label="Service location #"
        value={draft.service_location_number}
        onChange={(v) => setDraft({ ...draft, service_location_number: v })}
      />
      <TextField label="Phone" value={draft.phone ?? ""} onChange={(v) => setDraft({ ...draft, phone: v })} />
      <TextField label="Email" value={draft.email ?? ""} onChange={(v) => setDraft({ ...draft, email: v })} />
      <NumberField
        label="Household size"
        value={draft.household_size}
        onChange={(v) => setDraft({ ...draft, household_size: v })}
      />
      <CheckboxField
        label="Already has one of our water heaters"
        checked={draft.has_existing_scec_water_heater}
        onChange={(v) => setDraft({ ...draft, has_existing_scec_water_heater: v })}
      />
      <CheckboxField
        label="Already has LMR"
        checked={draft.has_existing_lmr}
        onChange={(v) => setDraft({ ...draft, has_existing_lmr: v })}
      />
    </Panel>
  );
}

function InquiryPanel({ record, onSave }: { record: WaterHeaterRecord; onSave: (f: Record<string, unknown>) => void }) {
  const [draft, setDraft] = useState(record);
  useEffect(() => setDraft(record), [record]);

  return (
    <Panel
      title="Inquiry"
      action={
        <SaveButton
          onClick={() =>
            onSave({
              contact_method: draft.contact_method,
              size_interest: draft.size_interest,
              size_chosen: draft.size_chosen,
              urgency: draft.urgency,
              price_check_only: draft.price_check_only,
              requested_follow_up: draft.requested_follow_up,
              is_scec_member: draft.is_scec_member,
              heater_is_electric: draft.heater_is_electric,
              agreed_to_load_management: draft.agreed_to_load_management,
            })
          }
        />
      }
    >
      <TextField label="Inquiry date" value={formatDate(draft.inquiry_date)} onChange={() => {}} disabled />
      <SelectField
        label="Contact method"
        value={draft.contact_method}
        onChange={(v) => setDraft({ ...draft, contact_method: v as typeof draft.contact_method })}
        options={Object.entries(CONTACT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <SelectField
        label="Size interest"
        value={draft.size_interest ?? ""}
        onChange={(v) => setDraft({ ...draft, size_interest: v as typeof draft.size_interest })}
        options={[
          { value: "85", label: "85 gallon" },
          { value: "100", label: "100 gallon" },
        ]}
      />
      <TextField
        label="App-recommended size"
        value={draft.size_recommended ? `${draft.size_recommended} gallon` : "—"}
        onChange={() => {}}
        disabled
      />
      <SelectField
        label="Size chosen (member's decision)"
        value={draft.size_chosen ?? ""}
        onChange={(v) => setDraft({ ...draft, size_chosen: v as typeof draft.size_chosen })}
        options={[
          { value: "85", label: "85 gallon" },
          { value: "100", label: "100 gallon" },
        ]}
      />
      <TextField label="Urgency" value={draft.urgency ?? ""} onChange={(v) => setDraft({ ...draft, urgency: v })} />
      <CheckboxField
        label="Price check only"
        checked={draft.price_check_only}
        onChange={(v) => setDraft({ ...draft, price_check_only: v })}
      />
      <CheckboxField
        label="Requested follow-up"
        checked={draft.requested_follow_up}
        onChange={(v) => setDraft({ ...draft, requested_follow_up: v })}
      />
      <CheckboxField
        label="Confirmed member"
        checked={draft.is_scec_member}
        onChange={(v) => setDraft({ ...draft, is_scec_member: v })}
      />
      <CheckboxField
        label="Heater is electric"
        checked={draft.heater_is_electric}
        onChange={(v) => setDraft({ ...draft, heater_is_electric: v })}
      />
      <CheckboxField
        label="Agreed to load management"
        checked={draft.agreed_to_load_management}
        onChange={(v) => setDraft({ ...draft, agreed_to_load_management: v })}
      />
    </Panel>
  );
}

function SalePanel({
  record,
  greyed,
  onSave,
}: {
  record: WaterHeaterRecord;
  greyed: boolean;
  onSave: (f: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(record);
  useEffect(() => setDraft(record), [record]);

  return (
    <Panel
      title="Sale"
      greyed={greyed}
      action={
        <SaveButton
          onClick={() =>
            onSave({
              sale_date: draft.sale_date,
              service_order_number: draft.service_order_number,
              price: draft.price,
              order_number: draft.order_number,
              pickup_instructions: draft.pickup_instructions,
              date_picked_up: draft.date_picked_up,
              serial_number: draft.serial_number,
              billing_notified: draft.billing_notified,
              billed: draft.billed,
            })
          }
        />
      }
    >
      <DateField label="Sale date" value={draft.sale_date} onChange={(v) => setDraft({ ...draft, sale_date: v })} disabled={greyed} />
      <TextField
        label="Service order #"
        value={draft.service_order_number ?? ""}
        onChange={(v) => setDraft({ ...draft, service_order_number: v })}
        disabled={greyed}
      />
      <NumberField label="Price" value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} disabled={greyed} />
      <TextField
        label="Order number"
        value={draft.order_number ?? ""}
        onChange={(v) => setDraft({ ...draft, order_number: v })}
        disabled={greyed}
      />
      <TextField
        label="Pick-up instructions"
        value={draft.pickup_instructions ?? ""}
        onChange={(v) => setDraft({ ...draft, pickup_instructions: v })}
        disabled={greyed}
      />
      <DateField
        label="Date picked up"
        value={draft.date_picked_up}
        onChange={(v) => setDraft({ ...draft, date_picked_up: v })}
        disabled={greyed}
      />
      <TextField
        label="Serial number (staff only, at pick-up)"
        value={draft.serial_number ?? ""}
        onChange={(v) => setDraft({ ...draft, serial_number: v })}
        disabled={greyed}
      />
      <CheckboxField
        label="Billing notified"
        checked={draft.billing_notified}
        onChange={(v) => setDraft({ ...draft, billing_notified: v })}
        disabled={greyed}
      />
      <CheckboxField label="Billed" checked={draft.billed} onChange={(v) => setDraft({ ...draft, billed: v })} disabled={greyed} />
    </Panel>
  );
}

function InstallLmrPanel({
  record,
  greyed,
  onSave,
}: {
  record: WaterHeaterRecord;
  greyed: boolean;
  onSave: (f: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(record);
  useEffect(() => setDraft(record), [record]);

  return (
    <Panel
      title="Install and LMR"
      greyed={greyed}
      action={
        <SaveButton
          onClick={() =>
            onSave({
              installed_date: draft.installed_date,
              secondary_meter_required: draft.secondary_meter_required,
              secondary_meter_in_place: draft.secondary_meter_in_place,
              lmr_service_order_date: draft.lmr_service_order_date,
              lmr_service_order_number: draft.lmr_service_order_number,
              lmr_install_date: draft.lmr_install_date,
              lmr_communicating: draft.lmr_communicating,
              lmr_communicating_verified_date: draft.lmr_communicating_verified_date,
            })
          }
        />
      }
    >
      <DateField
        label="Installed date (as reported)"
        value={draft.installed_date}
        onChange={(v) => setDraft({ ...draft, installed_date: v })}
        disabled={greyed}
      />
      <CheckboxField
        label="Secondary meter required"
        checked={draft.secondary_meter_required}
        onChange={(v) => setDraft({ ...draft, secondary_meter_required: v })}
        disabled={greyed}
      />
      <CheckboxField
        label="Secondary meter in place"
        checked={draft.secondary_meter_in_place}
        onChange={(v) => setDraft({ ...draft, secondary_meter_in_place: v })}
        disabled={greyed}
      />
      <DateField
        label="LMR service order date"
        value={draft.lmr_service_order_date}
        onChange={(v) => setDraft({ ...draft, lmr_service_order_date: v })}
        disabled={greyed}
      />
      <TextField
        label="LMR service order #"
        value={draft.lmr_service_order_number ?? ""}
        onChange={(v) => setDraft({ ...draft, lmr_service_order_number: v })}
        disabled={greyed}
      />
      <DateField
        label="LMR install date"
        value={draft.lmr_install_date}
        onChange={(v) => setDraft({ ...draft, lmr_install_date: v })}
        disabled={greyed}
      />
      <CheckboxField
        label="LMR confirmed communicating (DERMS)"
        checked={draft.lmr_communicating}
        onChange={(v) => setDraft({ ...draft, lmr_communicating: v })}
        disabled={greyed}
      />
      <DateField
        label="Date communication verified"
        value={draft.lmr_communicating_verified_date}
        onChange={(v) => setDraft({ ...draft, lmr_communicating_verified_date: v })}
        disabled={greyed}
      />
    </Panel>
  );
}

function RebatePanel({
  record,
  greyed,
  deadlineDays,
  onSave,
}: {
  record: WaterHeaterRecord;
  greyed: boolean;
  deadlineDays: number | null;
  onSave: (f: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(record);
  useEffect(() => setDraft(record), [record]);

  return (
    <Panel
      title="Rebate"
      greyed={greyed}
      action={
        <SaveButton
          onClick={() =>
            onSave({
              rebate_status: draft.rebate_status,
              rebate_submitted_date: draft.rebate_submitted_date,
              rebate_rejection_reason: draft.rebate_rejection_reason,
              rebate_paid_date: draft.rebate_paid_date,
            })
          }
        />
      }
    >
      <TextField
        label="3-month deadline"
        value={record.deadline_date ? `${formatDate(record.deadline_date)} (${formatDaysRemaining(deadlineDays)})` : "—"}
        onChange={() => {}}
        disabled
      />
      <SelectField
        label="Submission status"
        value={draft.rebate_status}
        onChange={(v) => setDraft({ ...draft, rebate_status: v as typeof draft.rebate_status })}
        options={Object.entries(REBATE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        disabled={greyed}
      />
      <DateField
        label="Date submitted to Dairyland"
        value={draft.rebate_submitted_date}
        onChange={(v) => setDraft({ ...draft, rebate_submitted_date: v })}
        disabled={greyed}
      />
      <TextField
        label="Rejection reason"
        value={draft.rebate_rejection_reason ?? ""}
        onChange={(v) => setDraft({ ...draft, rebate_rejection_reason: v })}
        disabled={greyed}
      />
      <DateField
        label="Payment confirmed date"
        value={draft.rebate_paid_date}
        onChange={(v) => setDraft({ ...draft, rebate_paid_date: v })}
        disabled={greyed}
      />
    </Panel>
  );
}

function ContactHistoryPanel({ record, onLogged }: { record: WaterHeaterRecord; onLogged: () => void }) {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [isFollowUp, setIsFollowUp] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!author || !body) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/records/${record.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, body, is_follow_up_attempt: isFollowUp }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save note");
      setBody("");
      onLogged();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-medium">Contact History &amp; Notes</h2>
      <p className="mt-1 text-xs text-slate-500">
        Attempts: {record.attempt_count} · Last contact: {formatDate(record.last_contact_date)} · Next follow-up:{" "}
        {formatDate(record.next_follow_up_date)}
        {record.program_email_sent && ` · Program email sent ${formatDate(record.program_email_sent_date)}`}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <TextField label="Logged by" value={author} onChange={setAuthor} />
        <TextAreaField label="Note" value={body} onChange={setBody} helpText="What the member said — this drives AI prioritization." />
        <div className="flex flex-col gap-2">
          <CheckboxField label="Log as follow-up attempt" checked={isFollowUp} onChange={setIsFollowUp} />
          <button
            onClick={submit}
            disabled={submitting || !author || !body}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Save note
          </button>
        </div>
      </div>

      <ul className="mt-5 space-y-3 border-t border-slate-100 pt-4">
        {(record.notes ?? []).length === 0 && <li className="text-sm text-slate-400">No notes yet.</li>}
        {(record.notes ?? []).map((n) => (
          <li key={n.id} className="text-sm">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{new Date(n.created_at).toLocaleString()}</span>
              <span>·</span>
              <span className="font-medium text-slate-500">{n.author}</span>
              {n.is_follow_up_attempt && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                  Follow-up attempt
                </span>
              )}
            </div>
            <p className="mt-0.5 text-slate-700">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      Save
    </button>
  );
}
