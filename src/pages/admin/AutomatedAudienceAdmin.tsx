import { useCallback, useEffect, useState } from 'react'
import { Activity, Pause, Play, RefreshCw, Shield, Square, Users } from 'lucide-react'
import { requestAutomatedAudience, type AudienceRequest } from '@/lib/automatedAudience'

type AudienceSettings = {
  enabled: boolean
  chat_min_interval_minutes: number
  chat_max_interval_minutes: number
  gift_cooldown_minutes: number
  updated_at: string
}

type AudienceAccount = {
  user_id: string
  account_key: string
  enabled: boolean
  created_at: string
  disabled_at: string | null
  user_profiles: { username: string; avatar_url: string | null } | null
  automated_audience_balances: { balance: number } | null
}

type AudienceSession = {
  id: string
  stream_id: string
  status: 'active' | 'paused' | 'stopped' | 'ended'
  started_at: string
  ended_at: string | null
  last_action_at: string | null
  last_gift_at: string | null
  action_sequence: number
}

type AudienceEvent = {
  id: string
  stream_id: string
  account_id: string
  event_type: 'chat' | 'gift' | 'virtual_like' | 'virtual_gift'
  content: string | null
  gift_name: string | null
  internal_cost: number
  created_at: string
}

type AudienceLog = {
  id: number
  stream_id: string | null
  event_type: string
  details: Record<string, unknown>
  created_at: string
}

type LiveStream = {
  id: string
  title: string | null
}

