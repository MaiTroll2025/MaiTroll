import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Users, ArrowRight, DollarSign, Crown, Trophy, Flame, Shield, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { useSquads } from '@/lib/hooks/useSquads'

const neonCard =
  'relative overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(ellipse_at_50%_55%,#25103c_0%,#0a0814_100%)] shadow-[0_0_20px_rgba(147,51,234,0.10)]'

export default function Squads() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { fetchSquads } = useSquads()
  const [squads, setSquads] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [mySquad, setMySquad] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchSquads()
      setSquads(list)
    } finally {
      setLoading(false)
    }
  }, [fetchSquads])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!user) return
    void supabaseFetchMySquad(user.id)
  }, [user])

  const supabaseFetchMySquad = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('squad_memberships')
        .select('*, squads(name, slug, tag, logo_url, status, block_name)')
        .eq('user_id', uid)
        .is('left_at', null)
        .maybeSingle()
      setMySquad(data || null)
    } catch { setMySquad(null) }
  }

  const filtered = squads.filter((s) =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.tag.toLowerCase().includes(search.toLowerCase())
  )

  const accent = ['#39ff14', '#00d9ff', '#ff25e8', '#af20ff', '#facc15']

  return (
    <div className="min-h-screen bg-[#070511] text-white p-4 sm:p-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Squads <span className="text-cyan-400">Broadcasting Communities</span>
          </h1>
          <p className="text-sm text-slate-400">
            Claim your block. Recruit members. Broadcast together. Earn Squad Cash weekly.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search Squads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl px-4 py-2.5 text-white bg-white/5 border border-white/10 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 w-full sm:w-64"
          />
          {user && (
            <button
              onClick={() => navigate('/squads/create')}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 font-black text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] transition"
            >
              <Users className="w-4 h-4" /> Start a Squad
            </button>
          )}
        </div>
      </header>

      {mySquad && (
        <section
          className={`${neonCard} mb-6 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-l-4 border-purple-500`}
          style={{ borderImageSource: 'linear-gradient(to bottom,#af20ff,#00d9ff)', borderImageSlice: '1' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-white font-black text-lg">
              {mySquad.squads?.tag?.charAt(0) || 'S'}
            </div>
            <div>
              <p className="text-[10px] font-black text-cyan-300 uppercase tracking-wider">Your City Block</p>
              <p className="font-bold text-white text-lg">{mySquad.squads?.name}</p>
              <p className="text-xs text-slate-400">
                @{mySquad.squads?.tag} <span className="text-white/40">•</span> Block{' '}
                <span className="text-yellow-300 font-bold">{mySquad.squads?.block_name ?? 'The Strip'}</span>
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-col sm:flex-row gap-2">
            <Link
              to={`/squads/${mySquad.squads.slug}`}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10 transition"
            >
              <MapPin className="w-3 h-3 mr-1" /> View Block
            </Link>
            <Link
              to="/squads/manage"
              className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-black text-white shadow-[0_0_15px_rgba(147,51,234,0.5)] hover:from-purple-500 hover:to-pink-500"
            >
              <Crown className="w-3 h-3 mr-1" /> Leader Dashboard
            </Link>
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Squad Flame Leaderboard</h2>
          </div>
          <Link
            to="/squads/leaderboard"
            className="text-xs text-cyan-400 underline underline-offset-4 hover:text-cyan-300 transition"
          >
            View full rankings →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <p className="col-span-full text-slate-500 text-center py-12">No Squads on the block yet. Be the first.</p>
          ) : (
            filtered.map((s, i) => (
              <Link
                key={s.id}
                to={`/squads/${s.slug}`}
                className={`
                  ${neonCard} p-4 group transition border-[1px]
                  border-white/10 hover:border-cyan-400/60 hover:shadow-[0_0_25px_rgba(0,217,255,0.15)]
                `}
                style={accent[i % accent.length] ? { borderColor: accent[i % accent.length] } : {}}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/40 text-white font-black text-xl border border-white/10"
                      style={{ boxShadow: `0 0 12px ${accent[i % accent.length]}` }}
                    >
                      {s.tag?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <p className="font-black text-white text-sm">{s.name}</p>
                      <p className="text-[10px] font-mono font-bold text-cyan-400">@{s.tag}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="text-[10px] font-black text-yellow-300">Leader</span>
                  </div>
                </div>
                {s.description && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-1">{s.description}</p>
                )}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase">Members</div>
                    <div className="font-bold text-white">{s.member_count ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase">Flame</div>
                    <div className="font-bold text-yellow-400">—</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase">Cash</div>
                    <div className="font-bold text-cyan-300">Weekly</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <Flame className="w-4 h-4 text-yellow-500" />
                  <span className="text-[10px] font-black text-cyan-300">
                    <ArrowRight className="w-3 h-3 inline mr-1" /> Claim Block
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className={`${neonCard} p-6`}>
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">How Squads Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatRow icon={<Users className="w-5 h-5 text-cyan-400" />} label="Create" text="3,000 Troll Coins. You become the Squad Leader." />
          <StatRow icon={<Shield className="w-5 h-5 text-purple-400" />} label="Join" text="100 Troll Coins — 50 to your Leader, 50 to MaiTroll." />
          <StatRow icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label="Earn" text="Squad Cash paid weekly. The weekly hold stays after you leave." />
        </div>
      </section>

      {loading && <p className="text-slate-500 text-center py-8">Loading the block…</p>}
    </div>
  )
}

function StatRow({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">{icon}</div>
      <div>
        <div className="text-xs font-black text-white">{label}</div>
        <div className="text-[11px] text-slate-400">{text}</div>
      </div>
    </div>
  )
}
