import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { X, ShieldAlert, Coins, CheckCircle } from 'lucide-react'

export default function PayWarrantModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile } = useAuthStore()
  const [warrant, setWarrant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    void loadWarrant()
  }, [isOpen, user?.id])

  const loadWarrant = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_user_active_warrant', { p_user_id: user.id })
      if (error) throw error
      if (data?.has_active_warrant && data?.warrant) {
        setWarrant(data.warrant)
      } else {
        setWarrant(null)
      }
    } catch (err: any) {
      console.error('Failed to load warrant:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async () => {
    if (!warrant?.id || !user?.id) return
    setPaying(true)
    try {
      const { data, error } = await supabase.rpc('pay_court_warrant', { p_warrant_id: warrant.id })
      if (error) throw error
      if (data?.success) {
        toast.success(`Warrant paid: ${data.amount} Troll Coins. Broadcast and cash-out access restored.`)
        setWarrant(null)
        onClose()
      } else {
        toast.error(data?.message || 'Payment failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to pay warrant')
    } finally {
      setPaying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-red-500/30 bg-[#120b08] shadow-[0_0_60px_rgba(239,68,68,0.18)]">
        <div className="flex items-center justify-between border-b border-red-500/20 bg-gradient-to-r from-red-950/60 to-black/40 p-5">
          <div className="flex items-center gap-2 text-lg font-black text-red-100">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            Active Warrant
          </div>
          <button onClick={onClose} className="text-red-100/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-8 text-center text-red-100/60">Loading warrant...</div>
          ) : warrant ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-500/20 bg-black/30 p-4">
                <p className="text-sm text-red-100/70">
                  <span className="font-bold text-red-200">Reason:</span> {warrant.reason}
                </p>
                <p className="mt-2 text-sm text-red-100/70">
                  <span className="font-bold text-red-200">Bond Amount:</span>{' '}
                  <span className="text-lg font-black text-amber-200">{warrant.bond_amount} Troll Coins</span>
                </p>
                <p className="mt-1 text-xs text-red-100/50">
                  Issued: {new Date(warrant.issued_at).toLocaleString()}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-300/15 bg-amber-400/5 p-3 text-xs text-amber-100/60">
                Paying this warrant will restore your ability to start broadcasts and cash out Troll Coins.
              </div>

              <button
                onClick={handlePay}
                disabled={paying}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-700 py-3 font-black text-white shadow-[0_0_30px_rgba(245,158,11,0.16)] disabled:opacity-50"
              >
                {paying ? (
                  'Processing...'
                ) : (
                  <>
                    <Coins className="h-4 w-4" />
                    Pay {warrant.bond_amount} Troll Coins
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="h-10 w-10 text-green-400" />
              <p className="text-sm text-amber-100/70">No active warrant found.</p>
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-amber-100/70 hover:bg-white/10">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
