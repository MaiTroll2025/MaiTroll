import React, { useState, useEffect } from 'react';
import { Home, Wrench, AlertTriangle, Shield, Hammer } from 'lucide-react';
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'

interface BroadcastHouseIconProps {
  broadcasterId: string
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  showStatus?: boolean
  interactive?: boolean
  broadcasterProfile?: {
    troll_coins?: number
    username?: string
  }
}

export default function BroadcastHouseIcon({ 
  broadcasterId, 
  size = 'md', 
  onClick,
  showStatus = true,
  interactive = false,
  broadcasterProfile
}: BroadcastHouseIconProps) {
  const { user, profile } = useAuthStore()
  const [house, setHouse] = useState<any>(null)
  const [raids, setRaids] = useState<any[]>([])
  const [insurance, setInsurance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRaidDialogOpen, setIsRaidDialogOpen] = useState(false)
  const [raiding, setRaiding] = useState(false)
  // Track recent raid for animation
  const [recentRaid, setRecentRaid] = useState<boolean>(false)

  useEffect(() => {
    fetchHouseData()
  }, [broadcasterId])

  // Hard-stop the raid flash animation exactly 4 s after each batch of raids becomes stale
  useEffect(() => {
    if (!recentRaid) return
    const t = setTimeout(() => setRecentRaid(false), 4000)
    return () => clearTimeout(t)
  }, [recentRaid])

  const fetchHouseData = async () => {
    try {
      setLoading(true)

      // Get house
      const { data: houseData } = await supabase
        .from('houses')
        .select('*')
        .eq('owner_user_id', broadcasterId)
        .maybeSingle()

      setHouse(houseData)

      if (houseData) {
        // Get raids
        const { data: raidsData } = await supabase
          .from('house_raids')
          .select('*')
          .eq('house_id', houseData.id)
          .is('repaired_at', null)
          .order('raided_at', { ascending: false })

        setRaids(raidsData || [])

        // Check if there was a recent raid (within last 4 seconds) for animation
        const now = new Date()
        const recentRaid = raidsData?.some(raid => {
          const raidTime = new Date(raid.raided_at)
          return (now.getTime() - raidTime.getTime()) < 4000
        })
        setRecentRaid(!!recentRaid)

        // Get insurance
        if (profile?.homeowners_insurance_expiry) {
          setInsurance({
            expires_at: profile.homeowners_insurance_expiry,
            is_active: new Date(profile.homeowners_insurance_expiry) > new Date()
          })
        }
      }
    } catch (error) {
      console.error('Error fetching house:', error)
    } finally {
      setLoading(false)
    }
  }

  const isRaided = raids.length > 0
  const hasInsurance = insurance?.is_active

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const handleRaid = async () => {
    if (!user?.id) {
      toast.error('Login to raid houses')
      return
    }

    const isStaff = profile?.is_admin || profile?.is_troll_officer || profile?.role === 'admin'
    if (isStaff) {
      toast.error('Staff cannot raid houses')
      return
    }

    if ((profile?.troll_coins || 0) < 100) {
      toast.error('Need 100 Troll Coins to raid')
      return
    }

    setRaiding(true)
    try {
      await supabase.rpc('deduct_coins', { amount: 100 })

       const { data: targetHouse } = await supabase
         .from('houses')
         .select('id')
         .eq('owner_user_id', broadcasterId)
         .maybeSingle()
 
       if (targetHouse) {
         await supabase.from('house_raids').insert({
           house_id: targetHouse.id,
           raided_by_user_id: user.id,
           damage_level: 'minor'
         })
 
        await supabase.rpc('update_house_condition', { 
          house_id: targetHouse.id, 
          condition_change: -10 
        })
 
         await fetchHouseData()
       }

       toast.success('House raided! ⚔️')
       setIsRaidDialogOpen(false)
       
       // Trigger raid animation
       const _animationEndTime = Date.now() + 4000; // 4 seconds
       // Animation will be handled via CSS classes that respond to isRaided state
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setRaiding(false)
    }
  }

  // Calculate cash value: 100 Troll Coins = $1, so 1 coin = $0.01
  const houseValue = house ? Math.round((house.condition || 100) / 100) : 0

  if (!house || loading) return null

  return (
    <>
      <div 
        className={`relative ${sizeClasses[size]} group ${interactive ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`}
        onClick={interactive ? () => setIsRaidDialogOpen(true) : onClick}
      >
         {/* House Icon */}
         <div className={`
           w-full h-full rounded-lg flex items-center justify-center
           ${isRaided ? 'bg-red-500/80' : 'bg-emerald-500/80'}
           ${hasInsurance ? 'ring-2 ring-green-400' : ''}
           ${recentRaid ? 'animate-pulse animate-[raid_flash_4s_ease-in-out]' : ''}
           ${interactive ? 'hover:scale-110' : ''}
           transition-transform
         `}>
           <Home className={`${iconSizes[size]} text-white`} />
         </div>

        {/* Status Badges */}
        {showStatus && (
          <div className="absolute -top-2 -right-2 flex flex-col gap-1">
            {isRaided && (
              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-2 h-2 text-white" />
              </div>
            )}
            {hasInsurance && (
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <Shield className="w-2 h-2 text-white" />
              </div>
            )}
          </div>
        )}

{/* Hover Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 rounded-lg p-2 whitespace-nowrap z-50">
            <p className="text-white text-xs font-bold">
              {isRaided ? '⚠️ House Raided!' : '🏠 House'}
            </p>
            <p className="text-gray-400 text-xs">
              Condition: {house.condition}%
            </p>
            <p className="text-cyan-400 text-xs">
              Cash Value: ${houseValue.toFixed(2)}
            </p>
            <p className="text-gray-400 text-xs">
              Level: {house.upgrade_level}
            </p>
            {broadcasterProfile?.troll_coins !== undefined && (
              <p className="text-yellow-400 text-xs">
                💰 {broadcasterProfile.troll_coins.toLocaleString()} TC
              </p>
            )}
            {hasInsurance && (
              <p className="text-green-400 text-xs">✅ Insured</p>
            )}
          </div>
      </div>

      {/* Raid Confirmation Dialog */}
      <Dialog open={isRaidDialogOpen} onOpenChange={setIsRaidDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Hammer className="w-5 h-5 text-red-500" />
              Raid House?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300">
              Raiding will cost <span className="font-bold text-yellow-400">100 Troll Coins</span> and deal damage to the house.
            </p>
            <p className="text-slate-400 text-sm">
              Current condition: {house.condition}%
            </p>
            {hasInsurance && (
              <p className="text-green-400 text-sm">⚠️ Owner has insurance - repair will be covered</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setIsRaidDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRaid} 
                disabled={raiding}
                className="bg-red-600 hover:bg-red-700"
              >
                {raiding ? 'Raiding...' : 'Raid House (100 TC)'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface HouseUpgradePanelProps {
  isOpen: boolean
  onClose: () => void
  house: any
  onUpgrade?: () => void
}

const UPGRADES = [
  { id: 'roof', name: 'Better Roof', cost: 500, condition_bonus: 10 },
  { id: 'paint', name: 'Fresh Paint', cost: 250, condition_bonus: 5 },
  { id: 'furniture', name: 'Furniture', cost: 1000, condition_bonus: 15 },
  { id: 'garden', name: 'Garden', cost: 300, condition_bonus: 5 },
  { id: 'security', name: 'Security System', cost: 750, condition_bonus: 10 },
  { id: 'solar', name: 'Solar Panels', cost: 2000, condition_bonus: 20 }
]

export function HouseUpgradePanel({ isOpen, onClose, house, onUpgrade }: HouseUpgradePanelProps) {
  const { user, profile } = useAuthStore()
  const [upgrading, setUpgrading] = useState<string | null>(null)

  const handleUpgrade = async (upgrade: typeof UPGRADES[0]) => {
    if (!user?.id || !house) return

    if ((profile?.troll_coins || 0) < upgrade.cost) {
      toast.error('Not enough Troll Coins')
      return
    }

    setUpgrading(upgrade.id)
    try {
      await supabase.rpc('deduct_coins', { amount: upgrade.cost })

      await supabase.from('house_upgrades').insert({
        house_id: house.id,
        upgrade_type: upgrade.id,
        cost: upgrade.cost
      })

      await supabase
        .from('houses')
        .update({ 
          upgrade_level: house.upgrade_level + 1,
          condition: Math.min(100, house.condition + upgrade.condition_bonus)
        })
        .eq('id', house.id)

      toast.success(`${upgrade.name} installed!`)
      onUpgrade?.()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUpgrading(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            House Upgrades
          </h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        <div className="space-y-2">
          {UPGRADES.map(upgrade => (
            <div 
              key={upgrade.id}
              className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
            >
              <div>
                <p className="text-white font-medium">{upgrade.name}</p>
                <p className="text-gray-400 text-xs">+{upgrade.condition_bonus}% condition</p>
              </div>
              <Button
                size="sm"
                onClick={() => handleUpgrade(upgrade)}
                disabled={upgrading === upgrade.id}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                {upgrading === upgrade.id ? '...' : `${upgrade.cost} TC`}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface HouseRaidButtonProps {
  broadcasterId: string
  onRaided?: () => void
}

export function HouseRaidButton({ broadcasterId, onRaided }: HouseRaidButtonProps) {
  const { user, profile } = useAuthStore()
  const [raiding, setRaiding] = useState(false)

  const handleRaid = async () => {
    if (!user?.id) return

    const isStaff = profile?.is_admin || profile?.is_troll_officer || profile?.role === 'admin'
    if (isStaff) {
      toast.error('Staff cannot raid houses')
      return
    }

    if ((profile?.troll_coins || 0) < 100) {
      toast.error('Need 100 Troll Coins to raid')
      return
    }

    setRaiding(true)
    try {
      await supabase.rpc('deduct_coins', { amount: 100 })

      const { data: house } = await supabase
        .from('houses')
        .select('id')
        .eq('owner_user_id', broadcasterId)
        .maybeSingle()

      if (house) {
        await supabase.from('house_raids').insert({
          house_id: house.id,
          raided_by_user_id: user.id,
          damage_level: 'minor'
        })

        await supabase.rpc('update_house_condition', { 
          house_id: house.id, 
          condition_change: -10 
        })
      }

      toast.success('House raided! ⚔️')
      onRaided?.()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setRaiding(false)
    }
  }

  return (
    <Button
      onClick={handleRaid}
      disabled={raiding}
      size="sm"
      variant="destructive"
      className="bg-red-600 hover:bg-red-700"
    >
      <Hammer className="w-4 h-4 mr-1" />
      {raiding ? 'Raiding...' : 'Raid (100 TC)'}
    </Button>
  )
}

interface RepairHouseButtonProps {
  houseId: string
  onRepaired?: () => void
}

export function RepairHouseButton({ houseId, onRepaired }: RepairHouseButtonProps) {
  const { user, profile } = useAuthStore()
  const [repairing, setRepairing] = useState(false)
  const [house, setHouse] = useState<{ condition: number } | null>(null)

  // Fetch house condition to compute dynamic repair cost: 100 TC per 5% restored
  useEffect(() => {
    if (!houseId) return
    supabase
      .from('houses')
      .select('condition')
      .eq('id', houseId)
      .maybeSingle()
      .then(({ data }) => setHouse(data))
  }, [houseId])

  const conditionDeficit = house ? (100 - (house.condition || 0)) : 0
  const repairUnits = Math.ceil(conditionDeficit / 5)
  const repairCost = repairUnits > 0 ? repairUnits * 100 : 100

  const handleRepair = async () => {
    if (!user?.id || !houseId) return

    if ((profile?.troll_coins || 0) < repairCost) {
      toast.error(`Need ${repairCost} Troll Coins to repair`)
      return
    }

    setRepairing(true)
    try {
      await supabase.rpc('deduct_coins', { amount: repairCost })

      await supabase
        .from('house_raids')
        .update({ repaired_at: new Date().toISOString() })
        .eq('house_id', houseId)
        .is('repaired_at', null)

      await supabase.rpc('update_house_condition', {
        house_id: houseId,
        condition_change: 100
      })

      toast.success('House repaired! ✅')
      onRepaired?.()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setRepairing(false)
    }
  }

  return (
    <Button
      onClick={handleRepair}
      disabled={repairing}
      size="sm"
      className="bg-green-600 hover:bg-green-700"
    >
      <Wrench className="w-4 h-4 mr-1" />
      {repairing ? 'Repairing...' : `Repair (${repairCost} TC)`}
    </Button>
  )
}