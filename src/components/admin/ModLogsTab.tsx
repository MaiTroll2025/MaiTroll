import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Shield, User, Clock, FileText, Filter, ChevronRight } from 'lucide-react'
import { useModLogs, ModLogEntry } from '../../hooks/useModLogs'
import { cn } from '../../lib/utils'

interface ModLogsTabProps {
  isOpen: boolean
  onClose: () => void
}

const ACTION_TYPE_FILTERS = [
  'all',
  'warn',
  'mute',
  'kick',
  'ban',
  'arrest',
  'court_summons',
  'feature',
  'unfeature',
]

export default function ModLogsTab({ isOpen, onClose }: ModLogsTabProps) {
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedLog, setSelectedLog] = useState<ModLogEntry | null>(null)

  const filters = {
    action: actionFilter === 'all' ? undefined : actionFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { logs, loading, hasMore, loadMore, refresh } = useModLogs(filters, 20)

  if (!isOpen) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString()
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Moderation Logs</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-white/10 p-4 overflow-x-auto">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            >
              {ACTION_TYPE_FILTERS.map((f) => (
                <option key={f} value={f} className="bg-zinc-900">
                  {f === 'all' ? 'All Actions' : f.charAt(0).toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={refresh}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {logs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No moderation logs found</p>
            </div>
          )}
          <div className="space-y-2">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition-colors hover:bg-white/[0.05]'
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{log.action || 'Unknown'}</span>
                    {log.status && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                        {log.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    {log.officer && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        @{log.officer.username || 'unknown'}
                      </span>
                    )}
                    {log.target && (
                      <span className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        @{log.target.username || 'unknown'}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
              </button>
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>

        {selectedLog && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Log Detail</h3>
                <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500">Action</span>
                  <p className="text-white font-bold">{selectedLog.action}</p>
                </div>
                <div>
                  <span className="text-slate-500">Reason</span>
                  <p className="text-white">{selectedLog.reason || 'No reason provided'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Details</span>
                  <p className="text-white">{selectedLog.details || 'No details'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Status</span>
                  <p className="text-white">{selectedLog.status}</p>
                </div>
                <div>
                  <span className="text-slate-500">Created At</span>
                  <p className="text-white">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Officer</span>
                  <p className="text-white">@{selectedLog.officer?.username || 'unknown'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Target</span>
                  <p className="text-white">@{selectedLog.target?.username || 'unknown'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="mt-6 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
