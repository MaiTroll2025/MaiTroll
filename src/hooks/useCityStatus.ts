import { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export interface CityStatus {
  user_id: string
  status_key: 'resident' | 'tenant' | 'landlord' | 'owner' | 'mayor'
  display_name: string
  status_order: number
  level: number
  xp_total: number
  next_status_key: CityStatus['status_key'] | null
  next_display_name: string | null
  next_min_level: number | null
}

export function useCityStatus(userId?: string | null) {
  const authUserId = useAuthStore((state) => state.user?.id)
  const targetUserId = userId || authUserId || null
  const [status, setStatus] = useState<CityStatus | null>(null)
  const [loading, setLoading] = useState(Boolean(targetUserId))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!targetUserId) {
      setStatus(null)
      setLoading(false)
      setError(null)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setError(null)

    void supabase
      .rpc('get_city_status', { p_user_id: targetUserId })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        if (rpcError) throw rpcError
        setStatus((data?.[0] as CityStatus | undefined) || null)
      })
      .catch((requestError: unknown) => {
        if (cancelled) return
        setStatus(null)
        setError(requestError instanceof Error ? requestError : new Error('Unable to load city status'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [targetUserId])

  return { status, loading, error }
}