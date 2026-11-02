import React from 'react';
import { useNavigate } from 'react-router-dom'

/**
 * Phone wrapper for the shared RTC Admin Monitor implementation.
 */
export default function PhoneRtcAdminMonitor() {
  const navigate = useNavigate()

  // The monitor fills the whole route, so closing it must leave the route.
  const handleClose = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/admin-mobile')
  }

  const RTCAdminMonitor = React.lazy(() =>
    import('../../components/admin/RTCAdminMonitor.tsx'),
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
      <RTCAdminMonitor fullPage onClose={handleClose} />
    </React.Suspense>
  )
}