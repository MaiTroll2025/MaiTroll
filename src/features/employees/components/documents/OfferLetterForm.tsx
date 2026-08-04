import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I certify that I have read and accept this offer of employment with Mai Troll. The terms above are accurate as of my start date, and I understand my employment may be governed by applicable company policy. I acknowledge this electronic signature is legally binding.'

export default function OfferLetterForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Role', value: d.role ?? '' },
        { label: 'Department', value: d.department ?? '' },
        { label: 'Pay rate', value: d.payRate ? `$${d.payRate}/hour` : '' },
        { label: 'Start date', value: d.startDate ?? '' },
        { label: 'Manager', value: d.managerName ?? '' },
        { label: 'Acknowledged', value: d.acknowledged ? 'Yes' : 'No' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" value={data.role} onChange={(v) => setField('role', v)} />
          <Field label="Department" value={data.department} onChange={(v) => setField('department', v)} />
          <Field label="Pay rate (baseline $19/hour)" value={data.payRate} onChange={(v) => setField('payRate', v)} placeholder="$19/hour" />
          <Field label="Start date" value={data.startDate} onChange={(v) => setField('startDate', v)} placeholder="YYYY-MM-DD" />
          <Field label="Manager name" value={data.managerName} onChange={(v) => setField('managerName', v)} className="sm:col-span-2" />
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={!!data.acknowledged}
              onChange={(e) => setField('acknowledged', e.target.checked)}
              className="h-4 w-4"
            />
            I acknowledge and accept the role, pay, and start date above.
          </label>
        </div>
      )}
    </DocumentFormShell>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-slate-300">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none placeholder:text-slate-600"
      />
    </div>
  )
}
