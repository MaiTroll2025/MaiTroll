import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { CheckCircle, Coins, Shield, BadgeCheck, AlertTriangle, Clock, Ban, XCircle } from 'lucide-react'

const VERIFICATION_COST_COINS = 500
const VERIFICATION_COST_USD = 5.00

export default function VerifiedBadgePage() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState<'coins' | 'paypal' | null>(null)
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason: string } | null>(null)
  const [checkingEligibility, setCheckingEligibility] = useState(true)

  useEffect(() => {
    if (!user) return
    checkEligibility()
  }, [user])

  const checkEligibility = async () => {
    if (!user) return
    setCheckingEligibility(true)
    try {
      const { data, error } = await supabase.rpc('check_verification_eligibility', {
        p_user_id: user.id
      })
      if (error) throw error
      setEligibility(data)
    } catch (err: any) {
      console.error('Eligibility check failed:', err)
      setEligibility({ eligible: true, reason: '' })
    } finally {
      setCheckingEligibility(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please log in to get verified</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Log In
          </button>
        </div>
      </div>
    )
  }

  const isVerified = profile?.is_verified && profile?.verification_expires_at && new Date(profile.verification_expires_at) > new Date()

  if (isVerified) {
    const expiresDate = profile?.verification_expires_at
      ? new Date(profile.verification_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'N/A'
    const verifiedSince = profile?.verified_since
      ? new Date(profile.verified_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'N/A'

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-6">
        <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-green-500/30 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You&apos;re Verified!</h1>
          <p className="opacity-80 mb-6">
            Your verified badge is active. You&apos;re part of the verified community.
          </p>

          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              <BadgeCheck className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-sm text-gray-400">Verified Account</div>
                <div className="font-semibold">Verified Since: {verifiedSince}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-400" />
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="font-semibold text-green-400">Active</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="text-sm text-gray-400">Subscription</div>
                <div className="font-semibold">Verified Member</div>
                <div className="text-xs text-gray-500">Renews: {expiresDate}</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const payWithCoins = async () => {
    if (processing) return

    const troll_coins = profile?.troll_coins || 0
    if (troll_coins < VERIFICATION_COST_COINS) {
      toast.error(`You need ${VERIFICATION_COST_COINS} troll coins. You have ${troll_coins}`)
      return
    }

    setProcessing('coins')
    try {
      const { data, error } = await supabase.rpc('subscribe_verification_coins', {
        p_user_id: user.id,
        p_amount_coins: VERIFICATION_COST_COINS
      })

      if (error) throw error

      if (data && data.success === false) {
        throw new Error(data.error || 'Insufficient coins')
      }

      toast.success('Verification successful! Your badge is now active.')
      if (refreshProfile) await refreshProfile()

      await supabase.from('coin_transactions').insert({
        user_id: user.id,
        coins: -VERIFICATION_COST_COINS,
        type: 'verification_subscription',
        description: 'Verified Badge subscription (30 days)',
        source: 'coins'
      })
    } catch (error: any) {
      console.error('Error verifying with coins:', error)
      toast.error(error?.message || 'Failed to verify')
    } finally {
      setProcessing(null)
    }
  }

  const payWithPayPal = async () => {
    if (processing) return

    setProcessing('paypal')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL ||
        'https://gejtbllazzighxwxudyu.supabase.co/functions/v1'

      const response = await fetch(`${edgeFunctionsUrl}/create-verification-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount_usd: VERIFICATION_COST_USD,
          user_id: user.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create PayPal order')
      }

      const orderData = await response.json()

      if (orderData.approval_url) {
        sessionStorage.setItem('verification_order_id', orderData.order_id)
        window.location.href = orderData.approval_url
      } else {
        throw new Error('No approval URL received')
      }
    } catch (error: any) {
      console.error('PayPal payment error:', error)
      toast.error(error?.message || 'Failed to start PayPal payment')
    } finally {
      setProcessing(null)
    }
  }

  const troll_coins = profile?.troll_coins || 0
  const canPayWithCoins = troll_coins >= VERIFICATION_COST_COINS

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-lg mx-auto bg-[#1A1A1A] border-2 border-blue-500/30 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <BadgeCheck className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Get Verified</h1>
        </div>

        <p className="opacity-80 mb-6">
          Stand out with a verified badge, protect your identity, and show the community you&apos;re the real deal.
        </p>

        {/* Pricing */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-semibold">Verified Badge</span>
            <span className="text-2xl font-bold text-blue-400">$5.00/mo</span>
          </div>
          <p className="text-sm opacity-70">Auto-renewing subscription. Cancel anytime.</p>
        </div>

        {/* Benefits */}
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Benefits:</h3>
          <ul className="text-sm space-y-1 opacity-80">
            <li>✓ Verified badge on your profile, posts, and chat</li>
            <li>✓ Priority username protection</li>
            <li>✓ Reduced impersonation risk</li>
            <li>✓ Verification profile section</li>
            <li>✓ Slight search ranking boost</li>
            <li>✓ Future verification perks</li>
          </ul>
        </div>

        {/* Eligibility Check */}
        {checkingEligibility ? (
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-400">Checking eligibility...</p>
          </div>
        ) : eligibility && !eligibility.eligible ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-400 mb-1">Not Eligible</h3>
                <p className="text-sm opacity-80">{eligibility.reason}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Payment Options */}
        <div className="space-y-4">
          {/* PayPal Option */}
          <button
            onClick={payWithPayPal}
            disabled={processing !== null || (eligibility && !eligibility.eligible)}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            {processing === 'paypal'
              ? 'Processing...'
              : `Pay $${VERIFICATION_COST_USD.toFixed(2)}/month with PayPal`
            }
          </button>

          {/* Coin Option */}
          <button
            onClick={payWithCoins}
            disabled={processing !== null || !canPayWithCoins || (eligibility && !eligibility.eligible)}
            className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Coins className="w-5 h-5" />
            {processing === 'coins'
              ? 'Processing...'
              : `Pay ${VERIFICATION_COST_COINS} Troll Coins ${canPayWithCoins ? `(You have ${troll_coins})` : `(Need ${VERIFICATION_COST_COINS - troll_coins} more)`}`
            }
          </button>
          {!canPayWithCoins && (
            <p className="text-xs text-red-400 mt-1 text-center">
              Insufficient troll coins. You need {VERIFICATION_COST_COINS}, but only have {troll_coins}.
            </p>
          )}
        </div>

        {/* Important Notice */}
        <div className="mt-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-400 mb-1">Important Notice</p>
              <ul className="space-y-1 opacity-80">
                <li>• No refunds if account has been reported or jailed after payment</li>
                <li>• Verification is contingent upon account standing</li>
                <li>• Background check required — account must be active 24+ hours</li>
                <li>• Must have no recent reports or jail history</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 items-center">
          <p className="text-xs text-gray-400 text-center">
            Not ready to verify yet? You can grab it later from the store.
          </p>
          <button
            onClick={() => navigate('/coin-store')}
            className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            Go to Coin Store
          </button>
        </div>

        <p className="text-xs opacity-60 mt-6 text-center">
          Verification confirms subscription is active and account passed verification requirements.
          Does not guarantee identity fame, trustworthiness, or grant moderation powers.
        </p>
      </div>
    </div>
  )
}
