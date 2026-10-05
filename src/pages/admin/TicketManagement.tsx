import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, XCircle, CheckCircle, Search } from 'lucide-react'

interface Ticket {
  id: string
  target_user_id: string
  issuing_admin_id: string
  amount: number
  status: string
  notes: string | null
  signature_data: string | null
  signed_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

interface TicketWithUsers extends Ticket {
  target_username?: string
  issuing_username?: string
}

export default function TicketManagement() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<TicketWithUsers[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      let rows = (data as Ticket[]) || []

      if (filterStatus !== 'all') {
        rows = rows.filter(t => t.status === filterStatus)
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        rows = rows.filter(t =>
          t.notes?.toLowerCase().includes(term) ||
          t.id.toLowerCase().includes(term)
        )
      }

      const userIds = new Set<string>()
      rows.forEach(t => {
        userIds.add(t.target_user_id)
        userIds.add(t.issuing_admin_id)
      })

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', Array.from(userIds))

      const userMap = new Map<string, string>()
      if (profiles) {
        for (const p of profiles) {
          userMap.set(p.id, p.username || 'Unknown')
        }
      }

      const enriched = rows.map(t => ({
        ...t,
        target_username: userMap.get(t.target_user_id) || t.target_user_id.slice(0, 8),
        issuing_username: userMap.get(t.issuing_admin_id) || t.issuing_admin_id.slice(0, 8),
      }))

      setTickets(enriched)
    } catch (err) {
      console.error('Failed to load tickets:', err)
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterStatus])

  useEffect(() => {
    loadTickets()

    const channel = supabase
      .channel('admin-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => loadTickets()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTickets])

  const voidTicket = async (ticketId: string) => {
    if (!confirm('Void this ticket?')) return
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'voided', updated_at: new Date().toISOString() })
        .eq('id', ticketId)

      if (error) throw error
      toast.success('Ticket voided')
      loadTickets()
    } catch (err) {
      console.error('Void failed:', err)
      toast.error('Failed to void ticket')
    }
  }

  const payTicket = async (ticketId: string) => {
    try {
      const { data, error } = await supabase.rpc('pay_ticket', { p_ticket_id: ticketId })
      if (error) throw error
      if (data && data.success) {
        toast.success(`Ticket paid. New balance: ${data.new_balance}`)
        loadTickets()
      } else {
        toast.error(data?.error || 'Failed to pay ticket')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to pay ticket')
    }
  }

  const formatCoins = (n: number) => Number(n || 0).toLocaleString()

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-400 bg-yellow-400/10'
      case 'signed': return 'text-blue-400 bg-blue-400/10'
      case 'paid': return 'text-green-400 bg-green-400/10'
      case 'voided': return 'text-red-400 bg-red-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black">Ticket Management</h1>
              <p className="text-sm text-zinc-500">Issue, track, and process coin tickets</p>
            </div>
          </div>
          <button
            onClick={loadTickets}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="signed">Signed</option>
            <option value="paid">Paid</option>
            <option value="voided">Voided</option>
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No tickets found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-zinc-400">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium">Issued By</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-3 font-mono text-xs">{t.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">@{t.target_username}</td>
                      <td className="px-4 py-3">@{t.issuing_username}</td>
                      <td className="px-4 py-3 font-bold">{formatCoins(t.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor(t.status)}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">{t.notes || '-'}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {(t.status === 'signed' || t.status === 'pending') && (
                            <button
                              onClick={() => payTicket(t.id)}
                              className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition"
                              title="Pay Ticket"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {t.status !== 'paid' && t.status !== 'voided' && (
                            <button
                              onClick={() => voidTicket(t.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                              title="Void Ticket"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
