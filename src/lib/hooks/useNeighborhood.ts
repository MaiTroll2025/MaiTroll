import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { toast } from 'sonner'
import type { Neighborhood, NeighborhoodMember, House, HouseUpgrade, HouseLoan, HouseRaid, HouseFees } from '../../types/neighborhood'

const DEFAULT_HOUSE_FEES: HouseFees = {
  deed_fee: 500,
  electric_fee: 100,
  water_fee: 75,
  internet_fee: 50,
  yard_trash_fee: 25,
  monthly_total: 250
}

export function useNeighborhood() {
  const { user, profile } = useAuthStore()
  const [neighborhood, setNeighborhood] = useState<Neighborhood | null>(null)
  const [members, setMembers] = useState<NeighborhoodMember[]>([])
  const [house, setHouse] = useState<House | null>(null)
  const [loading, setLoading] = useState(true)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchNeighborhood = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      // Try to get neighborhood where user is leader first
      let neighborhoodData: Neighborhood | null = null
      const { data: leaderNeighborhood, error: leaderError } = await supabase
        .from('neighborhoods')
        .select('*')
        .eq('leader_user_id', user.id)
        .maybeSingle()

      if (leaderError) throw leaderError

      if (leaderNeighborhood) {
        neighborhoodData = leaderNeighborhood
      } else {
        // If not a leader, check if user is a member via neighborhood_members
        const { data: memberData, error: memberError } = await supabase
          .from('neighborhood_members')
          .select('neighborhood_id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (memberError) throw memberError

        if (memberData?.neighborhood_id) {
          const { data: memberNeighborhood, error: memberNeighborhoodError } = await supabase
            .from('neighborhoods')
            .select('*')
            .eq('id', memberData.neighborhood_id)
            .maybeSingle()

          if (memberNeighborhoodError) throw memberNeighborhoodError
          neighborhoodData = memberNeighborhood || null
        }
      }

      if (!isMountedRef.current) return

      setNeighborhood(neighborhoodData)

      if (neighborhoodData) {
        // Get members
        const { data: membersData, error: membersError } = await supabase
          .from('neighborhood_members')
          .select('*, user:user_profiles(username, avatar_url)')
          .eq('neighborhood_id', neighborhoodData.id)

        if (membersError) throw membersError
        if (isMountedRef.current) setMembers(membersData || [])

        // Get user's house
        const { data: houseData, error: houseError } = await supabase
          .from('houses')
          .select('*')
          .eq('owner_user_id', user.id)
          .maybeSingle()

        if (houseError) throw houseError
        if (isMountedRef.current) setHouse(houseData)
      }
    } catch (error) {
      console.error('Error fetching neighborhood:', error)
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchNeighborhood()
  }, [fetchNeighborhood])

  const createNeighborhood = useCallback(async (name: string, zipCode: string, houseCount: number = 5) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    const safeHouseCount = Math.max(1, Math.min(15, houseCount))

    try {
      // Check monthly limit (15 neighborhoods per month)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count: monthlyCount, error: countError } = await supabase
        .from('neighborhoods')
        .select('*', { count: 'exact', head: true })
        .eq('leader_user_id', user.id)
        .gte('created_at', startOfMonth.toISOString())

      if (countError) throw countError

      if ((monthlyCount || 0) >= 15) {
        return { success: false, error: 'You can only create 15 neighborhoods per month' }
      }

      // Check credit score (must be >= 300)
      if ((profile?.credit_score || 300) < 300) {
        return { success: false, error: 'Credit score must be 300 or higher' }
      }

      // Create neighborhood
      const { data, error } = await supabase
        .from('neighborhoods')
        .insert({
          leader_user_id: user.id,
          name,
          zip_code: zipCode,
          officer_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Create leader as member
      await supabase.from('neighborhood_members').insert({
        neighborhood_id: data.id,
        user_id: user.id,
        role: 'leader'
      })

      // Create empty houses based on chosen count
      const housesData = Array.from({ length: safeHouseCount }, () => ({
        neighborhood_id: data.id,
        owner_user_id: null,
        upgrade_level: 1,
        condition: 100,
        is_reposessed: false,
        electric_on: false,
        water_on: false,
        internet_on: false
      }))

      const { data: houses, error: housesError } = await supabase
        .from('houses')
        .insert(housesData)
        .select()

      if (housesError) throw housesError
      if (!houses || houses.length === 0) throw new Error('Failed to create neighborhood houses')

      // Assign first house to leader
      const leaderHouse = houses[0]
      const { error: updateError } = await supabase
        .from('houses')
        .update({ owner_user_id: user.id })
        .eq('id', leaderHouse.id)

      if (updateError) throw updateError

      // Update user profile with neighborhood and house
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          neighborhood_id: data.id,
          house_id: leaderHouse.id
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      setNeighborhood(data)
      setHouse(leaderHouse)

      await fetchNeighborhood()
      return { success: true, neighborhood: data, house: leaderHouse }
    } catch (error: any) {
      console.error('Error creating neighborhood:', error)
      return { success: false, error: error.message }
    }
  }, [user?.id, profile?.credit_score])

  const inviteFollower = async (followerUsername: string) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    try {
      // Find follower by username
      const { data: follower, error: followerError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', followerUsername)
        .single()

      if (followerError || !follower) {
        return { success: false, error: 'User not found' }
      }

      // Create invite
      const { error: inviteError } = await supabase
        .from('neighborhood_invites')
        .insert({
          leader_user_id: user.id,
          follower_user_id: follower.id,
          status: 'pending'
        })

      if (inviteError) throw inviteError

      return { success: true }
    } catch (error: any) {
      console.error('Error inviting follower:', error)
      return { success: false, error: error.message }
    }
  }

  const acceptInvite = useCallback(async (leaderUserId?: string) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    try {
      if (!leaderUserId) {
        const { data: invite, error: inviteError } = await supabase
          .from('neighborhood_invites')
          .select('leader_user_id')
          .eq('follower_user_id', user.id)
          .eq('status', 'accepted')
          .limit(1)
          .maybeSingle()

        if (inviteError || !invite?.leader_user_id) {
          return { success: false, error: 'No accepted invite found' }
        }

        leaderUserId = invite.leader_user_id
      }

      // Get leader's neighborhood
      const { data: neighborhoodData, error: neighborhoodError } = await supabase
        .from('neighborhoods')
        .select('id')
        .eq('leader_user_id', leaderUserId)
        .single()

      if (neighborhoodError || !neighborhoodData) {
        return { success: false, error: 'Neighborhood not found' }
      }

      // Accept invite
      await supabase
        .from('neighborhood_invites')
        .update({ status: 'accepted' })
        .eq('leader_user_id', leaderUserId)
        .eq('follower_user_id', user.id)

      // Create member record
      const { error: memberError } = await supabase
        .from('neighborhood_members')
        .insert({
          neighborhood_id: neighborhoodData.id,
          user_id: user.id,
          role: 'follower'
        })

      if (memberError) throw memberError

      // Claim an existing empty house slot in the leader's neighborhood first.
      const { data: emptyHouse, error: emptyHouseError } = await supabase
        .from('houses')
        .select('id')
        .eq('neighborhood_id', neighborhoodData.id)
        .is('owner_user_id', null)
        .limit(1)
        .maybeSingle()

      if (emptyHouseError) {
        throw emptyHouseError
      }

      let house = emptyHouse

      if (emptyHouse) {
        const { error: updateHouseError } = await supabase
          .from('houses')
          .update({ owner_user_id: user.id })
          .eq('id', emptyHouse.id)

        if (updateHouseError) throw updateHouseError
      } else {
        const { data: newHouse, error: houseError } = await supabase
          .from('houses')
          .insert({
            neighborhood_id: neighborhoodData.id,
            owner_user_id: user.id,
            upgrade_level: 1,
            condition: 100,
            is_reposessed: false,
            electric_on: false,
            water_on: false,
            internet_on: false
          })
          .select()
          .single()

        if (houseError) throw houseError
        house = newHouse
      }

      if (!house) {
        throw new Error('Failed to assign a house slot')
      }

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({
          neighborhood_id: neighborhoodData.id,
          house_id: house.id
        })
        .eq('id', user.id)

      await fetchNeighborhood()
      return { success: true }
    } catch (error: any) {
      console.error('Error accepting invite:', error)
      return { success: false, error: error.message }
    }
  }, [user?.id])

  const getHouseFees = async (): Promise<HouseFees> => {
    return DEFAULT_HOUSE_FEES
  }

  const payHouseFees = async (fees: Partial<HouseFees>) => {
    if (!user?.id || !house) return { success: false, error: 'No house found' }

    try {
      const updates: Partial<House> = {}

      if (fees.electric_fee) updates.electric_on = true
      if (fees.water_fee) updates.water_on = true
      if (fees.internet_fee) updates.internet_on = true

      const { error } = await supabase
        .from('houses')
        .update(updates)
        .eq('id', house.id)

      if (error) throw error

      await fetchNeighborhood()
      return { success: true }
    } catch (error: any) {
      console.error('Error paying fees:', error)
      return { success: false, error: error.message }
    }
  }

  const joinNeighborhoodByLeaderId = useCallback(async (leaderUserId: string) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    try {
      const { data: neighborhoodData, error: neighborhoodError } = await supabase
        .from('neighborhoods')
        .select('id')
        .eq('leader_user_id', leaderUserId)
        .single()

      if (neighborhoodError || !neighborhoodData) {
        return { success: false, error: 'Neighborhood not found' }
      }

      const { error: memberError } = await supabase
        .from('neighborhood_members')
        .insert({
          neighborhood_id: neighborhoodData.id,
          user_id: user.id,
          role: 'follower'
        })

      if (memberError) throw memberError

      const { data: emptyHouse, error: emptyHouseError } = await supabase
        .from('houses')
        .select('id')
        .eq('neighborhood_id', neighborhoodData.id)
        .is('owner_user_id', null)
        .limit(1)
        .maybeSingle()

      if (emptyHouseError) {
        throw emptyHouseError
      }

      let house = emptyHouse

      if (emptyHouse) {
        const { error: updateHouseError } = await supabase
          .from('houses')
          .update({ owner_user_id: user.id })
          .eq('id', emptyHouse.id)

        if (updateHouseError) throw updateHouseError
      } else {
        const { data: newHouse, error: houseError } = await supabase
          .from('houses')
          .insert({
            neighborhood_id: neighborhoodData.id,
            owner_user_id: user.id,
            upgrade_level: 1,
            condition: 100,
            is_reposessed: false,
            electric_on: false,
            water_on: false,
            internet_on: false
          })
          .select()
          .single()

        if (houseError) throw houseError
        house = newHouse
      }

      if (!house) {
        throw new Error('Failed to assign a house slot')
      }

      await supabase
        .from('user_profiles')
        .update({
          neighborhood_id: neighborhoodData.id,
          house_id: house.id
        })
        .eq('id', user.id)

      await fetchNeighborhood()
      return { success: true }
    } catch (error: any) {
      console.error('Error joining neighborhood:', error)
      return { success: false, error: error.message }
    }
  }, [user?.id])

  const checkInvites = useCallback(async () => {
    if (!user?.id) return { hasPendingInvites: false, hasAcceptedInvites: false }

    try {
      const { data: invites, error } = await supabase
        .from('neighborhood_invites')
        .select('status')
        .eq('follower_user_id', user.id)

      if (error) throw error

      const hasPendingInvites = invites?.some(invite => invite.status === 'pending') || false
      const hasAcceptedInvites = invites?.some(invite => invite.status === 'accepted') || false

      return { hasPendingInvites, hasAcceptedInvites }
    } catch (error) {
      console.error('Error checking invites:', error)
      return { hasPendingInvites: false, hasAcceptedInvites: false }
    }
  }, [user?.id])

  return {
    neighborhood,
    members,
    house,
    loading,
    fetchNeighborhood,
    createNeighborhood,
    inviteFollower,
    acceptInvite,
    joinNeighborhoodByLeaderId,
    checkInvites,
    getHouseFees,
    payHouseFees
  }
}

