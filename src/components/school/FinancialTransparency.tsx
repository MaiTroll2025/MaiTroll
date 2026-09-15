import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader, DollarSign, FileText, Users, TrendingUp, Download, CheckCircle, Shield } from 'lucide-react'

interface EarningRow {
  student_id: string
  total_earnings: number
  total_fees: number
  total_net: number
  transaction_count: number
  last_earned_at: string | null
}

interface Report {
  id: string
  report_type: string
  period_start: string
  period_end: string
  content_json: any
  exported_at: string | null
  generated_at: string
}

interface Props {
  institutionId: string
  institutionName: string
  isStaff: boolean
}

export default function FinancialTransparency({ institutionId, institutionName, isStaff }: Props) {
  const [earnings, setEarnings] = useState<EarningRow[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const fetchAll = async () => {
    if (!institutionId) return
    try {
      const { data: e } = await supabase.rpc('get_student_earnings_summary', {
        p_institution_id: institutionId,
      })
      setEarnings(e || [])

      const { data: r } = await supabase.rpc('list_compliance_reports', {
        p_institution_id: institutionId,
      })
      setReports(r || [])
    } catch (err) {
      console.error('Error fetching financial data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [institutionId])

  const handleGenerateReport = async (type: string) => {
    if (!institutionId) return
    setGenerating(true)
    try {
      const now = new Date()
      const periodStart = new Date(now.getFullYear(), 0, 1)
      await supabase.rpc('generate_compliance_report', {
        p_institution_id: institutionId,
        p_report_type: type,
        p_period_start: periodStart.toISOString(),
        p_period_end: now.toISOString(),
      })
      await fetchAll()
    } catch (err) {
      console.error('Error generating report:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (reportId: string, format: string) => {
    setExportingId(reportId)
    try {
      await supabase.rpc('export_compliance_report', {
        p_report_id: reportId,
        p_format: format,
      })
      await fetchAll()
    } catch (err) {
      console.error('Error exporting report:', err)
    } finally {
      setExportingId(null)
    }
  }

  const handleExportCSV = (report: Report) => {
    const content = report.content_json
    if (!content) return
    const rows: string[] = []
    const header = 'Student ID,Total Earnings,Total Fees,Total Net,Transactions,Last Earned\n'
    const students = content.students || []
    students.forEach((s: EarningRow) => {
      rows.push([s.student_id, s.total_earnings, s.total_fees, s.total_net, s.transaction_count, s.last_earned_at || ''].join(','))
    })
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `student-earnings-${report.report_type}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    handleExport(report.id, 'csv')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-white size-8" />
      </div>
    )
  }

  const totalNet = earnings.reduce((sum, e) => sum + Number(e.total_net || 0), 0)
  const totalFees = earnings.reduce((sum, e) => sum + Number(e.total_fees || 0), 0)
  const totalEarnings = earnings.reduce((sum, e) => sum + Number(e.total_earnings || 0), 0)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Financial Transparency</h2>
          <p className="text-white/60 text-sm">{institutionName}</p>
        </div>
      </div>

      {/* Liability Protection Banner */}
      <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Shield className="size-6 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-white mb-2">100% Student Earnings — Zero School Tax Liability</h3>
            <p className="text-white/70 text-sm mb-3">
              All tips, gifts, and cashouts flow directly to individual students as independent entities.
              The school has no financial liability for student tax reporting (1099 forms).
            </p>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/50 text-xs">Platform Fee</p>
                <p className="text-white font-semibold">5% max</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/50 text-xs">Payout Method</p>
                <p className="text-white font-semibold">Direct to student</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/50 text-xs">Tax Reporting</p>
                <p className="text-white font-semibold">Student responsibility</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="size-5 text-blue-400" />
            <span className="text-white/70 text-sm">Total Student Earnings</span>
          </div>
          <p className="text-2xl font-bold text-white">${totalEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-5 text-purple-400" />
            <span className="text-white/70 text-sm">Platform Fees</span>
          </div>
          <p className="text-2xl font-bold text-white">${totalFees.toFixed(2)}</p>
        </div>
        <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="size-5 text-green-400" />
            <span className="text-white/70 text-sm">Net to Students</span>
          </div>
          <p className="text-2xl font-bold text-white">${totalNet.toFixed(2)}</p>
        </div>
      </div>

      {/* Per-Student Earnings Table */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="size-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">Per-Student Earnings</h3>
          <span className="text-white/40 text-sm ml-auto">{earnings.length} students</span>
        </div>
        {earnings.length === 0 ? (
          <p className="text-white/40 text-sm">No earnings records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 border-b border-white/10">
                  <th className="pb-2 pr-4">Student ID</th>
                  <th className="pb-2 pr-4">Earnings</th>
                  <th className="pb-2 pr-4">Fees</th>
                  <th className="pb-2 pr-4">Net</th>
                  <th className="pb-2 pr-4">Transactions</th>
                  <th className="pb-2 pr-4">Last Earned</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e, i) => (
                  <tr key={e.student_id + i} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white/70 font-mono text-xs">{e.student_id?.slice(0, 8)}...</td>
                    <td className="py-2 pr-4 text-white">${Number(e.total_earnings || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-white/60">${Number(e.total_fees || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-green-400 font-semibold">${Number(e.total_net || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-white/60">{e.transaction_count}</td>
                    <td className="py-2 pr-4 text-white/50 text-xs">
                      {e.last_earned_at ? new Date(e.last_earned_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Report Generation (staff only) */}
      {isStaff && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="size-6 text-purple-400" />
            <h3 className="text-xl font-bold text-white">Compliance Reports</h3>
          </div>
          <p className="text-white/60 text-sm mb-4">
            Generate compliance reports for school legal/finance review. Reports cover student earnings, financial audits, and tax summaries.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => handleGenerateReport('student_earnings_summary')}
              disabled={generating}
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-white rounded-lg border border-purple-500/50 transition disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Earnings Summary'}
            </button>
            <button
              onClick={() => handleGenerateReport('financial_audit')}
              disabled={generating}
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-white rounded-lg border border-purple-500/50 transition disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Financial Audit'}
            </button>
            <button
              onClick={() => handleGenerateReport('tax_form_summary')}
              disabled={generating}
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-white rounded-lg border border-purple-500/50 transition disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Tax Form Summary'}
            </button>
          </div>

          {reports.length === 0 ? (
            <p className="text-white/40 text-sm">No compliance reports generated yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="size-4 text-purple-400" />
                        <span className="text-white font-semibold text-sm">
                          {report.report_type.replace(/_/g, ' ')}
                        </span>
                        {report.exported_at && (
                          <span className="px-2 py-0.5 bg-green-600/20 text-green-300 rounded text-xs font-semibold">
                            Exported
                          </span>
                        )}
                      </div>
                      <p className="text-white/50 text-xs">
                        {new Date(report.period_start).toLocaleDateString()} — {new Date(report.period_end).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportCSV(report)}
                        disabled={exportingId === report.id}
                        className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded text-xs transition disabled:opacity-50"
                      >
                        <Download className="size-3 inline mr-1" />
                        CSV
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-3">Financial Transparency Summary</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-white/80">
          <div>
            <p className="font-semibold text-white mb-2">What Schools See</p>
            <ul className="space-y-1">
              <li>• Per-student earnings totals</li>
              <li>• Platform fee breakdown</li>
              <li>• Net payout amounts</li>
              <li>• Tax form readiness status</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">What Schools Don't See</p>
            <ul className="space-y-1">
              <li>• Student bank account details</li>
              <li>• Student SSN / tax ID</li>
              <li>• Individual transaction details</li>
              <li>• Student personal financial data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
