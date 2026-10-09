import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import type { HomeownersInsurance, CarInsurance, BroadcastInsurance } from '../../types/neighborhood'

interface InsuranceOption {
  id: string
  name: string
  type: 'homeowners' | 'car' | 'broadcast' | 'kick' | 'ban'
  cost: number
  duration_hours: number
  description: string
  deductible?: number
}

const DEFAULT_INSURANCE_OPTIONS: InsuranceOption[] = [
  { id: 'homeowners_basic_week', name: 'Basic Homeowners', type: 'homeowners', cost: 500, duration_hours: 168, description: 'Basic coverage for house damage', deductible: 25 },
  { id: 'homeowners_premium_month', name: 'Premium Homeowners', type: 'homeowners', cost: 1500, duration_hours: 720, description: 'Full coverage including raids', deductible: 25 },
  { id: 'car_basic_week', name: 'Basic Auto', type: 'car', cost: 400, duration_hours: 168, description: 'Basic vehicle coverage', deductible: 50 },
  { id: 'car_premium_month', name: 'Premium Auto', type: 'car', cost: 1200, duration_hours: 720, description: 'Full vehicle coverage + vandalism', deductible: 50 },
  { id: 'broadcast_basic_week', name: 'Broadcast Shield', type: 'broadcast', cost: 800, duration_hours: 168, description: 'Protects during broadcasts' },
  { id: 'broadcast_premium_month', name: 'Broadcast Armor', type: 'broadcast', cost: 2500, duration_hours: 720, description: 'Full broadcast protection' }
]

export function useInsurance() {
  const { user, profile } = useAuthStore()
  const [homeownersInsurance, setHomeownersInsurance] = useState<HomeownersInsurance | null>(null)
  const [carInsurance, setCarInsurance] = useState<CarInsurance | null>(null)
  const [broadcastInsurance, setBroadcastInsurance] = useState<BroadcastInsurance | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInsurance = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      // Get homeowners insurance
      const { data: homeownersData, error: homeownersError } = await supabase
        .from('homeowners_insurances')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (!homeownersError) setHomeownersInsurance(homeownersData)

      // Get car insurance
      const { data: carData, error: carError } = await supabase
        .from('car_insurances')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (!carError) setCarInsurance(carData)

      // Get broadcast insurance
      const { data: broadcastData, error: broadcastError } = await supabase
        .from('broadcast_insurances')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (!broadcastError) setBroadcastInsurance(broadcastData)
    } catch (error) {
      console.error('Error fetching insurance:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchInsurance()
  }, [fetchInsurance])

  const getOptions = (): InsuranceOption[] => {
    return DEFAULT_INSURANCE_OPTIONS
  }

  const purchaseHomeownersInsurance = async (optionId: string) => {
    if (!user?.id || !profile) return { success: false, error: 'Not authenticated' }

    const option = DEFAULT_INSURANCE_OPTIONS.find(o => o.id === optionId && o.type === 'homeowners')
    if (!option) return { success: false, error: 'Invalid option' }

    try {
      const expiresAt = new Date(Date.now() + option.duration_hours * 60 * 60 * 1000).toISOString()

      const { error } = await supabase
        .from('homeowners_insurances')
        .insert({
          user_id: user.id,
          house_id: profile.house_id || '',
          expires_at: expiresAt,
          deductible_paid: 0
        })

      if (error) throw error

      // Update profile
      await supabase
        .from('user_profiles')
        .update({ homeowners_insurance_expiry: expiresAt })
        .eq('id', user.id)

      await fetchInsurance()
      return { success: true }
    } catch (error: any) {
      console.error('Error purchasing insurance:', error)
      return { success: false, error: error.message }
    }
  }

  const purchaseCarInsurance = async (optionId: string) => {
    if (!user?.id || !profile) return { success: false, error: 'Not authenticated' }

    const option = DEFAULT_INSURANCE_OPTIONS.find(o => o.id === optionId && o.type === 'car')
    if (!option) return { success: false, error: 'Invalid option' }

    try {
      const expiresAt = new Date(Date.now() + option.duration_hours * 60 * 60 * 1000).toISOString()

      const { error } = await supabase
        .from('car_insurances')
        .insert({
          user_id: user.id,
          vehicle_id: profile.vehicle_id || '',
          expires_at: expiresAt,
          deductible_paid: 0
        })

      if (error) throw error

      // Update profile
      await supabase
        .from('user_profiles')
        .update({ car_insurance_expiry: expiresAt })
        .eq('id', user.id)

      await fetchInsurance()
      return { success: true }
    } catch (error: any) {
      console.error('Error purchasing insurance:', error)
      return { success: false, error: error.message }
    }
  }

  const purchaseBroadcastInsurance = async (optionId: string) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    const option = DEFAULT_INSURANCE_OPTIONS.find(o => o.id === optionId && o.type === 'broadcast')
    if (!option) return { success: false, error: 'Invalid option' }

    try {
      const expiresAt = new Date(Date.now() + option.duration_hours * 60 * 60 * 1000).toISOString()

      const { error } = await supabase
        .from('broadcast_insurances')
        .insert({
          user_id: user.id,
          expires_at: expiresAt,
          coverage_type: 'all'
        })

      if (error) throw error

      await fetchInsurance()
      return { success: true }
    } catch (error: any) {
      console.error('Error purchasing insurance:', error)
      return { success: false, error: error.message }
    }
  }

  const hasHomeownersInsurance = (): boolean => {
    return homeownersInsurance !== null && new Date(homeownersInsurance.expires_at) > new Date()
  }

  const hasCarInsurance = (): boolean => {
    return carInsurance !== null && new Date(carInsurance.expires_at) > new Date()
  }

  const hasBroadcastInsurance = (): boolean => {
    return broadcastInsurance !== null && new Date(broadcastInsurance.expires_at) > new Date()
  }

   return {
     homeownersInsurance,
     carInsurance,
     broadcastInsurance,
     loading,
     getOptions,
     purchaseHomeownersInsurance,
     purchaseCarInsurance,
     purchaseBroadcastInsurance,
     hasHomeownersInsurance,
     hasCarInsurance,
     hasBroadcastInsurance,
     fetchInsurance
   }
 }