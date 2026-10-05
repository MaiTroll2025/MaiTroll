import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, Image as ImageIcon, Loader2, Lock, Play, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import HashtagCaption from '@/components/HashtagCaption'

interface StoryRow {
  id: string
  visibility: 'everyone' | 'followers' | 'private'
  expires_at: string
  monetization_mode: 'free' | 'paid' | 'subscribers_only' | 'free_for_subscribers'
  base_price_coins: number
}

interface ProfileStory {
  id: string
  visibility: StoryRow['visibility']
  monetizationMode: StoryRow['monetization_mode']
  hasAccess: boolean
  basePrice: number
  finalPrice: number
  discountPercent: number
  expiresAt: string
  items: Array<{
    id: string
    mediaType: 'photo' | 'video'
    mediaUrl: string
    caption: string | null
  }>
}

interface StoryTransaction {
  id: string
  story_id: string | null
  purchaser_id: string
  creator_id: string | null
  purchased_at: string
  access_expires_at: string | null
  base_price_coins: number
  discount_percent: number
  discount_coins: number
  final_price_coins: number
  creator_earnings_coins: number
  platform_fee_coins: number
  status: string
}

export default function ProfileMaiPiks({ userId, username }: { userId: string; username: string }) {
  const navigate = useNavigate()
  const viewer = useAuthStore((state) => state.user)
  const [stories, setStories] = useState<ProfileStory[]>([])
  const [purchases, setPurchases] = useState<StoryTransaction[]>([])
  const [sales, setSales] = useState<StoryTransaction[]>([])
  const [transactionUsernames, setTransactionUsernames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)

  const loadStories = useCallback(async () => {
    setLoading(true)
    try {
      const { data: rows, error } = await supabase
        .from('maipiks_stories')
        .select('id, visibility, expires_at, monetization_mode, base_price_coins')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const storyData = await Promise.all((rows || []).map(async (row) => {
        const story = row as StoryRow
        const [{ data: quote, error: quoteError }, { data: items, error: itemError }] = await Promise.all([
          supabase.rpc('maipiks_story_pricing', { p_story_id: story.id }),
          supabase
            .from('maipiks_story_items')
            .select('id, storage_path, media_url, media_type, caption')
            .eq('story_id', story.id)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true }),
        ])

        if (quoteError) throw quoteError
        if (itemError) throw itemError

        const pricing = quote as Record<string, unknown>
        const hasAccess = Boolean(pricing?.has_access)
        const mediaItems = hasAccess
          ? await Promise.all((items || []).map(async (item) => {
              let path = item.storage_path as string | null
              if (!path && typeof item.media_url === 'string' && item.media_url.includes('/maipiks/')) {
                const encodedPath = item.media_url.split('/maipiks/').pop()?.split('?')[0]
                try {
                  path = encodedPath ? decodeURIComponent(encodedPath) : null
                } catch {
                  path = null
                }
              }
              if (!path) return null
              const { data: signed, error: signedError } = await supabase.storage
                .from('maipiks')
                .createSignedUrl(path, 60 * 60)
              if (signedError || !signed?.signedUrl) return null
              return {
                id: item.id,
                mediaType: item.media_type === 'video' ? 'video' as const : 'photo' as const,
                mediaUrl: signed.signedUrl,
                caption: item.caption,
              }
            }))
          : []

        return {
          id: story.id,
          visibility: story.visibility,
          monetizationMode: story.monetization_mode || 'free',
          hasAccess,
          basePrice: Number(pricing?.base_price_coins ?? story.base_price_coins ?? 0),
          finalPrice: Number(pricing?.final_price_coins ?? story.base_price_coins ?? 0),
          discountPercent: Number(pricing?.discount_percent ?? 0),
          expiresAt: story.expires_at,
          items: mediaItems.filter((item): item is NonNullable<typeof item> => item !== null),
        } satisfies ProfileStory
      }))

      setStories(storyData.filter((story) => story.hasAccess || story.monetizationMode !== 'free' || story.items.length > 0))

      if (viewer?.id === userId) {
        const [purchaseResult, salesResult] = await Promise.all([
          supabase.from('maipiks_story_purchases')
            .select('id, story_id, purchaser_id, creator_id, purchased_at, access_expires_at, base_price_coins, discount_percent, discount_coins, final_price_coins, creator_earnings_coins, platform_fee_coins, status')
            .eq('purchaser_id', userId)
            .order('purchased_at', { ascending: false })
            .limit(50),
          supabase.from('maipiks_story_purchases')
            .select('id, story_id, purchaser_id, creator_id, purchased_at, access_expires_at, base_price_coins, discount_percent, discount_coins, final_price_coins, creator_earnings_coins, platform_fee_coins, status')
            .eq('creator_id', userId)
            .order('purchased_at', { ascending: false })
            .limit(50),
        ])
        if (purchaseResult.error || salesResult.error) {
          console.error('[ProfileMaiPiks] Purchase history failed:', purchaseResult.error || salesResult.error)
          setPurchases([])
          setSales([])
        } else {
          const purchaseRows = (purchaseResult.data || []) as StoryTransaction[]
          const salesRows = (salesResult.data || []) as StoryTransaction[]
          setPurchases(purchaseRows)
          setSales(salesRows)
          const participantIds = [...new Set([
            ...purchaseRows.map((row) => row.creator_id),
            ...salesRows.map((row) => row.purchaser_id),
          ].filter((id): id is string => Boolean(id)))]
          if (participantIds.length > 0) {
            const { data: profiles } = await supabase.from('user_profiles').select('id, username').in('id', participantIds)
            setTransactionUsernames(Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.username || 'user'])))
          } else {
            setTransactionUsernames({})
          }
        }
      } else {
        setPurchases([])
        setSales([])
        setTransactionUsernames({})
      }
    } catch (error) {
      console.error('[ProfileMaiPiks] Could not load profile stories:', error)
      toast.error('Could not load Mai Piks')
      setStories([])
    } finally {
      setLoading(false)
    }
  }, [userId, viewer?.id])

  useEffect(() => {
    void loadStories()
  }, [loadStories])

  const purchase = async (story: ProfileStory) => {
    if (!viewer) {
      navigate('/auth')
      return
    }
    if (story.monetizationMode === 'subscribers_only') {
      navigate(`/profile/${encodeURIComponent(username)}?tab=subscriptions`)
      return
    }

    const { data: quoteData, error: quoteError } = await supabase.rpc('maipiks_story_pricing', {
      p_story_id: story.id,
    })
    if (quoteError || !quoteData) {
      toast.error(quoteError?.message || 'Could not check story access')
      return
    }
    const quote = quoteData as Record<string, unknown>
    const price = Number(quote.final_price_coins ?? 0)
    const discount = Number(quote.discount_percent ?? 0)
    const prompt = price > 0
      ? `Unlock this story for ${price.toLocaleString()} Troll Coins${discount ? ` (${discount}% subscriber discount)` : ''}?`
      : 'Unlock this story for free?'
    if (!window.confirm(prompt)) return

    setPurchasingId(story.id)
    const { data, error } = await supabase.rpc('maipiks_purchase_story', { p_story_id: story.id })
    if (error || !data) {
      toast.error(error?.message || 'Could not unlock this story')
      setPurchasingId(null)
      return
    }
    await useAuthStore.getState().refreshProfile()
    await loadStories()
    toast.success('Story unlocked')
    setPurchasingId(null)
  }

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div>
  }

  return (
    <div className="space-y-4">
      {stories.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-10 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-white/25" />
          <h3 className="mt-3 text-sm font-black text-white">No active Mai Piks</h3>
        </div>
      )}
      {stories.map((story) => (
        <article key={story.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              {story.monetizationMode === 'free' ? <Sparkles className="h-4 w-4 text-cyan-300" /> : <Lock className="h-4 w-4 text-orange-300" />}
              <span className="text-xs font-bold text-white">
                {story.monetizationMode === 'subscribers_only'
                  ? 'Subscribers only'
                  : story.monetizationMode === 'free_for_subscribers'
                    ? 'Free for subscribers'
                    : story.monetizationMode === 'paid' ? 'Paid story' : 'Story'}
              </span>
              {story.visibility === 'followers' && <span className="text-[10px] text-zinc-500">Followers</span>}
            </div>
            {!story.hasAccess && story.monetizationMode !== 'subscribers_only' && (
              <button
                type="button"
                onClick={() => void purchase(story)}
                disabled={purchasingId === story.id}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 text-xs font-black text-amber-100 disabled:opacity-50"
              >
                {purchasingId === story.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                Unlock for {story.finalPrice.toLocaleString()} coins
              </button>
            )}
            {!story.hasAccess && story.monetizationMode === 'subscribers_only' && (
              <button type="button" onClick={() => void purchase(story)} className="min-h-9 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 text-xs font-bold text-cyan-100">
                Subscribe to view
              </button>
            )}
          </div>
          {!story.hasAccess ? (
            <div className="px-4 py-8 text-center text-xs text-zinc-500">
              {story.discountPercent > 0 && <p className="mb-1 text-emerald-300">{story.discountPercent}% subscriber discount applied</p>}
              Protected story media stays hidden until access is granted.
            </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              {story.items.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-lg border border-white/10 bg-black">
                  {item.mediaType === 'video' ? (
                    <video src={item.mediaUrl} controls playsInline className="max-h-[520px] w-full object-contain" />
                  ) : (
                    <img src={item.mediaUrl} alt="Mai Piks story" loading="lazy" className="max-h-[520px] w-full object-contain" />
                  )}
                  {item.caption && <p className="px-3 py-2 text-xs text-zinc-300"><HashtagCaption text={item.caption} /></p>}
                </div>
              ))}
              {story.items.length === 0 && <div className="text-center text-xs text-zinc-500">No active media remains.</div>}
            </div>
          )}
        </article>
      ))}

      {viewer?.id === userId && (
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <h2 className="text-sm font-black text-white">Mai Piks purchases and sales</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-cyan-200">Your purchases</h3>
              {purchases.length === 0 ? <p className="text-xs text-zinc-500">No story purchases yet.</p> : (
                <div className="space-y-2">
                  {purchases.map((transaction) => (
                    <div key={transaction.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-white">@{transactionUsernames[transaction.creator_id || ''] || 'creator'}</span>
                        <span className="font-bold text-cyan-200">{transaction.final_price_coins.toLocaleString()} coins</span>
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-500">{transaction.story_id ? `Story ${transaction.story_id.slice(0, 8)}` : 'Story expired or removed'} · {new Date(transaction.purchased_at).toLocaleDateString()}</p>
                      <p className="mt-1 text-[10px] text-zinc-400">Access: {transaction.access_expires_at ? new Date(transaction.access_expires_at).toLocaleString() : 'Permanent'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-amber-200">Your sales</h3>
              {sales.length === 0 ? <p className="text-xs text-zinc-500">No story sales yet.</p> : (
                <div className="space-y-2">
                  {sales.map((transaction) => (
                    <div key={transaction.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-white">@{transactionUsernames[transaction.purchaser_id] || 'viewer'}</span>
                        <span className="font-bold text-amber-200">+{transaction.creator_earnings_coins.toLocaleString()} coins</span>
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-500">Gross {transaction.final_price_coins.toLocaleString()} · Discount {transaction.discount_coins.toLocaleString()} · Platform fee {transaction.platform_fee_coins.toLocaleString()}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">{transaction.story_id ? `Story ${transaction.story_id.slice(0, 8)}` : 'Story expired or removed'} · {new Date(transaction.purchased_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}