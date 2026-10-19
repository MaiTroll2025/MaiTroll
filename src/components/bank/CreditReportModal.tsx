import React from 'react'
import { Shield, X, FileText, ArrowRight } from 'lucide-react'
import { MaiTrollTheme } from '@/styles/trollCityTheme'

interface CreditReportModalProps {
  show: boolean
  report: any
  onClose: () => void
}

export function CreditReportModal({ show, report, onClose }: CreditReportModalProps) {
  if (!show || !report) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Credit Report</h2>
              <p className="text-sm text-gray-400">
                {report.username} • Score: {report.credit_score} ({report.credit_tier})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Credit Score</p>
            <div className="text-3xl font-black">
              <span className={report.credit_score >= 500 ? 'text-green-400' : 'text-red-400'}>
                {report.credit_score}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{report.credit_tier}</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Credit Limit</p>
            <p className="text-2xl font-bold text-white">{report.credit_limit?.toLocaleString() ?? 0} coins</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Credit Used</p>
            <p className="text-2xl font-bold text-red-400">{report.credit_used?.toLocaleString() ?? 0} coins</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Available</p>
            <p className="text-2xl font-bold text-green-400">{report.credit_available?.toLocaleString() ?? 0} coins</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Application Status</p>
            <p className={report.application_status === 'approved' ? 'text-green-400' : report.application_status === 'denied' ? 'text-red-400' : 'text-yellow-400'}>
              {report.application_status?.replace(/_/g, ' ') || 'None'}
            </p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Credit Card Active</p>
            <p className={report.credit_card_active ? 'text-green-400' : 'text-gray-400'}>
              {report.credit_card_active ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Activity This Month
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Broadcast Hours</span>
                <span className="text-white font-mono">{report.broadcast_hours_this_month ?? 0} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Viewing Hours</span>
                <span className="text-white font-mono">{report.viewing_hours_this_month ?? 0} hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gifts Sent</span>
                <span className="text-white font-mono">{report.gifts_sent ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gifts Received</span>
                <span className="text-white font-mono">{report.gifts_received ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Small Installment Purchases</span>
                <span className="text-white font-mono">{report.small_installment_purchases ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Loans</span>
                <span className="text-white font-mono">{report.active_loans ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              How to Increase Your Score
            </h3>
            <ul className="text-sm text-gray-300 space-y-2 list-disc pl-5">
              {(report.how_to_increase ?? []).map((tip: string, i: number) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {(report.recent_events ?? []).length > 0 && (
          <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5 mb-6">
            <h3 className="text-sm font-bold text-white mb-3">Recent Credit Events (90 Days)</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(report.recent_events ?? []).map((event: any, i: number) => (
                <div key={i} className="p-2 bg-gray-900/50 rounded-lg text-xs">
                  <div className="flex justify-between mb-1">
                    <span className={event.delta > 0 ? 'text-green-400' : event.delta < 0 ? 'text-red-400' : 'text-gray-400'}>
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-gray-500">{new Date(event.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className={`text-white ${event.delta > 0 ? '+' : ''}${event.delta}`}>
                    {event.delta > 0 ? '+' : ''}{event.delta} points
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
