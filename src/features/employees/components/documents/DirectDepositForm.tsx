import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I authorize Mai Troll to deposit my net pay into the account identified above. I understand this is an electronic authorization and signature. Banking details are sensitive and handled per company security policy.'

export default function DirectDepositForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records. Banking details are masked outside HR/admin views."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Bank name', value: d.bankName ?? '' },
        { label: 'Account type', value: d.accountType ?? '' },
        { label: 'Routing number', value: d.routingNumber ?? '', sensitive: true },
        { label: 'Account number', value: d.accountNumber ?? '', sensitive: true },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name" value={data.bankName} onChange={(v) => setField('bankName', v)} />
          <div>
            <label className="block text-xs font-bold text-slate-300">Account type</label>
            <select
              value={data.accountType ?? ''}
              onChange={(e) => setField('accountType', e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
            >
              <option value="">Select…</option>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </div>
          <Field
            label="Routing number (9 digits)"
            value={data.routingNumber}
            onChange={(v) => setField('routingNumber', v.replace(/\D/g, '').slice(0, 9))}
            placeholder="123456789"
          />
          <Field
            label="Account number"
            value={data.accountNumber}
            onChange={(v) => setField('accountNumber', v.replace(/\D/g, ''))}
            placeholder="••••••••"
          />
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
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
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
