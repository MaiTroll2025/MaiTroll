import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Coins,
  Package,
  Plus,
  ShoppingCart,
  Store,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { useAuthStore } from '../lib/store'
import useSEO from '@/hooks/useSEO';
import BuyerOrders from './BuyerOrders'
import MarketplaceSellerOrders from './MarketplaceSellerOrders'

type TabType = 'browse' | 'orders' | 'sales'

const panel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const card =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'

export default function Marketplace() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useSEO({
    title: 'Marketplace | Mai Troll - Buy & Sell Online',
    description: 'Browse the Mai Troll marketplace. Buy and sell virtual goods, items, and services from creators and community members. Social marketplace for the streaming community.',
    keywords: [
      'online marketplace', 'buy and sell online', 'community marketplace',
      'social marketplace', 'virtual goods', 'marketplace', 'MaiTroll shop',
      'sell online', 'buy online', 'creator marketplace'
    ]
  });

  const [shops, setShops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('browse')
  const [hasShop, setHasShop] = useState(false)

  const totalItems = useMemo(() => {
    return shops.reduce((sum, shop) => sum + Number(shop.shop_items?.length || 0), 0)
  }, [shops])

  const checkIfSeller = async () => {
    if (!user) {
      setHasShop(false)
      return
    }

    const { data } = await supabase
      .from('MaiTroll_shops')
      .select('id')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    setHasShop(Boolean(data))
  }

  const loadShops = async () => {
    setLoading(true)

    try {
      const { data: shopsData, error: shopsError } = await supabase
        .from('MaiTroll_shops')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (shopsError) throw shopsError

      const ownerIds = [...new Set((shopsData || []).map((shop: any) => shop.owner_id).filter(Boolean))]

      let ownerMap: Record<string, { username: string }> = {}

      if (ownerIds.length > 0) {
        const { data: ownersData } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', ownerIds)

        ownerMap = (ownersData || []).reduce((acc: any, owner: any) => {
          acc[owner.id] = { username: owner.username }
          return acc
        }, {})
      }

      const shopsWithItems = await Promise.all(
        (shopsData || []).map(async (shop) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('shop_items')
            .select('*')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false })

          if (itemsError) {
            console.error(`Error loading items for shop ${shop.id}:`, itemsError)
            return {
              ...shop,
              shop_items: [],
              owner_username: ownerMap[shop.owner_id]?.username || 'unknown',
            }
          }

          return {
            ...shop,
            shop_items: itemsData || [],
            owner_username: ownerMap[shop.owner_id]?.username || 'unknown',
          }
        })
      )

      setShops(shopsWithItems)
    } catch (error) {
      console.error('Error loading shops:', error)
      toast.error('Failed to load marketplace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void checkIfSeller()
  }, [user])

  useEffect(() => {
    if (activeTab === 'browse') void loadShops()
  }, [activeTab])

  return (
    <div className="relative min-h-screen bg-[#050714] px-4 pb-10 pt-24 text-white md:px-6 overflow-y-auto">
      <BackgroundFX />

      <main className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={cn(panel, 'p-5 md:p-6')}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                <Store className="h-6 w-6 text-cyan-200" />
              </div>

              <div>
                <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-5xl">
                  Mai Troll Marketplace
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Browse city shops, manage orders, and sell items to the community.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!hasShop && (
                <button onClick={() => navigate('/sell')} className={primary}>
                  <Plus className="h-4 w-4" />
                  Create Shop
                </button>
              )}

              {hasShop && (
                <button onClick={() => navigate('/sell')} className={secondary}>
                  <Store className="h-4 w-4" />
                  Manage Shop
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Active Shops" value={shops.length.toLocaleString()} />
          <StatCard label="Listed Items" value={totalItems.toLocaleString()} />
          <StatCard label="Seller Mode" value={hasShop ? 'Enabled' : 'Not Started'} />
        </section>

        <nav className={cn(panel, 'p-2')}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <TabButton
              active={activeTab === 'browse'}
              icon={<Store className="h-4 w-4" />}
              label="Browse"
              onClick={() => setActiveTab('browse')}
            />

            <TabButton
              active={activeTab === 'orders'}
              icon={<Package className="h-4 w-4" />}
              label="My Orders"
              onClick={() => setActiveTab('orders')}
            />

            {hasShop && (
              <TabButton
                active={activeTab === 'sales'}
                icon={<Tag className="h-4 w-4" />}
                label="Sales"
                onClick={() => setActiveTab('sales')}
              />
            )}
          </div>
        </nav>

        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              All sales are final. Illegal items, scams, prohibited listings, or abusive sales
              behavior can result in enforcement action.
            </p>
          </div>
        </div>

        {activeTab === 'browse' && (
          <section className={cn(panel, 'p-5')}>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Browse Shops</h2>
                <p className="text-sm text-slate-400">
                  Visit shops, preview items, and support city sellers.
                </p>
              </div>

              <button onClick={() => void loadShops()} className={secondary}>
                Refresh Shops
              </button>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div key={item} className={cn(card, 'h-56 animate-pulse p-5')}>
                    <div className="mb-4 h-5 w-1/2 rounded bg-cyan-300/10" />
                    <div className="h-10 w-3/4 rounded bg-cyan-300/10" />
                    <div className="mt-8 space-y-2">
                      <div className="h-9 rounded bg-cyan-300/10" />
                      <div className="h-9 rounded bg-cyan-300/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shops.length === 0 ? (
              <EmptyMarketplace onCreate={() => navigate('/sell')} hasShop={hasShop} />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {shops.map((shop) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    isOwner={Boolean(user && user.id === shop.owner_id)}
                    onOpen={() =>
                      user && user.id === shop.owner_id
                        ? navigate('/sell')
                        : navigate(`/shop/${shop.owner_username}`)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'orders' && (
          <section className={cn(panel, 'p-5')}>
            <BuyerOrders />
          </section>
        )}

        {activeTab === 'sales' && (
          <section className={cn(panel, 'p-5')}>
            <MarketplaceSellerOrders />
          </section>
        )}
      </main>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(card, 'p-5 text-center')}>
      <p className="text-3xl font-black text-cyan-100">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
    </div>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition',
        active
          ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
          : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:text-white'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function EmptyMarketplace({
  onCreate,
  hasShop,
}: {
  onCreate: () => void
  hasShop: boolean
}) {
  return (
    <div className={cn(card, 'flex min-h-[320px] items-center justify-center p-8 text-center')}>
      <div>
        <Store className="mx-auto mb-4 h-14 w-14 text-slate-600" />
        <h2 className="text-2xl font-black text-white">No Shops Available</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Be the first seller in the marketplace and start listing items for Mai Troll members.
        </p>

        {!hasShop && (
          <button onClick={onCreate} className={cn(primary, 'mt-5')}>
            <Plus className="h-4 w-4" />
            Create Your Shop
          </button>
        )}
      </div>
    </div>
  )
}

function ShopCard({
  shop,
  isOwner,
  onOpen,
}: {
  shop: any
  isOwner: boolean
  onOpen: () => void
}) {
  return (
    <article className={cn(card, 'group overflow-hidden p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_0_34px_rgba(34,211,238,0.15)]')}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-cyan-100">{shop.name}</h3>
          <p className="text-sm text-slate-500">by @{shop.owner_username}</p>
        </div>

        {isOwner && (
          <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
            Your Shop
          </span>
        )}
      </div>

      <div className="mb-5 space-y-2">
        {shop.shop_items?.length > 0 ? (
          shop.shop_items.slice(0, 3).map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <span className="truncate text-sm text-slate-200">{item.name}</span>
              <span className="flex items-center gap-1 text-sm font-black text-cyan-200">
                <Coins className="h-3.5 w-3.5" />
                {Number(item.price || 0).toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-500">
            No items listed yet.
          </div>
        )}
      </div>

      <button onClick={onOpen} className={cn(primary, 'w-full')}>
        <ShoppingCart className="h-4 w-4" />
        {isOwner ? 'Manage Shop' : 'Visit Shop'}
      </button>
    </article>
  )
}