import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Loader2, Trash2, Mic, MicOff, AlertCircle, MessageSquareOff, LogOut, Ban, Shield, UserCheck, Car, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { isProtectedPlatformRole } from '@/lib/protectedRoles'

interface ModActionRow {
  id: string
  target_user_id: string | null
  actor_id: string | null
  action: string | null
  action_type: string | null
  reason: string | null
  details: string | null
  status: string | null
  created_at: string
  target?: { username?: string | null; role?: string | null } | null
  actor?: { username?: string | null; role?: string | null } | null
}

interface UserModActionsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  username: string
  currentUserId?: string
}

const MOD_ACTIONS = [
  { id: 'mute', label: 'Mute', icon: Mic, color: 'text-red-400' },
  { id: 'unmute', label: 'Unmute', icon: MicOff, color: 'text-green-400' },
  { id: 'warn', label: 'Warn', icon: Shield, color: 'text-yellow-400' },
  { id: 'disable_chat', label: 'Disable Chat', icon: MessageSquareOff, color: 'text-amber-400' },
  { id: 'kick', label: 'Kick', icon: LogOut, color: 'text-purple-400' },
  { id: 'ban', label: 'Ban', icon: Ban, color: 'text-rose-500' },
  { id: 'arrest', label: 'Arrest', icon: AlertCircle, color: 'text-orange-400' },
  { id: 'grant_license', label: 'Grant License', icon: UserCheck, color: 'text-green-400' },
  { id: 'release_jail', label: 'Release Jail', icon: ShieldCheck, color: 'text-cyan-400' },
  { id: 'disable_kick', label: 'Disable Kick', icon: Car, color: 'text-blue-400' },
]

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function UserModActionsModal({ isOpen, onClose, userId, username, currentUserId }: UserModActionsModalProps) {
  const [rows, setRows] = useState<ModActionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [muteDuration, setMuteDuration] = useState(5)
  const [chatDisableDuration, setChatDisableDuration] = useState(5)
  const [arrestReason, setArrestReason] = useState('')
  const [arrestSeverity, setArrestSeverity] = useState('moderate')
  const [actionReason, setActionReason] = useState('')
  const [disableKickDuration, setDisableKickDuration] = useState(24)
  const [targetProfile, setTargetProfile] = useState<any>(null)

  const loadTarget = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, role, troll_role, is_admin')
      .eq('id', userId)
      .maybeSingle()
    setTargetProfile(data || null)
  }

  useEffect(() => {
    if (isOpen) {
      void loadTarget()
    }
  }, [isOpen, userId])

  const isTargetProtected = isProtectedPlatformRole(targetProfile)
  const PROTECTED_ACTION_IDS = new Set(['mute', 'unmute', 'arrest', 'disable_chat', 'kick', 'ban', 'suspend_license', 'remove_officer', 'set_to_user'])
  const filteredActions = isTargetProtected ? MOD_ACTIONS.filter((a) => !PROTECTED_ACTION_IDS.has(a.id)) : MOD_ACTIONS

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('moderation_actions')
        .select('id, target_user_id, actor_id, action, action_type, reason, details, status, created_at')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const items = (data || []) as ModActionRow[]
      const ids = Array.from(
        new Set(
          items
            .flatMap((r) => [r.target_user_id, r.actor_id])
            .filter((id): id is string => Boolean(id)),
        ),
      )

      const { data: profiles } = ids.length
        ? await supabase
            .from('user_profiles')
            .select('id, username, role')
            .in('id', ids)
        : { data: [] as any[] }

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const enriched = items.map((r) => ({
        ...r,
        target: profileMap.get(r.target_user_id || '') || null,
        actor: profileMap.get(r.actor_id || '') || null,
      }))

      setRows(enriched)
    } catch (e: any) {
      console.error('Failed to load mod actions:', e)
      toast.error(e?.message || 'Failed to load mod actions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void load()
    }
  }, [isOpen, userId])

  const deleteAction = async (row: ModActionRow) => {
    const confirmed = window.confirm(`Delete this mod action?\n\nAction: ${row.action || row.action_type || 'unknown'}\nTarget: ${row.target?.username || 'unknown'}\nReason: ${row.reason || '—'}`)
    if (!confirmed) return

    setDeletingId(row.id)
    try {
      const { error } = await supabase
        .from('moderation_actions')
        .delete()
        .eq('id', row.id)

      if (error) throw error

      setRows((prev) => prev.filter((r) => r.id !== row.id))
      toast.success('Mod action deleted')
    } catch (e: any) {
      console.error('Failed to delete mod action:', e)
      toast.error(e?.message || 'Failed to delete mod action')
    } finally {
      setDeletingId(null)
    }
  }

  const executeAction = async (actionId: string) => {
    if (!currentUserId) {
      toast.error('You must be logged in to perform this action')
      return
    }

    setActionLoading(actionId)
    try {
      if (actionId === 'warn') {
        const warningMessage = actionReason || `You have been warned by staff.`
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'moderation_alert',
          title: 'Warning from Staff',
          message: warningMessage,
          metadata: { warned_by: currentUserId },
        })
        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId,
          officer_id: currentUserId,
          target_user_id: userId,
          action: 'warn',
          action_type: 'warn',
          reason: warningMessage,
          details: 'profile_mod_actions',
          status: 'active',
        }).then(() => undefined, () => undefined)
        toast.success(`@${username} has been warned`)
        setActionReason('')
      }

      if (actionId === 'mute') {
        const mutedUntil = new Date(Date.now() + muteDuration * 60 * 1000).toISOString()
        await supabase
          .from('user_profiles')
          .update({ muted_until: mutedUntil, mic_muted_until: mutedUntil, updated_at: new Date().toISOString() })
          .eq('id', userId)
        await supabase.from('chat_blocks').upsert(
          { user_id: userId, stream_id: null, blocked_by: currentUserId, expires_at: mutedUntil, reason: `Muted for ${muteDuration} minutes` },
          { onConflict: 'stream_id,user_id' }
        ).then(() => undefined, () => undefined)
        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'mute', action_type: 'mute', reason: `Muted for ${muteDuration} minutes`, details: `duration_minutes:${muteDuration}`, status: 'active',
        }).then(() => undefined, () => undefined)
        toast.success(`@${username} muted for ${muteDuration} minutes`)
      }

      if (actionId === 'unmute') {
        await supabase
          .from('user_profiles')
          .update({ muted_until: null, mic_muted_until: null, updated_at: new Date().toISOString() })
          .eq('id', userId)
        await supabase.from('chat_blocks').delete().eq('user_id', userId).eq('stream_id', null)
        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'unmute', action_type: 'unmute', reason: 'Unmuted by staff', details: 'profile_mod_actions', status: 'active',
        }).then(() => undefined, () => undefined)
        toast.success(`@${username} has been unmuted`)
      }

      if (actionId === 'disable_chat') {
        const disabledUntil = new Date(Date.now() + chatDisableDuration * 60 * 1000).toISOString()
        await supabase
          .from('user_profiles')
          .update({ muted_until: disabledUntil, updated_at: new Date().toISOString() })
          .eq('id', userId)
        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'disable_chat', action_type: 'disable_chat', reason: `Chat disabled for ${chatDisableDuration} minutes`, details: `duration_minutes:${chatDisableDuration}`, status: 'active',
        }).then(() => undefined, () => undefined)
        toast.success(`@${username}'s chat disabled for ${chatDisableDuration} minutes`)
      }

      if (actionId === 'kick') {
        const { error } = await supabase.rpc('ban_user', {
          target: userId,
          minutes: 30,
          reason: actionReason || 'Kicked by moderator from profile',
          acting_admin_id: currentUserId,
        })
        if (error) throw error
        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'kick', action_type: 'kick', reason: actionReason || 'Kicked by moderator from profile', details: 'duration_minutes:30', status: 'active',
        }).then(() => undefined, () => undefined)
        toast.success(`@${username} has been kicked`)
      }

      if (actionId === 'ban') {
        const { error } = await supabase.rpc('ban_user', {
          target: userId,
          minutes: 525600,
          reason: actionReason || 'Banned by moderator from profile',
          acting_admin_id: currentUserId,
        })
        if (error) throw error
        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'ban', action_type: 'ban', reason: actionReason || 'Banned by moderator from profile', details: 'duration_minutes:525600', status: 'active',
        }).then(() => undefined, () => undefined)
        toast.success(`@${username} has been banned`)
      }

      if (actionId === 'arrest') {
        if (!arrestReason.trim()) {
          toast.error('Arrest reason is required')
          return
        }
        const SEVERITY_LEVELS = [
          { id: 'minor', bailMultiplier: 1 },
          { id: 'moderate', bailMultiplier: 2 },
          { id: 'serious', bailMultiplier: 5 },
          { id: 'severe', bailMultiplier: 10 },
        ]
        const severity = SEVERITY_LEVELS.find(s => s.id === arrestSeverity)
        const bail = severity ? severity.bailMultiplier * 100 : 100

        const today = new Date()
        const dow = today.getDay()
        let nextCourtDate: Date
        if (dow === 0 || dow === 1) nextCourtDate = new Date(today.getTime() + ((2 - dow) * 86400000))
        else if (dow === 2 || dow === 3) nextCourtDate = new Date(today.getTime() + ((4 - dow) * 86400000))
        else if (dow === 4) nextCourtDate = today
        else nextCourtDate = new Date(today.getTime() + (((2 + 7 - dow) % 7) * 86400000))
        const courtDateStr = nextCourtDate.toISOString().split('T')[0]

        const { data: userIpRecords } = await supabase
          .from('user_ip_tracking')
          .select('latitude, longitude, ip_address')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)

        const { error: jailError } = await supabase.from('jail').insert({
          user_id: userId,
          release_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reason: arrestReason,
          sentence_days: 1,
          arrested_by: currentUserId,
          court_date: courtDateStr,
          status: 'jailed',
          severity: arrestSeverity,
          bond_amount: bail,
          arrest_latitude: userIpRecords?.[0]?.latitude ?? null,
          arrest_longitude: userIpRecords?.[0]?.longitude ?? null,
        })
        if (jailError) throw jailError

        const { data: docket } = await supabase
          .from('court_dockets')
          .select('id, cases_count')
          .eq('court_date', courtDateStr)
          .maybeSingle()

        let docketId: string
        if (docket && docket.cases_count < 20) {
          docketId = docket.id
          await supabase.from('court_dockets').update({ cases_count: (docket.cases_count || 0) + 1 }).eq('id', docketId)
        } else {
          const { data: newDocket, error: insertError } = await supabase.from('court_dockets').insert({
            court_date: courtDateStr, max_cases: 20, cases_count: 1, status: 'open',
          }).select().single()
          if (insertError) throw insertError
          docketId = newDocket?.id
          if (!docketId) throw new Error('Failed to create court docket')
        }

        await supabase.from('court_cases').insert({
          docket_id: docketId,
          defendant_id: userId,
          plaintiff_id: currentUserId,
          reason: arrestReason,
          status: 'pending',
          case_type: 'criminal',
        })

        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'arrest', action_type: 'arrest', reason: arrestReason, details: `court_date:${courtDateStr}; bail:${bail}; severity:${arrestSeverity}`, status: 'active',
        }).then(() => undefined, () => undefined)

        toast.success(`@${username} arrested - Court: ${new Date(courtDateStr).toLocaleDateString()}`)
        setArrestReason('')
        setArrestSeverity('moderate')
      }

      if (actionId === 'grant_license') {
        const licenseExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const insuranceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        const { error: licenseError } = await supabase
          .from('user_driver_licenses')
          .upsert({
            user_id: userId,
            status: 'active',
            suspended_until: null,
            issued_at: new Date().toISOString(),
            expires_at: licenseExpiresAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

        if (licenseError) throw licenseError

        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            drivers_license_status: 'active',
            drivers_license_expiry: licenseExpiresAt,
            car_insurance_expiry: insuranceExpiresAt,
          })
          .eq('id', userId)

        if (profileError) {
          console.error('[ModActions] Profile update error:', profileError)
        }

        const { error: insuranceError } = await supabase
          .from('user_insurances')
          .upsert({
            user_id: userId,
            protection_type: 'car',
            is_active: true,
            expires_at: insuranceExpiresAt,
            issued_at: new Date().toISOString(),
          }, { onConflict: 'user_id,protection_type' })

        if (insuranceError) {
          console.error('[ModActions] Insurance insert error:', insuranceError)
        }

        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'license_granted',
          title: 'Driver License Granted',
          message: 'Your driver license and 30 days of car insurance have been granted by moderators.',
          data: { granted_by: currentUserId, license_expires_at: licenseExpiresAt, insurance_expires_at: insuranceExpiresAt },
        }).then(() => undefined, () => undefined)

        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'grant_license', action_type: 'grant_license', reason: 'License granted by staff', details: '30 days license + insurance', status: 'active',
        }).then(() => undefined, () => undefined)

        toast.success(`@${username} has been granted a driver license and insurance`)
      }

      if (actionId === 'release_jail') {
        const { data: activeJail } = await supabase
          .from('jail')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'jailed')
          .maybeSingle()

        if (activeJail) {
          const nowIso = new Date().toISOString()
          await supabase
            .from('jail')
            .update({ status: 'released', release_time: nowIso, bond_posted: true })
            .eq('id', activeJail.id)

          await supabase
            .from('user_profiles')
            .update({ is_jailed: false, updated_at: nowIso })
            .eq('id', userId)

          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'jail_release_completed',
            title: 'Released from Jail',
            message: 'You have been released from jail by staff.',
            metadata: { jail_id: activeJail.id, released_by: currentUserId },
          }).then(() => undefined, () => undefined)

          await supabase.from('moderation_actions').insert({
            actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
            action: 'release_jail', action_type: 'release_jail', reason: 'Released from jail by staff', details: 'profile_mod_actions', status: 'active',
          }).then(() => undefined, () => undefined)

          toast.success(`@${username} has been released from jail`)
        } else {
          toast.error('No active jail record found for this user')
        }
      }

      if (actionId === 'disable_kick') {
        const noKickUntil = new Date(Date.now() + disableKickDuration * 60 * 60 * 1000).toISOString()
        await supabase
          .from('user_profiles')
          .update({ no_kick_until: noKickUntil, updated_at: new Date().toISOString() })
          .eq('id', userId)

        await supabase.from('moderation_actions').insert({
          actor_id: currentUserId, officer_id: currentUserId, target_user_id: userId,
          action: 'disable_kick', action_type: 'disable_kick', reason: `Kick disabled for ${disableKickDuration} hours`, details: `duration_hours:${disableKickDuration}`, status: 'active',
        }).then(() => undefined, () => undefined)

        toast.success(`@${username} is now immune to kicks for ${disableKickDuration} hours`)
      }

      await load()
    } catch (e: any) {
      console.error('Failed to execute mod action:', e)
      toast.error(e?.message || 'Failed to execute mod action')
    } finally {
      setActionLoading(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">Mod Actions</h3>
            <p className="text-xs text-gray-400">@{username}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Perform Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {filteredActions.map((action) => {
                  const Icon = action.icon
                  const isLoading = actionLoading === action.id
                  const isArrest = action.id === 'arrest'
                  const isDisableKick = action.id === 'disable_kick'
                  const needsReason = ['warn', 'kick', 'ban', 'arrest'].includes(action.id)

                  return (
                    <div key={action.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-4 w-4 ${action.color}`} />
                        <span className="text-xs font-bold text-white">{action.label}</span>
                      </div>
                      {needsReason && action.id !== 'arrest' && (
                        <input
                          type="text"
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder="Reason..."
                          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                      )}
                      {isArrest && (
                        <div className="space-y-2 mb-2">
                          <input
                            type="text"
                            value={arrestReason}
                            onChange={(e) => setArrestReason(e.target.value)}
                            placeholder="Arrest reason..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                          />
                          <div className="flex gap-1">
                            {['minor', 'moderate', 'serious', 'severe'].map((sev) => (
                              <button
                                key={sev}
                                type="button"
                                onClick={() => setArrestSeverity(sev)}
                                className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                                  arrestSeverity === sev
                                    ? 'border-orange-500/50 bg-orange-500/20 text-orange-300'
                                    : 'border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20'
                                }`}
                              >
                                {sev}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {action.id === 'mute' && (
                        <div className="mb-2 flex gap-1">
                          {[1, 5, 10, 15, 30].map((dur) => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => setMuteDuration(dur)}
                              className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition-colors ${
                                muteDuration === dur
                                  ? 'border-red-500/50 bg-red-500/20 text-red-300'
                                  : 'border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20'
                              }`}
                            >
                              {dur}m
                            </button>
                          ))}
                        </div>
                      )}
                      {action.id === 'disable_chat' && (
                        <div className="mb-2 flex gap-1">
                          {[1, 5, 10, 15, 30].map((dur) => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => setChatDisableDuration(dur)}
                              className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition-colors ${
                                chatDisableDuration === dur
                                  ? 'border-yellow-500/50 bg-yellow-500/20 text-yellow-300'
                                  : 'border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20'
                              }`}
                            >
                              {dur}m
                            </button>
                          ))}
                        </div>
                      )}
                      {isDisableKick && (
                        <div className="mb-2 flex gap-1">
                          {[1, 6, 12, 24, 48].map((dur) => (
                            <button
                              key={dur}
                              type="button"
                              onClick={() => setDisableKickDuration(dur)}
                              className={`flex-1 rounded-lg border px-1.5 py-1 text-[10px] font-bold transition-colors ${
                                disableKickDuration === dur
                                  ? 'border-blue-500/50 bg-blue-500/20 text-blue-300'
                                  : 'border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20'
                              }`}
                            >
                              {dur}h
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={isLoading || (needsReason && !actionReason.trim() && action.id !== 'arrest') || (isArrest && !arrestReason.trim())}
                        onClick={() => executeAction(action.id)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : action.label}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">Action History</h4>
                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
                </button>
              </div>
              {loading && rows.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center text-xs text-gray-500">No mod actions found for this user.</div>
              ) : (
                <div className="max-h-[300px] space-y-1 overflow-y-auto">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            {row.action_type || row.action || '—'}
                          </span>
                          <span className="text-[10px] text-gray-500">{formatDate(row.created_at)}</span>
                        </div>
                        {row.reason && <div className="mt-0.5 truncate text-[10px] text-gray-400">{row.reason}</div>}
                      </div>
                      <button
                        type="button"
                        disabled={deletingId === row.id}
                        onClick={() => deleteAction(row)}
                        className="ml-2 shrink-0 rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                        title="Delete mod action"
                      >
                        {deletingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
