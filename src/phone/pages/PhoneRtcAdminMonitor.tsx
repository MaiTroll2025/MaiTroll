import React, { Suspense } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Phone RTC Admin Monitor — mobile wrapper that reuses the SAME
 * RtcAdminMonitorGate the web route uses, so there is exactly one
 * authorization path and one RTC monitoring implementation across
 * web and phone.
 *
 * Authorization is enforced server-side via can_access_rtc_admin_monitor().
 * Admin roles always pass; Career roles require an explicit grant.
 * The frontend is NOT the only security layer.
 */
export default function PhoneRtcAdminMonitor() {
  const navigate = useNavigate()

  // The monitor fills the whole route, so closing it must leave the route.
  const handleClose = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/admin-mobile')
  }

  const RtcAdminMonitorGate = React.lazy(() =>
    import('../../components/admin/RtcAdminMonitorGate.tsx'),
  )

  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#05010f] text-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#00BFFF]/20 border-t-[#00BFFF]" />
            <p className="text-white font-semibold">Loading RTC Monitor…</p>
          </div>
        </div>
      }
    >
      <RtcAdminMonitorGate fullPage onClose={handleClose} />
    </React.Suspense>
  )
}