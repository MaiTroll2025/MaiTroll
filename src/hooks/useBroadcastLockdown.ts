import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { UserRole } from '@/lib/supabase'

export function useBroadcastLockdown() {
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const profile = useAuthStore((state) => state.profile)

  // Check if user is admin
  const isAdmin = profile?.role === UserRole.ADMIN || 
    profile?.troll_role === UserRole.ADMIN || 
    profile?.role === UserRole.HR_ADMIN ||
    profile?.role === UserRole.AGENCY_HR_MANAGER ||
    profile?.is_admin ||
    profile?.role === UserRole.OWNER ||
    profile?.role === UserRole.PRESIDENT ||
    profile?.role === UserRole.VICE_PRESIDENT ||
    profile?.role === UserRole.TEMP_CITY_ADMIN ||
    profile?.role === UserRole.TEMP_ADMIN

  useEffect(() => {
    const fetchLockdownStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'broadcast_lockdown_enabled')
          .maybeSingle()

        if (error) {
          console.error('Error fetching broadcast lockdown status:', error)
          setLoading(false)
          return
        }

        if (data && data.setting_value) {
          // Handle both JSONB and text types
          const settingValue = data.setting_value
          if (typeof settingValue === 'object' && settingValue !== null) {
            setIsLocked(settingValue.enabled === true)
          } else if (typeof settingValue === 'string') {
            try {
              const parsed = JSON.parse(settingValue)
              setIsLocked(parsed.enabled === true)
            } catch {
              setIsLocked(settingValue.includes('enabled') && settingValue.includes('true'))
            }
          }
        } else {
          setIsLocked(false)
        }
      } catch (err) {
        console.error('Error fetching broadcast lockdown status:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLockdownStatus()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('broadcast_lockdown_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings',
          filter: "setting_key=eq.broadcast_lockdown_enabled"
        },
        (payload) => {
          if (payload.new && (payload.new as any).setting_value) {
            const settingValue = (payload.new as any).setting_value
            if (typeof settingValue === 'object' && settingValue !== null) {
              setIsLocked(settingValue.enabled === true)
            } else if (typeof settingValue === 'string') {
              try {
                const parsed = JSON.parse(settingValue)
                setIsLocked(parsed.enabled === true)
              } catch {
                setIsLocked(settingValue.includes('enabled') && settingValue.includes('true'))
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  // Check if user can broadcast
  // When lockdown is active, NO ONE can broadcast (not even admins)
  // When user's driver license is suspended, they cannot broadcast either
  const canBroadcast = useCallback(() => {
    // If not locked, still need to check license status
    if (!isLocked) {
      return profile?.drivers_license_status !== 'suspended'
    }
    // If locked, NO ONE can broadcast (admins included per new rule)
    return false
  }, [isLocked, profile?.drivers_license_status])

  // Function to toggle lockdown (for admin use - can be called from BroadcastLockdownControl)
  const toggleLockdown = useCallback(async (newState: boolean) => {
    try {
      // First try to update existing record
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({
          setting_value: { enabled: newState },
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'broadcast_lockdown_enabled')

      if (updateError) {
        console.error('Error toggling lockdown:', updateError)
        return false
      }

      setIsLocked(newState)
      return true
    } catch (err) {
      console.error('Error toggling lockdown:', err)
      return false
    }
  }, [])

  return {
    isLocked,
    loading,
    isAdmin,
    canBroadcast,
    toggleLockdown
  }
}
