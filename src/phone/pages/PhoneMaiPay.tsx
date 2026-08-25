import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Coins,
  Crown,
  CreditCard,
  DollarSign,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Search,
  Send,
  User,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Building,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import {
  CASHOUT_TIERS as TIERS,
  type CashoutTier,
} from '../../config/coinConfig'
import type {
  CashoutRequest,
  PayoutMethod,
} from '../../types/cashout'

import FastPayProgram from '../../components/FastPayProgram'
import FastPayApplication from '../../pages/FastPayApplication'
import { WeeklyCashbackCard } from '../../components/supporter-economy/WeeklyCashbackCard'

interface GiftedUser {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  total_coins: number
  gift_count: number
}

interface RedemptionRecord {
  id: string
  user_id: string
  reward_type: 'troll_coins' | 'gift_card'
  crowns_redeemed: number
  reward_value: string
  status:
    | 'pending'
    | 'approved'
    | 'fulfilled'
    | 'rejected'
    | 'cancelled'
  giftcard_code: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface CoinTransaction {
  id: string
  type: string
  amount: number
  description: string | null
  created_at: string
  metadata: any
}

type MaiPayTab =
  | 'overview'
  | 'application'
  | 'crowns'
  | 'gifted'
  | 'cashout'
  | 'requests'
  | 'transactions'

interface PayoutProvider {
  value: PayoutMethod | 'ach'
  label: string
  icon: React.ReactNode
}

const PAYOUT_PROVIDERS: PayoutProvider[] = [
  {
    value: 'cash_app',
    label: 'Cash App',
    icon: <Building size={18} />,
  },
  {
    value: 'paypal',
    label: 'PayPal',
    icon: <Wallet size={18} />,
  },
  {
    value: 'venmo',
    label: 'Venmo',
    icon: <User size={18} />,
  },
  {
    value: 'ach',
    label: 'Bank',
    icon: <CreditCard size={18} />,
  },
]

const tabs: {
  key: MaiPayTab
  label: string
  icon: React.ReactNode
}[] = [
  {
    key: 'overview',
    label: 'Home',
    icon: <Wallet size={17} />,
  },
  {
    key: 'cashout',
    label: 'Cash Out',
    icon: <DollarSign size={17} />,
  },
  {
    key: 'requests',
    label: 'Requests',
    icon: <FileText size={17} />,
  },
  {
    key: 'transactions',
    label: 'History',
    icon: <History size={17} />,
  },
]

export default function PhoneMaiPay() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [activeTab, setActiveTab] = useState<MaiPayTab>('overview')
  const [loading, setLoading] = useState(true)

  const [trollCoins, setTrollCoins] = useState(0)
  const [hypeCoins, setHypeCoins] = useState(0)
  const [battleCrowns, setBattleCrowns] = useState(0)

  const [crownConvertAmount, setCrownConvertAmount] = useState('')
  const [crownConverting, setCrownConverting] = useState(false)

  const [giftedUsers, setGiftedUsers] = useState<GiftedUser[]>([])
  const [giftedLoading, setGiftedLoading] = useState(false)
  const [giftedSearchOpen, setGiftedSearchOpen] = useState(false)
  const [giftedSearch, setGiftedSearch] = useState('')

  const [selectedTier, setSelectedTier] =
    useState<CashoutTier | null>(null)

  const [selectedProvider, setSelectedProvider] =
    useState<PayoutMethod | 'ach'>('paypal')

  const [providerUsername, setProviderUsername] = useState('')

  const [achBankName, setAchBankName] = useState('')
  const [achRoutingNumber, setAchRoutingNumber] = useState('')
  const [achAccountNumber, setAchAccountNumber] = useState('')

  const [submittingCashout, setSubmittingCashout] = useState(false)

  const [cashoutRequests, setCashoutRequests] =
    useState<CashoutRequest[]>([])

  const [successfulCashoutsLast24Hours, setSuccessfulCashoutsLast24Hours] =
    useState(0)

  const [nextCashoutAvailableAt, setNextCashoutAvailableAt] =
    useState<string | null>(null)

  const [transactions, setTransactions] =
    useState<CoinTransaction[]>([])

  const [transactionsLoading, setTransactionsLoading] =
    useState(false)

  const [txFilter, setTxFilter] = useState('all')

  const [crownRedemptions, setCrownRedemptions] =
    useState<RedemptionRecord[]>([])

  const [showMore, setShowMore] = useState(false)

  const cashoutTiers = useMemo<CashoutTier[]>(
    () => TIERS.map((tier) => ({ ...tier } as CashoutTier)),
    [],
  )

  const eligibleCashoutCoins = trollCoins
  const canConvertHype = hypeCoins > 0

  const hasFeeProvider =
    selectedProvider === 'venmo' ||
    selectedProvider === 'cash_app'

  const isPayPalProvider = selectedProvider === 'paypal'

  const feeCoins = selectedTier
    ? hasFeeProvider
      ? Math.round(selectedTier.coins * 0.05)
      : isPayPalProvider
        ? 50
        : 0
    : 0

  const totalCoinsNeeded = selectedTier
    ? selectedTier.coins + feeCoins
    : 0

  const providerIsValid =
    selectedProvider === 'ach'
      ? achBankName.trim().length > 0 &&
        achRoutingNumber.trim().length >= 9 &&
        achAccountNumber.trim().length > 0
      : providerUsername.trim().length > 0

  const dailyLimitReached =
    successfulCashoutsLast24Hours >= 1

  const canRequestCashout =
    !!selectedTier &&
    !dailyLimitReached &&
    eligibleCashoutCoins >= totalCoinsNeeded &&
    providerIsValid

