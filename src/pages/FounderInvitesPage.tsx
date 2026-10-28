import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Copy,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  Loader2,
  Gift,
  ShieldCheck,
} from 'lucide-react'
import {
  getMyFounderInviteCode,
  listMyFounderReferrals,
  getMyFounderReferralStats,
  type FounderReferral,
  type FounderReferralStats,
} from '@/services/founderProgram'

export default function FounderInvitesPage() {
  const { user } = useAuthStore()
  const [code, setCode] = useState<string | null>(null)
  const [loadingCode, setLoadingCode] = useState(true)
  const [referrals, setReferrals] = useState<FounderReferral[]>([])
  const [stats, setStats] = useState<FounderReferralStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, list, s] = await Promise.all([
        getMyFounderInviteCode(),
        listMyFounderReferrals(200),
        getMyFounderReferralStats(),
      ])
      setCode(c)
      setReferrals(list)
      setStats(s)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load invite data')
    } finally {
      setLoading(false)
      setLoadingCode(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const copyCode = () => {
    if (!code) return
    navigator.clipboard.writeText(code).then(() => toast.success('Code copied'))
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Sign in to view your Founder invites.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 rounded-lg">
            <Gift className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Founder Invites</h1>
            <p className="text-sm text-slate-400">
              Share your 7-digit code. Earn $5 for every verified user.
            </p>
          </div>
        </header>

        {/* Code card */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-purple-500/10 p-6">
          <p className="text-xs uppercase tracking-wider text-amber-300 mb-2">
            Your Founder Invite Code
          </p>
          <div className="flex items-center gap-4">
            {loadingCode ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : code ? (
              <>
                <span className="text-4xl font-mono font-black tracking-[0.3em] text-white">
                  {code}
                </span>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              </>
            ) : (
              <span className="text-slate-400">
                No active founder code. Contact an admin.
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            New users enter this code during signup. A referral is verified once
            the invited user completes a cashout of at least 3,500 coins earned
            from broadcast gifts. You earn $5 per verified user.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Invited" value={stats.total_invited} icon={Users} />
            <StatCard label="Verified" value={stats.verified} icon={CheckCircle2} />
            <StatCard label="Paid" value={stats.paid} icon={DollarSign} />
            <StatCard
              label="Earnings"
              value={`$${stats.earnings_usd.toFixed(2)}`}
              icon={DollarSign}
            />
          </div>
        )}

        {/* Referrals table */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> Invited Users
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No referrals yet. Share your code to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Invited</th>
                    <th className="py-2 pr-4">Coin Progress</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="py-3 pr-4">
                        <div className="font-semibold">@{r.invited_username}</div>
                        {r.invited_display_name && (
                          <div className="text-xs text-slate-500">
                            {r.invited_display_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(r.invited_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        {r.payout_status === 'pending' ? (
                          <div>
                            <div className="text-xs text-slate-300 mb-1">
                              {(r.invited_coins ?? 0).toLocaleString()} / 3,500 coins
                            </div>
                            <div className="w-28 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-amber-400"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    ((r.invited_coins ?? 0) / 3500) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Cashout reached
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={r.payout_status} verifiedAt={r.verified_at} />
                      </td>
                      <td className="py-3 pr-4">
                        {r.payout_status === 'pending'
                          ? '-'
                          : `$${r.payout_amount_usd.toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400 mt-0.5" />
          <div className="text-sm text-slate-400">
            <p className="font-medium text-cyan-300 mb-1">How verification works</p>
            <p>
              An admin verifies a referral once the invited user completes a
              cashout of 3,500+ coins that were earned entirely from broadcast
              gifts. You receive $5 per verified referral.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  )
}

function StatusBadge({
  status,
  verifiedAt,
}: {
  status: FounderReferral['payout_status']
  verifiedAt?: string | null
}) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pending', cls: 'bg-slate-500/20 text-slate-300' },
    verified: { label: 'Verified', cls: 'bg-emerald-500/20 text-emerald-300' },
    paid: { label: 'Paid', cls: 'bg-amber-500/20 text-amber-300' },
    rejected: { label: 'Rejected', cls: 'bg-red-500/20 text-red-300' },
  }
  const m = map[status] ?? map.pending
  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${m.cls}`}>
      {m.label}
      {status === 'verified' && verifiedAt && (
        <span className="ml-1 opacity-70">
          {new Date(verifiedAt).toLocaleDateString()}
        </span>
      )}
    </span>
  )
}
