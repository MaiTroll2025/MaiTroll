import { useMemo } from 'react'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import type { MaiRecordLabelAgreementData } from '@/services/maiRecordLabelAgreement'
import { generateMaiRecordLabelAgreement } from '@/services/maiRecordLabelAgreement'

interface MaiRecordLabelAgreementViewProps {
  data: MaiRecordLabelAgreementData
  className?: string
}

export function MaiRecordLabelAgreementView({ data, className = '' }: MaiRecordLabelAgreementViewProps) {
  const html = useMemo(() => generateMaiRecordLabelAgreement(data), [data])

  return (
    <div className={`${className}`}>
      <iframe
        title="MAI Record Label Artist Agreement"
        srcDoc={html}
        className="h-[calc(100vh-120px)] w-full rounded-lg border border-slate-700 bg-white"
      />
      <div className="no-print mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => {
            const blob = new Blob([html], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `MAI_Record_Label_Agreement_${data.contractNumber || 'contract'}.html`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}
          className={`${MaiTrollTheme.components.buttonSecondary} inline-flex items-center gap-2`}
        >
          Download HTML
        </button>
        <button
          onClick={() => {
            const printWindow = window.open('', '_blank')
            if (printWindow) {
              printWindow.document.write(html)
              printWindow.document.close()
              setTimeout(() => printWindow.print(), 500)
            } else {
              alert('Please allow popups to print this document.')
            }
          }}
          className={`${MaiTrollTheme.components.buttonPrimary} inline-flex items-center gap-2`}
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  )
}
