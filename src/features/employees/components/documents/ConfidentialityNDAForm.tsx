import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I acknowledge that I have read and agree to the Mai Troll Confidentiality and Data Security Agreement, including non-disclosure of proprietary, employee, user, moderation, and platform information.'

export default function ConfidentialityNDAForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Employee name', value: d.employeeName ?? '' },
        { label: 'Non-disclosure acknowledged', value: d.acknowledged ? 'Yes' : 'No' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <Field label="Employee full name" value={data.employeeName} onChange={(v) => setField('employeeName', v)} />
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={!!data.acknowledged}
              onChange={(e) => setField('acknowledged', e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            I agree not to disclose any proprietary, employee, user, moderation, or platform data
            obtained during my employment, during or after my tenure.
          </label>
        </div>
      )}
    </DocumentFormShell>
  )
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none"
      />
    </div>
  )
}
