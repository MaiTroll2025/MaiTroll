import React, { Suspense, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

/**
 * RtcAdminMonitorGate — server-side authorization gate for the RTC Admin
 * Monitor, shared by BOTH the web route and the phone route.
 *
 * The frontend is NOT the only security layer: this component calls the
 * SECURITY DEFINER function can_access_rtc_admin_monitor() which enforces
 * the permission at the database level. Admin roles always pass; Career
 * roles require an explicit grant in user_rtc_admin_monitor_grants.
 *
 * It lazy-loads the SAME web RTCAdminMonitor component so there is exactly
 * one RTC monitoring implementation and one set of realtime data across
 * web and phone.
 */
export default function RtcAdminMonitorGate({ fullPage = false }: { fullPage?: boolean } = {}) {
  const user = useAuthStore((s) => s.user)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!user?.id) {
        if (!cancelled) { setAllowed(false); setChecking(false) }
        return
      }
      try {
        const { data, error } = await supabase.rpc('can_access_rtc_admin_monitor', {
          p_user_id: user.id,
        })
        if (cancelled) return
        setAllowed(error ? false : !!data)
      } catch {
        if (!cancelled) setAllowed(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [user?.id])

  if (checking) {
    return (
      <div className="flex min-h-[400px] items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
          <p className="text-sm text-white/70">Verifying RTC Monitor access…</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center bg-black px-6 text-center text-white">
        <div className="mb-3 text-4xl">🚫</div>
        <h2 className="text-lg font-bold">Access Denied</h2>
        <p className="mt-1 max-w-xs text-sm text-white/60">
          You do not have permission to view the RTC Admin Monitor. Admin roles and explicitly granted Career roles only.
        </p>
      </div>
    )
  }

  const RTCAdminMonitor = React.lazy(() => import('./RTCAdminMonitor.tsx'))

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center bg-black text-white">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
            <p className="text-sm text-white/70">Loading RTC Monitor…</p>
          </div>
        </div>
      }
    >
      <RTCAdminMonitor fullPage={fullPage} />
    </Suspense>
  )
}