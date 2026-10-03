import { Navigate, useLocation } from 'react-router-dom'
import PhoneWebEmbed from '../components/PhoneWebEmbed'
import PhoneWebPage from './PhoneWebPage'
import { getPhoneAdminRoute } from '../phoneAdminRoutes'
import { useAuthStore } from '@/lib/store'

export default function PhoneAdminPage() {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)

  const entry = getPhoneAdminRoute(pathname)

  if (!entry) {
    return <PhoneWebPage />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <PhoneWebEmbed Component={entry.Component} title={entry.title} />
}
