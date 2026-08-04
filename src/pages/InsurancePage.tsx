import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  Check,
  ChevronRight,
  Coins,
  Home,
  Loader2,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { runStandardPurchaseFlow } from '../lib/purchases'

type InsurancePlan = {
  id: string
  name: string
  cost: number
  duration: number
  deductible?: number
  label: string
  highlight?: string
}

type InsuranceType = {
   id: 'homeowners' | 'car' | 'broadcast' | 'kick' | 'jail'
   name: string
   shortName: string
   icon: React.ElementType
   description: string
   protection: string[]
   accent: string
   glow: string
   plans: InsurancePlan[]
 }

const INSURANCE_TYPES: InsuranceType[] = [
  {
    id: 'homeowners',
    name: 'Homeowners Insurance',
    shortName: 'Home',
    icon: Home,
    description: 'Protect your Mai Troll property from raids, damage, and city chaos.',
    protection: ['Raid protection', 'Damage coverage', 'Property recovery support'],
    accent: 'from-cyan-300 to-blue-500',
    glow: 'shadow-cyan-500/20',
    plans: [
      { id: 'home_basic', name: 'Basic Week', cost: 500, duration: 168, deductible: 25, label: '7 days' },
      { id: 'home_month', name: 'Premium Month', cost: 1500, duration: 720, deductible: 25, label: '30 days', highlight: 'Best value' }
    ]
  },
  {
    id: 'car',
    name: 'Car Insurance',
    shortName: 'Car',
    icon: Car,
    description: 'Protect your vehicle from vandalism, city disputes, and raid damage.',
    protection: ['Vehicle protection', 'Vandalism coverage', 'Repair support'],
    accent: 'from-emerald-300 to-cyan-500',
    glow: 'shadow-emerald-500/20',
    plans: [
      { id: 'car_basic', name: 'Basic Week', cost: 400, duration: 168, deductible: 50, label: '7 days' },
      { id: 'car_month', name: 'Premium Month', cost: 1200, duration: 720, deductible: 50, label: '30 days', highlight: 'Best value' }
    ]
  },
  {
    id: 'broadcast',
    name: 'Broadcast Insurance',
    shortName: 'Broadcast',
    icon: Radio,
    description: 'Full stream protection for creators who want kick and ban coverage together.',
    protection: ['Kick protection', 'Ban protection', 'Full broadcast coverage'],
    accent: 'from-fuchsia-300 to-purple-500',
    glow: 'shadow-fuchsia-500/20',
    plans: [
      { id: 'broadcast_week', name: 'Weekly Shield', cost: 800, duration: 168, label: '7 days' },
      { id: 'broadcast_month', name: 'Monthly Shield', cost: 2500, duration: 720, label: '30 days', highlight: 'Full coverage' }
    ]
  },
  {
    id: 'kick',
    name: 'Kick Insurance',
    shortName: 'Kick',
    icon: Zap,
    description: 'Prevents stream kicks while your protection is active.',
    protection: ['Kick prevention', 'Stream stability', 'Creator protection'],
    accent: 'from-yellow-300 to-orange-500',
    glow: 'shadow-yellow-500/20',
    plans: [
      { id: 'kick_week', name: 'Weekly Guard', cost: 500, duration: 168, label: '7 days' },
      { id: 'kick_month', name: 'Monthly Guard', cost: 1500, duration: 720, label: '30 days', highlight: 'Popular' }
    ]
  },
   {
     id: 'jail',
     name: 'Jail Insurance',
     shortName: 'Jail',
     icon: Shield,
     description: 'Adds jail protection during broadcasts where eligible.',
     protection: ['Jail protection', 'Creator safety', 'Broadcast defense'],
     accent: 'from-rose-300 to-fuchsia-500',
     glow: 'shadow-rose-500/20',
      plans: [
        { id: 'jail_week', name: 'Weekly Defense', cost: 5000, duration: 168, label: '7 days' },
        { id: 'jail_month', name: 'Premium Defense', cost: 15000, duration: 168, label: '7 days', highlight: 'Maximum defense' }
      ]
   }
]

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

function isValidFutureDate(value: string | null | undefined) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date > new Date()
}

function formatExpiry(expiry: string | null | undefined) {
  if (!expiry) return 'Not active'

  const date = new Date(expiry)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return `Expires ${date.toLocaleDateString()}`
}

