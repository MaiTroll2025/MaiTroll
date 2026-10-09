import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'
import { CheckCircle, AlertTriangle, Send, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface SystemErrorRow {
  id: string
  message: string
  stack?: string | null
  user_id?: string | null
  url?: string | null
  component?: string | null
  context?: any
  status?: 'open' | 'resolved'
  admin_response?: string | null
  created_at?: string
  responded_at?: string | null
}

export default function AdminErrors() {
  const [errors, setErrors] = useState<SystemErrorRow[]>([])
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [loading, setLoading] = useState(false)
  const [responseMap, setResponseMap] = useState<Record<string, string>>({})

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase.from('system_errors').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }
      const { data, error } = await query
      if (error) throw error
      setErrors(data || [])
    } catch {
      toast.error('Failed to load errors')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void loadErrors()
  }, [loadErrors])

  const resolveError = async (row: SystemErrorRow) => {
    try {
      const { error } = await supabase
        .from('system_errors')
        .update({ status: 'resolved', responded_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
      toast.success('Marked resolved')
      void loadErrors()
    } catch {
      toast.error('Failed to resolve')
    }
  }

  const sendResponse = async (row: SystemErrorRow) => {
    const message = responseMap[row.id]?.trim()
    if (!message) {
      toast.info('Enter a response message')
      return
    }
    try {
      const { error } = await supabase
        .from('system_errors')
        .update({ admin_response: message, responded_at: new Date().toISOString(), status: 'resolved' })
        .eq('id', row.id)
      if (error) throw error
      if (row.user_id) {
        await createNotification(row.user_id, 'system', 'Issue Resolved', message, { error_id: row.id })
      }
      toast.success('Response sent')
      setResponseMap((prev) => ({ ...prev, [row.id]: '' }))
      void loadErrors()
    } catch {
      toast.error('Failed to send response')
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">System Errors</h1>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-black/40 border border-white/10 rounded-md px-3 py-2"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
            <button
              onClick={loadErrors}
              className="px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {loading && <div className="text-gray-400">Loading…</div>}
          {!loading && errors.length === 0 && <div className="text-gray-400">No errors</div>}
          {errors.map((row) => (
            <div
              key={row.id}
              className="bg-[#13131F] border border-[#2C2C2C] rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-5 h-5 ${row.status === 'open' ? 'text-yellow-400' : 'text-green-400'}`} />
                    <div className="text-sm text-gray-400">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</div>
                  </div>
                  <div className="font-semibold text-white mb-1">{row.message}</div>
                  {row.url && <div className="text-xs text-gray-400">URL: {row.url}</div>}
                  {row.component && <div className="text-xs text-gray-400">Component: {row.component}</div>}
                  {row.user_id && <div className="text-xs text-gray-400">User: {row.user_id}</div>}
                  {row.context && row.context.appVersion && <div className="text-xs text-blue-400">Version: {row.context.appVersion} (Build: {row.context.buildTime})</div>}
                  {row.stack && <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">{row.stack}</pre>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => resolveError(row)}
                    className="px-3 py-2 rounded-md bg-green-600 hover:bg-green-700 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Resolve
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={responseMap[row.id] || ''}
                  onChange={(e) => setResponseMap((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  placeholder="Type a response to user"
                  className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2"
                />
                <button
                  onClick={() => sendResponse(row)}
                  className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
