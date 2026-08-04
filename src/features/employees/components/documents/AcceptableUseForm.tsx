import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'

const ATTESTATION =
  'I acknowledge that I have read and agree to the Mai Troll Systems Acceptable Use Policy governing company accounts, devices, passwords, records, and administrative systems.'

export default function AcceptableUseForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records."
      attestation={ATTESTATION}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Acceptable use acknowledged', value: d.acknowledged ? 'Yes' : 'No' },
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
          I will use company systems, accounts, and devices only for authorized work, protect my
          credentials, and report security concerns promptly.
        </label>
      )}
    </DocumentFormShell>
  )
}
