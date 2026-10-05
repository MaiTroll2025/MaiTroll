import React, { createContext, useContext } from 'react'
import useStaffWalkieTalkie from '@/hooks/useStaffWalkieTalkie'
import { useAuthStore } from '@/lib/store'

interface StaffWalkieTalkieContextValue {
  isConnected: boolean
  isSpeaking: boolean
  isJoining: boolean
  remoteUsers: any[]
  error: string | null
  joinWalkieTalkie: () => void
  leaveWalkieTalkie: () => void
  toggleSpeaking: (speaking: boolean) => void
  canAccessWalkieTalkie: boolean
}

const StaffWalkieTalkieContext = createContext<StaffWalkieTalkieContextValue | null>(null)

const WALKIE_TALKIE_ALLOWED_ROLES = [
  'admin',
  'ceo',
  'staff',
  'officer',
  'broadofficer',
  'troll_officer',
  'lead_troll_officer',
  'secretary',
  'president',
  'agency_hr',
  'agency_hr_manager',
  'agency_leader',
  'attorney',
  'prosecutor',
  'journalist',
  'tcnn_news_caster',
  'tcnn_chief_news_caster',
  'auctioneer',
  'pastor',
  'org_admin',
  'empire_partner',
  'troller',
  'ceo_assistant',
  'noah_assistant',
]

export function StaffWalkieTalkieProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()

  const canAccessWalkieTalkie = !!(
    profile?.is_admin ||
    (profile as any)?.is_staff ||
    WALKIE_TALKIE_ALLOWED_ROLES.includes(profile?.role || '') ||
    (profile as any)?.is_staff_enabled
  )

  const {
    isConnected,
    isSpeaking,
    remoteUsers,
    error,
    isJoining,
    joinWalkieTalkie,
    leaveWalkieTalkie,
    toggleSpeaking,
  } = useStaffWalkieTalkie()

  return (
    <StaffWalkieTalkieContext.Provider
      value={{
        isConnected,
        isSpeaking,
        isJoining,
        remoteUsers,
        error,
        joinWalkieTalkie,
        leaveWalkieTalkie,
        toggleSpeaking,
        canAccessWalkieTalkie,
      }}
    >
      {children}
    </StaffWalkieTalkieContext.Provider>
  )
}

export function useStaffWalkieTalkieContext() {
  const context = useContext(StaffWalkieTalkieContext)
  if (!context) {
    throw new Error('useStaffWalkieTalkieContext must be used within StaffWalkieTalkieProvider')
  }
  return context
}

export { WALKIE_TALKIE_ALLOWED_ROLES }