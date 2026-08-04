import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I consent to enrollment in Mai Troll company systems and to employment eligibility verification via E-Verify (or equivalent, where applicable by law). I understand this consent is provided for payroll and work-authorization purposes.'

export default function TcEnrollmentForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records. TC payroll enrollment remains pending until the official company workflow is provided."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Employee name', value: d.employeeName ?? '' },
        { label: 'Systems enrollment consent', value: d.consent ? 'Yes' : 'No' },
        { label: 'Work-authorization consent', value: d.workAuthConsent ? 'Yes' : 'No' },
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
            I consent to enrollment in Mai Troll company systems for payroll and communications.
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={!!data.workAuthConsent}
              onChange={(e) => setField('workAuthConsent', e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            I consent to work-authorization verification (e.g., E-Verify) where applicable by law.
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
