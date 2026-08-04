import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store'
import { supabase } from '../supabase'

export type AvatarSkinTone = 'light' | 'medium' | 'dark'
export type AvatarHairStyle = 'short' | 'long' | 'buzz' | 'none'
export type AvatarHairColor = 'black' | 'brown' | 'blonde' | 'red' | 'neon'
export type AvatarOutfit = 'casual' | 'formal' | 'street'
export type AvatarAccessory = 'none' | 'glasses' | 'hat' | 'mask'

export interface AvatarConfig {
  skinTone: AvatarSkinTone
  hairStyle: AvatarHairStyle
  hairColor: AvatarHairColor
  outfit: AvatarOutfit
  accessory: AvatarAccessory
  useAsProfilePicture: boolean
}

const defaultConfig: AvatarConfig = {
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'brown',
  outfit: 'casual',
  accessory: 'none',
  useAsProfilePicture: false
}

function getGenderDefaultConfig(gender?: string | null): AvatarConfig {
  if (gender === 'male') {
    return {
      skinTone: 'medium',
      hairStyle: 'short',
      hairColor: 'brown',
      outfit: 'street',
      accessory: 'none',
      useAsProfilePicture: false
    }
  }

  if (gender === 'female') {
    return {
      skinTone: 'light',
      hairStyle: 'long',
      hairColor: 'blonde',
      outfit: 'casual',
      accessory: 'none',
      useAsProfilePicture: false
    }
  }

  return defaultConfig
}

export function useAvatar() {
  const { user, profile } = useAuthStore()
  const gender = (profile as any)?.gender as string | null | undefined
  const [config, setConfigState] = useState<AvatarConfig>(getGenderDefaultConfig(gender))
  const userKey = user?.id ? `MaiTroll_avatar_${user.id}` : null

  useEffect(() => {
    let isMounted = true

    const loadConfig = async () => {
      if (!userKey || !user?.id) {
        setConfigState(getGenderDefaultConfig(gender))
        return
      }

      // Load from local storage first for instant UI
      try {
        const raw = localStorage.getItem(userKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (isMounted) {
            setConfigState({
              ...getGenderDefaultConfig(gender),
              ...parsed
            })
          }
        }
      } catch {}

      // Then try DB
      try {
        const { data } = await supabase
          .from('user_avatar_customization')
          .select('avatar_config')
          .eq('user_id', user.id)
          .maybeSingle()

        if (data?.avatar_config && isMounted) {
          setConfigState({
            ...getGenderDefaultConfig(gender),
            ...data.avatar_config
          })
        }
      } catch {}
    }

    loadConfig()
    return () => {
      isMounted = false
    }
  }, [userKey, user?.id, gender])

  const setConfig = useCallback(
    (updater: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)) => {
      setConfigState(prev => {
        const next = typeof updater === 'function' ? (updater as (p: AvatarConfig) => AvatarConfig)(prev) : updater
        if (userKey) {
          try {
            localStorage.setItem(userKey, JSON.stringify(next))
          } catch {
          }
        }
        return next
      })
    },
    [userKey]
  )

  return { config, setConfig }
}
