import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { useMaiTrollOperatingStore } from '@/lib/maitrollOperatingStore'

interface BroadcastStartCheckResult {
  allowed: boolean
  reason: string
  isStaff: boolean
  isMaiTrollOpen: boolean
  closesAt?: string
  opensAt?: string
}

const STAFF_ROLES = new Set(['admin', 'staff'])

export function useBroadcastStartCheck() {
  const { user, profile } = useAuthStore()
  const { operatingHoursInfo } = useMaiTrollOperatingStore()

  const [checkResult, setCheckResult] =
    useState<BroadcastStartCheckResult | null>(null)

  const [loading, setLoading] = useState(false)

  const isStaff = !!(
    profile?.is_admin ||
    profile?.is_lead_officer ||
    profile?.is_troll_officer ||
    (profile?.role && STAFF_ROLES.has(profile.role))
  )

  const checkLocalBroadcastPermission =
    useCallback((): BroadcastStartCheckResult | null => {
      if (!operatingHoursInfo) {
        return null
      }

      if (isStaff) {
        return {
          allowed: true,
          reason: 'Staff bypass - 24/7 access',
          isStaff: true,
          isMaiTrollOpen: operatingHoursInfo.isOpen,
          closesAt: operatingHoursInfo.closesAt,
          opensAt: operatingHoursInfo.opensAt,
        }
      }

      if (operatingHoursInfo.isOpen) {
        return {
          allowed: true,
          reason: 'MaiTroll is currently open',
          isStaff: false,
          isMaiTrollOpen: true,
          closesAt: operatingHoursInfo.closesAt,
          opensAt: operatingHoursInfo.opensAt,
        }
      }

      return {
        allowed: false,
        reason:
          'MaiTroll is currently closed. Public broadcasting is unavailable from 2:00 AM to 10:00 AM America/Chicago.',
        isStaff: false,
        isMaiTrollOpen: false,
        opensAt: operatingHoursInfo.opensAt || '10:00 AM',
      }
    }, [operatingHoursInfo, isStaff])

  const checkServerBroadcastPermission = useCallback(async () => {
    if (!user?.id) {
      setCheckResult(null)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc(
        'can_start_broadcast_maitroll',
        {
          user_id: user.id,
        },
      )

      if (error) {
        console.error(
          '[useBroadcastStartCheck] Server check failed:',
          error,
        )

        const localResult = checkLocalBroadcastPermission()

        if (localResult) {
          setCheckResult({
            ...localResult,
            allowed: localResult.allowed && isStaff,
            reason: isStaff
              ? 'Staff bypass - 24/7 access'
              : 'Unable to verify MaiTroll operating status. Please try again.',
          })
        } else {
          setCheckResult({
            allowed: false,
            reason:
              'Unable to verify MaiTroll operating status. Please try again.',
            isStaff,
            isMaiTrollOpen: false,
          })
        }

        return
      }

      if (!data) {
        setCheckResult({
          allowed: false,
          reason:
            'Unable to verify MaiTroll broadcast permission. Please try again.',
          isStaff,
          isMaiTrollOpen: false,
        })

        return
      }

      setCheckResult({
        allowed: Boolean(data.allowed),
        reason:
          data.reason ||
          (data.allowed
            ? 'MaiTroll is currently open'
            : 'MaiTroll is currently closed'),
        isStaff: Boolean(data.is_staff),
        isMaiTrollOpen: Boolean(data.is_maitroll_open),
        closesAt: data.closes_at || undefined,
        opensAt: data.opens_at || undefined,
      })
    } catch (error) {
      console.error(
        '[useBroadcastStartCheck] Unexpected server error:',
        error,
      )

      const localResult = checkLocalBroadcastPermission()

      if (localResult && isStaff) {
        setCheckResult(localResult)
      } else {
        setCheckResult({
          allowed: false,
          reason:
            'Unable to verify MaiTroll operating status. Please try again.',
          isStaff,
          isMaiTrollOpen: false,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [
    user?.id,
    isStaff,
    checkLocalBroadcastPermission,
  ])

  useEffect(() => {
    if (!user?.id) {
      setCheckResult(null)
      return
    }

    const localResult = checkLocalBroadcastPermission()

    if (localResult) {
      setCheckResult(localResult)
    }

    void checkServerBroadcastPermission()
  }, [
    user?.id,
    checkLocalBroadcastPermission,
    checkServerBroadcastPermission,
  ])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const interval = window.setInterval(() => {
      void checkServerBroadcastPermission()
    }, 30000)

    return () => {
      window.clearInterval(interval)
    }
  }, [user?.id, checkServerBroadcastPermission])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkServerBroadcastPermission()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [user?.id, checkServerBroadcastPermission])

  return {
    allowed: checkResult?.allowed ?? false,
    reason: checkResult?.reason ?? 'Checking MaiTroll operating status...',
    isStaff: checkResult?.isStaff ?? isStaff,
    isMaiTrollOpen: checkResult?.isMaiTrollOpen ?? false,
    closesAt: checkResult?.closesAt,
    opensAt: checkResult?.opensAt,
    loading,
    recheck: checkServerBroadcastPermission,
  }
}

export default useBroadcastStartCheck