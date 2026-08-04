import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Settings } from 'lucide-react'
import { useAuthStore } from '../lib/store'

export default function PayoutSetupPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  useEffect(() => {
    // Redirect to MAI Pay setup
    if (user?.id) {
      const maiPayUrl = new URL('https://maicorp.online/mai-pay/setup')
      maiPayUrl.searchParams.set('platform', 'MaiTroll')
      maiPayUrl.searchParams.set('user_id', user.id)
      window.location.href = maiPayUrl.toString()
    }
  }, [user?.id])

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-300">Please log in to set up payouts.</p>
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
          <Settings className="h-12 w-12 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Payout Setup</h1>
        <p className="text-gray-300 mb-6">
          Redirecting you to MAI Pay for secure payout setup and account configuration.
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
        <p className="text-sm text-gray-400 mt-4">
          If you are not redirected automatically,{' '}
          <a
            href="https://maicorp.online/mai-pay/setup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            click here
          </a>
        </p>
      </div>
    </div>
  )
}