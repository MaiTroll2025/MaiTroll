import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { ArrowLeft, Coins, ShoppingBag, History, TrendingUp, Zap } from 'lucide-react';
import { COIN_PACKAGES } from '../../lib/coinMath';
import PayPalPaymentModal from '@/components/broadcast/PayPalPaymentModal'

interface CoinPackage {
  id: string
  name: string
  coins: number
  price: number
  bonus?: number
  popular?: boolean
}

export default function PhoneCoins() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const [balance, setBalance] = useState<number>(0)
  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [paypalOpen, setPaypalOpen] = useState(false)
  const [selectedPkg, setSelectedPkg] = useState<any>(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .maybeSingle()

      if (!cancelled) {
        setBalance(data?.troll_coins ?? 0)
        setLoading(false)
      }
    }

    load()

    const channel = supabase
      .channel(`phone-coins-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any
          setBalance(row.troll_coins ?? 0)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    const pkgs: CoinPackage[] = COIN_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.label,
      coins: pkg.coins,
      price: pkg.usdPrice,
      popular: pkg.id === 'pkg-1000',
    }))
    setPackages(pkgs)
  }, [])

  const handlePurchase = (pkg: CoinPackage) => {
    if (!user?.id) {
      navigate('/auth')
      return
    }

    const purchasePkg = {
      ...pkg,
      price: `$${pkg.price.toFixed(2)}`,
      purchaseType: 'coins',
      coin_amount: pkg.coins + (pkg.bonus || 0),
    }
    setSelectedPkg(purchasePkg)
    setPaypalOpen(true)
  }

  const handlePaymentSuccess = () => {
    setPaypalOpen(false)
    setSelectedPkg(null)
    if (user?.id) {
      supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setBalance(data?.troll_coins ?? 0)
        })
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0A0814] text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#0A0814]/90 px-4 py-3 backdrop-blur-xl">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-black uppercase tracking-widest text-white/80">Coins</h1>
        <div className="w-9" />
      </header>

      <main className="space-y-5 p-4">
        <section className="relative overflow-hidden rounded-3xl border border-[#00BFFF]/20 bg-gradient-to-br from-[#071522] via-[#080812] to-[#16071c] p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#BF00FF]/20 blur-[55px]" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00BFFF]/30 bg-[#00BFFF]/10">
              <Coins size={28} className="text-[#00BFFF]" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Your Balance</p>
              <p className="text-3xl font-black text-white">
                {loading ? '...' : balance.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#BF00FF]">Troll Coins</p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={17} className="text-[#00BFFF]" />
            <h2 className="text-sm font-black tracking-[0.08em] text-white/80">BUY COINS</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                  pkg.popular
                    ? 'border-[#00BFFF]/40 bg-gradient-to-br from-[#06121a] to-[#11061a]'
                    : 'border-white/10 bg-white/[0.025]'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute right-2 top-2 rounded-full bg-[#00BFFF] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-black">
                    Popular
                  </div>
                )}
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                  <Coins size={20} className="text-[#00BFFF]" />
                </div>
                <p className="text-sm font-black text-white">{pkg.coins.toLocaleString()}</p>
                {pkg.bonus && (
                  <p className="text-[10px] font-bold text-[#BF00FF]">+{pkg.bonus.toLocaleString()} bonus</p>
                )}
                <p className="mt-2 text-xs font-bold text-zinc-400">${pkg.price.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-3 flex items-center gap-2">
            <History size={17} className="text-[#BF00FF]" />
            <h2 className="text-sm font-black tracking-[0.08em] text-white/80">RECENT</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00BFFF]/10 text-[#00BFFF]">
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Coin Purchase</p>
                  <p className="text-[10px] text-zinc-500">Today</p>
                </div>
              </div>
              <span className="text-xs font-black text-[#00BFFF]">+500</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#BF00FF]/10 text-[#BF00FF]">
                  <Zap size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Daily Reward</p>
                  <p className="text-[10px] text-zinc-500">Yesterday</p>
                </div>
              </div>
              <span className="text-xs font-black text-[#00BFFF]">+50</span>
            </div>
          </div>
        </section>
      </main>

      <PayPalPaymentModal
        isOpen={paypalOpen}
        onClose={() => {
          setPaypalOpen(false)
          setSelectedPkg(null)
        }}
        pkg={selectedPkg}
        userId={user?.id ?? ''}
        profile={profile ?? null}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
