import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { CreditCard, X, Loader2, Shield, AlertCircle } from 'lucide-react'

interface PublicAccessFeeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PublicAccessFeeModal({ isOpen, onClose }: PublicAccessFeeModalProps) {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPayPal, setShowPayPal] = useState(false)

  if (!isOpen) return null

  const handlePayPalPayment = async () => {
    if (loading || !user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: {
          userId: user.id,
          amountUsd: 1.00,
          coins: 100,
          packageId: 'public-access-fee',
          packageName: 'Virtual Administration Fee - Non-refundable',
          purchaseType: 'fee',
        },
      })

      if (error) {
        throw new Error(error.message || 'Failed to create payment')
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create payment')
      }
      if (!data?.approvalUrl) {
        throw new Error('PayPal approval URL missing')
      }

      window.location.href = data.approvalUrl
    } catch (error: any) {
      console.error('Error creating PayPal payment:', error)
      toast.error(error?.message || 'Failed to create payment')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentComplete = async () => {
    if (!user) return
    try {
      await refreshProfile()

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('public_fee_paid, access_status')
        .eq('id', user.id)
        .maybeSingle()

      const isPaid =
        profileData?.public_fee_paid === true &&
        profileData?.access_status === 'active'

      if (isPaid) {
        toast.success('Payment verified! Welcome to MAiTROLL.')
        onClose()
      } else {
        toast.error('Payment not yet verified. Please complete payment or contact support.')
      }
    } catch (error) {
      console.error('Error verifying payment:', error)
      toast.error('Payment verification failed. Please contact support.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 bg-black/80">
      <div className="w-full max-w-md rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Administration Fee Required</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
            disabled={loading}
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-slate-300">
            To access MAiTROLL as a regular user, a <strong className="text-white">$1 annual administration fee</strong> is required.
          </p>
          
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-white font-medium">What this covers</p>
                <p className="text-xs text-slate-400">Platform maintenance, moderation, and infrastructure</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Secure PayPal payment</p>
                <p className="text-xs text-slate-400">Processed through PayPal — no card details stored</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">Annual renewal</p>
                <p className="text-xs text-slate-400">Fee renews yearly to maintain access</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Students and instructors with verified educational accounts are exempt from this fee.
          </p>

          <button
            onClick={handlePayPalPayment}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Pay $1 with PayPal
              </>
            )}
          </button>

          <button
            onClick={handlePaymentComplete}
            disabled={loading}
            className="w-full py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
          >
            <span>I've already paid — verify my account</span>
          </button>
        </div>
      </div>
    </div>
  )
}