  const filteredGiftedUsers = useMemo(() => {
    if (!giftedSearch.trim()) {
      return giftedUsers
    }

    const q = giftedSearch.toLowerCase()

    return giftedUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.display_name &&
          u.display_name.toLowerCase().includes(q)),
    )
  }, [giftedUsers, giftedSearch])

  const loadAllData = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(
          `
          troll_coins,
          hype_coins,
          battle_crowns,
          paypal_email,
          cashapp_handle,
          venmo_handle,
          preferred_payout_method
        `,
        )
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setTrollCoins(Number(data.troll_coins ?? 0))
        setHypeCoins(Number(data.hype_coins ?? 0))
        setBattleCrowns(Number(data.battle_crowns ?? 0))

        const preferred =
          data.preferred_payout_method as
            | PayoutMethod
            | null

        if (preferred) {
          setSelectedProvider(preferred)
        }

        if (data.paypal_email) {
          setProviderUsername(data.paypal_email)
        } else if (data.cashapp_handle) {
          setProviderUsername(data.cashapp_handle)
        } else if (data.venmo_handle) {
          setProviderUsername(data.venmo_handle)
        }
      }
    } catch (error) {
      console.error('[PhoneMaiPay] Failed loading profile:', error)
      toast.error('Unable to load MAI Pay')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const loadCashoutLimit = useCallback(async () => {
    if (!user?.id) return

    try {
      const since = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString()

      const { data, error } = await supabase
        .from('payout_requests')
        .select('created_at')
        .eq('user_id', user.id)
        .in('status', [
          'approved',
          'paid',
          'completed',
        ])
        .gte('created_at', since)
        .order('created_at', {
          ascending: true,
        })

      if (error) throw error

      const rows = (data ?? []) as {
        created_at: string
      }[]

      setSuccessfulCashoutsLast24Hours(rows.length)

      if (rows.length > 0) {
        const next =
          new Date(rows[0].created_at).getTime() +
          24 * 60 * 60 * 1000

        setNextCashoutAvailableAt(
          new Date(next).toISOString(),
        )
      } else {
        setNextCashoutAvailableAt(null)
      }
    } catch (error) {
      console.error(
        '[PhoneMaiPay] Cashout limit error:',
        error,
      )
    }
  }, [user?.id])

  const loadCashoutRequests = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false,
        })

      if (error) throw error

      setCashoutRequests(
        (data ?? []) as CashoutRequest[],
      )
    } catch (error) {
      console.error(
        '[PhoneMaiPay] Request loading error:',
        error,
      )
    }
  }, [user?.id])

  const loadTransactions = useCallback(async () => {
    if (!user?.id) return

    setTransactionsLoading(true)

    try {
      const { data, error } = await supabase
        .from('coin_transactions')
        .select(
          'id,type,amount,description,created_at,metadata',
        )
        .eq('user_id', user.id)
        .order('created_at', {
          ascending: false,
        })
        .limit(100)

      if (error) throw error

      setTransactions(
        (data ?? []) as CoinTransaction[],
      )
    } catch (error) {
      console.error(
        '[PhoneMaiPay] Transaction loading error:',
        error,
      )
    } finally {
      setTransactionsLoading(false)
    }
  }, [user?.id])

  const loadGiftedUsers = useCallback(async () => {
    if (!user?.id) return

    setGiftedLoading(true)

    try {
      const { data, error } = await supabase
        .from('coin_transactions')
        .select(
          'receiver_id,amount,metadata',
        )
        .eq('user_id', user.id)
        .eq('type', 'gift_sent')
        .gt('amount', 0)

      if (error) throw error

      const totals = new Map<string, number>()
      const counts = new Map<string, number>()

      ;(data ?? []).forEach((row: any) => {
        if (!row.receiver_id) return

        totals.set(
          row.receiver_id,
          (totals.get(row.receiver_id) ?? 0) +
            Number(row.amount ?? 0),
        )

        counts.set(
          row.receiver_id,
          (counts.get(row.receiver_id) ?? 0) + 1,
        )
      })

      const receiverIds = Array.from(totals.keys())

      if (receiverIds.length === 0) {
        setGiftedUsers([])
        return
      }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select(
          'id,username,display_name,avatar_url',
        )
        .in('id', receiverIds)

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [
          p.id,
          p,
        ]),
      )

      const users = receiverIds
        .map((id) => {
          const profile = profileMap.get(id)

          return {
            user_id: id,
            username:
              profile?.username ?? 'Unknown',
            display_name:
              profile?.display_name ?? null,
            avatar_url:
              profile?.avatar_url ?? null,
            total_coins:
              totals.get(id) ?? 0,
            gift_count:
              counts.get(id) ?? 0,
          }
        })
        .sort(
          (a, b) =>
            b.total_coins - a.total_coins,
        )

      setGiftedUsers(users)
    } catch (error) {
      console.error(
        '[PhoneMaiPay] Gifted users error:',
        error,
      )
    } finally {
      setGiftedLoading(false)
    }
  }, [user?.id])

  const loadCrownRedemptions =
    useCallback(async () => {
      if (!user?.id) return

      try {
        const { data, error } = await supabase
          .from('redemptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', {
            ascending: false,
          })

        if (error) {
          console.warn(
            '[PhoneMaiPay] Crown history unavailable:',
            error.message,
          )
          return
        }

        setCrownRedemptions(
          (data ?? []) as RedemptionRecord[],
        )
      } catch (error) {
        console.warn(
          '[PhoneMaiPay] Crown history error:',
          error,
        )
      }
    }, [user?.id])

  useEffect(() => {
    loadAllData()
    loadCashoutLimit()
    loadCashoutRequests()
    loadTransactions()
    loadCrownRedemptions()
  }, [
    loadAllData,
    loadCashoutLimit,
    loadCashoutRequests,
    loadTransactions,
    loadCrownRedemptions,
  ])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`phone-mai-pay-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any

          setTrollCoins(
            Number(row.troll_coins ?? 0),
          )

          setHypeCoins(
            Number(row.hype_coins ?? 0),
          )

          setBattleCrowns(
            Number(row.battle_crowns ?? 0),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const handleRefresh = async () => {
    await Promise.all([
      loadAllData(),
      loadCashoutLimit(),
      loadCashoutRequests(),
      loadTransactions(),
    ])

    toast.success('MAI Pay refreshed')
  }

  const handleConvertHype = async () => {
    if (!user?.id || hypeCoins <= 0) return

    try {
      const { data, error } =
        await supabase.rpc(
          'convert_hype_to_troll_coins',
          {
            p_user_id: user.id,
            p_amount: hypeCoins,
          },
        )

      if (error) throw error

      if (data?.success === false) {
        throw new Error(
          data?.error ||
            'Conversion failed',
        )
      }

      toast.success(
        `Converted ${hypeCoins.toLocaleString()} Hype Coins to Troll Coins`,
      )

      await loadAllData()
      await loadTransactions()
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Hype coin conversion is unavailable',
      )
    }
  }

  const handleConvertCrowns = async () => {
    if (!user?.id) return

    const amount = parseInt(
      crownConvertAmount,
      10,
    )

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid crown amount')
      return
    }

    if (amount > battleCrowns) {
      toast.error('Not enough Battle Crowns')
      return
    }

    setCrownConverting(true)

    try {
      const { data, error } =
        await supabase.rpc(
          'redeem_crowns_for_coins',
          {
            p_user_id: user.id,
            p_crowns: amount,
          },
        )

      if (error) throw error

      if (data?.success === false) {
        throw new Error(
          data?.error ||
            'Crown conversion failed',
        )
      }

      toast.success(
        `Converted ${amount.toLocaleString()} Crowns to Troll Coins`,
      )

      setCrownConvertAmount('')

      await loadAllData()
      await loadTransactions()
      await loadCrownRedemptions()
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Failed to convert crowns',
      )
    } finally {
      setCrownConverting(false)
    }
  }

  const handleRequestCashout = async () => {
    if (!user?.id || !selectedTier) return

    if (dailyLimitReached) {
      toast.error(
        'You can only complete one cashout every 24 hours.',
      )
      return
    }

    if (!providerIsValid) {
      toast.error(
        selectedProvider === 'ach'
          ? 'Complete all bank details.'
          : 'Enter your payout details.',
      )
      return
    }

    if (eligibleCashoutCoins < totalCoinsNeeded) {
      toast.error('Insufficient Troll Coins')
      return
    }

    setSubmittingCashout(true)

    try {
      let providerDetails =
        providerUsername.trim()

      if (selectedProvider === 'ach') {
        providerDetails = JSON.stringify({
          bank_name:
            achBankName.trim(),
          routing_number:
            achRoutingNumber.trim(),
          account_number:
            achAccountNumber.trim(),
        })
      }

      const { data, error } =
        await supabase.rpc(
          'request_cashout',
          {
            p_user_id: user.id,
            p_coins_to_redeem:
              selectedTier.coins,
            p_provider_type:
              selectedProvider,
            p_provider_username:
              providerDetails,
            p_user_tag: null,
            p_id_verification_url: null,
          },
        )

      if (error) throw error

      if (data?.success === false) {
        throw new Error(
          data?.error ||
            'Cashout request failed',
        )
      }

      toast.success(
        `Cashout submitted for $${selectedTier.usd.toFixed(2)}`,
      )

      setSelectedTier(null)
      setProviderUsername('')
      setAchBankName('')
      setAchRoutingNumber('')
      setAchAccountNumber('')

      await loadAllData()
      await loadCashoutLimit()
      await loadCashoutRequests()
      await loadTransactions()

      setActiveTab('requests')
    } catch (error: any) {
      toast.error(
        error?.message ||
          'Failed to submit cashout',
      )
    } finally {
      setSubmittingCashout(false)
    }
  }

  const getStatusClass = (
    status: string,
  ) => {
    switch (status) {
      case 'approved':
      case 'fulfilled':
      case 'completed':
      case 'paid':
        return 'border-green-400/20 bg-green-400/10 text-green-400'

      case 'processing':
        return 'border-cyan-400/20 bg-cyan-400/10 text-cyan-400'

      case 'rejected':
      case 'denied':
      case 'cancelled':
        return 'border-red-400/20 bg-red-400/10 text-red-400'

      default:
        return 'border-yellow-400/20 bg-yellow-400/10 text-yellow-400'
    }
  }

  const getStatusIcon = (
    status: string,
  ) => {
    switch (status) {
      case 'approved':
      case 'fulfilled':
      case 'completed':
      case 'paid':
        return <CheckCircle size={14} />

      case 'processing':
        return (
          <Loader2
            size={14}
            className="animate-spin"
          />
        )

      case 'rejected':
      case 'denied':
      case 'cancelled':
        return <XCircle size={14} />

      default:
        return <Clock size={14} />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070611] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-[#00BFFF]/30 bg-[#00BFFF]/10 shadow-[0_0_35px_rgba(0,191,255,0.18)]">
            <Loader2
              size={28}
              className="animate-spin text-[#00BFFF]"
            />
          </div>

          <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
            MAI Pay
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Loading your wallet...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#070611] text-white pb-24">
      {/* Ambient neon */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#00BFFF]/10 blur-[100px]" />
        <div className="absolute -right-24 top-96 h-72 w-72 rounded-full bg-[#BF00FF]/10 blur-[110px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070611]/90 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white active:scale-95"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              MAI Pay
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Your Troll Wallet
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 text-[#BF00FF] active:scale-95"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <main className="relative z-10 space-y-4 px-4 py-4">
        {/* Main Balance */}
        <section className="relative overflow-hidden rounded-[28px] border border-[#BF00FF]/25 bg-gradient-to-br from-[#160821] via-[#0D0B19] to-[#041521] p-5 shadow-[0_0_35px_rgba(191,0,255,0.08)]">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#BF00FF]/20 blur-[65px]" />
          <div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-[#00BFFF]/10 blur-[60px]" />

          <div className="relative">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00BFFF]/25 bg-[#00BFFF]/10">
                <Wallet
                  size={23}
                  className="text-[#00BFFF]"
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Total Troll Coins
                </p>
                <p className="text-3xl font-black tracking-tight">
                  {trollCoins.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 p-3">
                <div className="flex items-center gap-2">
                  <Coins
                    size={15}
                    className="text-[#00BFFF]"
                  />
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    Troll
                  </span>
                </div>
                <p className="mt-1 text-sm font-black text-[#00BFFF]">
                  {trollCoins.toLocaleString()}
                </p>
              </div>

              <div className="rounded-2xl border border-[#BF00FF]/15 bg-[#BF00FF]/5 p-3">
                <div className="flex items-center gap-2">
                  <Coins
                    size={15}
                    className="text-[#BF00FF]"
                  />
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    Hype
                  </span>
                </div>
                <p className="mt-1 text-sm font-black text-[#BF00FF]">
                  {hypeCoins.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Primary navigation */}
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setActiveTab(tab.key)
              }
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border py-3 transition-all active:scale-95 ${
                activeTab === tab.key
                  ? 'border-[#00BFFF]/40 bg-gradient-to-b from-[#00BFFF]/15 to-[#BF00FF]/10 text-white shadow-[0_0_18px_rgba(0,191,255,0.08)]'
                  : 'border-white/5 bg-white/[0.025] text-zinc-500'
              }`}
            >
              {tab.icon}
              <span className="text-[9px] font-black uppercase tracking-wide">
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <>
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-[#00BFFF]/15 bg-[#0C0A17] p-4">
                <Coins
                  size={20}
                  className="mb-3 text-[#00BFFF]"
                />
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Troll Coins
                </p>
                <p className="mt-1 text-xl font-black">
                  {trollCoins.toLocaleString()}
                </p>
              </div>

              <div className="rounded-3xl border border-[#BF00FF]/15 bg-[#0C0A17] p-4">
                <DollarSign
                  size={20}
                  className="mb-3 text-green-400"
                />
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Cashout
                </p>
                <p className="mt-1 text-xl font-black text-green-400">
                  {eligibleCashoutCoins.toLocaleString()}
                </p>
              </div>

              <div className="rounded-3xl border border-amber-400/15 bg-[#0C0A17] p-4">
                <Crown
                  size={20}
                  className="mb-3 text-amber-400"
                />
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Crowns
                </p>
                <p className="mt-1 text-xl font-black text-amber-400">
                  {battleCrowns.toLocaleString()}
                </p>
              </div>

              <div className="rounded-3xl border border-cyan-400/15 bg-[#0C0A17] p-4">
                <Coins
                  size={20}
                  className="mb-3 text-cyan-400"
                />
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Hype Coins
                </p>
                <p className="mt-1 text-xl font-black text-cyan-400">
                  {hypeCoins.toLocaleString()}
                </p>
              </div>
            </section>

            {canConvertHype && (
              <button
                onClick={handleConvertHype}
                className="w-full rounded-2xl border border-cyan-400/20 bg-cyan-400/10 py-3 text-xs font-black uppercase tracking-wider text-cyan-300 active:scale-[0.98]"
              >
                Convert All Hype Coins → Troll Coins
              </button>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black">
                    Quick Actions
                  </h2>
                  <p className="text-[10px] text-zinc-500">
                    Manage your MAI Pay account
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    setActiveTab('cashout')
                  }
                  className="rounded-2xl border border-green-400/15 bg-green-400/5 p-4 text-left"
                >
                  <DollarSign
                    size={20}
                    className="mb-2 text-green-400"
                  />
                  <p className="text-xs font-black">
                    Cash Out
                  </p>
                  <p className="mt-1 text-[9px] text-zinc-500">
                    Withdraw earned coins
                  </p>
                </button>

                <button
                  onClick={() =>
                    setActiveTab('transactions')
                  }
                  className="rounded-2xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 p-4 text-left"
                >
                  <History
                    size={20}
                    className="mb-2 text-[#00BFFF]"
                  />
                  <p className="text-xs font-black">
                    History
                  </p>
                  <p className="mt-1 text-[9px] text-zinc-500">
                    View transactions
                  </p>
                </button>

                <button
                  onClick={() =>
                    setActiveTab('crowns')
                  }
                  className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-left"
                >
                  <Crown
                    size={20}
                    className="mb-2 text-amber-400"
                  />
                  <p className="text-xs font-black">
                    Crowns
                  </p>
                  <p className="mt-1 text-[9px] text-zinc-500">
                    Convert crowns
                  </p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('gifted')
                    loadGiftedUsers()
                  }}
                  className="rounded-2xl border border-[#BF00FF]/15 bg-[#BF00FF]/5 p-4 text-left"
                >
                  <Send
                    size={20}
                    className="mb-2 text-[#BF00FF]"
                  />
                  <p className="text-xs font-black">
                    Gifted
                  </p>
                  <p className="mt-1 text-[9px] text-zinc-500">
                    See who you gifted
                  </p>
                </button>
              </div>
            </section>

            <WeeklyCashbackCard />
          </>
        )}

        {/* Application */}
        {activeTab === 'application' && (
          <section className="overflow-hidden rounded-3xl border border-[#00BFFF]/15 bg-[#0C0A17]">
            <FastPayApplication />
          </section>
        )}

        {/* Crowns */}
        {activeTab === 'crowns' && (
          <>
            <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-900/20 to-[#0C0A17] p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
                  <Crown
                    size={27}
                    className="text-amber-400"
                  />
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Battle Crowns
                  </p>
                  <p className="text-3xl font-black text-amber-400">
                    {battleCrowns.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-400/10 bg-black/20 p-4">
                <p className="text-sm font-black">
                  Convert Crowns
                </p>

                <p className="mt-1 text-[10px] text-zinc-500">
                  1 Crown = 1 Troll Coin
                </p>

                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {[1, 5, 25, 50].map(
                    (amount) => (
                      <button
                        key={amount}
                        onClick={() =>
                          setCrownConvertAmount(
                            String(
                              Math.min(
                                amount,
                                battleCrowns,
                              ),
                            ),
                          )
                        }
                        className="shrink-0 rounded-xl border border-amber-400/15 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-300"
                      >
                        {amount}
                      </button>
                    ),
                  )}

                  <button
                    onClick={() =>
                      setCrownConvertAmount(
                        String(battleCrowns),
                      )
                    }
                    className="shrink-0 rounded-xl border border-amber-400/15 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-300"
                  >
                    MAX
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={battleCrowns}
                    value={crownConvertAmount}
                    onChange={(e) =>
                      setCrownConvertAmount(
                        e.target.value,
                      )
                    }
                    placeholder="Amount"
                    className="min-w-0 flex-1 rounded-xl border border-amber-400/15 bg-black/30 px-3 py-3 text-sm text-white outline-none"
                  />

                  <button
                    onClick={
                      handleConvertCrowns
                    }
                    disabled={
                      crownConverting ||
                      !crownConvertAmount
                    }
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 text-xs font-black disabled:opacity-40"
                  >
                    {crownConverting ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      'CONVERT'
                    )}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
              <h2 className="mb-4 text-sm font-black">
                Crown History
              </h2>

              {crownRedemptions.length === 0 ? (
                <div className="py-8 text-center">
                  <Crown
                    size={28}
                    className="mx-auto mb-2 text-zinc-700"
                  />
                  <p className="text-xs text-zinc-600">
                    No crown conversions yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {crownRedemptions.map(
                    (redemption) => (
                      <div
                        key={redemption.id}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-3"
                      >
                        <div>
                          <p className="text-xs font-bold">
                            {redemption.crowns_redeemed.toLocaleString()}{' '}
                            Crowns
                          </p>
                          <p className="mt-1 text-[9px] text-zinc-500">
                            {new Date(
                              redemption.created_at,
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${getStatusClass(
                            redemption.status,
                          )}`}
                        >
                          {redemption.status}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {/* Gifted */}
        {activeTab === 'gifted' && (
          <section className="rounded-3xl border border-[#BF00FF]/15 bg-[#0C0A17] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black">
                  Coins Gifted
                </h2>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Users you've sent coins to
                </p>
              </div>

              <button
                onClick={() => {
                  setGiftedSearchOpen(
                    (value) => !value,
                  )

                  if (
                    giftedUsers.length === 0
                  ) {
                    loadGiftedUsers()
                  }
                }}
                className="flex items-center gap-1 rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10 px-3 py-2 text-[10px] font-black text-[#BF00FF]"
              >
                <Search size={14} />
                Search
                {giftedSearchOpen ? (
                  <ChevronUp size={13} />
                ) : (
                  <ChevronDown size={13} />
                )}
              </button>
            </div>

            {giftedSearchOpen && (
              <div className="relative mt-4">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                />

                <input
                  value={giftedSearch}
                  onChange={(e) =>
                    setGiftedSearch(
                      e.target.value,
                    )
                  }
                  placeholder="Search username..."
                  className="w-full rounded-2xl border border-[#BF00FF]/15 bg-black/30 py-3 pl-9 pr-3 text-xs text-white outline-none"
                />
              </div>
            )}

            <div className="mt-4">
              {giftedLoading ? (
                <div className="py-10 text-center">
                  <Loader2
                    size={25}
                    className="mx-auto animate-spin text-[#BF00FF]"
                  />
                </div>
              ) : filteredGiftedUsers.length ===
                0 ? (
                <div className="py-10 text-center">
                  <Send
                    size={28}
                    className="mx-auto mb-2 text-zinc-700"
                  />
                  <p className="text-xs text-zinc-600">
                    {giftedSearch
                      ? 'No users found.'
                      : "You haven't gifted anyone yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredGiftedUsers.map(
                    (gifted) => (
                      <div
                        key={gifted.user_id}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {gifted.avatar_url ? (
                            <img
                              src={
                                gifted.avatar_url
                              }
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#BF00FF]/10">
                              <User
                                size={17}
                                className="text-[#BF00FF]"
                              />
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-xs font-black">
                              {gifted.display_name ||
                                gifted.username}
                            </p>
                            <p className="truncate text-[9px] text-zinc-600">
                              @{gifted.username}
                            </p>
                          </div>
                        </div>

                        <div className="ml-3 shrink-0 text-right">
                          <p className="text-xs font-black text-[#00BFFF]">
                            {gifted.total_coins.toLocaleString()}
                          </p>
                          <p className="text-[8px] text-zinc-600">
                            coins
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Cashout */}
        {activeTab === 'cashout' && (
          <>
            <FastPayProgram
              successfulCashoutsLast24Hours={
                successfulCashoutsLast24Hours
              }
              nextCashoutAvailableAt={
                nextCashoutAvailableAt
              }
            />

            <section className="rounded-3xl border border-green-400/20 bg-gradient-to-br from-green-900/20 to-[#0C0A17] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-400/10">
                  <DollarSign
                    size={23}
                    className="text-green-400"
                  />
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    Cashout Eligible
                  </p>
                  <p className="text-2xl font-black text-green-400">
                    {eligibleCashoutCoins.toLocaleString()}
                  </p>
                </div>
              </div>

              {dailyLimitReached && (
                <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3">
                  <div className="flex items-start gap-2">
                    <Clock
                      size={16}
                      className="mt-0.5 shrink-0 text-yellow-400"
                    />
                    <div>
                      <p className="text-xs font-black text-yellow-300">
                        Daily cashout limit reached
                      </p>
                      {nextCashoutAvailableAt && (
                        <p className="mt-1 text-[9px] text-yellow-300/70">
                          Available{' '}
                          {new Date(
                            nextCashoutAvailableAt,
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
              <div className="mb-4">
                <h2 className="text-sm font-black">
                  Choose Cashout
                </h2>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Select an eligible payout amount.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {cashoutTiers.map(
                  (tier) => {
                    const eligible =
                      eligibleCashoutCoins >=
                      tier.coins

                    const selected =
                      selectedTier?.coins ===
                      tier.coins

                    return (
                      <button
                        key={tier.coins}
                        disabled={
                          !eligible ||
                          dailyLimitReached
                        }
                        onClick={() =>
                          setSelectedTier(
                            tier,
                          )
                        }
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          selected
                            ? 'border-green-400/50 bg-green-400/10 shadow-[0_0_20px_rgba(34,197,94,0.08)]'
                            : eligible
                              ? 'border-[#BF00FF]/15 bg-[#BF00FF]/5'
                              : 'border-white/5 bg-black/10 opacity-30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black">
                            {tier.coins.toLocaleString()}
                          </span>

                          {selected && (
                            <CheckCircle
                              size={17}
                              className="text-green-400"
                            />
                          )}
                        </div>

                        <p className="mt-1 text-sm font-black text-green-400">
                          ${tier.usd.toFixed(2)}
                        </p>

                        {tier.manualReview && (
                          <p className="mt-1 text-[8px] font-bold text-amber-400">
                            MANUAL REVIEW
                          </p>
                        )}
                      </button>
                    )
                  },
                )}
              </div>
            </section>

            {selectedTier && (
              <section className="space-y-4 rounded-3xl border border-[#BF00FF]/15 bg-[#0C0A17] p-4">
                <div>
                  <h2 className="text-sm font-black">
                    Payout Method
                  </h2>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Choose where you want your cashout sent.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PAYOUT_PROVIDERS.map(
                    (provider) => (
                      <button
                        key={provider.value}
                        onClick={() =>
                          setSelectedProvider(
                            provider.value,
                          )
                        }
                        className={`flex items-center gap-2 rounded-2xl border p-3 text-left ${
                          selectedProvider ===
                          provider.value
                            ? 'border-[#00BFFF]/40 bg-[#00BFFF]/10'
                            : 'border-white/5 bg-black/20'
                        }`}
                      >
                        <div
                          className={
                            selectedProvider ===
                            provider.value
                              ? 'text-[#00BFFF]'
                              : 'text-zinc-500'
                          }
                        >
                          {provider.icon}
                        </div>

                        <span className="text-[10px] font-black">
                          {provider.label}
                        </span>
                      </button>
                    ),
                  )}
                </div>

                {/* Summary */}
                <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                  <p className="mb-3 text-xs font-black">
                    Cashout Summary
                  </p>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Cashout
                      </span>
                      <span className="font-bold">
                        {selectedTier.coins.toLocaleString()}{' '}
                        coins
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Fee
                      </span>
                      <span className="font-bold text-red-400">
                        {feeCoins > 0
                          ? `${feeCoins.toLocaleString()} coins`
                          : 'None'}
                      </span>
                    </div>

                    <div className="border-t border-white/5 pt-2">
                      <div className="flex justify-between">
                        <span className="font-black">
                          You Receive
                        </span>
                        <span className="font-black text-green-400">
                          $
                          {selectedTier.usd.toFixed(
                            2,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Total Charged
                      </span>
                      <span className="font-black text-white">
                        {totalCoinsNeeded.toLocaleString()}{' '}
                        coins
                      </span>
                    </div>
                  </div>
                </div>

                {/* Provider Details */}
                {selectedProvider !==
                  'ach' && (
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                      {selectedProvider ===
                      'paypal'
                        ? 'PayPal Email'
                        : selectedProvider ===
                            'cash_app'
                          ? 'Cash App $Cashtag'
                          : 'Venmo Username'}
                    </label>

                    <input
                      value={
                        providerUsername
                      }
                      onChange={(e) =>
                        setProviderUsername(
                          e.target.value,
                        )
                      }
                      placeholder={
                        selectedProvider ===
                        'paypal'
                          ? 'email@example.com'
                          : selectedProvider ===
                              'cash_app'
                            ? '$Cashtag'
                            : '@username'
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                    />
                  </div>
                )}

                {selectedProvider ===
                  'ach' && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        Bank Name
                      </label>
                      <input
                        value={achBankName}
                        onChange={(e) =>
                          setAchBankName(
                            e.target.value,
                          )
                        }
                        placeholder="Bank name"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        Routing Number
                      </label>
                      <input
                        inputMode="numeric"
                        value={
                          achRoutingNumber
                        }
                        onChange={(e) =>
                          setAchRoutingNumber(
                            e.target.value.replace(
                              /\D/g,
                              '',
                            ),
                          )
                        }
                        placeholder="9-digit routing number"
                        maxLength={9}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        Account Number
                      </label>
                      <input
                        inputMode="numeric"
                        value={
                          achAccountNumber
                        }
                        onChange={(e) =>
                          setAchAccountNumber(
                            e.target.value.replace(
                              /\D/g,
                              '',
                            ),
                          )
                        }
                        placeholder="Bank account number"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-[#00BFFF]/40"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={
                    handleRequestCashout
                  }
                  disabled={
                    !canRequestCashout ||
                    submittingCashout
                  }
                  className={`w-full rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition-all ${
                    canRequestCashout
                      ? 'bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] text-white shadow-[0_0_25px_rgba(0,191,255,0.15)]'
                      : 'bg-white/5 text-zinc-600'
                  }`}
                >
                  {submittingCashout ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      Submitting
                    </span>
                  ) : dailyLimitReached ? (
                    '24 Hour Limit Reached'
                  ) : eligibleCashoutCoins <
                    totalCoinsNeeded ? (
                    'Insufficient Coins'
                  ) : !providerIsValid ? (
                    'Enter Payout Details'
                  ) : (
                    `Cash Out $${selectedTier.usd.toFixed(2)}`
                  )}
                </button>
              </section>
            )}
          </>
        )}

        {/* Requests */}
        {activeTab === 'requests' && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black">
                  Cashout Requests
                </h2>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Track your withdrawals
                </p>
              </div>

              <button
                onClick={
                  loadCashoutRequests
                }
                className="rounded-xl border border-white/10 p-2 text-zinc-500"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {cashoutRequests.length ===
            0 ? (
              <div className="py-12 text-center">
                <FileText
                  size={30}
                  className="mx-auto mb-3 text-zinc-700"
                />

                <p className="text-xs text-zinc-600">
                  No cashout requests yet.
                </p>

                <button
                  onClick={() =>
                    setActiveTab('cashout')
                  }
                  className="mt-4 rounded-xl bg-[#BF00FF]/10 px-4 py-2 text-[10px] font-black text-[#BF00FF]"
                >
                  START CASHOUT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {cashoutRequests.map(
                  (request: any) => (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-white/5 bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${getStatusClass(
                            request.status,
                          )}`}
                        >
                          {getStatusIcon(
                            request.status,
                          )}
                          {request.status}
                        </span>

                        <span className="text-lg font-black text-green-400">
                          $
                          {Number(
                            request.usd_amount ??
                              0,
                          ).toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                            Coins
                          </p>
                          <p className="mt-1 text-xs font-bold">
                            {Number(
                              request.coin_amount ??
                                request.coins_reserved ??
                                0,
                            ).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                            Provider
                          </p>
                          <p className="mt-1 text-xs font-bold capitalize">
                            {request.payout_method ??
                              '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                            Submitted
                          </p>
                          <p className="mt-1 text-xs font-bold">
                            {new Date(
                              request.created_at,
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                            Processed
                          </p>
                          <p className="mt-1 text-xs font-bold">
                            {request.processed_at
                              ? new Date(
                                  request.processed_at,
                                ).toLocaleDateString()
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {request.admin_notes && (
                        <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3">
                          <p className="text-[9px] font-black text-cyan-300">
                            Processing Team
                          </p>
                          <p className="mt-1 text-[10px] text-cyan-200/70">
                            {
                              request.admin_notes
                            }
                          </p>
                        </div>
                      )}

                      {request.rejection_reason && (
                        <div className="mt-3 rounded-xl border border-red-400/10 bg-red-400/5 p-3">
                          <p className="text-[9px] font-black text-red-300">
                            Rejection Reason
                          </p>
                          <p className="mt-1 text-[10px] text-red-200/70">
                            {
                              request.rejection_reason
                            }
                          </p>
                        </div>
                      )}

                      {request.receipt_url && (
                        <a
                          href={
                            request.receipt_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 block text-center text-[10px] font-black text-[#00BFFF]"
                        >
                          VIEW RECEIPT
                        </a>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        )}

        {/* Transactions */}
        {activeTab === 'transactions' && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black">
                  Transaction History
                </h2>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Your coin activity
                </p>
              </div>

              <select
                value={txFilter}
                onChange={(e) =>
                  setTxFilter(
                    e.target.value,
                  )
                }
                className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-[9px] font-bold text-white outline-none"
              >
                <option value="all">
                  All
                </option>
                <option value="gift_received">
                  Received
                </option>
                <option value="gift_sent">
                  Sent
                </option>
                <option value="purchase">
                  Purchases
                </option>
                <option value="cashout">
                  Cashout
                </option>
                <option value="spend">
                  Spending
                </option>
              </select>
            </div>

            {transactionsLoading ? (
              <div className="py-10 text-center">
                <Loader2
                  size={25}
                  className="mx-auto animate-spin text-[#00BFFF]"
                />
              </div>
            ) : (
              (() => {
                const filtered =
                  transactions.filter(
                    (tx) =>
                      txFilter ===
                        'all' ||
                      tx.type ===
                        txFilter,
                  )

                if (
                  filtered.length === 0
                ) {
                  return (
                    <div className="py-10 text-center">
                      <History
                        size={28}
                        className="mx-auto mb-2 text-zinc-700"
                      />
                      <p className="text-xs text-zinc-600">
                        No transactions yet.
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    {filtered.map(
                      (tx) => {
                        const positive =
                          tx.type ===
                            'gift_received' ||
                          tx.type ===
                            'purchase' ||
                          tx.type ===
                            'crown_redemption' ||
                          tx.type ===
                            'reward'

                        const negative =
                          tx.type ===
                            'gift_sent' ||
                          tx.type ===
                            'cashout' ||
                          tx.type ===
                            'spend'

                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  positive
                                    ? 'bg-green-400/10'
                                    : negative
                                      ? 'bg-[#BF00FF]/10'
                                      : 'bg-[#00BFFF]/10'
                                }`}
                              >
                                {positive ? (
                                  <ArrowDownLeft
                                    size={17}
                                    className="text-green-400"
                                  />
                                ) : negative ? (
                                  <ArrowUpRight
                                    size={17}
                                    className="text-[#BF00FF]"
                                  />
                                ) : (
                                  <Coins
                                    size={17}
                                    className="text-[#00BFFF]"
                                  />
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-black capitalize">
                                  {tx.type.replace(
                                    /_/g,
                                    ' ',
                                  )}
                                </p>

                                <p className="truncate text-[9px] text-zinc-500">
                                  {tx.description ||
                                    'Coin transaction'}
                                </p>

                                <p className="mt-1 text-[8px] text-zinc-700">
                                  {new Date(
                                    tx.created_at,
                                  ).toLocaleDateString()}{' '}
                                  {new Date(
                                    tx.created_at,
                                  ).toLocaleTimeString(
                                    [],
                                    {
                                      hour: '2-digit',
                                      minute:
                                        '2-digit',
                                    },
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="ml-2 shrink-0 text-right">
                              <p
                                className={`text-xs font-black ${
                                  positive
                                    ? 'text-green-400'
                                    : negative
                                      ? 'text-[#BF00FF]'
                                      : 'text-white'
                                }`}
                              >
                                {positive
                                  ? '+'
                                  : negative
                                    ? '-'
                                    : ''}
                                {Number(
                                  tx.amount,
                                ).toLocaleString()}
                              </p>

                              <p className="text-[8px] text-zinc-600">
                                coins
                              </p>
                            </div>
                          </div>
                        )
                      },
                    )}
                  </div>
                )
              })()
            )}
          </section>
        )}

        {/* More MAI Pay options */}
        {activeTab === 'overview' && (
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
            <button
              onClick={() =>
                setShowMore(
                  (value) => !value,
                )
              }
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <FileText
                  size={18}
                  className="text-[#BF00FF]"
                />
                <div className="text-left">
                  <p className="text-xs font-black">
                    More MAI Pay
                  </p>
                  <p className="text-[9px] text-zinc-600">
                    Applications and gifting
                  </p>
                </div>
              </div>

              {showMore ? (
                <ChevronUp size={17} />
              ) : (
                <ChevronDown size={17} />
              )}
            </button>

            {showMore && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    setActiveTab(
                      'application',
                    )
                  }
                  className="rounded-2xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 p-3 text-left"
                >
                  <FileText
                    size={17}
                    className="mb-2 text-[#00BFFF]"
                  />
                  <p className="text-[10px] font-black">
                    FastPay
                  </p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab(
                      'gifted',
                    )
                    loadGiftedUsers()
                  }}
                  className="rounded-2xl border border-[#BF00FF]/15 bg-[#BF00FF]/5 p-3 text-left"
                >
                  <Send
                    size={17}
                    className="mb-2 text-[#BF00FF]"
                  />
                  <p className="text-[10px] font-black">
                    Gifted Users
                  </p>
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Fixed mobile navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#070611]/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          <button
            onClick={() =>
              setActiveTab('overview')
            }
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${
              activeTab === 'overview'
                ? 'bg-[#00BFFF]/10 text-[#00BFFF]'
                : 'text-zinc-600'
            }`}
          >
            <Wallet size={18} />
            <span className="text-[8px] font-black">
              HOME
            </span>
          </button>

          <button
            onClick={() =>
              setActiveTab('cashout')
            }
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${
              activeTab === 'cashout'
                ? 'bg-green-400/10 text-green-400'
                : 'text-zinc-600'
            }`}
          >
            <DollarSign size={18} />
            <span className="text-[8px] font-black">
              CASH OUT
            </span>
          </button>

          <button
            onClick={() =>
              setActiveTab('crowns')
            }
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${
              activeTab === 'crowns'
                ? 'bg-amber-400/10 text-amber-400'
                : 'text-zinc-600'
            }`}
          >
            <Crown size={18} />
            <span className="text-[8px] font-black">
              CROWNS
            </span>
          </button>

          <button
            onClick={() =>
              setActiveTab('requests')
            }
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${
              activeTab === 'requests'
                ? 'bg-[#BF00FF]/10 text-[#BF00FF]'
                : 'text-zinc-600'
            }`}
          >
            <FileText size={18} />
            <span className="text-[8px] font-black">
              REQUESTS
            </span>
          </button>

          <button
            onClick={() =>
              setActiveTab(
                'transactions',
              )
            }
            className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${
              activeTab ===
              'transactions'
                ? 'bg-[#00BFFF]/10 text-[#00BFFF]'
                : 'text-zinc-600'
            }`}
          >
            <History size={18} />
            <span className="text-[8px] font-black">
              HISTORY
            </span>
          </button>
        </div>
      </nav>
    </div>
  )
}