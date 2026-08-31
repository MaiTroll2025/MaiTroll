import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  Search,
  Gift,
  Sparkles,
  Crown,
  Gem,
  Check,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useGiftSystem, GiftItem } from '@/lib/hooks/useGiftSystem'
import MKeySendPanel from '@/components/broadcast/mkey/MKeySendPanel'
import { useMKeyWallet } from '@/hooks/useMKeyWallet'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type { GiftItem } from '@/lib/hooks/useGiftSystem'

export type GiftTargetType = 'broadcaster' | 'all' | 'specific'

export interface GiftTarget {
  type: GiftTargetType
  userId?: string
  username?: string
  quantity?: number
}

interface PhoneGiftModalProps {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  streamId: string
  broadcasterId?: string
  activeUserIds?: string[]
  userProfiles?: Record<
    string,
    {
      username: string
      avatar_url?: string
    }
  >
  onGiftSent?: (gift: GiftItem, target: GiftTarget) => void
  sharedChannel?: any
}

type GiftCategory =
  | 'all'
  | 'general'
  | 'cars'
  | 'houses'
  | 'boats'
  | 'planes'
  | 'luxury'
  | 'men'
  | 'women'
  | 'lgbt'
  | 'holiday'
  | 'smoking'
  | 'drinking'
  | 'funny'
  | 'seasonal'

type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'

const CATEGORIES: {
  id: GiftCategory
  label: string
  icon: React.ReactNode
}[] = [
  { id: 'all', label: 'All', icon: <Gift size={13} /> },
  { id: 'general', label: 'General', icon: <Sparkles size={13} /> },
  { id: 'cars', label: 'Cars', icon: '🏎️' },
  { id: 'houses', label: 'Houses', icon: '🏠' },
  { id: 'boats', label: 'Boats', icon: '🛥️' },
  { id: 'planes', label: 'Planes', icon: '✈️' },
  { id: 'luxury', label: 'Luxury', icon: <Crown size={13} /> },
  { id: 'men', label: 'Men', icon: '👨' },
  { id: 'women', label: 'Women', icon: '👩' },
  { id: 'lgbt', label: 'LGBT', icon: '🌈' },
  { id: 'holiday', label: 'Holiday', icon: '🎄' },
  { id: 'smoking', label: 'Smoking', icon: '🚬' },
  { id: 'drinking', label: 'Drinking', icon: '🍺' },
  { id: 'funny', label: 'Funny', icon: '😂' },
  { id: 'seasonal', label: 'Seasonal', icon: '🌸' },
]

const RARITY_STYLES: Record<
  Rarity,
  {
    border: string
    glow: string
    label: string
    badge: string
  }
> = {
  common: {
    border: 'border-white/10',
    glow: '',
    label: 'Common',
    badge: 'bg-white/[0.06] text-white/45',
  },
  uncommon: {
    border: 'border-emerald-400/25',
    glow: 'shadow-[0_0_18px_rgba(52,211,153,0.05)]',
    label: 'Uncommon',
    badge: 'bg-emerald-400/10 text-emerald-300',
  },
  rare: {
    border: 'border-blue-400/30',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.07)]',
    label: 'Rare',
    badge: 'bg-blue-400/10 text-blue-300',
  },
  epic: {
    border: 'border-purple-400/35',
    glow: 'shadow-[0_0_22px_rgba(168,85,247,0.08)]',
    label: 'Epic',
    badge: 'bg-purple-400/10 text-purple-300',
  },
  legendary: {
    border: 'border-orange-400/40',
    glow: 'shadow-[0_0_24px_rgba(251,146,60,0.10)]',
    label: 'Legendary',
    badge: 'bg-orange-400/10 text-orange-300',
  },
  mythic: {
    border: 'border-yellow-300/45',
    glow: 'shadow-[0_0_26px_rgba(250,204,21,0.12)]',
    label: 'Mythic',
    badge: 'bg-yellow-300/10 text-yellow-200',
  },
}

function getRarity(gift: GiftItem): Rarity {
  const rarity = String(gift.rarity || '').toLowerCase()

  if (
    rarity === 'common' ||
    rarity === 'uncommon' ||
    rarity === 'rare' ||
    rarity === 'epic' ||
    rarity === 'legendary' ||
    rarity === 'mythic'
  ) {
    return rarity
  }

  return 'common'
}

