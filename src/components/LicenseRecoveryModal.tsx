import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Lock, Coins, CreditCard, Shield, AlertTriangle } from 'lucide-react'
import PayPalPaymentModal from '@/components/broadcast/PayPalPaymentModal'

const LICENSE_RESTORATION_COST = 300
const PAY_WARRANT_COST = 500
const PAYPAL_PACKAGE = {
  id: 'license_restore_coins',
  coins: 330,
  price: 3,
  name: '330 Troll Coins',
  purchaseType: 'license_restore',
}

interface LicenseRecoveryModalProps {
  open: boolean
  onClose: () => void
  onRecovered?: () => void
}

export default function LicenseRecoveryModal({ open, onClose, onRecovered }: LicenseRecoveryModalProps) {
  const { user, profile } = useAuthStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPaypal, setShowPaypal] = useState(false)
  const [paypalPkg] = useState(PAYPAL_PACKAGE)

  const coinBalance = Number(profile?.troll_coins ?? 0)

  const isSuspended =
    profile?.license_status === 'suspended' ||
    profile?.drivers_license_status === 'suspended'

  if (!isSuspended) {
    return null
  }

  const handleRestoreCoins = async () => {
    if (!user) return

    if (coinBalance < LICENSE_RESTORATION_COST) {
      toast.error(`You need ${LICENSE_RESTORATION_COST} troll coins but only have ${coinBalance}.`)
      return
    }

    setIsProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('restore-license', {
        body: { method: 'coins' },
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to restore license.')

      toast.success(`License restored! ${LICENSE_RESTORATION_COST} troll coins deducted.`)

      // Update store profile
      const currentProfile = useAuthStore.getState().profile
      if (currentProfile) {
        useAuthStore.getState().setProfile(
          {
            ...currentProfile,
            is_broadcaster: true,
            license_status: 'active',
            drivers_license_status: 'active',
          },
          { force: true },
        )
      }

      onRecovered?.()
      onClose()
    } catch (err: any) {
      console.error('[LicenseRecoveryModal] Restore error:', err)
      toast.error(err?.message || 'Failed to restore license. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayWarrant = async () => {
    if (!user) return

    if (coinBalance < PAY_WARRANT_COST) {
      toast.error(`You need ${PAY_WARRANT_COST} troll coins to pay the warrant but only have ${coinBalance}.`)
      return
    }

    setIsProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('restore-license', {
        body: { method: 'pay_warrant' },
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to pay warrant.')

      toast.success(`License restored! Bond paid (${PAY_WARRANT_COST} troll coins).`)

      const currentProfile = useAuthStore.getState().profile
      if (currentProfile) {
        useAuthStore.getState().setProfile(
          {
            ...currentProfile,
            is_broadcaster: true,
            license_status: 'active',
            drivers_license_status: 'active',
          },
          { force: true },
        )
      }

      onRecovered?.()
      onClose()
    } catch (err: any) {
      console.error('[LicenseRecoveryModal] Warrant error:', err)
      toast.error(err?.message || 'Failed to pay warrant. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaypalSuccess = () => {
    // After PayPal purchase, the coins are added to the balance.
    // Now restore the license using the coins.
    setShowPaypal(false)
    handleRestoreCoins()
  }

  const handlePaypal = () => {
    setShowPaypal(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              License Suspended — Restore Required
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Your broadcast license is currently suspended. You cannot go live until it is restored.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
              <div className="flex items-center gap-2 mb-2 text-sm text-zinc-400">
                <Shield className="w-4 h-4" />
                <span>Suspension Details</span>
              </div>
              <ul className="text-sm text-zinc-300 space-y-1">
                <li>• Your driver license and broadcaster privileges are currently suspended.</li>
                <li>• You can still join seats as a guest in other broadcasts.</li>
                <li>• Restore your license to go live again.</li>
              </ul>
            </div>

            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Troll Coins Balance</span>
                <span className="font-bold text-yellow-400">{coinBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleRestoreCoins}
                disabled={isProcessing || coinBalance < LICENSE_RESTORATION_COST}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold"
              >
                <Coins className="w-4 h-4 mr-2" />
                {isProcessing ? 'Processing...' : `Restore License (${LICENSE_RESTORATION_COST} Coins)`}
              </Button>

              <Button
                onClick={handlePayWarrant}
                disabled={isProcessing || coinBalance < PAY_WARRANT_COST}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
              >
                <Lock className="w-4 h-4 mr-2" />
                {isProcessing ? 'Processing...' : `Pay Warrant (${PAY_WARRANT_COST} Coins)`}
              </Button>

              <div className="text-center text-xs text-zinc-500 my-2">— OR —</div>

              <Button
                onClick={handlePaypal}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-bold"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Purchase 330 Coins for $3 (PayPal)
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayPalPaymentModal
        isOpen={showPaypal}
        onClose={() => setShowPaypal(false)}
        pkg={paypalPkg}
        userId={user?.id ?? ''}
        profile={profile}
        onPaymentSuccess={handlePaypalSuccess}
        requireCoins={false}
      />
    </>
  )
}
