import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  Search,
  UserX,
  ShieldAlert,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { neonCard, neonTextGradient } from '../phoneTheme'

interface BlockedUser {
  id: string
  blocked_id: string
  blocked_username: string
  blocked_display_name: string | null
  blocked_avatar_url: string | null
  created_at: string
}

export default function PhoneBlockedUsers() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  const fetchBlockedUsers = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: blocks, error: blocksError } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false })

      if (blocksError) throw blocksError

      const blockedIds = (blocks || [])
        .map((row: any) => row.blocked_id)
        .filter(Boolean)

      let profiles: any[] = []

      if (blockedIds.length > 0) {
        const { data: profilesData, error: profilesError } =
          await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', blockedIds)

        if (profilesError) throw profilesError

        profiles = profilesData || []
      }

      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile])
      )

      const mapped: BlockedUser[] = (blocks || []).map((row: any) => {
        const profile = profileMap.get(row.blocked_id) || {}

        return {
          id: row.id,
          blocked_id: row.blocked_id,
          blocked_username:
            profile.username || `user${row.blocked_id.slice(0, 6)}`,
          blocked_display_name: profile.display_name || null,
          blocked_avatar_url: profile.avatar_url || null,
          created_at: row.created_at,
        }
      })

      setBlockedUsers(mapped)
    } catch (error) {
      console.error('[PhoneBlockedUsers] Failed to fetch:', error)
      toast.error('Failed to load blocked users')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchBlockedUsers()
  }, [fetchBlockedUsers])

  const handleUnblock = async (
    blockedUserId: string,
    username: string
  ) => {
    if (!user?.id) return

    const confirmed = window.confirm(
      `Are you sure you want to unblock @${username}?`
    )

    if (!confirmed) return

    setUnblockingId(blockedUserId)

    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedUserId)

      if (error) throw error

      setBlockedUsers((current) =>
        current.filter(
          (blocked) => blocked.blocked_id !== blockedUserId
        )
      )

      toast.success(`Unblocked @${username}`)
    } catch (error) {
      console.error('[PhoneBlockedUsers] Failed to unblock:', error)
      toast.error('Failed to unblock user')
    } finally {
      setUnblockingId(null)
    }
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return blockedUsers

    return blockedUsers.filter((user) => {
      return (
        user.blocked_username.toLowerCase().includes(query) ||
        user.blocked_display_name?.toLowerCase().includes(query)
      )
    })
  }, [blockedUsers, searchQuery])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* Ambient neon background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#00BFFF]/10 blur-[100px]" />
        <div className="absolute -right-32 top-80 h-72 w-72 rounded-full bg-[#BF00FF]/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-600/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="text-center">
            <h1
              className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}
            >
              Blocked Users
            </h1>

            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
              {blockedUsers.length} blocked
            </p>
          </div>

          <div className="w-9" />
        </div>
      </header>

      <main className="relative z-10 space-y-4 p-4 pb-24">
        {/* Title Card */}
        <section
          className={`${neonCard} overflow-hidden p-5`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-gradient-to-br from-red-500/20 to-purple-500/20 shadow-[0_0_25px_rgba(239,68,68,0.12)]">
              <Ban className="h-6 w-6 text-red-400" />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-black text-white">
                Blocked Users
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Manage people you have blocked from your MaiTroll experience.
              </p>
            </div>
          </div>
        </section>

        {/* Search */}
        <section className={`${neonCard} p-3`}>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400/60" />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search blocked users..."
              className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#00BFFF]/40 focus:bg-black/40 focus:ring-1 focus:ring-[#00BFFF]/20"
            />
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <section className={`${neonCard} p-5`}>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
                >
                  <div className="h-11 w-11 shrink-0 rounded-full bg-white/10" />

                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 rounded bg-white/10" />
                    <div className="h-2 w-20 rounded bg-white/5" />
                  </div>

                  <div className="h-8 w-20 rounded-xl bg-white/5" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty */}
        {!loading && filteredUsers.length === 0 && (
          <section
            className={`${neonCard} p-8 text-center`}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00BFFF]/10 bg-[#00BFFF]/5">
              <UserX className="h-8 w-8 text-[#00BFFF]/40" />
            </div>

            <h3 className="mt-4 text-base font-black text-white">
              {searchQuery
                ? 'No Matching Users'
                : 'No Blocked Users'}
            </h3>

            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
              {searchQuery
                ? 'Try searching for a different username or display name.'
                : "You haven't blocked anyone yet. Users you block will appear here."}
            </p>
          </section>
        )}

        {/* Blocked Users */}
        {!loading && filteredUsers.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white/80">
                  Your Block List
                </h3>

                <p className="mt-0.5 text-[10px] text-white/30">
                  {filteredUsers.length}{' '}
                  {filteredUsers.length === 1 ? 'user' : 'users'}
                </p>
              </div>

              <Ban className="h-4 w-4 text-red-400/50" />
            </div>

            <div className="space-y-2">
              {filteredUsers.map((blockedUser) => {
                const avatar =
                  blockedUser.blocked_avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    blockedUser.blocked_username
                  )}`

                const isUnblocking =
                  unblockingId === blockedUser.blocked_id

                return (
                  <div
                    key={blockedUser.id}
                    className={`${neonCard} flex items-center gap-3 p-3`}
                  >
                    {/* Avatar */}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/profile/id/${blockedUser.blocked_id}`
                        )
                      }
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#00BFFF]/20 bg-black/30 transition active:scale-95"
                    >
                      <img
                        src={avatar}
                        alt={blockedUser.blocked_username}
                        className="h-full w-full object-cover"
                      />

                      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
                    </button>

                    {/* User Info */}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/profile/id/${blockedUser.blocked_id}`
                        )
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-black text-white">
                        {blockedUser.blocked_display_name ||
                          blockedUser.blocked_username}
                      </p>

                      <p className="mt-0.5 truncate text-[11px] text-cyan-300/60">
                        @{blockedUser.blocked_username}
                      </p>

                      <p className="mt-1 text-[9px] text-white/25">
                        Blocked{' '}
                        {new Date(
                          blockedUser.created_at
                        ).toLocaleDateString()}
                      </p>
                    </button>

                    {/* Unblock */}
                    <button
                      type="button"
                      disabled={isUnblocking}
                      onClick={() =>
                        handleUnblock(
                          blockedUser.blocked_id,
                          blockedUser.blocked_username
                        )
                      }
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-black text-emerald-300 transition active:scale-95 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5 rotate-180" />

                      {isUnblocking ? '...' : 'Unblock'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Blocking Information */}
        <section className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            </div>

            <div>
              <p className="text-xs font-black text-amber-200">
                About Blocking
              </p>

              <p className="mt-1.5 text-[10px] leading-relaxed text-amber-200/50">
                Blocking limits interaction between you and another
                user. They are not notified when you block them.
              </p>
            </div>
          </div>
        </section>

        {/* Browse Profiles */}
        {!loading && blockedUsers.length === 0 && (
          <button
            type="button"
            onClick={() => navigate('/community')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 py-3 text-xs font-black text-purple-300 transition active:scale-[0.98] hover:bg-[#BF00FF]/10"
          >
            <User className="h-4 w-4" />
            Back to Community
          </button>
        )}
      </main>
    </div>
  )
}