import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Coins, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

interface ActiveOrder {
  id: string
  caseNumber: string
  respondentUuid: string
  respondentUsername: string
}

interface ProtectionOrderGateProps {
  streamId: string | null | undefined
  broadcasterId: string | null | undefined
  participantIds: string[]
}

/**
 * Protection order enforcement on viewer pages.
 *
 * When the current user (petitioner) holds a granted/active protection order
 * against someone in this stream (the broadcaster or a seat participant), the
 * respondent may stay in the broadcast, but the petitioner is not allowed to
 * enter: a blocking popup is shown with the option to cancel the protection
 * order for a 500 Troll Coin fee.
 */
export default function ProtectionOrderGate({
  streamId,
  broadcasterId,
  participantIds,
}: ProtectionOrderGateProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const [checked, setChecked] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id || !streamId) {
      setOrders([])
      setChecked(false)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('protection_orders')
          .select(
            'id, case_number, status, expires_at, protection_order_respondents(respondent_uuid, username_at_filing)',
          )
          .eq('petitioner_uuid', user.id)
          .in('status', ['GRANTED', 'ACTIVE'])

        if (error) {
          console.warn('[ProtectionOrderGate] failed to load orders:', error.message)
        }

        if (!mounted) return

        const now = new Date()
        const result: ActiveOrder[] = []
        ;(data || []).forEach((po: any) => {
          if (po.expires_at && new Date(po.expires_at) <= now) return
          ;(po.protection_order_respondents || []).forEach((r: any) => {
            result.push({
              id: po.id,
              caseNumber: po.case_number,
              respondentUuid: r.respondent_uuid,
              respondentUsername: r.username_at_filing,
            })
          })
        })
        setOrders(result)
      } catch (err) {
        console.warn('[ProtectionOrderGate] failed to load orders:', err)
      } finally {
        if (mounted) setChecked(true)
      }
    })()

    return () => {
      mounted = false
    }
  }, [user?.id, streamId])

  const participantSet = useMemo(() => new Set(participantIds), [participantIds])

  const blockingOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          (broadcasterId && o.respondentUuid === broadcasterId) ||
          participantSet.has(o.respondentUuid),
      ),
    [orders, broadcasterId, participantSet],
  )

  const cancelOrder = async (order: ActiveOrder) => {
    if (cancellingId) return
    setCancellingId(order.id)
    try {
      const { data, error } = await supabase.rpc('cancel_protection_order', {
        p_order_id: order.id,
      })
      if (error || !data?.success) {
        toast.error(error?.message || data?.message || 'Failed to cancel protection order')
        return
      }
      toast.success('Protection order cancelled. You may enter the stream.')
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel protection order')
    } finally {
      setCancellingId(null)
    }
  }

  if (!user?.id || !streamId || !checked || blockingOrders.length === 0) {
    return null
  }

  const order = blockingOrders[0]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-amber-400/40 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 bg-amber-400/10 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20">
            <ShieldAlert className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h2 className="font-black text-white">Protection Order Active</h2>
            <p className="text-xs text-amber-100/60">Case {order.caseNumber}</p>
          </div>
        </div>

        <div className="space-y-3 p-4 text-sm text-slate-200">
          <p>
            The user you have a protection order against{' '}
            <span className="font-bold text-white">@{order.respondentUsername}</span> is in
            this stream. You are not allowed to enter.
          </p>
          <p className="text-xs text-slate-400">
            The respondent may remain in the broadcast. To enter, you can cancel your
            protection order for a fee of 500 Troll Coins.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            disabled={cancellingId !== null}
            onClick={() => cancelOrder(order)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Coins className="h-4 w-4" />
            {cancellingId === order.id
              ? 'Cancelling...'
              : 'Cancel Protection Order — 500 Troll Coins'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-bold text-slate-200 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Leave Stream
          </button>
        </div>
      </div>
    </div>
  )
}
