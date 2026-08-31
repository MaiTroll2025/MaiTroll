import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface LockdownState {
  isLocked: boolean
  loading: boolean
  toggleLockdown: (newState: boolean) => Promise<boolean>
}

// Generic admin-driven lockdown backed by the `admin_settings` table.
// Each feature passes its own setting key so multiple independent lockdowns
// can coexist (broadcast, hytro_gaming, podcast, etc.).
export function useLockdown(settingKey: string, description: string): LockdownState {
  const [isLocked, setIsLocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', settingKey)
          .maybeSingle()

        if (error) {
          console.error(`Error fetching ${settingKey} status:`, error)
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
        console.error(`Error fetching ${settingKey} status:`, err)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()

    const channel = supabase
      .channel(`${settingKey}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings',
          filter: `setting_key=eq.${settingKey}`,
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
  }, [settingKey, description])

  const toggleLockdown = useCallback(async (newState: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update({
          setting_value: { enabled: newState },
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', settingKey)

      if (updateError) {
        console.error(`Error toggling ${settingKey}:`, updateError)
        return false
      }

      setIsLocked(newState)
      return true
    } catch (err) {
      console.error(`Error toggling ${settingKey}:`, err)
      return false
    }
  }, [settingKey, description])

  return { isLocked, loading, toggleLockdown }
}
