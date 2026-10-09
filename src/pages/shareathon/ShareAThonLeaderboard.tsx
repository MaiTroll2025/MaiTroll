import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShareAThonProvider } from '../../contexts/ShareAThonContext'
import { useShareAThon } from '../../hooks/useShareAThon'
import { toast } from 'sonner'
import { Trophy, ArrowLeft, Users, Share2, Zap, Clock, CheckCircle, Medal, Crown, Star, Loader2 } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  stream_duration_minutes: number
  battles_participated: number
  shares_approved: number
  is_qualified: boolean
  bonus_paid: boolean
  disqualified: boolean
  score: number
}

function LeaderboardContent() {
  const navigate = useNavigate()
  const { event, eligibleBroadcasters, loading: eventLoading } = useShareAThon()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'qualified'>('all')

  useEffect(() => {
    if (!event) return
    setLoading(true)
    try {
      const formatted: LeaderboardEntry[] = eligibleBroadcasters.map(b => ({
        user_id: b.user_id,
        username: b.username || 'Unknown',
        display_name: b.display_name || b.username || 'Unknown',
        avatar_url: b.avatar_url || null,
        stream_duration_minutes: b.stream_duration_minutes || 0,
        battles_participated: b.battles_participated || 0,
        shares_approved: b.shares_approved || 0,
        is_qualified: b.is_qualified || false,
        bonus_paid: b.bonus_paid || false,
        disqualified: b.disqualified || false,
        score: (b.stream_duration_minutes || 0) * 0.5 +
               (b.battles_participated || 0) * 10 +
               (b.shares_approved || 0) * 15
      }))

      formatted.sort((a, b) => b.score - a.score)
      setEntries(formatted)
    } catch (err: any) {
      console.error('Error building leaderboard:', err)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [event, eligibleBroadcasters])

  const filteredEntries = tab === 'qualified'
    ? entries.filter(e => e.is_qualified)
    : entries.filter(e => !e.disqualified)

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-400" />
    if (index === 1) return <Medal className="w-5 h-5 text-gray-300" />
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />
    return <span className="text-sm font-bold text-gray-500 w-5 text-center">{index + 1}</span>
  }

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/20'
    if (index === 1) return 'bg-gradient-to-r from-gray-400/10 to-gray-500/5 border-gray-400/20'
    if (index === 2) return 'bg-gradient-to-r from-amber-600/10 to-orange-500/5 border-amber-600/20'
    return 'bg-black/20 border-white/5'
  }

  if (eventLoading && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/shareathon')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Leaderboard
            </h1>
            <p className="text-sm text-gray-400">Share-A-Thon Weekend Rankings</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'all'
                ? 'bg-gradient-to-r from-cyan-600/30 to-purple-600/30 border border-cyan-400/30 text-white'
                : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white'
            }`}
          >
            All Participants
          </button>
          <button
            onClick={() => setTab('qualified')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
              tab === 'qualified'
                ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 border border-green-400/30 text-white'
                : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Qualified
          </button>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/5">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No participants yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry, index) => (
              <div
                key={entry.user_id}
                className={`rounded-xl p-4 border transition-all ${getRankBg(index)} ${
                  entry.is_qualified ? 'ring-1 ring-green-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 flex items-center justify-center">
                    {getRankIcon(index)}
                  </div>

                  <div className="flex-shrink-0">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.display_name}
                        className="w-10 h-10 rounded-full border border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-sm font-bold">
                        {entry.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{entry.display_name}</span>
                      {entry.is_qualified && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" />
                          Qualified
                        </span>
                      )}
                      {entry.bonus_paid && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3" />
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(entry.stream_duration_minutes / 60)}h {entry.stream_duration_minutes % 60}m
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {entry.battles_participated} battles
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {entry.shares_approved} shares
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-cyan-400">{Math.round(entry.score)}</div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Scoring Info */}
        <div className="glass rounded-2xl p-5 mt-6 border border-white/5">
          <h3 className="text-sm font-semibold mb-3 text-gray-300">Scoring System</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-black/20">
              <Clock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <div className="text-xs text-gray-400">Stream Time</div>
              <div className="text-xs font-semibold text-cyan-400">0.5 pts/min</div>
            </div>
            <div className="p-2 rounded-lg bg-black/20">
              <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <div className="text-xs text-gray-400">Battles</div>
              <div className="text-xs font-semibold text-yellow-400">10 pts each</div>
            </div>
            <div className="p-2 rounded-lg bg-black/20">
              <Share2 className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-xs text-gray-400">Shares</div>
              <div className="text-xs font-semibold text-purple-400">15 pts each</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShareAThonLeaderboard() {
  return (
    <ShareAThonProvider>
      <LeaderboardContent />
    </ShareAThonProvider>
  )
}
