import React, { useCallback, useMemo, useState } from 'react'
import { Download, FileSignature, ShieldCheck } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../../../lib/supabase'
import { useAuthStore } from '../../../../lib/store'

export type DocStatus =
  | 'not_sent'
  | 'sent'
  | 'submitted'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'waived'
  | 'completed'

export interface DocumentFormProps {
  documentKey: string
  documentName: string
  category: string
  required: boolean
  status?: DocStatus
  canEdit: boolean
  initialData?: any
  onSave?: (data: any, signatureName: string, pdf?: File | Blob | null) => Promise<void>
  employeeId?: string
}

interface FieldRow {
  label: string
  value: string
  sensitive?: boolean
}

interface DocumentFormShellProps extends DocumentFormProps {
  children: (ctx: {
    data: any
    setField: (key: string, value: any) => void
    errors: Record<string, string>
  }) => React.ReactNode
  attestation: string
  employeeCopyNote?: string
  fieldsForPdf: (data: any, signatureName: string, date: string) => FieldRow[]
  requireSignatureMatch?: boolean
  legalName?: string
  footerNote?: string
  onGeneratePdf?: (data: any, signatureName: string) => Promise<Uint8Array | null>
}

function defaultSave(
  employeeId: string,
  documentKey: string,
  documentName: string,
  category: string,
  required: boolean,
) {
  return async (data: any, signatureName: string) => {
    const now = new Date().toISOString()
    const payload = {
      employee_id: employeeId,
      document_key: documentKey,
      document_name: documentName,
      category,
      required,
      status: 'submitted' as const,
      submitted_at: now,
      notes: JSON.stringify({ ...data, _signature: signatureName, _signed_at: now }),
    }
    const { error } = await supabase
      .from('hr_onboarding_items')
      .upsert(payload, { onConflict: 'employee_id,document_key' })
    if (error) throw error
  }
}

function maskSensitive(rows: FieldRow[]): FieldRow[] {
  return rows.map((row) =>
    row.sensitive && row.value
      ? { ...row, value: '•••• ' + row.value.slice(-4) }
      : row,
  )
}

