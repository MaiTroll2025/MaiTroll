import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { getUniverseEventSummary, universeRegister, universeWithdraw, universeInviteSeat, universeRespondSeat, universeRemoveSeat, fetchMyRegistrations, fetchMySeats } from '../lib/api/universe'
import { Sparkles, Check, X, UserPlus, ShieldCheck, Clock, ArrowLeft, Users } from 'lucide-react';
import { toast } from 'sonner'

function mdLabel(d: Date) {
  const m = d.getUTCMonth()
  return m > 2 && m < 11 ? 'MDT' : 'MST'
}

export default function UniverseRegisterPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isMyBattles = location.pathname.includes('my-battles')

  const [event, setEvent] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [myReg, setMyReg] = useState<any>(null)
  const [mySeats, setMySeats] = useState<any[]>([])
  const [attendance, setAttendance] = useState(false)
  const [rules, setRules] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const { data: events } = await supabase
      .from('universe_events').select('*')
      .in('status', ['registration_open', 'registration_closed', 'check_in', 'seat_locked'])
      .order('scheduled_start', { ascending: true })
    const open = (events || [])[0]
    setEvent(open || null)
    if (open) {
      const { data } = await getUniverseEventSummary(open.id)
      setSummary(data)
    }
    if (user) {
      const { data: regs } = await fetchMyRegistrations()
      setMyReg((regs || []).find((r: any) => !open || r.event_id === open.id) || null)
      const { data: seats } = await fetchMySeats()
      // Only show seats for my registrations
      const myRegIds = new Set((regs || []).map((r: any) => r.id))
      setMySeats((seats || []).filter((s: any) => myRegIds.has(s.registration_id)))
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const handleRegister = async () => {
    if (!event) return
    if (!rules) { toast.error('Accept the rules to register'); return }
    setSubmitting(true)
    const res = await universeRegister(event.id, attendance, rules)
    setSubmitting(false)
    if (res.success) { toast.success('Registered as Captain!'); load() }
    else toast.error(res.error || 'Registration failed')
  }

  const handleWithdraw = async () => {
    if (!event) return
    const res = await universeWithdraw(event.id)
    if (res.success) { toast.success('Withdrawn'); load() }
    else toast.error(res.error || 'Withdraw failed')
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center">
          <Sparkles className="h-10 w-10 text-fuchsia-400 mx-auto mb-3" />
          <p className="text-lg font-bold">No Universe Battle is open for registration right now.</p>
          <button onClick={() => navigate('/universe')} className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2">Back to Universe</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#020617_55%,_#000000_100%)]" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <button onClick={() => navigate('/universe')} className="flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Universe Battles
        </button>

        <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-fuchsia-300">
          {isMyBattles ? 'My Universe Battles' : 'Register as Captain'}
        </h1>

        {/* Event card */}
        <div className="rounded-3xl border border-fuchsia-500/20 bg-black/40 backdrop-blur-md p-5">
          <div className="flex items-center gap-2 text-fuchsia-300"><Sparkles className="h-4 w-4" /> {event.title}</div>
          <p className="mt-2 text-sm text-slate-300">
            Battle date: <span className="font-bold">{new Date(event.scheduled_start).toLocaleDateString()}</span>
          </p>
          <p className="text-sm text-slate-300">
            Official start: <span className="font-bold text-amber-300 [text-shadow:0_0_12px_rgba(245,158,11,0.5)]">7:00 PM {mdLabel(new Date(event.scheduled_start))}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">Registration closes: {event.registration_closes_at ? new Date(event.registration_closes_at).toLocaleString() : '—'}</p>
          {summary && (
            <p className="text-xs text-emerald-300 mt-1">{summary.registration_count} broadcasters registered</p>
          )}
        </div>

        {!myReg ? (
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md p-5 space-y-4">
            <p className="text-sm text-slate-300">You will be matched privately (blind) — you won&apos;t choose or see your opponent until the battle begins.</p>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={attendance} onChange={(e) => setAttendance(e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
              I can attend at 7:00 PM Mountain Time.
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
              I agree to the Universe Battle rules and competition terms.
            </label>
            <button
              onClick={handleRegister}
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 font-bold shadow-[0_0_25px_rgba(168,85,247,0.4)] disabled:opacity-50"
            >
              {submitting ? 'Registering…' : 'Lock In Registration'}
            </button>
          </div>
        ) : (
          <CaptainDashboard reg={myReg} seats={mySeats} event={event} onChanged={load} onWithdraw={handleWithdraw} />
        )}
      </div>
    </div>
  )
}

function CaptainDashboard({ reg, seats, event, onChanged, onWithdraw }: any) {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [_searching, setSearching] = useState(false)

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url, is_broadcaster, role')
      .ilike('username', `%${q}%`)
      .limit(8)
    setResults(data || [])
    setSearching(false)
  }, [])

  const seatByNumber = useMemo(() => {
    const m: Record<number, any> = {}
    seats.forEach((s: any) => { m[s.seat_number] = s })
    return m
  }, [seats])

  const invite = async (seat: number, invitedUserId: string) => {
    const res = await universeInviteSeat(reg.id, seat, invitedUserId)
    if (res.success) { toast.success('Invitation sent'); setQuery(''); setResults([]); onChanged() }
    else toast.error(res.error || 'Invite failed')
  }

  const respond = async (seatId: string, accept: boolean) => {
    const res = await universeRespondSeat(seatId, accept)
    if (res.success) { toast.success(accept ? 'Seat accepted' : 'Seat declined'); onChanged() }
    else toast.error(res.error || 'Failed')
  }

  const remove = async (seatId: string) => {
    const res = await universeRemoveSeat(seatId)
    if (res.success) { toast.success('Seat removed'); onChanged() }
    else toast.error(res.error || 'Failed')
  }

  // If this user is an invited seat member (not captain), show accept/decline
  const myInvitedSeat = seats.find((s: any) => s.invited_user_id === user?.id && s.status === 'invited')

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-emerald-500/20 bg-black/40 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 text-emerald-300"><Check className="h-4 w-4" /> Registered as Captain</div>
        <p className="mt-1 text-sm text-slate-300">Status: <span className="font-bold text-amber-300">{reg.status}</span></p>
        <button onClick={onWithdraw} className="mt-3 text-xs text-rose-300 hover:text-rose-200">Withdraw registration</button>
      </div>

      {myInvitedSeat && (
        <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
          <p className="font-bold">You were invited to a Universe team seat</p>
          <p className="text-xs text-slate-300">Battle: 7:00 PM {mdLabel(new Date(event.scheduled_start))}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => respond(myInvitedSeat.id, true)} className="flex-1 rounded-xl bg-emerald-500/80 py-2 font-semibold">Accept</button>
            <button onClick={() => respond(myInvitedSeat.id, false)} className="flex-1 rounded-xl bg-rose-500/80 py-2 font-semibold">Decline</button>
          </div>
        </div>
      )}

      {/* Manage Team Seats */}
      <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-fuchsia-300" /> <span className="font-bold">Manage Team Seats</span></div>
        <p className="text-xs text-slate-400 mb-3">1 Captain + up to 3 seats. Locked at seat-lock deadline.</p>

        <div className="space-y-3">
          {[1, 2, 3].map((n) => {
            const seat = seatByNumber[n]
            return (
              <div key={n} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="h-9 w-9 rounded-xl bg-fuchsia-500/20 flex items-center justify-center font-bold">S{n}</div>
                {!seat || seat.status === 'empty' ? (
                  <div className="flex-1">
                    <input
                      value={n === (seat?.seat_number || n) ? query : ''}
                      onChange={(e) => search(e.target.value)}
                      placeholder={`Search user to invite for Seat ${n}`}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none"
                    />
                    {results.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {results.map((u) => (
                          <button key={u.id} onClick={() => invite(n, u.id)}
                            className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-left hover:bg-white/10">
                            <UserPlus className="h-4 w-4 text-emerald-300" />
                            <span className="text-sm">{u.username}</span>
                            {!u.is_broadcaster && u.role !== 'broadcaster' && <span className="text-[10px] text-rose-300 ml-auto">not eligible</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm">{seat.invited_user_id ? 'Invited user' : '—'}</span>
                    <SeatStatusBadge status={seat.status} />
                    {(seat.status === 'invited' || seat.status === 'accepted') && (
                      <button onClick={() => remove(seat.id)} className="ml-auto text-rose-300 hover:text-rose-200"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SeatStatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; i: any }> = {
    invited: { c: 'text-amber-300', i: Clock },
    accepted: { c: 'text-emerald-300', i: Check },
    declined: { c: 'text-rose-300', i: X },
    removed: { c: 'text-slate-400', i: X },
    checked_in: { c: 'text-emerald-300', i: ShieldCheck },
    locked: { c: 'text-slate-300', i: ShieldCheck },
  }
  const m = map[status] || { c: 'text-slate-300', i: Clock }
  const Icon = m.i
  return <span className={`flex items-center gap-1 text-[11px] ${m.c}`}><Icon className="h-3 w-3" /> {status}</span>
}
