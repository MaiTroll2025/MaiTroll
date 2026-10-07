import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'
import { jsPDF } from 'jspdf'

const ATTESTATION =
  'Under penalties of perjury, I declare that the information on this state withholding form is true and correct, and that I have claimed the proper allowances or exemption for my state of residence/work.'

async function generateStateWithholdingPdf(data: any, signatureName: string): Promise<Uint8Array | null> {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const date = new Date().toISOString().slice(0, 10)

    doc.setFontSize(18)
    doc.text('State Tax Withholding', 40, 48)
    doc.setFontSize(10)
    doc.text('Employee Copy — State Withholding Certificate', 40, 64)
    doc.setFontSize(14)
    doc.text('State Withholding Form', 40, 90)

    const rows = [
      ['Employee Name', data.employeeName ?? ''],
      ['Social Security Number', data.ssn ?? ''],
      ['Address', [data.street, data.city, data.state, data.zip].filter(Boolean).join(', ')],
      ['State', data.state ?? ''],
      ['Filing Status', data.filingStatus ?? ''],
      ['Allowances / Exemptions', data.allowances ?? ''],
      ['Exempt from State Withholding', data.exempt ? 'Yes' : 'No'],
      ['Employee Signature', signatureName],
      ['Date', date],
    ]

    doc.autoTable({
      startY: 110,
      head: [['Field', 'Value']],
      body: rows.map((r) => [r[0], r[1] || '—']),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [16, 21, 32] },
      theme: 'grid',
    })

    doc.save(`state_withholding-${Date.now()}.pdf`)
    return null
  } catch (err) {
    console.error('Failed to generate state withholding PDF:', err)
    return null
  }
}

export default function StateWithholdingForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employee Copy — retain for your records. State-specific form — complete per your state's requirements."
      attestation={ATTESTATION}
      onGeneratePdf={generateStateWithholdingPdf}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Employee name', value: d.employeeName ?? '' },
        { label: 'SSN', value: d.ssn ?? '', sensitive: true },
        { label: 'Address', value: [d.street, d.city, d.state, d.zip].filter(Boolean).join(', ') },
        { label: 'State', value: d.state ?? '' },
        { label: 'Filing status', value: d.filingStatus ?? '' },
        { label: 'Allowances', value: d.allowances ?? '' },
        { label: 'Exempt', value: d.exempt ? 'Yes' : 'No' },
        { label: 'Employee signature', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-400">
            State-specific form — complete per your state&apos;s requirements.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee name" value={data.employeeName} onChange={(v) => setField('employeeName', v)} />
            <Field label="SSN" value={data.ssn} onChange={(v) => setField('ssn', v)} placeholder="•••••••••" sensitive />
            <Field label="Street address" value={data.street} onChange={(v) => setField('street', v)} />
            <Field label="City" value={data.city} onChange={(v) => setField('city', v)} />
            <Field label="Work state" value={data.state} onChange={(v) => setField('state', v)} />
            <Field label="ZIP code" value={data.zip} onChange={(v) => setField('zip', v)} />
            <Field label="Filing status" value={data.filingStatus} onChange={(v) => setField('filingStatus', v)} placeholder="Single / Married / HOH" />
            <Field label="Allowances / exemptions" value={data.allowances} onChange={(v) => setField('allowances', v)} />
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={!!data.exempt}
              onChange={(e) => setField('exempt', e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            I claim EXEMPT from state withholding (where permitted by state law).
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
  sensitive,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  sensitive?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-300">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={sensitive ? 'password' : 'text'}
        className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none placeholder:text-slate-600"
      />
    </div>
  )
}
