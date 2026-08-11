import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { OFFICER_BASE_HOURLY_COINS } from '../../lib/officerPay'
import { toast } from 'sonner'
import { format12hr, formatFullDateTime12hr } from '../../utils/timeFormat'
import { Shield, Ghost, Clock, Award, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import { MaiTrollTheme } from '../../styles/trollCityTheme'
import OfficerShiftCalendar from '../../components/officer/OfficerShiftCalendar'

interface WorkSession {
  id: string
  stream_id: string
  clock_in: string
  clock_out: string | null
  status?: string
  hours_worked: number
  coins_earned: number
  auto_clocked_out: boolean
  streams?: { title: string | null }
}

interface ShiftSlot {
  id: string
  shift_date: string
  shift_start_time: string
  shift_end_time: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
}

interface ActiveAssignment {
  id: string
  stream_id: string
  joined_at: string
  last_activity: string
  streams?: { title: string | null }
}

export default function OfficerDashboard() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null)
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>([])
  const [shiftActionLoading, setShiftActionLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [togglingGhost, setTogglingGhost] = useState(false)
  const [localGhostMode, setLocalGhostMode] = useState(profile?.is_ghost_mode ?? false)

  // Sync local ghost mode state when profile changes
  useEffect(() => {
    if (profile?.is_ghost_mode !== undefined) {
      setLocalGhostMode(profile.is_ghost_mode)
    }
  }, [profile?.is_ghost_mode])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Load active assignment via direct DB query
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('officer_live_assignments')
        .select(`
          id,
          stream_id,
          joined_at,
          last_activity,
          streams(title)
        `)
        .eq('officer_id', user.id)
        .eq('status', 'active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!assignmentError && assignmentData) {
        setActiveAssignment(assignmentData as any)
      } else if (assignmentError) {
        console.error('Error fetching assignment:', assignmentError)
      }

      // Load work sessions
      const { data: sessions } = await supabase
        .from('officer_work_sessions')
        .select(`
          *,
          streams(title)
        `)
        .eq('officer_id', user.id)
        .order('clock_in', { ascending: false })
        .limit(30)

      setWorkSessions((sessions as any) || [])

      const { data: slots } = await supabase
        .from('officer_shift_slots')
        .select('*')
        .eq('officer_id', user.id)
        .order('shift_date', { ascending: false })

      setShiftSlots((slots as ShiftSlot[]) || [])
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  const performShiftRpc = useCallback(
    async (slotId: string, rpcName: 'clock_in_from_slot' | 'clock_out_and_complete_slot', successMessage: string) => {
      setShiftActionLoading((prev) => ({ ...prev, [slotId]: true }))
      try {
        const { error } = await supabase.rpc(rpcName, { p_slot_id: slotId })
        if (error) throw error
        toast.success(successMessage)
        await loadData()
      } catch (error: any) {
        console.error('Shift action failed:', error)
        toast.error(error?.message || 'Shift action failed')
      } finally {
        setShiftActionLoading((prev) => {
          const next = { ...prev }
          delete next[slotId]
          return next
        })
      }
    },
    [loadData]
  )

  const handleClockIn = useCallback(
    (slotId: string) => performShiftRpc(slotId, 'clock_in_from_slot', 'Clocked in to shift'),
    [performShiftRpc]
  )

  const handleClockOut = useCallback(
    (slotId: string) => performShiftRpc(slotId, 'clock_out_and_complete_slot', 'Clocked out of shift'),
    [performShiftRpc]
  )

  const toggleGhostMode = async () => {
    if (!user) return

    setTogglingGhost(true)
    try {
      // Toggle based on local state (always up-to-date)
      const newEnabled = !localGhostMode
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_ghost_mode: newEnabled })
        .eq('id', user.id)

      if (error) throw error

      // Update local state immediately for instant UI feedback
      setLocalGhostMode(newEnabled)
      // Also refresh the store profile in background
      if (refreshProfile) await refreshProfile()
      toast.success(newEnabled ? 'Ghost mode enabled' : 'Ghost mode disabled')
    } catch (error: any) {
      console.error('Error toggling ghost mode:', error)
      toast.error('Failed to toggle ghost mode')
    } finally {
      setTogglingGhost(false)
    }
  }

  const calculateDuration = (joinedAt: string) => {
    const now = Date.now()
    const joined = new Date(joinedAt).getTime()
    const minutes = Math.floor((now - joined) / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatSessionDuration = (hours: number) => {
    const totalMinutes = Math.round(hours * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    if (h > 0 && m > 0) return `${h} hrs ${m} min`
    if (h > 0) return `${h} hrs`
    return `${m} min`
  }

  if (loading) {
    return <div className={`p-6 ${MaiTrollTheme.text.primary} text-center`}>Loading...</div>
  }

  return (
    <div className={`${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary} p-6 max-w-5xl mx-auto`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-3xl font-bold">Officer Dashboard</h1>
        </div>
      </div>

      <div className="mb-6 grid md:grid-cols-2 gap-6">
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-lg p-6 flex flex-col justify-between`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Ghost className={`w-6 h-6 ${localGhostMode ? 'text-purple-400 animate-pulse' : MaiTrollTheme.text.muted}`} />
              <h2 className="text-xl font-bold">Ghost Mode</h2>
              {localGhostMode && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className={`text-sm ${MaiTrollTheme.text.muted}`}>
              {localGhostMode 
                ? 'You are invisible to regular users. They cannot see your role in the audience bar or viewer list.' 
                : 'Become invisible to users while keeping all moderation tools active.'
              }
            </p>
          </div>
          <button
            onClick={toggleGhostMode}
            disabled={togglingGhost}
            className={`mt-4 w-full py-3 rounded-xl font-bold transition-all ${
              localGhostMode 
                ? `${MaiTrollTheme.interactive.active} hover:bg-slate-700/70 ${MaiTrollTheme.borders.glass}` 
                : `${MaiTrollTheme.gradients.button} text-white`
            }`}
          >
            {togglingGhost 
              ? 'Toggling...' 
              : localGhostMode 
                ? '👻 GHOST ON - Click to Disable' 
                : '🛡 Activate Ghost Mode'
            }
          </button>
        </div>
      </div>

      <div className="mb-6">
        <OfficerShiftCalendar title="All Officer Shifts" />
      </div>

      {/* Live Status */}
      {activeAssignment && workSessions.length > 0 && workSessions[0].clock_out === null && (
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} border-green-500 rounded-lg p-4 mb-6`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-400" />
            <p className="font-semibold">Currently Assigned</p>
          </div>
          <p className={`text-sm ${MaiTrollTheme.text.muted}`}>
            Stream: {activeAssignment.streams?.title || activeAssignment.stream_id}
          </p>
          <p className={`text-sm ${MaiTrollTheme.text.muted}`}>
            Active for: {calculateDuration(activeAssignment.joined_at)}
          </p>
        </div>
      )}

      {/* Stats */}
    <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <div className={`text-sm ${MaiTrollTheme.text.muted}`}>Reputation Score</div>
          </div>
          <div className="text-2xl font-bold">{profile?.officer_reputation_score || 100}</div>
        </div>
        <div className={`${MaiTrollTheme.backgrounds.card} border-blue-600/30 border rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-blue-400" />
            <div className={`text-sm ${MaiTrollTheme.text.muted}`}>Officer Level</div>
          </div>
          <div className="text-2xl font-bold">Level {profile?.officer_level || 1}</div>
        </div>
        <div className={`${MaiTrollTheme.backgrounds.card} border-green-600/30 border rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <div className={`text-sm ${MaiTrollTheme.text.muted}`}>Status</div>
          </div>
          <div className="text-2xl font-bold">
            {profile?.is_troll_officer && !profile?.is_officer_active
              ? 'Pending' 
              : (workSessions[0]?.clock_out === null 
                  ? (workSessions[0]?.status === 'break' ? 'On Break' : 'On Duty') 
                  : 'Off Duty')
            }
          </div>
        </div>
        <div className={`${MaiTrollTheme.backgrounds.card} border-yellow-600/30 border rounded-lg p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <div className={`text-sm ${MaiTrollTheme.text.muted}`}>Hourly Rate</div>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{OFFICER_BASE_HOURLY_COINS.toLocaleString()}</div>
          <div className={`text-xs ${MaiTrollTheme.text.muted}`}>coins/hour</div>
      </div>
    </div>

    {/* Shift Signups */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Scheduled Shifts</h2>
        <p className={`text-sm ${MaiTrollTheme.text.muted}`}>{shiftSlots.length} slots</p>
      </div>
      <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-lg overflow-hidden`}>
        {/* Mobile Card View */}
        <div className="block md:hidden p-4">
          {shiftSlots.length === 0 ? (
            <div className={`text-center py-8 ${MaiTrollTheme.text.muted} whitespace-normal break-words`}>
              No scheduled shifts available at this time. Check back later for new shift assignments.
            </div>
          ) : (
            <div className="space-y-3">
              {shiftSlots.map((slot) => {
                const start = new Date(`${slot.shift_date}T${slot.shift_start_time}`)
                const end = new Date(`${slot.shift_date}T${slot.shift_end_time}`)
                const canClockIn = slot.status === 'scheduled'
                const canClockOut = slot.status === 'active'
                return (
                  <div key={slot.id} className={`p-3 rounded-lg border ${MaiTrollTheme.borders.glass} bg-white/5`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{start.toLocaleDateString()}</div>
                        <div className="text-sm text-gray-400">
                          {format12hr(start)} - {format12hr(end)}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        slot.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : slot.status === 'scheduled'
                            ? 'bg-blue-500/10 text-blue-300'
                            : `${MaiTrollTheme.backgrounds.input} ${MaiTrollTheme.text.muted}`
                      }`}>
                        {slot.status}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleClockIn(slot.id)}
                        disabled={!canClockIn || shiftActionLoading[slot.id]}
                        className="px-3 py-1 rounded-full border border-blue-500 text-blue-300 text-xs font-bold hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {shiftActionLoading[slot.id] && slot.status === 'scheduled' ? 'Clocking in…' : 'Clock In'}
                      </button>
                      <button
                        onClick={() => handleClockOut(slot.id)}
                        disabled={!canClockOut || shiftActionLoading[slot.id]}
                        className="px-3 py-1 rounded-full border border-red-500 text-red-300 text-xs font-bold hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {shiftActionLoading[slot.id] && slot.status === 'active' ? 'Clocking out…' : 'Clock Out'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className={`border-b ${MaiTrollTheme.borders.glass}`}>
                <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Date</th>
                <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Time</th>
                <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Status</th>
                <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shiftSlots.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`p-6 text-center ${MaiTrollTheme.text.muted} whitespace-normal break-words`}>
                    No scheduled shifts available at this time. Check back later for new shift assignments.
                  </td>
                </tr>
            ) : (
              shiftSlots.map((slot) => {
                const start = new Date(`${slot.shift_date}T${slot.shift_start_time}`)
                const end = new Date(`${slot.shift_date}T${slot.shift_end_time}`)
                const canClockIn = slot.status === 'scheduled'
                const canClockOut = slot.status === 'active'
                return (
                  <tr key={slot.id} className={`border-b ${MaiTrollTheme.borders.glass} hover:bg-white/5`}>
                    <td className="p-3">{start.toLocaleDateString()}</td>
                    <td className="p-3 text-sm">
                      {format12hr(start)} - {format12hr(end)}
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                        slot.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : slot.status === 'scheduled'
                            ? 'bg-blue-500/10 text-blue-300'
                            : `${MaiTrollTheme.backgrounds.input} ${MaiTrollTheme.text.muted}`
                      }`}>
                        {slot.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleClockIn(slot.id)}
                          disabled={!canClockIn || shiftActionLoading[slot.id]}
                          className="px-3 py-1 rounded-full border border-blue-500 text-blue-300 text-xs font-bold hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {shiftActionLoading[slot.id] && slot.status === 'scheduled' ? 'Clocking in…' : 'Clock In'}
                        </button>
                        <button
                          onClick={() => handleClockOut(slot.id)}
                          disabled={!canClockOut || shiftActionLoading[slot.id]}
                          className="px-3 py-1 rounded-full border border-red-500 text-red-300 text-xs font-bold hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {shiftActionLoading[slot.id] && slot.status === 'active' ? 'Clocking out…' : 'Clock Out'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Work Sessions */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Recent Work Sessions</h2>
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-lg overflow-hidden`}>
          {/* Mobile Card View */}
          <div className="block md:hidden p-4">
            {workSessions.length === 0 ? (
              <div className={`text-center py-8 ${MaiTrollTheme.text.muted}`}>
                No work sessions yet
              </div>
            ) : (
              <div className="space-y-3">
                {workSessions.map((session) => (
                  <div key={session.id} className={`p-3 rounded-lg border ${MaiTrollTheme.borders.glass} bg-white/5`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{session.streams?.title || 'N/A'}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Clock In: {formatFullDateTime12hr(session.clock_in)}
                        </div>
                        <div className="text-sm text-gray-400">
                          Clock In: {formatFullDateTime12hr(session.clock_in)}
                        </div>
                        <div className="text-sm text-gray-400">
                          Clock Out: {session.clock_out ? formatFullDateTime12hr(session.clock_out) : 'Active'}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-green-400 font-medium">{session.coins_earned} coins</div>
                        <div className="text-sm text-gray-400">{formatSessionDuration(session.hours_worked)}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        {session.auto_clocked_out && (
                          <span className="text-xs text-yellow-400">Auto-clockout</span>
                        )}
                        {session.clock_out ? (
                          <span className={`text-xs ${MaiTrollTheme.text.muted}`}>Completed</span>
                        ) : (
                          <span className="text-xs text-green-400">Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className={`border-b ${MaiTrollTheme.borders.glass}`}>
                  <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Stream</th>
                  <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Clock In</th>
                  <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Clock Out</th>
                  <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Time Worked</th>
                  <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Coins</th>
                  <th className={`p-3 text-left ${MaiTrollTheme.text.muted}`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {workSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-6 text-center ${MaiTrollTheme.text.muted}`}>
                      No work sessions yet
                    </td>
                  </tr>
                ) : (
                  workSessions.map((session) => (
                    <tr key={session.id} className={`border-b ${MaiTrollTheme.borders.glass} hover:bg-white/5`}>
                      <td className="p-3">{session.streams?.title || 'N/A'}</td>
                      <td className="p-3 text-sm">
                        {formatFullDateTime12hr(session.clock_in)}
                      </td>
                      <td className="p-3 text-sm">
                        {session.clock_out ? formatFullDateTime12hr(session.clock_out) : 'Active'}
                      </td>
                      <td className="p-3">
                        {formatSessionDuration(session.hours_worked)}
                      </td>
                      <td className="p-3 text-green-400">{session.coins_earned}</td>
                      <td className="p-3">
                        {session.auto_clocked_out && (
                          <span className="text-xs text-yellow-400">Auto-clockout</span>
                        )}
                        {session.clock_out ? (
                          <span className={`text-xs ${MaiTrollTheme.text.muted}`}>Completed</span>
                        ) : (
                          <span className="text-xs text-green-400">Active</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/officer/payroll')}
          className={`p-4 ${MaiTrollTheme.backgrounds.card} border border-yellow-600 rounded-lg hover:bg-white/5 transition-colors text-left`}
        >
          <DollarSign className="w-6 h-6 text-yellow-400 mb-2" />
          <p className="font-semibold">Payroll Dashboard</p>
          <p className={`text-sm ${MaiTrollTheme.text.muted}`}>View earnings and work hours</p>
        </button>
        <button
          onClick={() => navigate('/officer/moderation')}
          className={`p-4 ${MaiTrollTheme.backgrounds.card} border border-red-600 rounded-lg hover:bg-white/5 transition-colors text-left`}
        >
          <AlertTriangle className="w-6 h-6 text-red-400 mb-2" />
          <p className="font-semibold">Moderation Tools</p>
          <p className={`text-sm ${MaiTrollTheme.text.muted}`}>Access moderation panel</p>
        </button>
      </div>
    </div>
  )
}