type AudienceStatus = {
  settings: AudienceSettings
  accounts: AudienceAccount[]
  sessions: AudienceSession[]
  events: AudienceEvent[]
  logs: AudienceLog[]
  liveStreams: LiveStream[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Audience service request failed'
}

function formatTimestamp(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export default function AutomatedAudienceAdmin() {
  const [status, setStatus] = useState<AudienceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await requestAutomatedAudience<AudienceStatus>({ action: 'status' })
      setStatus(response)
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const perform = useCallback(async (key: string, request: AudienceRequest) => {
    setPending(key)
    setError(null)
    setNotice(null)
    try {
      await requestAutomatedAudience(request)
      setNotice(
        request.action === 'activate'
          ? 'Audience activation was requested.'
          : request.action === 'configure'
            ? 'Audience settings updated.'
            : request.action === 'session'
              ? `Audience session ${request.status}.`
              : request.action === 'account'
                ? `Audience account ${request.enabled ? 'enabled' : 'disabled'}.`
                : 'Audience status refreshed.',
      )
      await refresh()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setPending(null)
    }
  }, [refresh])

  const settings = status?.settings

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 text-white md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
            <Shield className="h-4 w-4" />
            Designated administrator only
          </p>
          <h1 className="mt-2 text-2xl font-black md:text-3xl">Automated Audience</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/60">
            Virtual audience activity is clearly labeled and capped at one action per minute across all broadcasts. Virtual likes and gifts are demo overlays, not real engagement, and do not create RTC viewers or human viewer counts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {notice}
        </div>
      )}

      {settings && (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-bold">Service control</h2>
            </div>
            <p className="mt-2 text-sm text-white/55">
              {settings.enabled ? 'Enabled for the designated administrator’s own active broadcasts.' : 'Disabled. No new audience actions will be scheduled.'}
            </p>
            <button
              type="button"
              disabled={pending === 'settings'}
              onClick={() => void perform('settings', {
                action: 'configure',
                enabled: !settings.enabled,
                chatMinIntervalMinutes: 1,
                chatMaxIntervalMinutes: 1,
                giftCooldownMinutes: settings.gift_cooldown_minutes,
              })}
              className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black disabled:opacity-50 ${settings.enabled ? 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'}`}
            >
              {settings.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {settings.enabled ? 'Disable service' : 'Enable service'}
            </button>
            <p className="mt-3 text-xs text-white/40">Last updated {formatTimestamp(settings.updated_at)}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <h2 className="text-lg font-bold">Activity cadence</h2>
            <p className="mt-2 text-sm text-white/60">
              A resumed session attempts an immediate labeled chat. Afterward, chats and disclosed virtual reaction overlays share a one-action-per-minute global limit.
            </p>
          </div>
        </section>
      )}

      {status && (
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-bold">Persistent accounts</h2>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
              {status.accounts.length}/30
            </span>
          </div>
          {status.accounts.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">Accounts are provisioned idempotently on the first eligible broadcast activation.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {status.accounts.map((account) => (
                <div key={account.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {account.user_profiles?.avatar_url && (
                      <img
                        src={account.user_profiles.avatar_url}
                        alt=""
                        className="h-9 w-9 rounded-full"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{account.user_profiles?.username || account.account_key}</p>
                      <p className="text-xs text-white/50">
                        {Number(account.automated_audience_balances?.balance || 0).toLocaleString()} internal coins
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={pending === account.user_id}
                    onClick={() => void perform(account.user_id, {
                      action: 'account',
                      accountId: account.user_id,
                      enabled: !account.enabled,
                    })}
                    className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10 disabled:opacity-50"
                  >
                    {account.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Audience sessions</h2>
          {status?.sessions.length ? (
            <div className="mt-3 space-y-3">
              {status.sessions.map((session) => (
                <div key={session.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{session.status.toUpperCase()}</p>
                      <p className="break-all text-xs text-white/50">Broadcast {session.stream_id}</p>
                      <p className="mt-1 text-xs text-white/50">
                        Started {formatTimestamp(session.started_at)} · Actions {session.action_sequence}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {session.status === 'active' && (
                        <button
                          type="button"
                          disabled={pending === session.stream_id}
                          onClick={() => void perform(session.stream_id, { action: 'session', streamId: session.stream_id, status: 'paused' })}
                          className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-bold text-amber-100"
                        >
                          Pause
                        </button>
                      )}
                      {session.status === 'paused' && (
                        <button
                          type="button"
                          disabled={!settings?.enabled || pending === session.stream_id}
                          onClick={() => void perform(session.stream_id, { action: 'session', streamId: session.stream_id, status: 'active' })}
                          className="rounded-lg border border-emerald-300/25 px-3 py-2 text-xs font-bold text-emerald-100"
                        >
                          Resume
                        </button>
                      )}
                      {['active', 'paused'].includes(session.status) && (
                        <button
                          type="button"
                          disabled={pending === session.stream_id}
                          onClick={() => void perform(session.stream_id, { action: 'session', streamId: session.stream_id, status: 'stopped' })}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300/25 px-3 py-2 text-xs font-bold text-red-100"
                        >
                          <Square className="h-3 w-3" />
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/50">No audience sessions recorded.</p>
          )}
          {status?.liveStreams.length ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/50">Eligible live broadcasts</p>
              {status.liveStreams.map((stream) => {
                const session = status.sessions.find((item) => item.stream_id === stream.id)
                return (
                  <div key={stream.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span className="text-sm">{stream.title || stream.id}</span>
                    {session ? (
                      session.status === 'active' ? (
                        <span className="text-xs font-bold uppercase text-white/50">Audience active</span>
                      ) : session.status === 'paused' ? (
                        <button
                          type="button"
                          disabled={!settings?.enabled || pending === stream.id}
                          onClick={() => void perform(stream.id, { action: 'session', streamId: stream.id, status: 'active' })}
                          className="rounded-lg border border-emerald-300/25 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-40"
                        >
                          Resume audience
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!settings?.enabled || pending === stream.id}
                          onClick={() => void perform(stream.id, { action: 'activate', streamId: stream.id })}
                          className="rounded-lg bg-cyan-300/15 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40"
                        >
                          Re-enable audience
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={!settings?.enabled || pending === stream.id}
                        onClick={() => void perform(stream.id, { action: 'activate', streamId: stream.id })}
                        className="rounded-lg bg-cyan-300/15 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-40"
                      >
                        Activate audience
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
          <h2 className="text-lg font-bold">Recent automated activity</h2>
          {status?.events.length ? (
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
              {status.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="font-bold uppercase text-cyan-200">{event.event_type}</span>
                    <time className="text-white/40">{formatTimestamp(event.created_at)}</time>
                  </div>
                  <p className="mt-1 text-sm text-white/80">
                    {event.content || event.gift_name || 'Automated gift'}
                  </p>
                  {(event.event_type === 'gift' || event.event_type === 'virtual_gift') && (
                    <p className="mt-1 text-xs text-white/45">{event.internal_cost.toLocaleString()} internal coins · non-payable</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/50">No automated audience activity yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <h2 className="text-lg font-bold">Service log</h2>
        {status?.logs.length ? (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {status.logs.map((log) => (
              <div key={log.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2 text-xs">
                <span>{log.event_type} {log.stream_id ? `· ${log.stream_id}` : ''}</span>
                <time className="text-white/40">{formatTimestamp(log.created_at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/50">No service log entries.</p>
        )}
      </section>
    </main>
  )
}
