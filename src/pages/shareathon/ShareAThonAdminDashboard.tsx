import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { ShareAThonProvider, useShareAThon } from '../../contexts/ShareAThonContext'
import { toast } from 'sonner'
import { ArrowLeft, Users, Share2, Zap, Clock, CheckCircle, XCircle, DollarSign, Radio, Loader2, Search, Eye, Shield, BarChart3 } from 'lucide-react';

function AdminDashboardContent() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const {
    event,
    eligibleBroadcasters,
    allSubmissions,
    loading,
    startEvent,
    endEvent,
    toggleRestrictNewBroadcasters,
    disqualifyBroadcaster,
    qualifyBroadcaster,
    refreshEligibility,
    refreshSubmissions
  } = useShareAThon()

  const [searchTerm, setSearchTerm] = useState('')
  const [broadcasterFilter, setBroadcasterFilter] = useState<'all' | 'qualified' | 'disqualified' | 'pending'>('all')

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied')
      navigate('/')
    }
  }, [isAdmin, navigate])

  useEffect(() => {
    if (event && isAdmin) {
      refreshEligibility()
      refreshSubmissions()
    }
  }, [event, isAdmin])

  const stats = {
    eligible: eligibleBroadcasters.length,
    qualified: eligibleBroadcasters.filter(b => b.is_qualified).length,
    disqualified: eligibleBroadcasters.filter(b => b.disqualified).length,
    pendingVerification: allSubmissions.filter(s => s.status === 'pending').length,
    approvedVerification: allSubmissions.filter(s => s.status === 'approved').length,
    rejectedVerification: allSubmissions.filter(s => s.status === 'rejected').length,
    totalShares: allSubmissions.length,
    bonusPayout: eligibleBroadcasters.filter(b => b.bonus_paid).length * (event?.bonus_amount || 5)
  }

  const filteredBroadcasters = eligibleBroadcasters.filter(b => {
    const matchesSearch = !searchTerm ||
      b.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.display_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter =
      broadcasterFilter === 'all' ||
      (broadcasterFilter === 'qualified' && b.is_qualified) ||
      (broadcasterFilter === 'disqualified' && b.disqualified) ||
      (broadcasterFilter === 'pending' && !b.is_qualified && !b.disqualified)

    return matchesSearch && matchesFilter
  })

  const handleDisqualify = async (id: string) => {
    const reason = prompt('Enter disqualification reason:')
    if (!reason) return
    await disqualifyBroadcaster(id, reason)
  }

  const handleQualify = async (id: string) => {
    const confirmed = window.confirm('Qualify this broadcaster for rewards?')
    if (!confirmed) return
    await qualifyBroadcaster(id)
  }

  if (loading && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/shareathon')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
              Share-A-Thon Admin Dashboard
            </h1>
            <p className="text-sm text-gray-400">Event analytics and management</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            event?.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            event?.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
            event?.status === 'completed' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            {event?.status?.toUpperCase() || 'INACTIVE'}
          </div>
        </div>

        {/* Event Controls */}
        <div className="glass rounded-2xl p-5 mb-6 border border-white/5">
          <h2 className="text-sm font-semibold mb-3 text-gray-300">Event Controls</h2>
          <div className="flex flex-wrap gap-3">
            {event?.status === 'inactive' && (
              <button
                onClick={startEvent}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Start Event
              </button>
            )}
            {(event?.status === 'active' || event?.status === 'waiting') && (
              <button
                onClick={endEvent}
                className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-sm font-semibold transition-all flex items-center gap-2 text-red-400"
              >
                <XCircle className="w-4 h-4" />
                End Event
              </button>
            )}
            <button
              onClick={() => toggleRestrictNewBroadcasters(!event?.restrict_new_broadcasters)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                event?.restrict_new_broadcasters
                  ? 'bg-orange-600/20 border border-orange-500/30 text-orange-400'
                  : 'bg-white/5 border border-white/10 text-gray-300'
              }`}
            >
              <Shield className="w-4 h-4" />
              {event?.restrict_new_broadcasters ? 'Restrictions ON' : 'Restrictions OFF'}
            </button>
            <button
              onClick={() => navigate('/admin/shareathon/verification')}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold transition-all flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Verification Queue
              {stats.pendingVerification > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/30 text-yellow-400 text-xs">
                  {stats.pendingVerification}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Eligible Broadcasters', value: stats.eligible, icon: <Users className="w-4 h-4 text-cyan-400" />, color: 'cyan' },
            { label: 'Qualified', value: stats.qualified, icon: <CheckCircle className="w-4 h-4 text-green-400" />, color: 'green' },
            { label: 'Pending Verifications', value: stats.pendingVerification, icon: <Clock className="w-4 h-4 text-yellow-400" />, color: 'yellow' },
            { label: 'Approved Verifications', value: stats.approvedVerification, icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, color: 'emerald' },
            { label: 'Rejected', value: stats.rejectedVerification, icon: <XCircle className="w-4 h-4 text-red-400" />, color: 'red' },
            { label: 'Total Shares', value: stats.totalShares, icon: <Share2 className="w-4 h-4 text-purple-400" />, color: 'purple' },
            { label: 'Peak Live', value: event?.peak_simultaneous_broadcasters || 0, icon: <Radio className="w-4 h-4 text-pink-400" />, color: 'pink' },
            { label: 'Bonus Payout Total', value: `$${stats.bonusPayout}`, icon: <DollarSign className="w-4 h-4 text-green-400" />, color: 'green' }
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

        {/* Broadcasters Table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Eligible Broadcasters
              </h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full sm:w-48 pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>
                <select
                  value={broadcasterFilter}
                  onChange={(e) => setBroadcasterFilter(e.target.value as any)}
                  className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                >
                  <option value="all">All</option>
                  <option value="qualified">Qualified</option>
                  <option value="pending">Pending</option>
                  <option value="disqualified">Disqualified</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-xs text-gray-400">
                  <th className="text-left p-3 pl-5">User</th>
                  <th className="text-center p-3">Stream Time</th>
                  <th className="text-center p-3">Battles</th>
                  <th className="text-center p-3">Shares</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-center p-3 pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBroadcasters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500 text-sm">
                      No broadcasters found
                    </td>
                  </tr>
                ) : (
                  filteredBroadcasters.map(b => (
                    <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 pl-5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold">
                            {(b.display_name || b.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{b.display_name || b.username}</div>
                            <div className="text-xs text-gray-500">@{b.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-3 text-sm">
                        {Math.floor(b.stream_duration_minutes / 60)}h {b.stream_duration_minutes % 60}m
                      </td>
                      <td className="text-center p-3 text-sm">{b.battles_participated}</td>
                      <td className="text-center p-3 text-sm">{b.shares_approved}</td>
                      <td className="text-center p-3">
                        {b.disqualified ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Disqualified</span>
                        ) : b.is_qualified ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Qualified</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Pending</span>
                        )}
                      </td>
                      <td className="text-center p-3 pr-5">
                        <div className="flex items-center justify-center gap-1">
                          {!b.is_qualified && !b.disqualified && (
                            <button
                              onClick={() => handleQualify(b.id)}
                              className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-all"
                              title="Qualify"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {!b.disqualified && (
                            <button
                              onClick={() => handleDisqualify(b.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                              title="Disqualify"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ShareAThonAdminDashboard() {
  return (
    <ShareAThonProvider>
      <AdminDashboardContent />
    </ShareAThonProvider>
  )
}
