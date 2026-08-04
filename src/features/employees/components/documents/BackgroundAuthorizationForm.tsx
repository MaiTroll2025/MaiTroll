import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I authorize Mai Troll, where permitted by applicable law, to obtain a consumer report and/or background screening for employment purposes. I understand that providing consent is voluntary and that my employment is not conditioned on consent where prohibited by law. I may request a copy of any report obtained.'

export default function BackgroundAuthorizationForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records. This authorization is used only where lawful for the position."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Employee name', value: d.employeeName ?? '' },
        { label: 'Consent provided', value: d.consent ? 'Yes' : 'No' },
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
              checked={!!data.consent}
              onChange={(e) => setField('consent', e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            I voluntarily consent to a background screening for employment purposes, where permitted
            by applicable law.
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
