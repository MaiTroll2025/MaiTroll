import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'
import { jsPDF } from 'jspdf'

const ATTESTATION =
  'Under penalties of perjury, I declare that the information provided on this new hire report is true and correct to the best of my knowledge.'

function generateNewHirePdf(data: any, signatureName: string): Uint8Array | null {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const date = new Date().toISOString().slice(0, 10)

    doc.setFontSize(18)
    doc.text('State New Hire Reporting', 40, 48)
    doc.setFontSize(10)
    doc.text('Employer Copy — New Employee Report', 40, 64)
    doc.setFontSize(14)
    doc.text('New Hire Report', 40, 90)

    const rows = [
      ['Employee Full Legal Name', data.fullName ?? ''],
      ['Social Security Number', data.ssn ?? ''],
      ['Street Address', data.street ?? ''],
      ['City', data.city ?? ''],
      ['State', data.state ?? ''],
      ['ZIP Code', data.zip ?? ''],
      ['Date of Birth', data.dob ?? ''],
      ['Date of Hire', data.hireDate ?? ''],
      ['Position / Job Title', data.position ?? ''],
      ['Wage / Salary', data.wage ?? ''],
      ['Employer Name', data.employerName ?? ''],
      ['Employer FEIN', data.employerFein ?? ''],
      ['Employer Address', data.employerAddress ?? ''],
      ['Employer Phone', data.employerPhone ?? ''],
      ['Reported By', signatureName],
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

    doc.save(`new_hire_report-${Date.now()}.pdf`)
    return null
  } catch (err) {
    console.error('Failed to generate new hire report PDF:', err)
    return null
  }
}

export default function StateNewHireReportingForm(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote="Employer Copy — submit to your state new hire reporting agency within required timeframe (typically 20 days)."
      attestation={ATTESTATION}
      onGeneratePdf={generateNewHirePdf}
      fieldsForPdf={(d, sig, date) => [
        { label: 'Employee Full Legal Name', value: d.fullName ?? '' },
        { label: 'Social Security Number', value: d.ssn ?? '', sensitive: true },
        { label: 'Street Address', value: d.street ?? '' },
        { label: 'City', value: d.city ?? '' },
        { label: 'State', value: d.state ?? '' },
        { label: 'ZIP Code', value: d.zip ?? '' },
        { label: 'Date of Birth', value: d.dob ?? '' },
        { label: 'Date of Hire', value: d.hireDate ?? '' },
        { label: 'Position / Job Title', value: d.position ?? '' },
        { label: 'Wage / Salary', value: d.wage ?? '' },
        { label: 'Employer Name', value: d.employerName ?? '' },
        { label: 'Employer FEIN', value: d.employerFein ?? '' },
        { label: 'Employer Address', value: d.employerAddress ?? '' },
        { label: 'Employer Phone', value: d.employerPhone ?? '' },
        { label: 'Reported By', value: sig },
        { label: 'Date', value: date },
      ]}
    >
      {({ data, setField }) => (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-400">
            Complete this form for each new hire. Submit to your state new hire reporting agency within the required timeframe.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee Full Legal Name" value={data.fullName} onChange={(v) => setField('fullName', v)} className="sm:col-span-2" />
            <Field label="Social Security Number" value={data.ssn} onChange={(v) => setField('ssn', v)} placeholder="•••••••••" sensitive />
            <Field label="Date of Birth" value={data.dob} onChange={(v) => setField('dob', v)} placeholder="YYYY-MM-DD" />
            <Field label="Street Address" value={data.street} onChange={(v) => setField('street', v)} className="sm:col-span-2" />
            <Field label="City" value={data.city} onChange={(v) => setField('city', v)} />
            <Field label="State" value={data.state} onChange={(v) => setField('state', v)} />
            <Field label="ZIP Code" value={data.zip} onChange={(v) => setField('zip', v)} />
            <Field label="Date of Hire" value={data.hireDate} onChange={(v) => setField('hireDate', v)} placeholder="YYYY-MM-DD" />
            <Field label="Position / Job Title" value={data.position} onChange={(v) => setField('position', v)} />
            <Field label="Wage / Salary" value={data.wage} onChange={(v) => setField('wage', v)} placeholder="$" />
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs font-bold text-slate-300">Employer Information</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <Field label="Employer Name" value={data.employerName} onChange={(v) => setField('employerName', v)} />
              <Field label="Employer FEIN" value={data.employerFein} onChange={(v) => setField('employerFein', v)} placeholder="XX-XXXXXXX" />
              <Field label="Employer Address" value={data.employerAddress} onChange={(v) => setField('employerAddress', v)} className="sm:col-span-2" />
              <Field label="Employer Phone" value={data.employerPhone} onChange={(v) => setField('employerPhone', v)} />
            </div>
          </div>
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
  className,
  sensitive,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  sensitive?: boolean
}) {
  return (
    <div className={className}>
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
