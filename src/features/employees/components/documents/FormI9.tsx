import React from 'react'
import { DocumentFormShell, DocumentFormProps } from './DocumentFormShell'
import { generateI9Pdf, type I9FormData } from '../../../../lib/taxFormPdfs'

const EMPLOYEE_COPY_NOTE =
  'Employee Copy — retain this Section 1 and the Section 1 instructions only. The full M-274 employer instruction booklet is not retained by the employee. Complete Section 1 on or before your first day of employment.'

const SECTION_1_INSTRUCTION =
  'Section 1 instructions (retained): Use black or blue ink. Print clearly. Provide your full legal name as shown on your identity document. You must attest to your citizenship or immigration status and sign within three business days of your start date.'

const ATTESTATION =
  'I am aware that federal law provides for imprisonment and/or fines for false statements in connection with the completion of this form. I certify under penalty of perjury that this form was completed by me and that the information is true and correct.'

const LIST_A = [
  'U.S. Passport or U.S. Passport Card',
  'Permanent Resident Card or Alien Registration Receipt Card (Form I-551)',
  'Foreign passport with a temporary I-551 stamp',
  'Employment Authorization Document (Form I-766)',
  'Passport from the Federated States of Micronesia or Republic of the Marshall Islands with Form I-94',
]

const LIST_B = [
  "Driver's license or ID card issued by a U.S. state",
  'ID card issued by federal, state, or local government',
  'School ID with photo',
  'Military ID card',
  'Native American tribal document',
]

const LIST_C = [
  'Social Security Account Number card',
  'Certification of Birth Abroad (Form FS-545)',
  'U.S. Citizen ID Card (Form I-197)',
  'EmploymentAuthorization Document for a nonimmigrant (Form I-766)',
]

