import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I acknowledge that I have received, read, and understand the Mai Troll Employee Handbook, and I agree to comply with its policies and procedures.'

export default function HandbookAcknowledgementForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Handbook received', value: d.acknowledged ? 'Yes' : 'No' },
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
          I acknowledge receipt and review of the Mai Troll Employee Handbook, including all
          policies on conduct, compensation, leave, and platform safety.
        </label>
      )}
    </DocumentFormShell>
  )
}
