import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { ShareAThonProvider, useShareAThon } from '../../contexts/ShareAThonContext'
import { toast } from 'sonner'
import {
  Share2,
  Radio,
  Trophy,
  Users,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  Info,
  ArrowRight,
  Shield,
  Gift,
  Star,
  TrendingUp,
  AlertTriangle,
  ExternalLink
} from 'lucide-react'

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', color: 'from-pink-500 to-rose-500' },
  { id: 'facebook', label: 'Facebook', color: 'from-blue-600 to-blue-500' },
  { id: 'instagram', label: 'Instagram', color: 'from-purple-500 via-pink-500 to-yellow-500' },
  { id: 'x', label: 'X', color: 'from-gray-700 to-gray-900' },
  { id: 'youtube', label: 'YouTube', color: 'from-red-600 to-red-500' },
  { id: 'discord', label: 'Discord', color: 'from-indigo-500 to-indigo-400' },
  { id: 'reddit', label: 'Reddit', color: 'from-orange-500 to-orange-400' }
]

function ShareAThonContent() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const {
    event,
    myEligibility,
    mySubmissions,
    loading,
    isAdmin,
    isEligible,
    refreshEligibility,
    refreshSubmissions,
    startEvent,
    endEvent,
    toggleRestrictNewBroadcasters
  } = useShareAThon()

  const isBroadcaster = profile?.is_troller || profile?.role === 'user'

  useEffect(() => {
    if (user && event?.status !== 'inactive') {
      refreshEligibility()
      refreshSubmissions()
    }
  }, [user, event?.status])

  const handleStartEvent = async () => {
    const confirmed = window.confirm('Start Share-A-Thon Weekend? This will activate the event and restrict new broadcasters from broadcasting.')
    if (!confirmed) return
    await startEvent()
  }

  const handleEndEvent = async () => {
    const confirmed = window.confirm('End Share-A-Thon Weekend? This will mark the event as completed.')
    if (!confirmed) return
    await endEvent()
  }

  if (loading && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Event not found. Please contact an admin.</p>
      </div>
    )
  }

  const progressPercent = Math.min(100, (event.current_live_broadcasters / event.goal_live_broadcasters) * 100)
  const approvedShares = mySubmissions.filter(s => s.status === 'approved').length
  const uniquePlatforms = new Set(mySubmissions.filter(s => s.status === 'approved').map(s => s.platform)).size

  const qualificationChecks = [
    {
      label: 'Stream for 2+ hours',
      current: myEligibility ? Math.floor(myEligibility.stream_duration_minutes / 60) : 0,
      target: 2,
      unit: 'hours',
      icon: <Radio className="w-4 h-4" />,
      complete: myEligibility ? myEligibility.stream_duration_minutes >= 120 : false
    },
    {
      label: 'Participate in 3+ battles',
      current: myEligibility?.battles_participated || 0,
      target: 3,
      unit: 'battles',
      icon: <Zap className="w-4 h-4" />,
      complete: (myEligibility?.battles_participated || 0) >= 3
    },
    {
      label: 'Share to 2+ platforms',
      current: uniquePlatforms,
      target: 2,
      unit: 'platforms',
      icon: <Share2 className="w-4 h-4" />,
      complete: uniquePlatforms >= 2
    }
  ]

  const allQualified = qualificationChecks.every(c => c.complete) && myEligibility?.is_qualified

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-600/20 via-cyan-500/10 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/20">
                  <Share2 className="w-6 h-6 text-cyan-400" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {event.title}
                </h1>
              </div>
              <p className="text-gray-400 max-w-xl">{event.description}</p>
            </div>

            <div className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
              event.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              event.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              event.status === 'completed' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                event.status === 'active' ? 'bg-green-400 animate-pulse' :
                event.status === 'waiting' ? 'bg-yellow-400 animate-pulse' :
                event.status === 'completed' ? 'bg-purple-400' : 'bg-gray-400'
              }`} />
              {event.status === 'active' ? 'ACTIVE' :
               event.status === 'waiting' ? 'WAITING FOR BROADCASTERS' :
               event.status === 'completed' ? 'COMPLETED' : 'INACTIVE'}
            </div>
          </div>

          {/* Progress Tracker */}
          {event.status !== 'inactive' && (
            <div className="glass-panel rounded-2xl p-6 mb-8 border border-cyan-400/10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-gray-300">Live Eligible Broadcasters</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-cyan-400">{event.current_live_broadcasters}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-lg text-gray-400">{event.goal_live_broadcasters}</span>
                </div>
              </div>
              <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {event.status === 'waiting' && (
                <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Need {event.goal_live_broadcasters - event.current_live_broadcasters} more live broadcaster(s) to activate
                </p>
              )}
              {event.status === 'active' && (
                <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Event is live! Start streaming, battling, and sharing!
                </p>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            {isEligible && (
              <button
                onClick={() => navigate('/shareathon/submit')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 font-semibold text-sm transition-all flex items-center gap-2 glow-cyan"
              >
                <Share2 className="w-4 h-4" />
                Submit Share Proof
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin/shareathon/dashboard')}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-semibold text-sm transition-all flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Admin Dashboard
              </button>
            )}
            <button
              onClick={() => navigate('/shareathon/leaderboard')}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              Leaderboard
            </button>
            {isAdmin && event.status === 'inactive' && (
              <button
                onClick={handleStartEvent}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-semibold text-sm transition-all flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Start Event
              </button>
            )}
            {isAdmin && (event.status === 'active' || event.status === 'waiting') && (
              <button
                onClick={handleEndEvent}
                className="px-5 py-2.5 rounded-xl bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 font-semibold text-sm transition-all flex items-center gap-2 text-red-400"
              >
                <XCircle className="w-4 h-4" />
                End Event
              </button>
            )}
          </div>

          {/* Admin Broadcast Restriction Control */}
          {isAdmin && (
            <div className="glass rounded-2xl p-5 mb-8 border border-orange-400/15">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-orange-400" />
                  <div>
                    <h3 className="font-semibold text-orange-400">New Broadcaster Restriction</h3>
                    <p className="text-xs text-gray-400">
                      {event.restrict_new_broadcasters
                        ? 'New users CANNOT broadcast during the event'
                        : 'All users can broadcast normally'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleRestrictNewBroadcasters(!event.restrict_new_broadcasters)}
                  className={`px-5 py-2 rounded-xl font-semibold text-sm transition-all ${
                    event.restrict_new_broadcasters
                      ? 'bg-orange-600 hover:bg-orange-500 text-white'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {event.restrict_new_broadcasters ? 'Restrictions ON' : 'Restrictions OFF'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {event.status !== 'inactive' && (
        <div className="max-w-6xl mx-auto px-4 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Eligible Broadcasters', value: '—', icon: <Users className="w-4 h-4 text-cyan-400" />, color: 'cyan' },
              { label: 'Qualified', value: '—', icon: <CheckCircle className="w-4 h-4 text-green-400" />, color: 'green' },
              { label: 'Total Shares', value: event.total_shares_submitted, icon: <Share2 className="w-4 h-4 text-purple-400" />, color: 'purple' },
              { label: 'Peak Live', value: event.peak_simultaneous_broadcasters, icon: <Radio className="w-4 h-4 text-pink-400" />, color: 'pink' }
            ].map((stat, i) => (
              <div key={i} className="glass rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-xs text-gray-400">{stat.label}</span>
                </div>
                <span className="text-xl font-bold">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Info & Qualification */}
          <div className="md:col-span-2 space-y-6">
            {/* Event Info */}
            <div className="glass rounded-2xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-gold-400 text-yellow-400" />
                Event Rules
              </h2>
              <div className="space-y-3 text-sm text-gray-300">
                <p className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  Exclusively for current Mai Troll broadcasters who had access before the event started
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  New users can watch, tip, join seats, and chat — but cannot broadcast or qualify for rewards
                </p>
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  Fraudulent share submissions result in disqualification
                </p>
                {event.status !== 'inactive' && (
                  <p className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    Admins can manually approve or revoke rewards at any time
                  </p>
                )}
              </div>
            </div>

            {/* Rewards */}
            <div className="glass rounded-2xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-pink-400" />
                Rewards
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-400 mb-1">${event.bonus_amount}</div>
                  <div className="text-xs text-gray-400">Cashout Bonus</div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">0%</div>
                  <div className="text-xs text-gray-400">Cashout Fee (Next)</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">🏆</div>
                  <div className="text-xs text-gray-400">Share-A-Thon Badge</div>
                </div>
              </div>
            </div>

            {/* Accepted Platforms */}
            <div className="glass rounded-2xl p-6 border border-white/5">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-cyan-400" />
                Accepted Sharing Platforms
              </h2>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <span
                    key={p.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r ${p.color} bg-opacity-20 border border-white/10`}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Qualification Status */}
          <div className="space-y-6">
            {myEligibility && (
              <div className="glass rounded-2xl p-6 border border-white/5">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Your Qualification
                </h2>

                {myEligibility.disqualified ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 font-semibold">Disqualified</p>
                    <p className="text-xs text-gray-400 mt-1">{myEligibility.disqualification_reason}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {qualificationChecks.map((check, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm flex items-center gap-2">
                            {check.icon}
                            {check.label}
                          </span>
                          {check.complete ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="text-xs text-gray-400">
                              {check.current}/{check.target} {check.unit}
                            </span>
                          )}
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              check.complete
                                ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                                : 'bg-gradient-to-r from-cyan-600 to-purple-600'
                            }`}
                            style={{ width: `${Math.min(100, (check.current / check.target) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    <div className={`mt-4 p-3 rounded-xl text-center text-sm font-semibold ${
                      myEligibility.is_qualified
                        ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                        : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                    }`}>
                      {myEligibility.is_qualified ? (
                        <>Qualified for Rewards!</>
                      ) : (
                        <>Complete all requirements to qualify</>
                      )}
                    </div>

                    <button
                      onClick={() => navigate('/shareathon/submit')}
                      className="w-full mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600/20 to-purple-600/20 border border-cyan-400/20 hover:border-cyan-400/40 text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Submit Share Proof
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* My Submissions */}
            {mySubmissions.length > 0 && (
              <div className="glass rounded-2xl p-6 border border-white/5">
                <h2 className="text-lg font-bold mb-4">My Submissions</h2>
                <div className="space-y-2">
                  {mySubmissions.slice(0, 5).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize">{sub.platform}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        sub.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        sub.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        sub.status === 'more_info_requested' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {sub.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Not Eligible Notice */}
            {user && !myEligibility && event.status !== 'inactive' && (
              <div className="glass rounded-2xl p-6 border border-yellow-400/15">
                <div className="text-center">
                  <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <h3 className="font-semibold text-yellow-400 mb-1">Not Eligible</h3>
                  <p className="text-xs text-gray-400">
                    You don't have broadcaster status or signed up after the event started.
                    You can still watch, tip, and participate in chats!
                  </p>
                </div>
              </div>
            )}

            {!user && (
              <div className="glass rounded-2xl p-6 border border-cyan-400/15">
                <div className="text-center">
                  <Users className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <h3 className="font-semibold text-cyan-400 mb-1">Join the Fun!</h3>
                  <p className="text-xs text-gray-400">
                    Sign in to check your eligibility and participate in the Share-A-Thon Weekend event.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShareAThonLanding() {
  return (
    <ShareAThonProvider>
      <ShareAThonContent />
    </ShareAThonProvider>
  )
}
