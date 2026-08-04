import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I certify that the emergency contact information provided is accurate and may be used by Mai Troll to reach my designated contact in case of an emergency.'

export default function EmergencyContactForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Contact name', value: d.name ?? '' },
        { label: 'Relationship', value: d.relationship ?? '' },
        { label: 'Phone', value: d.phone ?? '' },
        { label: 'Email', value: d.email ?? '' },
        { label: 'Alternate phone', value: d.alternatePhone ?? '' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" value={data.name} onChange={(v) => setField('name', v)} />
          <Field label="Relationship" value={data.relationship} onChange={(v) => setField('relationship', v)} />
          <Field label="Phone" value={data.phone} onChange={(v) => setField('phone', v)} />
          <Field label="Email" value={data.email} onChange={(v) => setField('email', v)} />
          <Field label="Alternate phone" value={data.alternatePhone} onChange={(v) => setField('alternatePhone', v)} className="sm:col-span-2" />
        </div>
      )}
    </DocumentFormShell>
  )
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-slate-300">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
      />
    </div>
  )
}
