import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Music, Users, ArrowLeft } from 'lucide-react'
import { usePresenceStore } from '@/lib/presenceStore'
import { useAuthStore } from '@/lib/store'

export default function MaiRecordLabelPage() {
  const navigate = useNavigate()
  const onlineCount = usePresenceStore((state) => state.onlineCount)
  const { user } = useAuthStore()

  const isComingSoon = onlineCount > 100

  return (
    <div className="relative min-h-full w-full overflow-y-auto overflow-x-hidden text-white">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-6 px-4 py-6 md:px-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-900/40 via-slate-900/80 to-cyan-900/30 p-6 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.10),transparent_50%)]" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
                <Music size={32} className="text-purple-300" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white md:text-4xl">
                  MAI Record Label
                </h1>
                <p className="mt-1 text-sm text-slate-300 md:text-base">
                  Mai Troll&apos;s in-platform music program for creators and artists.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Coming Soon / Program Preview
              </span>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2">
                <Users size={16} className="text-cyan-400" />
                <span className="text-xs font-bold text-slate-300">
                  {onlineCount.toLocaleString()} users online now
                </span>
              </div>
            </div>
          </div>
        </div>

        {isComingSoon && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center md:text-left">
            <p className="text-sm font-bold text-amber-300">
              Program Launch Threshold Reached
            </p>
            <p className="mt-1 text-xs text-amber-200/80">
              The platform currently has more than 100 active users. MAI Record Label applications and music publishing are not yet available. Check back as the program prepares for launch.
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-lg font-black text-white">About the Program</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              MAI Record Label is Mai Troll&apos;s in-platform music program where users can apply to become artists, promote original music on Mai Troll, and earn Troll Coin tips from listeners. This is a preview of the program rules and structure.
            </p>
            {!user && (
              <p className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200">
                Sign in to track your artist application status and eligibility once the program launches.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-lg font-black text-white">What&apos;s Coming</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                Artist applications and profile setup
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                Music upload and publishing tools
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                Track promotion across Mai Troll
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                Troll Coin tips directly from listeners
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                Artist dashboards and earnings insights
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-lg font-black text-white">Program Rules</h2>
          <div className="mt-4 space-y-4">
            <RuleItem
              number="01"
              title="30-Day Probationary Period"
              description="All new artists begin with a 30-day probationary period. During this time, your music, earnings, and publishing limits are monitored before full artist status is granted."
            />
            <RuleItem
              number="02"
              title="50/50 Artist / Platform Split During Probation"
              description="Music earnings during probation use a 50/50 split. 50% goes to the artist and 50% goes to Mai Troll."
            />
            <RuleItem
              number="03"
              title="10 Songs Per Week Limit"
              description="Artists may publish up to 10 songs per week during probation. This limit helps maintain quality and gives new artists time to build an audience."
            />
            <RuleItem
              number="04"
              title="Weekly Qualification Threshold"
              description="Each published song must earn at least 500 Troll Coins per week toward qualification. Consistent performance is required to advance."
            />
            <RuleItem
              number="05"
              title="30-Day Performance Review"
              description="At the end of the 30 days, performance is reviewed before the user becomes an official MAI Record Label artist. Meeting the weekly threshold and quality standards is required for approval."
            />
            <RuleItem
              number="06"
              title="80/20 Split for Approved Artists"
              description="Approved artists move to an 80/20 split, with 80% going to the artist and 20% to Mai Troll. This is the current standard tier for active artists."
            />
            <RuleItem
              number="07"
              title="Future Tiers Not Yet Active"
              description="Future artist tiers may eventually increase to 90/10 and potentially 95/5, but those tiers are not implemented yet. Only the probationary 50/50 and approved artist 80/20 splits are active."
            />
            <RuleItem
              number="08"
              title="Promotion and Listener Tips"
              description="Artists will eventually be able to promote their tracks throughout Mai Troll and receive tips directly from listeners. These features are part of the program preview and will be enabled in a future update."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 text-center">
          <p className="text-sm font-bold text-purple-200">
            Applications, uploads, payouts, and music playback are not active yet.
          </p>
          <p className="mt-1 text-xs text-purple-300/80">
            This page is a program preview. Check back later for updates.
          </p>
        </div>
      </div>
    </div>
  )
}

function RuleItem({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-xs font-black text-purple-300">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
    </div>
  )
}
