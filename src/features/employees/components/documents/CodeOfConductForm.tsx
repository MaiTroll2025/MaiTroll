import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I acknowledge that I have read and understand the Mai Troll Code of Conduct and agree to abide by its standards of professional and lawful behavior while representing the company.'

export default function CodeOfConductForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Code of Conduct acknowledged', value: d.acknowledged ? 'Yes' : 'No' },
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
          I agree to the Mai Troll Code of Conduct, including respect for colleagues and users,
          lawful behavior, and platform safety obligations.
        </label>
      )}
    </DocumentFormShell>
  )
}