export default function FormI9(props: DocumentFormProps) {
  return (
    <DocumentFormShell
      {...props}
      employeeCopyNote={EMPLOYEE_COPY_NOTE}
      attestation={ATTESTATION}
      onGeneratePdf={async (data, signatureName) => {
        const i9Data: I9FormData = {
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          middleInitial: data.middleInitial ?? '',
          otherLastNames: data.otherLastNames ?? '',
          street: data.street ?? '',
          apt: data.apt ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          zip: data.zip ?? '',
          country: data.country ?? '',
          dob: data.dob ?? '',
          ssn: data.ssn ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          status: (data.status ?? '1') as I9FormData['status'],
          alienNumber: data.alienNumber ?? '',
          issuingCountry: data.issuingCountry ?? '',
          authExpiry: data.authExpiry ?? '',
          i94: data.i94 ?? '',
          foreignPassport: data.foreignPassport ?? '',
          attest: !!data.attest,
          signature: signatureName,
          date: new Date().toISOString().slice(0, 10),
        }
        try {
          return await generateI9Pdf(i9Data)
        } catch (err) {
          console.error('Failed to generate I-9 PDF:', err)
          return null
        }
      }}
      fieldsForPdf={(d, sig, date) => {
        const rows: { label: string; value: string; sensitive?: boolean }[] = [
          { label: 'Last name', value: d.lastName ?? '' },
          { label: 'First name', value: d.firstName ?? '' },
          { label: 'Middle initial', value: d.middleInitial ?? '' },
          { label: 'Other last names used', value: d.otherLastNames ?? '' },
          { label: 'Address', value: [d.street, d.apt, d.city, d.state, d.zip, d.country].filter(Boolean).join(', ') },
          { label: 'Date of birth', value: d.dob ?? '' },
          { label: 'SSN', value: d.ssn ?? '', sensitive: true },
          { label: 'Email', value: d.email ?? '' },
          { label: 'Phone', value: d.phone ?? '' },
          { label: 'Citizenship/immigration status', value: statusLabel(d.status) },
        ]
        if (d.status === '3' || d.status === '4') {
          rows.push({ label: 'A-number / Foreign passport #', value: d.alienNumber ?? '' })
          rows.push({ label: 'Issuing country', value: d.issuingCountry ?? '' })
        }
        rows.push({ label: 'Employee signature', value: sig })
        rows.push({ label: 'Date', value: date })
        return rows
      }}
    >
      {({ data, setField, errors }) => {
        const status = data.status ?? ''
        return (
          <div className="space-y-5">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/[0.06] px-3 py-2 text-xs text-cyan-100/80">
              {SECTION_1_INSTRUCTION}
            </div>

            <SectionTitle>Section 1 — Employee Information and Attestation</SectionTitle>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Last name (family name)" value={data.lastName} onChange={(v) => setField('lastName', v)} error={errors.lastName} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" value={data.firstName} onChange={(v) => setField('firstName', v)} error={errors.firstName} />
                <Field label="Middle initial" value={data.middleInitial} onChange={(v) => setField('middleInitial', v.slice(0, 1))} />
              </div>
              <Field label="Other last names used (if any)" value={data.otherLastNames} onChange={(v) => setField('otherLastNames', v)} className="sm:col-span-2" />
              <Field label="Street address" value={data.street} onChange={(v) => setField('street', v)} />
              <Field label="Apt/Unit" value={data.apt} onChange={(v) => setField('apt', v)} />
              <Field label="City" value={data.city} onChange={(v) => setField('city', v)} />
              <Field label="State" value={data.state} onChange={(v) => setField('state', v)} />
              <Field label="ZIP code" value={data.zip} onChange={(v) => setField('zip', v)} />
              <Field label="Country (if not U.S.)" value={data.country} onChange={(v) => setField('country', v)} />
              <Field label="Date of birth" value={data.dob} onChange={(v) => setField('dob', v)} placeholder="YYYY-MM-DD" />
              <Field label="U.S. Social Security Number" value={data.ssn} onChange={(v) => setField('ssn', v)} placeholder="•••••••••" sensitive />
              <Field label="Email" value={data.email} onChange={(v) => setField('email', v)} />
              <Field label="Phone" value={data.phone} onChange={(v) => setField('phone', v)} />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-300">Citizenship or immigration status</p>
              <div className="mt-2 space-y-2">
                {[
                  ['1', 'A U.S. citizen'],
                  ['2', 'A noncitizen national of the United States'],
                  ['3', 'A lawful permanent resident'],
                  ['4', 'An alien authorized to work'],
                ].map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="radio"
                      name="i9status"
                      checked={status === val}
                      onChange={() => setField('status', val)}
                      className="h-4 w-4"
                    />
                    {val}. {label}
                  </label>
                ))}
              </div>
            </div>

            {(status === '3' || status === '4') && (
              <div className="grid gap-4 sm:grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-3">
                <Field
                  label={status === '3' ? 'USCIS # / A-Number' : 'A-Number / Foreign passport #'}
                  value={data.alienNumber}
                  onChange={(v) => setField('alienNumber', v)}
                />
                <Field label="Issuing country" value={data.issuingCountry} onChange={(v) => setField('issuingCountry', v)} />
                {status === '4' && (
                  <Field label="Expiration date (if any)" value={data.authExpiry} onChange={(v) => setField('authExpiry', v)} placeholder="YYYY-MM-DD" />
                )}
              </div>
            )}

            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={!!data.attest}
                onChange={(e) => setField('attest', e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              I attest, under penalty of perjury, that I am a citizen or national of the United
              States, a lawful permanent resident, or an alien authorized to work, and the
              information is true.
            </label>

            <OptionalBlock title="Preparer and/or Translator Certification">
              <p className="text-xs text-slate-400">
                Complete only if prepared with the help of a preparer or translator.
              </p>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <Field label="Preparer/translator name" value={data.prepName} onChange={(v) => setField('prepName', v)} />
                <Field label="Address" value={data.prepAddress} onChange={(v) => setField('prepAddress', v)} />
                <Field label="Signature" value={data.prepSignature} onChange={(v) => setField('prepSignature', v)} />
                <Field label="Date" value={data.prepDate} onChange={(v) => setField('prepDate', v)} />
              </div>
            </OptionalBlock>

            <ReadOnlyEmployerBlock
              listA={LIST_A}
              listB={LIST_B}
              listC={LIST_C}
            />
          </div>
        )
      }}
    </DocumentFormShell>
  )
}

function statusLabel(v?: string) {
  switch (v) {
    case '1': return '1 — U.S. citizen'
    case '2': return '2 — Noncitizen national'
    case '3': return '3 — Lawful permanent resident'
    case '4': return '4 — Alien authorized to work'
    default: return ''
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-black uppercase tracking-wide text-cyan-200">{children}</h4>
}

function OptionalBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs font-bold text-slate-300">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function ReadOnlyEmployerBlock({
  listA,
  listB,
  listC,
}: {
  listA: string[]
  listB: string[]
  listC: string[]
}) {
  return (
    <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-3">
      <h4 className="text-sm font-black uppercase tracking-wide text-amber-200">
        Section 2 & 3 — Employer/HR (read-only for employee)
      </h4>
      <p className="mt-1 text-xs text-amber-100/70">
        HR completes Section 2 (document examination) and Section 3 (reverification/rehire) at
        review. Upload your identity documents in the separate &quot;I-9 Identity Documents&quot; form.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ListBlock title="List A — Identity & Employment Auth." items={listA} />
        <ListBlock title="List B — Identity" items={listB} />
        <ListBlock title="List C — Employment Auth." items={listC} />
      </div>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-slate-300">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-400">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  className,
  sensitive,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
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
      {error && <p className="mt-1 text-[11px] font-semibold text-rose-300">{error}</p>}
    </div>
  )
}