export function useHouseRaids(houseId: string | null) {
  const [raids, setRaids] = useState<HouseRaid[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRaids = useCallback(async () => {
    if (!houseId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('house_raids')
        .select('*')
        .eq('house_id', houseId)
        .order('raided_at', { ascending: false })

      if (error) throw error
      setRaids(data || [])
    } catch (error) {
      console.error('Error fetching raids:', error)
    } finally {
      setLoading(false)
    }
  }, [houseId])

  useEffect(() => {
    fetchRaids()
  }, [fetchRaids])

  const raidHouse = async (raiderUserId: string, damageLevel: 'minor' | 'major' | 'destroyed' = 'minor') => {
    if (!houseId) return { success: false, error: 'No house' }

    try {
      const { error } = await supabase
        .from('house_raids')
        .insert({
          house_id: houseId,
          raided_by_user_id: raiderUserId,
          damage_level: damageLevel,
          raided_at: new Date().toISOString()
        })

      if (error) throw error

      // Update house condition
      const conditionLoss = damageLevel === 'minor' ? 10 : damageLevel === 'major' ? 25 : 50
      await supabase.rpc('update_house_condition', { house_id: houseId, condition_change: -conditionLoss })

      await fetchRaids()
      return { success: true }
    } catch (error: any) {
      console.error('Error raiding house:', error)
      return { success: false, error: error.message }
    }
  }

  const repairHouse = async (repairUserId: string) => {
    if (!houseId) return { success: false, error: 'No house' }

    try {
      // Mark latest raid as repaired
      await supabase
        .from('house_raids')
        .update({ repaired_at: new Date().toISOString() })
        .eq('house_id', houseId)
        .is('repaired_at', null)
        .order('raided_at', { ascending: false })
        .limit(1)

      // Restore house condition
      await supabase
        .from('houses')
        .update({ condition: 100 })
        .eq('id', houseId)

      await fetchRaids()
      return { success: true }
    } catch (error: any) {
      console.error('Error repairing house:', error)
      return { success: false, error: error.message }
    }
  }

  const isRaided = raids.some(r => !r.repaired_at)

  return {
    raids,
    loading,
    isRaided,
    fetchRaids,
    raidHouse,
    repairHouse
  }
}