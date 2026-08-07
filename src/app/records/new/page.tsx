"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTACT_METHOD_LABELS } from "@/lib/types";
import { CheckboxField, NumberField, SelectField, TextAreaField, TextField } from "@/components/fields";

const initialForm = {
  first_name: "",
  last_name: "",
  account_number: "",
  service_location_number: "",
  phone: "",
  email: "",
  household_size: null as number | null,
  contact_method: "phone",
  size_interest: "",
  urgency: "",
  situation_notes: "",
  price_check_only: false,
  requested_follow_up: false,
  has_existing_scec_water_heater: false,
  has_existing_lmr: false,
  is_scec_member: false,
  heater_is_electric: false,
  agreed_to_load_management: false,
  author: "",
};

export default function NewInquiryPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save inquiry");
      router.push(`/records/${data.record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Inquiry</h1>
        <p className="mt-1 text-sm text-slate-500">Short on purpose — fill this in while the member is on the phone.</p>
      </div>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <form onSubmit={submit} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="First name" value={form.first_name} onChange={(v) => set("first_name", v)} required />
          <TextField label="Last name" value={form.last_name} onChange={(v) => set("last_name", v)} required />
          <TextField label="Account number" value={form.account_number} onChange={(v) => set("account_number", v)} required />
          <TextField
            label="Service location #"
            value={form.service_location_number}
            onChange={(v) => set("service_location_number", v)}
            required
          />
          <TextField label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
          <TextField label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
          <NumberField label="Household size" value={form.household_size} onChange={(v) => set("household_size", v)} />
          <SelectField
            label="How they contacted us"
            value={form.contact_method}
            onChange={(v) => set("contact_method", v)}
            options={Object.entries(CONTACT_METHOD_LABELS).map(([value, label]) => ({ value, label }))}
            required
          />
          <SelectField
            label="Size interest"
            value={form.size_interest}
            onChange={(v) => set("size_interest", v)}
            options={[
              { value: "85", label: "85 gallon" },
              { value: "100", label: "100 gallon" },
            ]}
          />
          <TextField label="Urgency" value={form.urgency} onChange={(v) => set("urgency", v)} />
        </div>

        <TextAreaField
          label="Situation notes"
          value={form.situation_notes}
          onChange={(v) => set("situation_notes", v)}
          helpText="What the member said — this drives AI prioritization. Write what's actually going on (“no hot water, dairy operation”), not just “called about heater.”"
        />

        <div className="grid grid-cols-2 gap-3">
          <CheckboxField label="Checking price only" checked={form.price_check_only} onChange={(v) => set("price_check_only", v)} />
          <CheckboxField label="Asked for follow-up" checked={form.requested_follow_up} onChange={(v) => set("requested_follow_up", v)} />
          <CheckboxField
            label="Household already has SCEC water heater"
            checked={form.has_existing_scec_water_heater}
            onChange={(v) => set("has_existing_scec_water_heater", v)}
          />
          <CheckboxField label="Already has LMR" checked={form.has_existing_lmr} onChange={(v) => set("has_existing_lmr", v)} />
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700">Eligibility (verified verbally)</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <CheckboxField label="Confirmed SCEC member" checked={form.is_scec_member} onChange={(v) => set("is_scec_member", v)} />
            <CheckboxField label="Heater is electric" checked={form.heater_is_electric} onChange={(v) => set("heater_is_electric", v)} />
            <CheckboxField
              label="Agreed to load management"
              checked={form.agreed_to_load_management}
              onChange={(v) => set("agreed_to_load_management", v)}
            />
          </div>
        </div>

        <TextField label="Your name (ESR logging this inquiry)" value={form.author} onChange={(v) => set("author", v)} />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Inquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
