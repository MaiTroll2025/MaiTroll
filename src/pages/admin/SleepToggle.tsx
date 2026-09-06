import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { setSleepAsleep, resetSleepState } from '@/lib/appSleep'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { PowerOff, RotateCcw, Loader2 } from 'lucide-react'

export default function SleepToggle() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

  if (!isAdmin) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 text-red-400">
        Admin access required
      </div>
    )
  }

  const handleSleep = async () => {
    setLoading('sleep')
    try {
      setSleepAsleep()
      toast.success('App is now sleeping. Visitors will see the puzzle.')
      navigate('/admin/sleep', { replace: true })
    } catch {
      toast.error('Failed to set sleep mode')
    } finally {
      setLoading(null)
    }
  }

  const handleWake = async () => {
    setLoading('wake')
    try {
      resetSleepState()
      toast.success('App is awake.')
      navigate('/', { replace: true })
    } catch {
      toast.error('Failed to wake app')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-2">Sleep Mode</h2>
      <p className="text-gray-400 text-sm mb-6">
        Put the app to sleep. Visitors will see a math puzzle to unlock access.
      </p>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleSleep}
          disabled={loading !== null}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          {loading === 'sleep' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sleeping...
            </>
          ) : (
            <>
              <PowerOff className="w-5 h-5" />
              Sleep App
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleWake}
          disabled={loading !== null}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        >
          {loading === 'wake' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Waking...
            </>
          ) : (
            <>
              <RotateCcw className="w-5 h-5" />
              Wake App
            </>
          )}
        </button>
      </div>
    </div>
  )
}
