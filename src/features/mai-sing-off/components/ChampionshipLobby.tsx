import { useEffect, useState } from 'react'
import {
  Award,
  Crown,
  Loader2,
  Pencil,
  Plus,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { useSingOffActions } from '../hooks/useSingOffActions'
import type { SingOffChampionship } from '../types'

export function ChampionshipLobby() {
  const { profile } = useAuthStore()
  const actions = useSingOffActions()
  const isStaff = !!profile && (profile.is_ceo || profile.is_admin || profile.role === 'ceo' || profile.role === 'admin')

  const [championships, setChampionships] = useState<SingOffChampionship[]>([])
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(false)
  const [prizeOpen, setPrizeOpen] = useState<SingOffChampionship | null>(null)

  const [name, setName] = useState('')
  const [prizeCoins, setPrizeCoins] = useState('')
  const [prizeDesc, setPrizeDesc] = useState('')
  const [entriesLimit, setEntriesLimit] = useState('16')
  const [submitting, setSubmitting] = useState(false)

  const [editCoins, setEditCoins] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const load = async () => {
    setLoading(true)
    const data = await actions.listChampionships()
    setChampionships(data)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    setSubmitting(true)
    const res = await actions.generateChampionship(
      name.trim() || null,
      prizeCoins ? Number(prizeCoins) : 100000,
      prizeDesc.trim() || null,
      entriesLimit ? Number(entriesLimit) : 16,
    )
    setSubmitting(false)
    if (res.success) {
      toast.success('Championship season generated with auto-qualified entrants!')
      setGenOpen(false)
      setName('')
      setPrizeCoins('')
      setPrizeDesc('')
      setEntriesLimit('16')
      void load()
    } else {
      toast.error(res.error || 'Could not generate championship.')
    }
  }

  const handleEditPrize = async () => {
    if (!prizeOpen) return
    setSubmitting(true)
    const res = await actions.editGrandPrize(
      prizeOpen.id,
      editCoins ? Number(editCoins) : null,
      editDesc || null,
    )
    setSubmitting(false)
    if (res.success) {
      toast.success('Grand prize updated!')
      setPrizeOpen(null)
      void load()
    } else {
      toast.error(res.error || 'Could not update grand prize.')
    }
  }

  const openPrizeEditor = (c: SingOffChampionship) => {
    setPrizeOpen(c)
    setEditCoins(String(c.grand_prize_coins ?? ''))
    setEditDesc(c.grand_prize_description ?? '')
  }

  const statusColor = (status: string) =>
    status === 'active'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-400/30'
      : status === 'upcoming'
        ? 'text-amber-400 bg-amber-500/10 border-amber-400/30'
        : 'text-purple-400 bg-purple-500/10 border-purple-400/30'

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-yellow-400/25 bg-gradient-to-r from-amber-950/40 via-black to-yellow-950/30 p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(250,204,21,.35), transparent 35%), radial-gradient(circle at 80% 40%, rgba(234,179,8,.3), transparent 35%)',
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400/15">
              <Trophy className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black">
                CHAMPIONSHIP <span className="text-yellow-400">SEASONS</span>
              </h2>
              <p className="text-sm text-white/50">Qualify, compete, and claim the grand prize.</p>
            </div>
          </div>

          {isStaff && (
            <button
              type="button"
              onClick={() => setGenOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-600 px-4 py-2.5 text-sm font-black text-black shadow-lg shadow-yellow-600/30 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Generate Championship
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading seasons...
        </div>
      ) : championships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-white/15" />
          <p className="mt-3 text-sm text-white/40">No championship seasons yet.</p>
          {isStaff && <p className="mt-1 text-xs text-white/25">Generate the first season to auto-qualify top winners.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {championships.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-yellow-400/20 bg-zinc-950/80">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/10">
                    <Award className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">{c.name}</span>
                      {c.season_number && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/50">
                          S{c.season_number}
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {c.start_at ? new Date(c.start_at).toLocaleDateString() : ''}
                      {c.end_at ? ' - ' + new Date(c.end_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-right">
                    <div className="text-[9px] font-black uppercase tracking-wider text-yellow-300/60">Grand Prize</div>
                    <div className="text-sm font-black text-yellow-300">
                      {Number(c.grand_prize_coins ?? 0).toLocaleString()} coins
                    </div>
                  </div>

                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => openPrizeEditor(c)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] font-black text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit Prize
                    </button>
                  )}
                </div>
              </div>

              {c.grand_prize_description && (
                <div className="border-t border-white/5 px-4 py-2 text-xs text-white/40">{c.grand_prize_description}</div>
              )}

              {c.champion_user_id && (
                <div className="flex items-center gap-2 border-t border-yellow-400/10 bg-yellow-500/5 px-4 py-2 text-xs">
                  <Crown className="h-3.5 w-3.5 text-yellow-400" />
                  <span className="font-black text-yellow-300">Champion:</span>
                  <span className="text-white/60">{c.champion_user_id.slice(0, 8)}</span>
                </div>
              )}

              {c.entries && c.entries.length > 0 && (
                <div className="border-t border-white/5 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/40">
                    <Users className="h-3 w-3" />
                    {c.entries.length} Qualified Entrants
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.entries.slice(0, 24).map((e) => (
                      <span
                        key={e.user_id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                      >
                        {e.display_name || e.user_id.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {genOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setGenOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <h3 className="text-lg font-black text-white">Generate Championship</h3>
              </div>
              <button
                type="button"
                onClick={() => setGenOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-white/40">
              Auto-qualifies the top winners from completed rounds. Only one season can be active or upcoming at a time.
            </p>

            <label className="mt-4 block text-xs font-bold text-white/60">Season Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mai Sing Off Championship Season X"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-400/40"
            />

            <label className="mt-4 block text-xs font-bold text-white/60">Grand Prize (coins)</label>
            <input
              value={prizeCoins}
              onChange={(e) => setPrizeCoins(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="100000"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/40"
            />

            <label className="mt-4 block text-xs font-bold text-white/60">Grand Prize Description</label>
            <input
              value={prizeDesc}
              onChange={(e) => setPrizeDesc(e.target.value)}
              placeholder="1,000,000 coins + Golden Mic trophy + featured on newspaper"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-yellow-400/40"
            />

            <label className="mt-4 block text-xs font-bold text-white/60">Entries Limit</label>
            <input
              value={entriesLimit}
              onChange={(e) => setEntriesLimit(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/40"
            />

            <button
              type="button"
              onClick={handleGenerate}
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-600 px-4 py-3 text-sm font-black text-black transition hover:brightness-110 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              {submitting ? 'Generating...' : 'Generate Season'}
            </button>
          </div>
        </div>
      )}

      {prizeOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPrizeOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-yellow-400" />
                <h3 className="text-lg font-black text-white">Edit Grand Prize</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrizeOpen(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/45">{prizeOpen.name}</div>

            <label className="mt-4 block text-xs font-bold text-white/60">Prize Coins</label>
            <input
              value={editCoins}
              onChange={(e) => setEditCoins(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/40"
            />

            <label className="mt-4 block text-xs font-bold text-white/60">Prize Description</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400/40"
            />

            <button
              type="button"
              onClick={handleEditPrize}
              disabled={submitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-600 to-amber-600 px-4 py-3 text-sm font-black text-black transition hover:brightness-110 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {submitting ? 'Saving...' : 'Save Grand Prize'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

