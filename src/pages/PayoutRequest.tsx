import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useAuthStore } from '../lib/store'

export default function PayoutRequest() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore() as any

  useEffect(() => {
    // Redirect to MAI Pay immediately
    if (user?.id) {
      const rawCoins = Number(profile?.troll_coins || 0)
      const availableCoins = Math.max(0, rawCoins)

      const maiPayUrl = new URL('https://maicorp.online/mai-pay')
      maiPayUrl.searchParams.set('platform', 'MaiTroll')
      maiPayUrl.searchParams.set('user_id', user.id)
      maiPayUrl.searchParams.set('available_balance', availableCoins.toString())

      window.location.href = maiPayUrl.toString()
    }
  }, [user?.id, profile])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-300">Please log in to access MAI Pay.</p>
          <button
            onClick={() => navigate('/auth')}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg"
          >
            Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-cyan-500 p-6 text-center">
        <div className="flex justify-center mb-4">
          <ExternalLink className="h-12 w-12 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Redirecting to MAI Pay</h1>
        <p className="text-gray-300 mb-6">
          You're being redirected to MAI Pay for secure payout processing.
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
      </div>
    </div>
  )
}