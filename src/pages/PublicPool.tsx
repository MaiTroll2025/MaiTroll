import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import {
  Coins,
  Crown,
  Droplets,
  Gem,
  Send,
  Sparkles,
  Trophy,
  User,
  Waves
} from 'lucide-react'
import UserNameWithAge from '../components/UserNameWithAge'

type Donation = {
  id: string
  user_id: string
  amount: number
  message: string | null
  created_at: string
  username?: string
  avatar_url?: string
  user_created_at?: string
}

const POOL_TARGET = 10_000_000_000_000_000
const TROLLMONDS_PER_100_COINS = 100

function calculateTrollmonds(coins: number) {
  if (!Number.isFinite(coins) || coins <= 0) return 0
  return Math.floor(coins / 100) * TROLLMONDS_PER_100_COINS
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString()
}

export default function PublicPool() {
  const { profile } = useAuthStore()

  const [poolBalance, setPoolBalance] = useState(0)
  const [donations, setDonations] = useState<Donation[]>([])
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<any[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const hasPoolRealtimeRef = useRef(false)

  const numericAmount = Number(amount || 0)
  const earnedTrollmonds = useMemo(() => calculateTrollmonds(numericAmount), [numericAmount])
  const poolProgress = Math.min((poolBalance / POOL_TARGET) * 100, 100)

  const spawnCoins = (donatedAmount: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const count = Math.min(Math.floor(Math.sqrt(Number(donatedAmount || 0))) + 12, 90)

    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: -40 - Math.random() * 160,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 2 + Math.random() * 4,
        size: 5 + Math.random() * 8,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.22,
        shine: Math.random() > 0.72
      })
    }
  }

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      const { data: poolData } = await supabase
        .from('admin_pool')
        .select('trollcoins_balance')
        .limit(1)
        .maybeSingle()

      const { data: donationData } = await supabase
        .from('pool_donations')
        .select('id, user_id, amount, message, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!mounted) return

      let mappedDonations: Donation[] = []
      let donationsTotal = 0

      if (donationData?.length) {
        const userIds = Array.from(new Set(donationData.map((d: any) => d.user_id)))

        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url, created_at')
          .in('id', userIds)

        const profileMap = new Map()
        profiles?.forEach((p: any) => profileMap.set(p.id, p))

        mappedDonations = donationData.map((d: any) => ({
          ...d,
          amount: Number(d.amount || 0),
          username: profileMap.get(d.user_id)?.username,
          avatar_url: profileMap.get(d.user_id)?.avatar_url,
          user_created_at: profileMap.get(d.user_id)?.created_at
        }))

        donationsTotal = mappedDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0)
      }

      const liveBalance = Number(poolData?.trollcoins_balance || 0)
      setPoolBalance(liveBalance > 0 ? liveBalance : donationsTotal)
      setDonations(mappedDonations)
    }

    loadData()

    const channel = supabase
      .channel('public-pool-live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_pool' },
        (payload) => {
          hasPoolRealtimeRef.current = true
          setPoolBalance(Number(payload.new?.trollcoins_balance || 0))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pool_donations' },
        async (payload) => {
          const donation = payload.new as any

          const { data: userData } = await supabase
            .from('user_profiles')
            .select('username, avatar_url, created_at')
            .eq('id', donation.user_id)
            .maybeSingle()

          const newDonation: Donation = {
            id: donation.id,
            user_id: donation.user_id,
            amount: Number(donation.amount || 0),
            message: donation.message,
            created_at: donation.created_at,
            username: userData?.username,
            avatar_url: userData?.avatar_url,
            user_created_at: userData?.created_at
          }

          setDonations((prev) => [newDonation, ...prev].slice(0, 50))
          spawnCoins(newDonation.amount)

          if (!hasPoolRealtimeRef.current) {
            setPoolBalance((prev) => Number(prev || 0) + newDonation.amount)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
    }

    const drawPool = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const time = Date.now() / 900
      const fillRatio = Math.min(poolBalance / POOL_TARGET, 1)
      const waterHeight = canvas.height * (0.18 + fillRatio * 0.66)
      const waterTop = canvas.height - waterHeight

      const bgGlow = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height * 0.35,
        60,
        canvas.width / 2,
        canvas.height * 0.55,
        canvas.width
      )
      bgGlow.addColorStop(0, 'rgba(34, 211, 238, 0.20)')
      bgGlow.addColorStop(0.45, 'rgba(124, 58, 237, 0.10)')
      bgGlow.addColorStop(1, 'rgba(2, 6, 23, 0.0)')
      ctx.fillStyle = bgGlow
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const waterGradient = ctx.createLinearGradient(0, waterTop, 0, canvas.height)
      waterGradient.addColorStop(0, 'rgba(34, 211, 238, 0.56)')
      waterGradient.addColorStop(0.45, 'rgba(14, 165, 233, 0.40)')
      waterGradient.addColorStop(1, 'rgba(8, 47, 73, 0.78)')

      ctx.beginPath()
      ctx.moveTo(0, canvas.height)
      ctx.lineTo(0, waterTop)

      for (let x = 0; x <= canvas.width; x += 18) {
        const wave =
          Math.sin(x * 0.012 + time) * 13 +
          Math.sin(x * 0.023 + time * 0.75) * 6
        ctx.lineTo(x, waterTop + wave)
      }

      ctx.lineTo(canvas.width, canvas.height)
      ctx.closePath()
      ctx.fillStyle = waterGradient
      ctx.fill()

      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += 18) {
        const wave =
          Math.sin(x * 0.012 + time) * 13 +
          Math.sin(x * 0.023 + time * 0.75) * 6
        if (x === 0) ctx.moveTo(x, waterTop + wave)
        else ctx.lineTo(x, waterTop + wave)
      }
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)'
      ctx.lineWidth = 3
      ctx.shadowBlur = 16
      ctx.shadowColor = 'rgba(34, 211, 238, 0.8)'
      ctx.stroke()
      ctx.shadowBlur = 0

      const coinRows = Math.min(Math.floor(fillRatio * 18) + 2, 22)
      for (let row = 0; row < coinRows; row++) {
        const y = canvas.height - 28 - row * 20
        const offset = row % 2 === 0 ? 0 : 18

        for (let x = -30; x < canvas.width + 30; x += 42) {
          const cx = x + offset
          const bob = Math.sin(time + row + x * 0.03) * 2

          ctx.beginPath()
          ctx.ellipse(cx, y + bob, 15, 8, 0, 0, Math.PI * 2)
          ctx.fillStyle = row % 3 === 0 ? '#facc15' : '#f59e0b'
          ctx.fill()

          ctx.beginPath()
          ctx.ellipse(cx, y + bob - 1, 9, 4, 0, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(254, 240, 138, 0.55)'
          ctx.fill()
        }
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.vRot
        p.vy += 0.09

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)

        ctx.beginPath()
        ctx.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2)
        ctx.fillStyle = p.shine ? '#fde68a' : '#fbbf24'
        ctx.fill()

        ctx.beginPath()
        ctx.ellipse(0, -1, p.size * 0.55, p.size * 0.25, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.42)'
        ctx.fill()

        ctx.restore()

        return p.y < waterTop + 40 && p.y < canvas.height + 80
      })

      animationFrameRef.current = requestAnimationFrame(drawPool)
    }

    resize()
    window.addEventListener('resize', resize)
    drawPool()

    return () => {
      window.removeEventListener('resize', resize)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }, [poolBalance])

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault()

    const coins = Number(amount)

    if (!profile?.id) {
      toast.error('Please sign in to donate')
      return
    }

    if (!Number.isFinite(coins) || coins <= 0) {
      toast.error('Enter a valid coin amount')
      return
    }

    if (coins < 100) {
      toast.error('Minimum donation is 1 Troll Coins')
      return
    }

    if (coins > Number(profile?.troll_coins || 0)) {
      toast.error('You do not have enough Troll Coins')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.rpc('donate_to_public_pool', {
        p_amount: coins,
        p_message: message.trim() || null
      })

      if (error) throw error

      const trollmonds = calculateTrollmonds(coins)

      toast.success(
        `Donation sent! You earned ${formatNumber(trollmonds)} Trollmonds.`
      )

      spawnCoins(coins)
      setAmount('')
      setMessage('')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to donate to the pool')
    } finally {
      setLoading(false)
    }
  }

  const topDonor = donations[0]

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_32%),linear-gradient(135deg,#020617_0%,#07111f_45%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.16] bg-[linear-gradient(rgba(34,211,238,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.22)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="absolute inset-0 z-0">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-cyan-400/20 bg-slate-950/70 px-4 py-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/35 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.35)]">
                <Waves className="h-9 w-9 text-cyan-200" />
                <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-fuchsia-300" />
              </div>

              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">
                  Mai Troll Public Pool
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Community Coin Pool
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-cyan-100/75">
                  Donate Troll Coins, grow the public pool, and earn Trollmonds automatically.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/10 p-4 shadow-[0_0_28px_rgba(250,204,21,0.14)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-100/70">
                  Pool Balance
                </p>
                <p className="mt-1 font-mono text-3xl font-black text-yellow-200">
                  {formatNumber(poolBalance)}
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                  Filled
                </p>
                <p className="mt-1 font-mono text-3xl font-black text-cyan-100">
                  {poolProgress.toFixed(1)}%
                </p>
              </div>

              <div className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100/70">
                  Reward
                </p>
                <p className="mt-1 font-mono text-xl font-black text-fuchsia-100">
                  100 Trollmonds / 100 Coins
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[380px_1fr_390px]">
          <section className="flex flex-col gap-5">
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_0_40px_rgba(34,211,238,0.14)] backdrop-blur-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-2xl font-black">
                    <Coins className="h-6 w-6 text-yellow-300" />
                    Donate Coins
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Every 100 Troll Coins gives 100 Trollmonds.
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/10 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-widest text-yellow-100/60">
                    Balance
                  </p>
                  <p className="font-mono text-sm font-black text-yellow-200">
                    {formatNumber(Number(profile?.troll_coins || 0))}
                  </p>
                </div>
              </div>

              <form onSubmit={handleDonate} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                    Troll Coins
                  </label>
                  <div className="relative">
                    <Coins className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-yellow-300" />
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/80 px-12 py-4 font-mono text-2xl font-black text-white outline-none transition focus:border-cyan-300 focus:shadow-[0_0_26px_rgba(34,211,238,0.25)]"
                      placeholder="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[100, 500, 1000].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      type="button"
                      onClick={() => setAmount(String(quickAmount))}
                      className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/20"
                    >
                      {formatNumber(quickAmount)}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Gem className="h-5 w-5 text-fuchsia-200" />
                      <span className="text-sm font-bold text-fuchsia-50">
                        Trollmonds Earned
                      </span>
                    </div>
                    <span className="font-mono text-2xl font-black text-fuchsia-100">
                      {formatNumber(earnedTrollmonds)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-fuchsia-100/65">
                    Rounded down by each full 100 coins donated.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                    Message
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={80}
                    className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    placeholder="Drop a public pool message..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/40 bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 px-5 py-4 font-black text-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.34)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  ) : (
                    <Send className="h-5 w-5 transition group-hover:translate-x-1" />
                  )}
                  Donate to Public Pool
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 backdrop-blur-2xl">
              <h3 className="mb-3 flex items-center gap-2 font-black text-white">
                <Droplets className="h-5 w-5 text-cyan-200" />
                Pool Rules
              </h3>
              <div className="space-y-3 text-sm text-slate-300">
                <p>Minimum donation: 100 Troll Coins.</p>
                <p>Reward rate: 100 Trollmonds per full 100 Troll Coins.</p>
                <p>Public pool coins support community events, rewards, and city activity.</p>
              </div>
            </div>
          </section>

          <section className="relative hidden min-h-[560px] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/35 shadow-[inset_0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-sm lg:block">
            <div className="absolute left-6 top-6 rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 backdrop-blur-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/60">
                Live Pool Visual
              </p>
              <p className="mt-1 max-w-xs text-sm text-slate-300">
                The water and coin pile rises as the public pool grows.
              </p>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/75 p-5 backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-cyan-100">Target Progress</span>
                  <span className="font-mono text-sm font-black text-yellow-200">
                    {formatNumber(poolBalance)} / {formatNumber(POOL_TARGET)}
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full border border-cyan-300/20 bg-slate-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 shadow-[0_0_18px_rgba(34,211,238,0.55)]"
                    style={{ width: `${poolProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/72 shadow-[0_0_40px_rgba(168,85,247,0.12)] backdrop-blur-2xl">
            <div className="border-b border-cyan-300/15 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <Trophy className="h-5 w-5 text-yellow-300" />
                    Recent Donors
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">Live donation feed</p>
                </div>

                {topDonor && (
                  <div className="rounded-2xl border border-yellow-300/25 bg-yellow-300/10 px-3 py-2 text-right">
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-yellow-100/60">
                      <Crown className="h-3 w-3" />
                      Latest
                    </div>
                    <p className="font-mono text-sm font-black text-yellow-200">
                      +{formatNumber(topDonor.amount)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {donations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10">
                    <Coins className="h-8 w-8 text-cyan-100" />
                  </div>
                  <p className="text-lg font-black text-white">No donations yet</p>
                  <p className="mt-1 text-sm text-slate-400">Be the first to fill the pool.</p>
                </div>
              ) : (
                donations.map((donation, index) => {
                  const trollmonds = calculateTrollmonds(Number(donation.amount || 0))

                  return (
                    <div
                      key={donation.id}
                      className="group rounded-2xl border border-cyan-300/15 bg-slate-900/72 p-4 shadow-[0_0_24px_rgba(15,23,42,0.35)] transition hover:border-cyan-300/35 hover:bg-slate-900/95"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          {donation.avatar_url ? (
                            <img
                              src={donation.avatar_url}
                              alt=""
                              className="h-11 w-11 rounded-2xl border border-cyan-300/25 object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                              <User className="h-5 w-5 text-cyan-100/70" />
                            </div>
                          )}

                          {index === 0 && (
                            <div className="absolute -right-1 -top-1 rounded-full bg-yellow-300 p-1 text-slate-950">
                              <Crown className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <UserNameWithAge
                              user={{
                                username: donation.username || 'Unknown',
                                created_at: donation.user_created_at || donation.created_at,
                                id: donation.user_id
                              }}
                              className="truncate text-sm font-black text-cyan-100"
                            />

                            <div className="text-right">
                              <p className="font-mono text-sm font-black text-yellow-200">
                                +{formatNumber(donation.amount)}
                              </p>
                              <p className="font-mono text-[11px] font-bold text-fuchsia-200">
                                +{formatNumber(trollmonds)} Trollmonds
                              </p>
                            </div>
                          </div>

                          {donation.message && (
                            <p className="mt-2 break-words rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                              “{donation.message}”
                            </p>
                          )}

                          <p className="mt-2 text-right text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            {new Date(donation.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}