export function DocumentFormShell({
  documentKey,
  documentName,
  category,
  required,
  status,
  canEdit,
  initialData,
  onSave,
  employeeId,
  children,
  attestation,
  employeeCopyNote,
  fieldsForPdf,
  requireSignatureMatch,
  legalName,
  footerNote,
  onGeneratePdf,
}: DocumentFormShellProps) {
  const authEmployeeId = useAuthStore((s) => s.user?.id)
  const effectiveEmployeeId = employeeId ?? authEmployeeId ?? ''

  const [data, setData] = useState<any>(initialData ?? {})
  const [signatureName, setSignatureName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  const setField = useCallback((key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }))
  }, [])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}
    if (!canEdit) return true
    if (!signatureName.trim()) {
      next.signature = 'A typed full name is required to e-sign.'
    } else if (requireSignatureMatch && legalName && signatureName.trim().toLowerCase() !== legalName.trim().toLowerCase()) {
      next.signature = 'Your e-signature must match your legal name exactly.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }, [canEdit, signatureName, requireSignatureMatch, legalName])

  const handleSave = useCallback(async () => {
    if (!canEdit) return
    if (!validate()) return
    setSubmitting(true)
    try {
      let pdfBlob: Blob | null = null
      if (onGeneratePdf) {
        const pdfBytes = await onGeneratePdf(data, signatureName.trim())
        if (pdfBytes) {
          pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
        }
      }
      const save = onSave ?? defaultSave(effectiveEmployeeId, documentKey, documentName, category, required)
      await save(data, signatureName.trim(), pdfBlob)
      setSaved(true)
    } catch (err) {
      console.error('Unable to save document:', err)
      setErrors((prev) => ({
        ...prev,
        form: err instanceof Error ? err.message : 'Unable to save this document.',
      }))
    } finally {
      setSubmitting(false)
    }
  }, [canEdit, validate, onSave, data, signatureName, onGeneratePdf, effectiveEmployeeId, documentKey, documentName, category, required])

  const exportPdf = useCallback(async () => {
    const date = new Date().toISOString().slice(0, 10)
    const safeName = signatureName.trim() || (data?.fullName ?? data?.employeeName ?? 'employee')

    if (onGeneratePdf) {
      const pdfBytes = await onGeneratePdf(data, safeName)
      if (pdfBytes) {
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${documentKey}-${Date.now()}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        return
      }
    }

    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const rows = maskSensitive(fieldsForPdf(data, safeName, date))

    doc.setFontSize(18)
    doc.text('MaiTroll', 40, 48)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('Employee Document — Employee Copy', 40, 64)
    doc.setTextColor(0)
    doc.setFontSize(14)
    doc.text(documentName, 40, 90)

    if (employeeCopyNote) {
      doc.setFontSize(8)
      doc.setTextColor(110)
      doc.text(doc.splitTextToSize(employeeCopyNote, 520), 40, 106)
      doc.setTextColor(0)
    }

    autoTable(doc, {
      startY: 130,
      head: [['Field', 'Value']],
      body: rows.map((r) => [r.label, r.value || '—']),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [16, 21, 32] },
      theme: 'grid',
    })

    // @ts-ignore autoTable adds finalY
    const afterY = (doc as any).lastAutoTable?.finalY ?? 300
    doc.setFontSize(10)
    doc.text('Attestation', 40, afterY + 28)
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text(doc.splitTextToSize(attestation, 520), 40, afterY + 44)
    doc.setTextColor(0)
    doc.setFontSize(11)
    doc.text(`Employee signature: ${safeName}`, 40, afterY + 92)
    doc.text(`Date: ${date}`, 40, afterY + 110)

    doc.save(`${documentKey}-${Date.now()}.pdf`)
  }, [data, signatureName, documentName, documentKey, employeeCopyNote, attestation, fieldsForPdf, onGeneratePdf])

  const readOnly = !canEdit || status === 'approved' || status === 'completed' || status === 'waived'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101520]/95 p-5 shadow-2xl shadow-black/20">
      {readOnly && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rotate-[-18deg] rounded-lg border-4 border-amber-400/40 px-10 py-3 text-3xl font-black uppercase tracking-widest text-amber-300/30">
            {status === 'approved' || status === 'completed' ? 'Approved' : 'Read Only'}
          </span>
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
            Mai Troll
          </p>
          <h3 className="mt-1 text-lg font-black text-white">{documentName}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Category: {category}
            {required ? ' · Required' : ' · Optional'}
          </p>
        </div>
        <button
          type="button"
          onClick={exportPdf}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {employeeCopyNote && (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-300">
          {employeeCopyNote}
        </p>
      )}

      <div className="mt-4 space-y-4">{children({ data, setField, errors })}</div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-start gap-2">
          <FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p className="text-xs leading-5 text-slate-300">{attestation}</p>
        </div>

        <div className="mt-3 max-w-md">
          <label className="block text-xs font-bold text-slate-300">
            Full legal name (e-signature)
          </label>
          <input
            value={signatureName}
            disabled={readOnly}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Type your full legal name"
            className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#090D15] px-3 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
          />
          {errors.signature && (
            <p className="mt-1 text-[11px] font-semibold text-rose-300">{errors.signature}</p>
          )}
        </div>
      </div>

      {footerNote && (
        <p className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {footerNote}
        </p>
      )}

      {readOnly ? (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-100">
          This document is locked. Contact HR to request changes.
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : saved ? 'Resubmit' : 'Submit / Sign'}
          </button>
          {saved && (
            <span className="text-xs font-bold text-emerald-300">
              Saved — status: submitted
            </span>
          )}
          {errors.form && (
            <span className="text-xs font-semibold text-rose-300">{errors.form}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default DocumentFormShell
