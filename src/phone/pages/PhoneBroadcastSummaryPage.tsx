import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'

interface UserStats {
  trollmondsSpent: number
  giftsReceived: number
  newFollowers: number
}

function looksLikeUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidPattern.test(trimmed)) return true
  const noDashPattern = /^[0-9a-f]{32}$/i
  if (noDashPattern.test(trimmed)) return true
  return false
}

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return value.toLocaleString()
}

export default function PhoneBroadcastSummaryPage() {
  const navigate = useNavigate()
  const { id: streamId } = useParams<{ id?: string }>()
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState<string | null>(null)
  const [broadcasterName, setBroadcasterName] = useState<string | null>(null)
  const [totalLikes, setTotalLikes] = useState(0)
  const [userStats, setUserStats] = useState<UserStats>({
    trollmondsSpent: 0,
    giftsReceived: 0,
    newFollowers: 0,
  })
  const [isBroadcaster, setIsBroadcaster] = useState(false)

  useEffect(() => {
    if (!streamId) {
      setLoading(false)
      return
    }

    const fetchSummary = async () => {
      try {
        const { data: stream, error } = await supabase
          .from('streams')
          .select('title, total_likes, created_at, ended_at, user_id')
          .eq('id', streamId)
          .maybeSingle()

        if (error) throw error

        const broadcasterId = stream?.user_id || ''
        const streamCreatedAt = stream?.created_at || new Date().toISOString()
        const streamEndedAt = stream?.ended_at || new Date().toISOString()

        setTitle(
          looksLikeUUID(stream?.title)
            ? 'Stream Ended'
            : stream?.title || 'Stream Ended',
        )
        setTotalLikes(stream?.total_likes || 0)

        setIsBroadcaster(user?.id === broadcasterId)

        let trollmondsSpent = 0
        let giftsReceived = 0
        let newFollowers = 0

        if (broadcasterId) {
          const { data: broadcasterProfile } = await supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', broadcasterId)
            .maybeSingle()

          setBroadcasterName(
            broadcasterProfile?.display_name || broadcasterProfile?.username || null,
          )
        }

        if (user?.id) {
          const { data: streamGiftsSpent } = await supabase
            .from('stream_gifts')
            .select('trollmonds_spent, metadata')
            .eq('stream_id', streamId)
            .eq('sender_id', user.id)

          if (streamGiftsSpent && streamGiftsSpent.length > 0) {
            trollmondsSpent = streamGiftsSpent.reduce((sum, g: any) => {
              const spent = g.trollmonds_spent ?? g.metadata?.trollmonds_spent ?? g.metadata?.trollmonds_deducted ?? 0
              return sum + (typeof spent === 'number' ? spent : 0)
            }, 0)
          }

          const { data: streamGiftsReceived } = await supabase
            .from('stream_gifts')
            .select('quantity')
            .eq('stream_id', streamId)
            .eq('receiver_id', user.id)

          if (streamGiftsReceived && streamGiftsReceived.length > 0) {
            giftsReceived = streamGiftsReceived.reduce((sum, g) => sum + (g.quantity || 1), 0)
          }

          const { data: artistProfile } = await supabase
            .from('artist_profiles')
            .select('id')
            .eq('user_id', broadcasterId)
            .maybeSingle()

          if (artistProfile?.id) {
            const { count: followerCount } = await supabase
              .from('artist_followers')
              .select('id', { count: 'exact' })
              .eq('artist_id', artistProfile.id)
              .gte('created_at', streamCreatedAt)
              .lte('created_at', streamEndedAt)

            newFollowers = followerCount || 0
          }
        }

        setUserStats({
          trollmondsSpent,
          giftsReceived,
          newFollowers,
        })
      } catch (err) {
        console.error('PhoneBroadcastSummaryPage: fetch failed', err)
      } finally {
        setLoading(false)
      }
    }

    void fetchSummary()
  }, [streamId, user?.id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm font-black uppercase tracking-widest text-white/90">
            Broadcast Summary
          </h1>
          <p className="truncate text-[10px] font-semibold text-zinc-500">
            {title || 'Stream Ended'}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-black text-white/90">Broadcast Ended</h2>
            {broadcasterName && (
              <p className="mt-1 text-sm font-semibold text-zinc-300">
                {broadcasterName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Trollmonds Spent
              </span>
              <p className="mt-2 text-2xl font-black text-yellow-400">
                {formatValue(userStats.trollmondsSpent)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Gifts Received
              </span>
              <p className="mt-2 text-2xl font-black text-pink-400">
                {formatValue(userStats.giftsReceived)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Total Likes
              </span>
              <p className="mt-2 text-2xl font-black text-red-400">
                {formatValue(totalLikes)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                New Followers
              </span>
              <p className="mt-2 text-2xl font-black text-emerald-400">
                {formatValue(userStats.newFollowers)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400"
          >
            Back to Home
          </button>
        </div>
      </main>
    </div>
  )
}
