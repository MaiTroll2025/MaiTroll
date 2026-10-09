import { useCallback, useEffect, useMemo, useState } from 'react'
import { Facebook, ExternalLink, Loader2, Radio, RefreshCw, Send, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { isMarketingAgent, type UserProfile, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { facebookFunctionErrorMessage } from '@/lib/facebookPublishing'

interface FacebookConnection {
  page_name: string
  connection_status: 'connected' | 'needs_attention' | 'disconnected'
  automatic_publishing: boolean
  graph_api_version: string
  token_last4: string | null
  last_verified_at: string | null
  last_error_category: string | null
  last_error_message: string | null
}

interface FacebookPublication {
  id: string
  source_type: string
  source_id: string
  source_title: string | null
  facebook_post_url: string | null
  status: string
  attempt_count: number
  max_attempts: number
  error_category: string | null
  error_message: string | null
  next_retry_at: string | null
  published_at: string | null
  created_at: string
  payload: Record<string, unknown>
}

interface FacebookStatus {
  connection: FacebookConnection | null
  publications: FacebookPublication[]
}

const adminRoles = new Set(['admin', 'superadmin', 'owner', 'ceo'])
const pagePublisherAdminRoles = new Set(['admin', 'superadmin', 'owner'])

function isFacebookAdmin(profile: UserProfile | null, isAdmin: boolean): boolean {
  return isAdmin ||
    profile?.is_admin === true ||
    adminRoles.has(String(profile?.role || '').toLowerCase()) ||
    adminRoles.has(String(profile?.troll_role || '').toLowerCase())
}

function canPublishFromMarketingPage(profile: UserProfile | null, isAdmin: boolean): boolean {
  return isAdmin ||
    profile?.is_admin === true ||
    pagePublisherAdminRoles.has(String(profile?.role || '').toLowerCase()) ||
    pagePublisherAdminRoles.has(String(profile?.troll_role || '').toLowerCase()) ||
    isMarketingAgent(profile)
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never'
}

export default function MarketingPage() {
  const { profile, isAdmin } = useAuthStore()
  const admin = isFacebookAdmin(profile, isAdmin)
  const canPublishFromPage = canPublishFromMarketingPage(profile, isAdmin)
  const [status, setStatus] = useState<FacebookStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [message, setMessage] = useState('')
  const [facebookResult, setFacebookResult] = useState('')
  const [announcementId, setAnnouncementId] = useState(() => crypto.randomUUID())

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('facebook-integration', {
        body: { action: 'status' },
      })
      if (error) throw error
      if (!data || !Array.isArray(data.publications)) throw new Error('Facebook status response was invalid.')
      setStatus(data as FacebookStatus)
    } catch (error) {
      console.error('[MarketingPage] Could not load Facebook status', error)
      toast.error(error instanceof Error ? error.message : 'Unable to load Facebook status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const result = new URLSearchParams(window.location.search).get('facebook')
    if (result) {
      setFacebookResult(result)
      if (result === 'connected') toast.success('Facebook Page connected.')
      else if (result === 'cancelled') toast.info('Facebook authorization was cancelled.')
      else toast.error(`Facebook connection failed: ${new URLSearchParams(window.location.search).get('reason') || 'unknown'}`)
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    }
  }, [refresh])

  const connection = status?.connection ?? null
  const publications = status?.publications ?? []
  const connectionLabel = useMemo(() => {
    if (connection?.connection_status === 'connected') return 'Connected'
    if (connection?.connection_status === 'needs_attention') return 'Needs attention'
    return 'Not connected'
  }, [connection])

  const runAdminAction = async (action: 'connect' | 'test' | 'disconnect') => {
    if (!admin) return
    if (action === 'disconnect' && !window.confirm('Disconnect the Mai Troll Facebook Page? Publishing will stop until it is reconnected.')) return
    setBusyAction(action)
    try {
      if (action === 'connect') {
        const { data, error } = await supabase.functions.invoke('facebook-oauth-init', { body: {} })
        if (error) throw error
        if (!data?.auth_url) throw new Error('Facebook authorization URL was not returned.')
        window.location.assign(data.auth_url)
        return
      }
      const { data, error } = await supabase.functions.invoke('facebook-integration', { body: { action } })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || `Facebook ${action} failed.`)
      toast.success(action === 'test' ? data.message : 'Facebook Page disconnected.')
      await refresh()
    } catch (error) {
      console.error(`[MarketingPage] Facebook ${action} failed`, error)
      toast.error(await facebookFunctionErrorMessage(error, `Facebook ${action} failed.`))
    } finally {
      setBusyAction('')
    }
  }

  const publishAnnouncement = async () => {
    const content = message.trim()
    if (!content || content.length > 5000) {
      toast.error('Enter an update of up to 5,000 characters.')
      return
    }
    setBusyAction('publish')
    try {
      const { data, error } = await supabase.functions.invoke('facebook-publish', {
        body: {
          sourceType: 'announcement',
          sourceId: announcementId,
          message: content,
        },
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Facebook publishing failed.')
      toast.success('Marketing update published to Facebook.')
      setMessage('')
      setAnnouncementId(crypto.randomUUID())
      await refresh()
    } catch (error) {
      console.error('[MarketingPage] Announcement publishing failed', error)
      toast.error(await facebookFunctionErrorMessage(error, 'Facebook publishing failed.'))
      await refresh()
    } finally {
      setBusyAction('')
    }
  }

  const retryPublication = async (publication: FacebookPublication) => {
    const now = Date.now()
    if (
      publication.status !== 'failed' ||
      publication.error_category !== 'rate_limit' ||
      publication.attempt_count >= publication.max_attempts ||
      (publication.next_retry_at && new Date(publication.next_retry_at).getTime() > now)
    ) return

    setBusyAction(publication.id)
    try {
      const body: Record<string, unknown> = {
        sourceType: publication.source_type,
        sourceId: publication.source_id,
        retryPublicationId: publication.id,
      }
      const { data, error } = await supabase.functions.invoke('facebook-publish', { body })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Facebook retry failed.')
      toast.success('Facebook publication retry completed.')
      await refresh()
    } catch (error) {
      console.error('[MarketingPage] Facebook retry failed', error)
      toast.error(await facebookFunctionErrorMessage(error, 'Facebook retry failed.'))
      await refresh()
    } finally {
      setBusyAction('')
    }
  }

  return (
    <main className="min-h-screen bg-[#070510] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Mai Troll</p>
            <h1 className="mt-1 text-3xl font-black">Marketing</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Publish approved wall posts, user posts, and live broadcasts to the official Facebook Page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </header>

        {facebookResult && <div className="sr-only" role="status">Facebook connection result: {facebookResult}</div>}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Facebook className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold">Facebook Page</h2>
                <p className="text-sm text-slate-400">{connectionLabel}{connection?.page_name ? ` · ${connection.page_name}` : ''}</p>
              </div>
            </div>
            {admin && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runAdminAction('connect')}
                  disabled={Boolean(busyAction)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {connection ? 'Reconnect Facebook' : 'Connect Facebook'}
                </button>
                {connection?.connection_status === 'connected' && (
                  <>
                    <button
                      type="button"
                      onClick={() => void runAdminAction('test')}
                      disabled={Boolean(busyAction)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                    >
                      Test connection
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAdminAction('disconnect')}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Unplug className="h-4 w-4" />
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {connection && (
            <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-xs text-slate-400 sm:grid-cols-3">
              <p>Graph API: {connection.graph_api_version}</p>
              <p>Last verified: {formatDate(connection.last_verified_at)}</p>
              <p>Page token hint: {connection.token_last4 ? `•••• ${connection.token_last4}` : 'Unavailable'}</p>
            </div>
          )}
          {connection?.last_error_message && (
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-200">
              {connection.last_error_message}
            </p>
          )}
          {!connection && !loading && (
            <p className="mt-4 text-sm text-slate-400">
              {admin ? 'Connect the Page using a Facebook account that manages it and grant all requested Page permissions.' : 'Facebook publishing is not available until an administrator connects the Page.'}
            </p>
          )}
        </section>

        {canPublishFromPage && (
          <section className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.04] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Send className="h-4 w-4 text-cyan-300" />
              <h2 className="font-bold">Create a Facebook update</h2>
            </div>
            <textarea
              value={message}
              onChange={(event) => {
                if (event.target.value !== message) setAnnouncementId(crypto.randomUUID())
                setMessage(event.target.value)
              }}
              disabled={busyAction === 'publish'}
              maxLength={5000}
              rows={5}
              placeholder="Write a public update for the Mai Troll Facebook Page..."
              className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{message.length}/5,000 · Only Marketing Agents and administrators can publish from this page.</span>
              <button
                type="button"
                onClick={() => void publishAnnouncement()}
                disabled={!message.trim() || busyAction === 'publish' || connection?.connection_status !== 'connected'}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish update
              </button>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 border-b border-white/10 p-5">
            <Radio className="h-4 w-4 text-cyan-300" />
            <h2 className="font-bold">Recent publishing activity</h2>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading activity…</div>
          ) : publications.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No Facebook publishing activity yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {publications.map((publication) => {
                const retryReady = publication.status === 'failed' &&
                  publication.error_category === 'rate_limit' &&
                  publication.attempt_count < publication.max_attempts &&
                  (!publication.next_retry_at || new Date(publication.next_retry_at).getTime() <= Date.now())
                return (
                  <article key={publication.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{publication.source_title || publication.source_type.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-xs text-slate-500">{publication.status} · {formatDate(publication.published_at || publication.created_at)} · attempt {publication.attempt_count}/{publication.max_attempts}</p>
                      {publication.error_message && <p className="mt-1 text-xs text-amber-200">{publication.error_message}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {retryReady && (admin || isMarketingAgent(profile)) && (
                        <button
                          type="button"
                          onClick={() => void retryPublication(publication)}
                          disabled={Boolean(busyAction)}
                          className="rounded-lg border border-amber-300/20 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      {publication.facebook_post_url && (
                        <a
                          href={publication.facebook_post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        <p className="text-xs text-slate-600">
          Facebook publishing is manual. Content is checked again on the server before posting; failed or ambiguous attempts are not automatically duplicated.
        </p>
      </div>
    </main>
  )
}