function getProtectionType(type: InsuranceType['id']) {
  if (type === 'broadcast') return 'full'
  return type
}

export default function InsurancePage() {
  const { user, profile } = useAuthStore()
  const [activeInsurance, setActiveInsurance] = useState<Record<string, any>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<InsuranceType['id']>('homeowners')

  const selectedInsurance = useMemo(
    () => INSURANCE_TYPES.find((item) => item.id === selectedType) || INSURANCE_TYPES[0],
    [selectedType]
  )

const activeCount = useMemo(
     () => ['homeowners', 'car', 'broadcast', 'kick', 'jail'].filter((key) => activeInsurance[key]).length,
     [activeInsurance]
   )

  const checkActiveInsurance = useCallback(async () => {
    if (!user?.id) return

    try {
      const active: Record<string, any> = {}

      if (isValidFutureDate(profile?.homeowners_insurance_expiry)) {
        active.homeowners = {
          expiry: profile?.homeowners_insurance_expiry,
          deductible: profile?.homeowners_insurance_deductible
        }
      }

      if (isValidFutureDate(profile?.car_insurance_expiry)) {
        active.car = {
          expiry: profile?.car_insurance_expiry,
          deductible: profile?.car_insurance_deductible
        }
      }

      if (isValidFutureDate(profile?.broadcast_insurance_expiry)) {
         active.broadcast = {
           expiry: profile?.broadcast_insurance_expiry,
           protection_type: 'full'
         }
         active.kick = {
           expiry: profile?.broadcast_insurance_expiry,
           protection_type: 'full'
         }
         active.jail = {
           expiry: profile?.broadcast_insurance_expiry,
           protection_type: 'full'
         }
       }

      const { data: liveProtections, error } = await supabase
        .from('user_insurances')
        .select('id, protection_type, expires_at, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())

      if (error) throw error

        liveProtections?.forEach((policy: any) => {
          if (!isValidFutureDate(policy.expires_at)) return

          if (policy.protection_type === 'full') {
            active.broadcast = { expiry: policy.expires_at, protection_type: 'full' }
            active.kick = { expiry: policy.expires_at, protection_type: 'full' }
            active.jail = { expiry: policy.expires_at, protection_type: 'full' }
          }

          if (policy.protection_type === 'kick') {
            active.kick = { expiry: policy.expires_at, protection_type: 'kick' }
          }

          if (policy.protection_type === 'jail') {
            active.jail = { expiry: policy.expires_at, protection_type: 'jail' }
          }
        })

      setActiveInsurance(active)
    } catch (error) {
      console.error('Error checking active insurance:', error)
      setActiveInsurance({})
    }
  }, [user?.id, profile])

  useEffect(() => {
    checkActiveInsurance()
  }, [checkActiveInsurance])

  const purchaseInsurance = async (
    type: InsuranceType['id'],
    plan: InsurancePlan
  ): Promise<{ success: boolean; error?: string; expiresAt?: string }> => {
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single()

      if (profileError || !userProfile) {
        return { success: false, error: 'User profile not found' }
      }

      if (Number(userProfile.troll_coins || 0) < plan.cost) {
        return { success: false, error: 'Not enough Troll Coins' }
      }

      const now = new Date()
      const expiryDate = new Date(now.getTime() + plan.duration * 60 * 60 * 1000)

      const purchaseResult = await runStandardPurchaseFlow({
        userId: user.id,
        amount: plan.cost,
        transactionType: 'insurance_purchase',
        description: `Purchased ${type} insurance`,
        metadata: {
          insurance_type: type,
          plan_id: plan.id,
          duration_hours: plan.duration,
          deductible: plan.deductible || null
        },
        ensureOwnership: async (client) => {
          if (type === 'homeowners' || type === 'car') {
            const profileField =
              type === 'homeowners'
                ? 'homeowners_insurance_expiry'
                : 'car_insurance_expiry'

            const deductibleField =
              type === 'homeowners'
                ? 'homeowners_insurance_deductible'
                : 'car_insurance_deductible'

            const currentExpiryRaw =
              type === 'homeowners'
                ? profile?.homeowners_insurance_expiry
                : profile?.car_insurance_expiry

            const baseExpiry = isValidFutureDate(currentExpiryRaw)
              ? new Date(currentExpiryRaw as string)
              : now

            const extendedExpiryDate = new Date(
              baseExpiry.getTime() + plan.duration * 60 * 60 * 1000
            )

            const { error: profileUpdateError } = await client
              .from('user_profiles')
              .update({
                [profileField]: extendedExpiryDate.toISOString(),
                [deductibleField]: plan.deductible || null
              })
              .eq('id', user.id)

            if (profileUpdateError) throw profileUpdateError

            const { data: existing, error: existingError } = await client
              .from('user_insurance_policies')
              .select('id, duration_hours, expires_at')
              .eq('user_id', user.id)
              .eq('policy_type', type)
              .eq('is_active', true)
              .maybeSingle()

            if (existingError) throw existingError

            if (existing) {
              const { error: updateError } = await client
                .from('user_insurance_policies')
                .update({
                  expires_at: extendedExpiryDate.toISOString(),
                  duration_hours: Number(existing.duration_hours || 0) + plan.duration,
                  deductible: plan.deductible || null,
                  cost_paid: plan.cost,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)

              if (updateError) throw updateError
            } else {
              const { error: insertError } = await client
                .from('user_insurance_policies')
                .insert({
                  user_id: user.id,
                  policy_type: type,
                  duration_hours: plan.duration,
                  deductible: plan.deductible || null,
                  cost_paid: plan.cost,
                  purchased_at: now.toISOString(),
                  expires_at: extendedExpiryDate.toISOString(),
                  is_active: true,
                  claims_made: 0
                })

              if (insertError) throw insertError
            }

            return { success: true }
          }

          const protectionType = getProtectionType(type)

          const { data: existingIns, error: existingInsError } = await client
            .from('user_insurances')
            .select('id, expires_at')
            .eq('user_id', user.id)
            .eq('protection_type', protectionType)
            .eq('is_active', true)
            .gt('expires_at', now.toISOString())
            .maybeSingle()

          if (existingInsError) throw existingInsError

          if (existingIns) {
            const baseExpiry = isValidFutureDate(existingIns.expires_at)
              ? new Date(existingIns.expires_at)
              : now

            const newExpiry = new Date(
              baseExpiry.getTime() + plan.duration * 60 * 60 * 1000
            )

            const { error: updateError } = await client
              .from('user_insurances')
              .update({
                expires_at: newExpiry.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', existingIns.id)

            if (updateError) throw updateError
          } else {
            const { error: insertError } = await client
              .from('user_insurances')
              .insert({
                user_id: user.id,
                insurance_id: plan.id,
                protection_type: protectionType,
                purchased_at: now.toISOString(),
                expires_at: expiryDate.toISOString(),
                is_active: true
              })

            if (insertError) throw insertError
          }

          return { success: true }
        }
      })

      if (!purchaseResult.success) {
        return {
          success: false,
          error: purchaseResult.error || 'Purchase failed'
        }
      }

      return {
        success: true,
        expiresAt: expiryDate.toISOString()
      }
    } catch (error: any) {
      console.error(`${type} insurance purchase error:`, error)
      return { success: false, error: error?.message || 'Purchase failed' }
    }
  }

  const handlePurchase = async (type: InsuranceType['id'], plan: InsurancePlan) => {
    if (!user?.id) {
      toast.error('Please sign in first')
      return
    }

    const key = `${type}:${plan.id}`
    setLoadingKey(key)

    try {
      const result = await purchaseInsurance(type, plan)

      if (!result.success) {
        toast.error(result.error || 'Purchase failed')
        return
      }

      toast.success(`${plan.name} purchased successfully`)
      await checkActiveInsurance()
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.2),transparent_30%),linear-gradient(135deg,#020617_0%,#07111f_48%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] bg-[size:44px_44px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <header className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-[0_0_50px_rgba(34,211,238,0.16)] backdrop-blur-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.35)]">
                <ShieldCheck className="h-9 w-9 text-cyan-100" />
                <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-fuchsia-300" />
              </div>

              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                  Mai Troll Coverage
                </div>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Insurance Center
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-cyan-100/70">
                  Protect your house, car, and broadcast life with premium Mai Troll coverage.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-100/60">
                  Balance
                </p>
                <p className="mt-1 font-mono text-2xl font-black text-yellow-200">
                  {formatCoins(profile?.troll_coins)} TC
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/60">
                  Active
                </p>
                <p className="mt-1 font-mono text-2xl font-black text-emerald-100">
                  {activeCount}/5
                </p>
              </div>

              <div className="col-span-2 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10 p-4 sm:col-span-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100/60">
                  Status
                </p>
                <p className="mt-1 text-sm font-black text-fuchsia-50">
                  {activeCount > 0 ? 'Protected' : 'No Active Coverage'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {INSURANCE_TYPES.map((item) => {
            const Icon = item.icon
            const isActive = Boolean(activeInsurance[item.id])
            const isSelected = selectedType === item.id

            return (
              <button
                key={item.id}
                onClick={() => setSelectedType(item.id)}
                className={`group rounded-3xl border p-4 text-left backdrop-blur-2xl transition ${
                  isSelected
                    ? 'border-cyan-200 bg-cyan-300/15 shadow-[0_0_34px_rgba(34,211,238,0.22)]'
                    : 'border-cyan-300/15 bg-slate-950/60 hover:border-cyan-300/35 hover:bg-slate-900/80'
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-slate-950 shadow-lg ${item.glow}`}>
                    <Icon className="h-6 w-6" />
                  </div>

                  {isActive ? (
                    <BadgeCheck className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-slate-500" />
                  )}
                </div>

                <p className="font-black text-white">{item.shortName}</p>
                <p className={`mt-1 text-xs ${isActive ? 'text-emerald-200' : 'text-slate-400'}`}>
                  {isActive ? formatExpiry(activeInsurance[item.id]?.expiry) : 'Not active'}
                </p>
              </button>
            )
          })}
        </section>

        <main className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[390px_1fr]">
          <aside className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
            <div className="mb-5 flex items-start gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${selectedInsurance.accent} text-slate-950 shadow-xl ${selectedInsurance.glow}`}>
                <selectedInsurance.icon className="h-9 w-9" />
              </div>

              <div>
                <h2 className="text-2xl font-black">{selectedInsurance.name}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedInsurance.description}</p>
              </div>
            </div>

            <div className="mb-5 rounded-3xl border border-cyan-300/15 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">Coverage Status</span>
                {activeInsurance[selectedInsurance.id] ? (
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-black text-slate-400">
                    Inactive
                  </span>
                )}
              </div>

              <p className="font-mono text-sm text-cyan-100">
                {formatExpiry(activeInsurance[selectedInsurance.id]?.expiry)}
              </p>

              {activeInsurance[selectedInsurance.id]?.deductible && (
                <p className="mt-2 text-xs text-slate-400">
                  Deductible: {activeInsurance[selectedInsurance.id].deductible} TC
                </p>
              )}
            </div>

            <div className="space-y-3">
              {selectedInsurance.protection.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-cyan-300/10 bg-white/[0.03] px-4 py-3"
                >
                  <Check className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm font-medium text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(168,85,247,0.12)] backdrop-blur-2xl">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Choose Your Plan</h2>
                <p className="text-sm text-slate-400">
                  Buying again extends active coverage instead of replacing it.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {selectedInsurance.plans.map((plan) => {
                const loading = loadingKey === `${selectedInsurance.id}:${plan.id}`

                return (
                  <button
                    key={plan.id}
                    onClick={() => handlePurchase(selectedInsurance.id, plan)}
                    disabled={loading}
                    className="group relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-900/70 p-5 text-left transition hover:border-cyan-200/50 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${selectedInsurance.accent}`} />

                    {plan.highlight && (
                      <div className="mb-4 inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-fuchsia-100">
                        {plan.highlight}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-black text-white">{plan.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{plan.label} coverage</p>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 font-mono text-2xl font-black text-yellow-200">
                          <Coins className="h-5 w-5" />
                          {formatCoins(plan.cost)}
                        </div>
                        <p className="text-xs text-yellow-100/55">Troll Coins</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/70 px-4 py-3">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Duration</p>
                        <p className="mt-1 font-bold text-cyan-100">{Math.round(plan.duration / 24)} days</p>
                      </div>

                      <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/70 px-4 py-3">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Deductible</p>
                        <p className="mt-1 font-bold text-cyan-100">
                          {plan.deductible ? `${plan.deductible} TC` : 'None'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-4 py-3 text-cyan-100">
                      <span className="text-sm font-black">
                        {activeInsurance[selectedInsurance.id] ? 'Extend coverage' : 'Purchase coverage'}
                      </span>

                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ChevronRight className="h-5 w-5 transition group-hover:translate-x-1" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}