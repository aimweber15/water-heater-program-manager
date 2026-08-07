"use client";

import { ReactNode } from "react";

const labelClass = "block text-xs font-medium text-slate-500";
const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400";

export function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="text-rose-500"> *</span>}
      <input
        type={type}
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        type="number"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={inputClass}
      />
    </label>
  );
}

export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        type="date"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      {required && <span className="text-rose-500"> *</span>}
      <select
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  helpText?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={`${inputClass} resize-y`}
      />
      {helpText && <span className="mt-1 block text-xs italic text-slate-400">{helpText}</span>}
    </label>
  );
}

export function Panel({
  title,
  greyed,
  children,
  action,
}: {
  title: string;
  greyed?: boolean;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border p-5 ${
        greyed ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {!greyed && action}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</div>
    </section>
  );
}
