import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { UserRole } from '@/lib/supabase'

export interface FeeStatusResult {
  fee_required: boolean
  fee_paid: boolean
  access_status: 'active' | 'payment_required' | 'not_required'
  expires_at?: string
  payment_reference?: string
}

export function usePublicAccessFee() {
  const { user, profile, refreshProfile } = useAuthStore()
  const [feeStatus, setFeeStatus] = useState<FeeStatusResult>({
    fee_required: false,
    fee_paid: false,
    access_status: 'not_required'
  })
  const [showModal, setShowModal] = useState(false)
  const [checking, setChecking] = useState(false)

  const checkFeeStatus = useCallback(async () => {
    if (!user) return
    
    // Only check for regular users (not students, instructors, staff, admins)
    const userRole = profile?.role
    const isOrgStudent = (profile as any)?.is_org_student
    const trollRole = profile?.troll_role
    
    // Skip if user has educational access or elevated role
    // Check role enum values
    const exemptRoles = [UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.CEO, UserRole.SECRETARY, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER, UserRole.MODERATOR, UserRole.OWNER]
    const exemptTrollRoles = ['student', 'instructor', 'troll_family']
    
    if (exemptRoles.includes(userRole as UserRole) || exemptTrollRoles.includes(trollRole || '') || isOrgStudent) {
      setFeeStatus({ fee_required: false, fee_paid: true, access_status: 'not_required' })
      return
    }

    setChecking(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        setFeeStatus({ fee_required: false, fee_paid: false, access_status: 'not_required' })
        return
      }

      // Try edge function first
      const edgeFunctionsUrl = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 
        'https://gejtbllazzighxwxudyu.supabase.co/functions/v1'

      let feeData: FeeStatusResult | null = null
      
      try {
        const response = await fetch(`${edgeFunctionsUrl}/public-access-fee/status?user_id=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        })

        if (response.ok) {
          feeData = await response.json()
        }
      } catch (edgeError) {
        console.warn('Edge function unavailable, falling back to direct DB check:', edgeError)
      }

      // Fallback: check user profile directly if edge function failed
      if (!feeData) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('public_fee_required, public_fee_paid, public_fee_paid_at, public_fee_expires_at, access_status')
          .eq('id', user.id)
          .maybeSingle()

        if (profileData) {
          const now = new Date()
          const expiresAt = profileData.public_fee_expires_at ? new Date(profileData.public_fee_expires_at) : null
          const isFeePaid = profileData.public_fee_paid === true
          const isExpired = expiresAt && expiresAt < now

          if (isFeePaid && !isExpired) {
            feeData = {
              fee_required: true,
              fee_paid: true,
              access_status: 'active',
              expires_at: profileData.public_fee_expires_at,
              payment_reference: profileData.public_fee_paid_at
            }
          } else {
            feeData = {
              fee_required: true,
              fee_paid: false,
              access_status: 'payment_required'
            }
          }
        } else {
          // No profile data - assume fee required for regular users
          feeData = {
            fee_required: true,
            fee_paid: false,
            access_status: 'payment_required'
          }
        }
      }

      if (feeData) {
        setFeeStatus(feeData)
        
        // Show modal if fee is required but not paid
        if (feeData.fee_required && !feeData.fee_paid && feeData.access_status === 'payment_required') {
          setShowModal(true)
        }
      }
    } catch (error) {
      console.error('Failed to check fee status:', error)
    } finally {
      setChecking(false)
    }
  }, [user, profile])

  const handlePaymentComplete = async () => {
    if (!user) return
    try {
      await refreshProfile()
      await checkFeeStatus()
    } catch (error) {
      console.error('Error verifying payment:', error)
    }
  }

  // Run on user login
  useEffect(() => {
    if (user) {
      checkFeeStatus()
    }
  }, [user, checkFeeStatus])

  // Also run when profile changes (e.g., role gets set after signup)
  useEffect(() => {
    if (user && profile?.role) {
      checkFeeStatus()
    }
  }, [profile?.role, user, checkFeeStatus])

  return {
    feeStatus,
    showModal,
    setShowModal,
    checking,
    checkFeeStatus,
    handlePaymentComplete
  }
}