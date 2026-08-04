import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I acknowledge that I have read and understand the Mai Troll Anti-Harassment and Workplace Respect Policy, including its reporting channels, and I agree to maintain a respectful workplace.'

export default function AntiHarassmentForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Anti-harassment acknowledged', value: d.acknowledged ? 'Yes' : 'No' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={!!data.acknowledged}
            onChange={(e) => setField('acknowledged', e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          I understand harassment of any kind is prohibited and that I may report concerns
          confidentially through HR or the designated reporting channel.
        </label>
      )}
    </DocumentFormShell>
  )
}
