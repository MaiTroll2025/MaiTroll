import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Receipt, CheckCircle, XCircle, PenSquare } from 'lucide-react'

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

export default function Tickets() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<TicketWithUsers[]>([])
  const [loading, setLoading] = useState(true)

  const loadTickets = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('target_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data as Ticket[]) || []

      const adminIds = new Set<string>()
      rows.forEach(t => adminIds.add(t.issuing_admin_id))

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', Array.from(adminIds))

      const userMap = new Map<string, string>()
      if (profiles) {
        for (const p of profiles) {
          userMap.set(p.id, p.username || 'Unknown')
        }
      }

      const enriched = rows.map(t => ({
        ...t,
        target_username: profile?.username || 'You',
        issuing_username: userMap.get(t.issuing_admin_id) || t.issuing_admin_id.slice(0, 8),
      }))

      setTickets(enriched)
    } catch (err) {
      console.error('Failed to load tickets:', err)
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.username])

  useEffect(() => {
    loadTickets()

    const channel = supabase
      .channel('user-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `target_user_id=eq.${user?.id}` },
        () => loadTickets()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadTickets, user?.id])

  const signTicket = async (ticketId: string) => {
    try {
      const { data, error } = await supabase.rpc('sign_ticket', { p_ticket_id: ticketId })
      if (error) throw error
      if (data && data.success) {
        toast.success('Ticket signed. Coins have been deducted.')
        loadTickets()
      } else {
        toast.error(data?.error || 'Failed to sign ticket')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign ticket')
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
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2">
                <Receipt className="w-6 h-6 text-amber-400" />
                My Tickets
              </h1>
              <p className="text-sm text-zinc-500">View and sign your coin tickets</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No tickets found.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {tickets.map(t => (
                <div key={t.id} className="p-4 hover:bg-white/5 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-amber-300">{formatCoins(t.amount)} coins</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(t.status)}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-400 mb-1">
                        Issued by @{t.issuing_username}
                      </div>
                      {t.notes && (
                        <div className="text-sm text-zinc-500 mb-2">&ldquo;{t.notes}&rdquo;</div>
                      )}
                      <div className="text-xs text-zinc-600">
                        {new Date(t.created_at).toLocaleString()}
                        {t.signed_at && ` · Signed ${new Date(t.signed_at).toLocaleString()}`}
                        {t.paid_at && ` · Paid ${new Date(t.paid_at).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {t.status === 'pending' && (
                        <button
                          onClick={() => signTicket(t.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition text-sm font-bold"
                        >
                          <PenSquare size={16} />
                          Sign Ticket
                        </button>
                      )}
                      {t.status === 'signed' && (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-bold">
                          <CheckCircle size={16} />
                          Signed
                        </span>
                      )}
                      {t.status === 'paid' && (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-bold">
                          <CheckCircle size={16} />
                          Paid
                        </span>
                      )}
                      {t.status === 'voided' && (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-bold">
                          <XCircle size={16} />
                          Voided
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
