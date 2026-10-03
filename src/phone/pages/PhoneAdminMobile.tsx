import React from 'react'
import { Navigate } from 'react-router-dom'

/**
 * The phone admin surface is served by the shared web Admin dashboard.
 * PhoneApp already routes /admin-mobile here; this just forwards to /admin.
 */
export default function PhoneAdminMobile() {
  return <Navigate to="/admin" replace />
}