export default function PhoneGiftModal({
  isOpen,
  onClose,
  recipientId,
  streamId,
  broadcasterId = recipientId,
  activeUserIds = [],
  userProfiles = {},
  onGiftSent,
  sharedChannel,
}: PhoneGiftModalProps) {
  const { user, profile } = useAuthStore()
  const { sendGift, isSending } = useGiftSystem()

  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [selectedCategory, setSelectedCategory] =
    useState<GiftCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [showMKey, setShowMKey] = useState(false)

  const [giftTarget, setGiftTarget] = useState<GiftTarget>({
    type: 'specific',
    userId: recipientId,
  })

  const { wallet: mkeyWallet } = useMKeyWallet({
    enabled: isOpen,
  })

  useEffect(() => {
    if (!isOpen) return

    setGiftTarget({
      type: 'specific',
      userId: recipientId,
    })

    setSelectedGift(null)
    setQuantity(1)
    setSearchQuery('')
    setSelectedCategory('all')
    setShowMKey(false)
  }, [isOpen, recipientId])

  useEffect(() => {
    if (!isOpen) return

    setIsLoading(true)
    setGifts([])
    fetchGifts()
  }, [isOpen])

  async function fetchGifts() {
    try {
      const tables = ['gift_items']

      let rawGifts: any[] = []

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('coin_cost', { ascending: true })
            .limit(200)

          if (!error && data && data.length > 0) {
            rawGifts = data
            break
          }
        } catch {
          continue
        }
      }

      if (rawGifts.length === 0) {
        const { data: purchasableItems } = await supabase
          .from('purchasable_items')
          .select('*')
          .eq('category', 'gift')
          .eq('is_active', true)
          .order('coin_price', { ascending: true })
          .limit(200)

        if (purchasableItems && purchasableItems.length > 0) {
          rawGifts = purchasableItems
        }
      }

      const transformedGifts: GiftItem[] = rawGifts.map((g: any) => {
        const id =
          g.id ||
          String(g._id || g.gift_id || '')

        const name =
          g.name ||
          g.gift_name ||
          g.title ||
          g.display_name ||
          'Unknown Gift'

        const icon =
          g.icon ||
          g.icon_url ||
          g.emoji ||
          g.gift_icon ||
          '🎁'

        const coinCost = Number(
          g.coin_cost ??
            g.coinCost ??
            g.value ??
            g.cost ??
            g.price ??
            g.coin_price ??
            g.coins ??
            g.amount ??
            0
        )

        const slug =
          g.slug ||
          g.gift_slug ||
          g.item_key ||
          name.toLowerCase().replace(/\s+/g, '-')

        const animationType =
          g.animation_type ||
          g.animationType ||
          g.animation ||
          undefined

        const category =
          g.category ||
          g.gift_category ||
          g.metadata?.subcategory ||
          undefined

        return {
          id,
          name,
          icon,
          coinCost,
          type: coinCost > 0 ? 'paid' : 'free',
          slug,
          animationKey:
            g.animation_key ||
            g.animationKey ||
            g.gift_slug ||
            slug,
          animationType,
          animationUrl:
            g.animation_url ||
            g.animationUrl ||
            g.video_url ||
            g.videoUrl ||
            null,
          videoUrl:
            g.video_url ||
            g.videoUrl ||
            g.animation_url ||
            g.animationUrl ||
            null,
          animationDurationMs:
            g.animation_duration_ms ||
            g.animationDurationMs ||
            undefined,
          soundUrl:
            g.sound_url ||
            g.soundUrl ||
            null,
          isFullscreen:
            g.is_fullscreen ??
            g.isFullscreen ??
            undefined,
          rarity: g.rarity || undefined,
          description:
            g.description ||
            undefined,
          trayVisualUrl:
            g.tray_visual_url ||
            g.trayVisualUrl ||
            undefined,
          trayGradient:
            g.tray_gradient ||
            g.trayGradient ||
            undefined,
          category,
        }
      })

      setGifts(transformedGifts)
    } catch (err) {
      console.error(
        '[PhoneGiftModal] Failed to load gifts:',
        err
      )
    } finally {
      setIsLoading(false)
    }
  }

  const getGiftCategory = (
    gift: GiftItem
  ): GiftCategory => {
    const nameLower = gift.name.toLowerCase()
    const icon = gift.icon
    const category = String(
      gift.category || ''
    ).toLowerCase()

    if (
      category.includes('royalty') ||
      category.includes('luxury') ||
      nameLower.includes('crown') ||
      nameLower.includes('diamond') ||
      nameLower.includes('gold') ||
      nameLower.includes('platinum') ||
      nameLower.includes('aurora')
    ) {
      return 'luxury'
    }

    if (
      nameLower.includes('car') ||
      nameLower.includes('lamborghini') ||
      nameLower.includes('ferrari')
    ) {
      return 'cars'
    }

    if (
      nameLower.includes('house') ||
      nameLower.includes('mansion') ||
      nameLower.includes('castle')
    ) {
      return 'houses'
    }

    if (
      nameLower.includes('boat') ||
      nameLower.includes('yacht')
    ) {
      return 'boats'
    }

    if (
      nameLower.includes('plane') ||
      nameLower.includes('jet') ||
      nameLower.includes('helicopter')
    ) {
      return 'planes'
    }

    if (
      nameLower.includes('cigarette') ||
      nameLower.includes('cigar') ||
      nameLower.includes('smoke')
    ) {
      return 'smoking'
    }

    if (
      nameLower.includes('beer') ||
      nameLower.includes('wine') ||
      nameLower.includes('champagne')
    ) {
      return 'drinking'
    }

    if (
      nameLower.includes('clown') ||
      nameLower.includes('meme') ||
      nameLower.includes('troll')
    ) {
      return 'funny'
    }

    if (
      nameLower.includes('christmas') ||
      nameLower.includes('santa') ||
      nameLower.includes('pumpkin')
    ) {
      return 'holiday'
    }

    if (
      nameLower.includes('rainbow') ||
      nameLower.includes('pride')
    ) {
      return 'lgbt'
    }

    if (
      icon === '👨' ||
      nameLower.includes('men') ||
      nameLower.includes('muscle')
    ) {
      return 'men'
    }

    if (
      icon === '👩' ||
      nameLower.includes('women') ||
      nameLower.includes('dress')
    ) {
      return 'women'
    }

    if (
      nameLower.includes('sunny') ||
      nameLower.includes('snow') ||
      nameLower.includes('spring')
    ) {
      return 'seasonal'
    }

    return 'general'
  }

  const filteredGifts = useMemo(() => {
    let filtered = gifts

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        gift =>
          getGiftCategory(gift) ===
          selectedCategory
      )
    }

    if (searchQuery.trim()) {
      const query =
        searchQuery.toLowerCase()

      filtered = filtered.filter(gift =>
        gift.name
          .toLowerCase()
          .includes(query)
      )
    }

    return filtered
  }, [
    gifts,
    selectedCategory,
    searchQuery,
  ])

  const totalCost = selectedGift
    ? selectedGift.coinCost * quantity
    : 0

  const handleSendGift = async () => {
    if (
      !selectedGift ||
      !user ||
      !profile ||
      isSending
    ) {
      return
    }

    const targetReceiverId =
      giftTarget.userId || recipientId

    if (user.id === targetReceiverId) {
      toast.error(
        'You cannot send gifts to yourself'
      )
      return
    }

    try {
      const result = await sendGift(
        selectedGift,
        {
          receiverId: targetReceiverId,
          quantity,
          streamId,
        }
      )

      if (
        result &&
        typeof result === 'object' &&
        result.success
      ) {
        toast.success(
          `Sent ${selectedGift.name} x${quantity}`
        )

        const sentGift = selectedGift

        setSelectedGift(null)
        setQuantity(1)

        onGiftSent?.(
          sentGift,
          {
            type: 'specific',
            userId: targetReceiverId,
            quantity,
          }
        )
      }
    } catch {
      toast.error(
        'Failed to send gift'
      )
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative flex w-full flex-col overflow-hidden',
          'rounded-t-[26px] border border-white/[0.09]',
          'bg-[#080a12]',
          'shadow-[0_-18px_60px_rgba(0,0,0,0.75)]',
          'h-[52dvh] max-h-[560px] min-h-[360px]'
        )}
        onClick={e =>
          e.stopPropagation()
        }
      >
        {/* Top highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />

        {/* Drag Handle */}
        <div className="flex shrink-0 justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-white/15" />
        </div>

        {/* Compact Header */}
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/15 to-violet-500/10">
              <Gift
                size={17}
                className="text-cyan-200"
              />
              <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_7px_rgba(103,232,249,0.8)]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[14px] font-black tracking-tight text-white">
                  Gifts
                </h2>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.12em] text-white/35">
                  LIVE
                </span>
              </div>

              <p className="truncate text-[9px] font-medium text-white/30">
                Support this broadcast
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-yellow-300/10 bg-yellow-300/[0.05] px-2 py-1">
              <span className="text-[10px]">🪙</span>
              <span className="text-[8px] font-black text-yellow-200/80">
                {Number(
                  (mkeyWallet as any)?.balance ??
                    (mkeyWallet as any)?.coins ??
                    0
                ).toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] transition active:scale-95"
              aria-label="Close gifts"
            >
              <X
                size={16}
                className="text-white/60"
              />
            </button>
          </div>
        </div>

        {/* Compact Search */}
        <div className="shrink-0 px-4 pb-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              type="text"
              value={searchQuery}
              onChange={e =>
                setSearchQuery(
                  e.target.value
                )
              }
              placeholder="Search gifts..."
              className={cn(
                'h-9 w-full rounded-xl',
                'border border-white/[0.08]',
                'bg-white/[0.04]',
                'pl-9 pr-9',
                'text-[11px] font-medium text-white',
                'placeholder:text-white/25',
                'outline-none transition',
                'focus:border-cyan-300/25',
                'focus:bg-white/[0.055]'
              )}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  setSearchQuery('')
                }
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-white/[0.06]"
              >
                <X
                  size={11}
                  className="text-white/50"
                />
              </button>
            )}
          </div>
        </div>

        {/* Compact Categories */}
        <div className="shrink-0 overflow-x-auto border-b border-white/[0.05] px-4 pb-2 scrollbar-none">
          <div className="flex w-max gap-1">
            {CATEGORIES.map(category => {
              const active =
                selectedCategory ===
                category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(
                      category.id
                    )
                  }
                  className={cn(
                    'flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5',
                    'text-[7px] font-black uppercase tracking-[0.07em]',
                    'transition-all active:scale-[0.97]',
                    active
                      ? 'border-cyan-300/30 bg-cyan-300/[0.11] text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.08)]'
                      : 'border-white/[0.08] bg-white/[0.025] text-white/40'
                  )}
                >
                  {category.icon}
                  <span>
                    {category.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Gift Grid */}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            'overscroll-contain',
            'px-3.5 py-2.5',
            selectedGift
              ? 'pb-2'
              : 'pb-4'
          )}
        >
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({
                length: 6,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-[112px] animate-pulse rounded-[17px] border border-white/[0.05] bg-white/[0.025]"
                />
              ))}
            </div>
          ) : filteredGifts.length === 0 ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
              <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Gift
                  size={19}
                  className="text-white/20"
                />
              </div>

              <p className="text-[11px] font-black text-white/60">
                No gifts found
              </p>

              <p className="mt-1 max-w-[190px] text-[9px] leading-relaxed text-white/25">
                Try another gift name or category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredGifts.map(gift => {
                const rarity =
                  getRarity(gift)

                const rarityStyle =
                  RARITY_STYLES[
                    rarity
                  ]

                const selected =
                  selectedGift?.id ===
                  gift.id

                return (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() =>
                      setSelectedGift(
                        gift
                      )
                    }
                    className={cn(
                      'group relative min-h-[116px] overflow-hidden rounded-[18px]',
                      'border bg-white/[0.025]',
                      'p-2 text-left',
                      'transition-all duration-200',
                      'active:scale-[0.965]',
                      rarityStyle.border,
                      rarityStyle.glow,
                      selected &&
                        'border-cyan-300/55 bg-cyan-300/[0.075] shadow-[0_0_24px_rgba(34,211,238,0.12)]'
                    )}
                  >
                    {gift.trayGradient && (
                      <div
                        className="pointer-events-none absolute inset-0 opacity-20"
                        style={{
                          background:
                            gift.trayGradient,
                        }}
                      />
                    )}

                    {selected && (
                      <div className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-cyan-300 text-black shadow-[0_0_12px_rgba(103,232,249,0.35)]">
                        <Check
                          size={11}
                          strokeWidth={3}
                        />
                      </div>
                    )}

                    {rarity !==
                      'common' && (
                      <span
                        className={cn(
                          'absolute left-1.5 top-1.5 z-10 rounded-full px-1 py-0.5 text-[5px] font-black uppercase tracking-[0.1em]',
                          rarityStyle.badge
                        )}
                      >
                        {
                          rarityStyle.label
                        }
                      </span>
                    )}

                    {/* Artwork */}
                    <div className="relative flex h-[67px] items-center justify-center">
                      <div
                        className={cn(
                          'absolute h-12 w-12 rounded-full blur-xl opacity-20',
                          selected &&
                            'opacity-45'
                        )}
                      />

                      {gift.trayVisualUrl ? (
                        <img
                          src={
                            gift.trayVisualUrl
                          }
                          alt=""
                          className={cn(
                            'relative z-[1] h-[54px] w-[54px] object-contain',
                            'transition-transform duration-200',
                            'group-active:scale-95',
                            selected &&
                              'scale-105'
                          )}
                          draggable={false}
                        />
                      ) : (
                        <span
                          className={cn(
                            'relative z-[1] text-[37px] leading-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]',
                            'transition-transform duration-200',
                            selected &&
                              'scale-110'
                          )}
                        >
                          {gift.icon}
                        </span>
                      )}
                    </div>

                    {/* Gift Info */}
                    <div className="relative z-[2]">
                      <p className="truncate text-[9px] font-black text-white/90">
                        {gift.name}
                      </p>

                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="flex items-center gap-0.5 text-[8px] font-black text-yellow-200/80">
                          <span className="text-[8px]">
                            🪙
                          </span>
                          {gift.coinCost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* MKey Compact Toggle */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#090b13]/95 px-3 py-1.5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() =>
              setShowMKey(
                value => !value
              )
            }
            className="flex min-h-[34px] w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-lg bg-violet-400/10">
                <Gem
                  size={12}
                  className="text-violet-300"
                />
              </div>

              <div className="text-left">
                <p className="text-[9px] font-black text-white/70">
                  MKey
                </p>
                <p className="text-[7px] font-medium text-white/25">
                  Send MKey to this broadcast
                </p>
              </div>
            </div>

            <ChevronDown
              size={14}
              className={cn(
                'text-white/30 transition-transform',
                showMKey &&
                  'rotate-180'
              )}
            />
          </button>

          {showMKey && (
            <div className="pt-1.5">
              <MKeySendPanel
                broadcastId={streamId}
                onSent={() => {}}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Selected Gift Action Dock */}
        {selectedGift && (
          <div
            className={cn(
              'shrink-0 border-t border-white/[0.07]',
              'bg-[#070910]/98 px-3 pt-2',
              'pb-[max(8px,env(safe-area-inset-bottom))]',
              'backdrop-blur-2xl'
            )}
          >
            <div className="flex items-center gap-2.5">
              {/* Mini artwork */}
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045]">
                {selectedGift.trayVisualUrl ? (
                  <img
                    src={
                      selectedGift.trayVisualUrl
                    }
                    alt=""
                    className="h-7 w-7 object-contain"
                    draggable={false}
                  />
                ) : (
                  <span className="text-xl">
                    {selectedGift.icon}
                  </span>
                )}
              </div>

              {/* Name / Price */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-black text-white">
                  {selectedGift.name}
                </p>

                <p className="mt-0.5 text-[7px] font-bold text-white/35">
                  {selectedGift.coinCost.toLocaleString()}{' '}
                  coins each
                </p>
              </div>

              {/* Quantity */}
              <div className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.045] p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(q =>
                      Math.max(
                        1,
                        q - 1
                      )
                    )
                  }
                  className="grid h-7 w-7 place-items-center rounded-full text-base font-medium text-white/60 active:bg-white/10"
                  aria-label="Decrease quantity"
                >
                  −
                </button>

                <span className="w-6 text-center text-[10px] font-black text-white">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity(q =>
                      q + 1
                    )
                  }
                  className="grid h-7 w-7 place-items-center rounded-full text-base font-medium text-white/70 active:bg-white/10"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total + Send */}
            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="min-w-0 w-[92px] shrink-0">
                <p className="text-[6px] font-black uppercase tracking-[0.15em] text-white/25">
                  Total
                </p>

                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-black text-yellow-200">
                  🪙{' '}
                  {totalCost.toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  handleSendGift
                }
                disabled={isSending}
                className={cn(
                  'min-h-[40px] flex-1 rounded-xl',
                  'border border-cyan-300/25',
                  'bg-gradient-to-r from-cyan-500/25 via-cyan-400/15 to-violet-500/25',
                  'px-3',
                  'text-[8px] font-black uppercase tracking-[0.12em] text-white',
                  'shadow-[0_0_20px_rgba(34,211,238,0.10)]',
                  'transition-all active:scale-[0.985]',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {isSending
                  ? 'Sending...'
                  : `Send Gift • ${quantity}x`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
