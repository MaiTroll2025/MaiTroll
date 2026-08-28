import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Gavel,
  Hash,
  Lock,
  Loader2,
  MessageSquare,
  Phone,
  Scale,
  Send,
  Shield,
  ShieldCheck,
  Timer,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { moderation } from '@/services/maitrollModeration'
import { jailAttorneyService, type JailRequest } from '@/services/jailAttorneyService'
import { toast } from 'sonner'

type ContactType = 'attorney' | 'admin'

export default function PhoneJailPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [jailState, setJailState] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [postingBond, setPostingBond] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [contactType, setContactType] = useState<ContactType | null>(null)
  const [message, setMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [requestingAttorney, setRequestingAttorney] = useState(false)
  const [requestingAdmin, setRequestingAdmin] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [attorneyStatus, setAttorneyStatus] = useState<string | null>(null)
  const [adminStatus, setAdminStatus] = useState<string | null>(null)
  const [attorneyRequest, setAttorneyRequest] = useState<JailRequest | null>(null)
  const [adminRequest, setAdminRequest] = useState<JailRequest | null>(null)
  const [hasAttorneyAccess, setHasAttorneyAccess] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [adminMessageCount, setAdminMessageCount] = useState(0)

  const loadJailState = useCallback(async () => {
    if (!user) return
    try {
      const state = await moderation.getJailState(user.id)
      setJailState(state)
    } catch (err) {
      console.error('Failed to load jail state:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  const refreshJailState = useCallback(async () => {
    if (!user) return
    try {
      const state = await moderation.getJailState(user.id)
      setJailState(state)
    } catch {
      // noop
    }
  }, [user])

  const loadWalletBalance = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setWalletBalance(data?.troll_coins || 0)
    } catch (err) {
      console.error('Failed to load wallet:', err)
    }
  }, [user])

  const loadRequestStatus = useCallback(async () => {
    if (!user || !jailState?.jailId) return
    try {
      const { data, error } = await supabase
        .from('jail_requests')
        .select('request_type, status')
        .eq('jail_id', jailState.jailId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error || !data) return

      const attorneyReq = data.find((r: any) => r.request_type === 'attorney')
      const adminReq = data.find((r: any) => r.request_type === 'admin')

      if (attorneyReq) setAttorneyStatus(attorneyReq.status)
      if (adminReq) setAdminStatus(adminReq.status)
    } catch (err) {
      console.error('Failed to load request status:', err)
    }
  }, [user, jailState?.jailId])

  const loadAttorneyRequest = useCallback(async () => {
    if (!user || !jailState?.jailId) return
    const req = await jailAttorneyService.loadMyRequest(jailState.jailId, 'attorney')
    setAttorneyRequest(req)
    setHasAttorneyAccess(req?.status === 'fulfilled')
  }, [user, jailState?.jailId])

  const loadAdminRequest = useCallback(async () => {
    if (!user || !jailState?.jailId) return
    const req = await jailAttorneyService.loadMyRequest(jailState.jailId, 'admin')
    setAdminRequest(req)
  }, [user, jailState?.jailId])

  const loadAdminMessageCount = useCallback(async () => {
    if (!user || !jailState?.jailId) return
    try {
      const { count, error } = await supabase
        .from('jail_messages')
        .select('id', { count: 'exact', head: true })
        .eq('jail_id', jailState.jailId)
        .eq('sender_id', user.id)
        .eq('recipient_type', 'admin')

      if (error) throw error
      setAdminMessageCount(count || 0)
    } catch {
      // noop
    }
  }, [user, jailState?.jailId])

  useEffect(() => {
    if (!user) return
    loadJailState()
    loadWalletBalance()
  }, [user, loadJailState, loadWalletBalance])

  useEffect(() => {
    if (!jailState?.jailId || !user) return
    loadRequestStatus()
    loadAttorneyRequest()
    loadAdminRequest()
    loadAdminMessageCount()
  }, [jailState?.jailId, user, loadRequestStatus, loadAttorneyRequest, loadAdminRequest, loadAdminMessageCount])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!jailState?.isJailed) return

    const preventBackNavigation = () => {
      window.history.pushState(null, '', window.location.href)
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', preventBackNavigation)

    return () => {
      window.removeEventListener('popstate', preventBackNavigation)
    }
  }, [jailState?.isJailed])

  useEffect(() => {
    if (!jailState?.isJailed || !jailState?.scheduledReleaseAt) return

    const releaseDate = new Date(jailState.scheduledReleaseAt)
    const interval = setInterval(() => {
      const remaining = releaseDate.getTime() - Date.now()
      if (remaining <= 0) {
        setNow(Date.now())
        loadJailState()
        loadWalletBalance()
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [jailState?.isJailed, jailState?.scheduledReleaseAt, loadJailState, loadWalletBalance])

  useEffect(() => {
    if (!jailState?.jailId || !user) return

    const unsubJail = jailAttorneyService.subscribeToJailUpdates(jailState.jailId, () => {
      loadJailState()
      loadWalletBalance()
    })

    const unsubRequest = jailAttorneyService.subscribeToRequestUpdates(
      jailState.jailId,
      user.id,
      () => {
        loadRequestStatus()
        loadAttorneyRequest()
        loadAdminRequest()
      },
    )

    return () => {
      unsubJail()
      unsubRequest()
    }
  }, [jailState?.jailId, user, loadJailState, loadWalletBalance, loadRequestStatus, loadAttorneyRequest, loadAdminRequest])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`phone-jail-arrest:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jail',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshJailState()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, refreshJailState])

  const handlePostBond = async () => {
    if (!jailState?.jailId) return

    setPostingBond(true)

    try {
      const result = await moderation.postBond(jailState.jailId)

      if (!result.success) {
        toast.error(result.message || 'Failed to post bond')
        return
      }

      toast.success(result.message || 'Bond posted. You have been released.')
      await loadJailState()
      await loadWalletBalance()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post bond')
    } finally {
      setPostingBond(false)
    }
  }

  const handleRequestAttorney = async () => {
    if (!user || !jailState?.jailId) {
      toast.error('Jail record is not loaded yet. Please wait or refresh.')
      return
    }

    if (attorneyStatus && attorneyStatus !== 'rejected') {
      toast.error('You already have an attorney request pending.')
      return
    }

    setRequestingAttorney(true)

    try {
      const result = await jailAttorneyService.requestAttorney(jailState.jailId)

      if (!result.success) {
        toast.error(result.error || 'Unable to request an attorney right now.')
        return
      }

      toast.success('Attorney requested. Your request has been sent to all available attorneys.')
      setAttorneyStatus('pending')
      await loadAttorneyRequest()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Unable to request an attorney right now.')
    } finally {
      setRequestingAttorney(false)
    }
  }

  const handleContactAdmin = async () => {
    if (!user || !jailState?.jailId) {
      toast.error('Jail record is not loaded yet. Please wait or refresh.')
      return
    }

    if (adminStatus && adminStatus !== 'rejected') {
      toast.error('You already have an admin request pending.')
      return
    }

    setRequestingAdmin(true)

    try {
      const result = await jailAttorneyService.requestAdmin(jailState.jailId)

      if (!result.success) {
        toast.error(result.error || 'Unable to contact administration right now.')
        return
      }

      toast.success('Administration has been contacted.')
      setAdminStatus('pending')
      await loadAdminRequest()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Unable to contact administration right now.')
    } finally {
      setRequestingAdmin(false)
    }
  }

  const handleAcceptAttorneyQuote = async () => {
    if (!attorneyRequest) return
    setActionLoading(true)
    try {
      const result = await jailAttorneyService.acceptAttorneyQuote(attorneyRequest.id)
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to accept quote.')
        return
      }
      toast.success(result.message || 'Attorney quote accepted!')
      await loadAttorneyRequest()
      loadRequestStatus()
      loadWalletBalance()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept quote.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDenyAttorneyQuote = async () => {
    if (!attorneyRequest) return
    setActionLoading(true)
    try {
      const result = await jailAttorneyService.denyAttorneyQuote(attorneyRequest.id)
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to deny quote.')
        return
      }
      toast.success(result.message || 'Attorney quote denied.')
      await loadAttorneyRequest()
      loadRequestStatus()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deny quote.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptAdminBondQuote = async () => {
    if (!adminRequest) return
    setActionLoading(true)
    try {
      const result = await jailAttorneyService.acceptAdminBondQuote(adminRequest.id)
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to accept bond quote.')
        return
      }
      toast.success(result.message || 'Bond accepted!')
      await loadAdminRequest()
      loadRequestStatus()
      loadJailState()
      loadWalletBalance()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept bond quote.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDenyAdminBondQuote = async () => {
    if (!adminRequest) return
    setActionLoading(true)
    try {
      const result = await jailAttorneyService.denyAdminBondQuote(adminRequest.id)
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to deny bond quote.')
        return
      }
      toast.success(result.message || 'Bond quote denied.')
      await loadAdminRequest()
      loadRequestStatus()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deny bond quote.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!user || !jailState?.jailId) return

    if (!contactType) {
      toast.error('Choose Attorney or Administration first.')
      return
    }

    if (contactType === 'admin' && adminMessageCount >= 5) {
      toast.error('You have reached the maximum of 5 messages to administration. Please wait for their response.')
      return
    }

    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Enter a message first.')
      return
    }

    if (trimmed.length > 2000) {
      toast.error('Message cannot exceed 2,000 characters.')
      return
    }

    setSendingMessage(true)

    try {
      const { error } = await supabase
        .from('jail_messages')
        .insert({
          jail_id: jailState.jailId,
          sender_id: user.id,
          recipient_type: contactType,
          message: trimmed,
        })

      if (error) throw error

      setMessage('')
      toast.success(
        contactType === 'attorney'
          ? 'Message sent to Attorney Services.'
          : `Message sent to Administration. (${adminMessageCount + 1}/5)`,
      )
      setAdminMessageCount((prev) => prev + 1)
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Unable to send your message.')
    } finally {
      setSendingMessage(false)
    }
  }

  const releaseDate = useMemo(
    () => (jailState?.scheduledReleaseAt ? new Date(jailState.scheduledReleaseAt) : null),
    [jailState?.scheduledReleaseAt],
  )

  const remainingSeconds = useMemo(() => {
    if (!releaseDate) return 0
    return Math.max(0, Math.floor((releaseDate.getTime() - now) / 1000))
  }, [releaseDate, now])

  const days = Math.floor(remainingSeconds / 86400)
  const hours = Math.floor((remainingSeconds % 86400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60

  const countdown = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const canAffordBond = walletBalance >= (jailState?.bondAmount || 0)
  const canAffordAttorneyQuote = walletBalance >= (attorneyRequest?.quoteAmount || 0)
  const canAffordAdminBondQuote = walletBalance >= (adminRequest?.quoteAmount || 0)

  const severityLabel = useMemo(() => {
    const map: Record<string, string> = {
      minor: 'MINOR',
      moderate: 'MODERATE',
      serious: 'SERIOUS',
      severe: 'SEVERE',
    }
    return map[jailState?.severity || 'moderate'] || 'MODERATE'
  }, [jailState?.severity])

  const severityColor = useMemo(() => {
    const map: Record<string, string> = {
      minor: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
      moderate: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
      serious: 'text-red-400 border-red-500/40 bg-red-500/10',
      severe: 'text-red-300 border-red-600/50 bg-red-600/15',
    }
    return map[jailState?.severity || 'moderate'] || map.moderate
  }, [jailState?.severity])

  const displayUsername =
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    'MaiTroll User'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white font-semibold">Checking detention status...</p>
          <p className="text-slate-500 text-sm mt-2">Mai Troll Corrections</p>
        </div>
      </div>
    )
  }

  if (!jailState?.isJailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-sm bg-slate-900 border border-green-900/40 rounded-2xl p-6 text-center shadow-2xl">
          <Shield className="w-16 h-16 text-green-400 mx-auto mb-5" />
          <h1 className="text-2xl font-black text-white">YOU ARE FREE</h1>
          <p className="text-slate-400 mt-3 text-sm">
            No active detention record was found for your account.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center gap-3 border-b border-red-900/40 bg-black/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-800 bg-red-950/60">
          <Lock className="h-4 w-4 text-red-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-black uppercase tracking-widest text-white/90">
            MaiTroll Corrections
          </h1>
          <p className="truncate text-[10px] font-semibold text-red-400">
            Account Restricted
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-sm space-y-5">
          {/* Arrest Banner */}
          <div className="border-2 border-red-800 bg-red-950/20 p-5">
            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-600 bg-red-950/60">
                  <Lock className="h-6 w-6 text-red-400" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-red-500 uppercase tracking-[0.2em] font-bold">
                  Case Status
                </p>
                <h1 className="font-black text-xl uppercase tracking-tight text-red-300">
                  In Custody
                </h1>
                <h2 className="font-black text-2xl text-white">
                  YOU HAVE BEEN ARRESTED
                </h2>
                <p className="mt-2 text-xs text-red-200/60">
                  Your MaiTroll account is currently restricted while your sentence is
                  active. Normal platform access has been suspended until your scheduled
                  release.
                </p>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <section className="border-2 border-red-900/60 bg-black p-5 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Timer className="h-5 w-5 text-red-400" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-red-400 font-bold">
                Time Until Scheduled Release
              </p>
            </div>

            <p className="text-4xl font-mono font-black tracking-[0.15em] text-white">
              {countdown}
            </p>

            <p className="mt-2 text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
              Days : Hours : Minutes : Seconds
            </p>
          </section>

          {/* Case Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-800 bg-[#111] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="h-4 w-4 text-slate-500" />
                <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                  Case
                </p>
              </div>
              <p className="font-mono text-xs font-bold text-slate-300">
                {jailState?.caseId ? jailState.caseId.slice(0, 8).toUpperCase() : 'DETENTION'}
              </p>
            </div>

            <div className="border border-slate-800 bg-[#111] p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                  Release
                </p>
              </div>
              <p className="text-xs font-bold text-slate-300">
                {releaseDate ? releaseDate.toLocaleDateString() : 'Pending'}
              </p>
            </div>

            <div className="border border-slate-800 bg-[#111] p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                  Bond
                </p>
              </div>
              <p className="text-xs font-bold text-slate-300">
                {(jailState?.bondAmount || 0).toLocaleString()} TC
              </p>
            </div>

            <div className="border border-slate-800 bg-[#111] p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-slate-500" />
                <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                  Wallet
                </p>
              </div>
              <p className="text-xs font-bold text-slate-300">
                {walletBalance.toLocaleString()} TC
              </p>
            </div>
          </div>

          {/* Arrest Details */}
          <section className="border border-slate-800 bg-[#0a0a0a] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="h-5 w-5 text-red-500" />
              <h2 className="text-sm font-black uppercase tracking-wider">
                Detention Details
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                  Reason
                </p>
                <p className="mt-1 text-xs font-semibold text-white">
                  {jailState?.reason || 'Violation of MaiTroll community rules'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                    Severity
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${severityColor}`}
                  >
                    {severityLabel}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                    Discipline Level
                  </p>
                  <p className="mt-1 text-xs font-bold text-white">
                    Level {jailState?.disciplineLevel || 1}
                  </p>
                </div>
              </div>

              {jailState?.arrestedBy && (
                <div>
                  <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">
                    Arresting Officer
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {jailState.arrestedBy}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Bond */}
          {jailState?.bondAllowed && jailState?.bondAmount > 0 && (
            <section className="border-2 border-green-900/50 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-green-700 bg-green-950/40">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tight">
                    Post Bond
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Pay your bond to request release.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                    Required
                  </p>
                  <p className="text-2xl font-black text-green-400">
                    {jailState.bondAmount.toLocaleString()} TC
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                    Your Balance
                  </p>
                  <p className="text-2xl font-black text-white">
                    {walletBalance.toLocaleString()} TC
                  </p>
                </div>
              </div>

              {!canAffordBond && (
                <div className="mb-3 flex items-center gap-2 text-red-400 text-xs font-bold">
                  <UserX className="h-4 w-4" />
                  Insufficient Troll Coins
                </div>
              )}

              <button
                type="button"
                onClick={handlePostBond}
                disabled={postingBond || !canAffordBond}
                className="w-full rounded-xl border-2 border-green-600 bg-green-700 py-3 font-black text-xs uppercase tracking-wider disabled:opacity-40"
              >
                {postingBond ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Bond...
                  </span>
                ) : (
                  `Post Bond — ${jailState.bondAmount.toLocaleString()} TC`
                )}
              </button>
            </section>
          )}

          {/* Attorney / Admin */}
          <div className="grid gap-3">
            {/* Attorney */}
            <section className="border border-slate-800 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-700 bg-blue-950/30">
                  <Scale className="h-5 w-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-tight">
                    Request an Attorney
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Get legal assistance for your case.
                  </p>
                </div>
              </div>

              {attorneyStatus && attorneyStatus !== 'rejected' && (
                <div className="mb-3 flex items-center gap-2 text-blue-300 text-xs font-bold">
                  <UserCheck className="h-4 w-4" />
                  Status: {attorneyStatus}
                </div>
              )}

              {attorneyRequest && attorneyRequest.status === 'approved' && attorneyRequest.quoteAmount > 0 && (
                <div className="mb-3 border border-blue-800/50 bg-blue-950/30 p-3">
                  <p className="text-[10px] text-blue-400 uppercase font-black tracking-wider mb-1">
                    Attorney Quote
                  </p>
                  <p className="text-lg font-black text-white">
                    {attorneyRequest.quoteAmount.toLocaleString()} TC
                  </p>
                  {attorneyRequest.quoteMessage && (
                    <p className="mt-1 text-xs text-slate-400">
                      {attorneyRequest.quoteMessage}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleAcceptAttorneyQuote}
                      disabled={actionLoading || !canAffordAttorneyQuote}
                      className="flex-1 rounded-lg border-2 border-green-600 bg-green-700 py-2 font-black text-xs uppercase tracking-wider disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        'Accept'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDenyAttorneyQuote}
                      disabled={actionLoading}
                      className="flex-1 rounded-lg border-2 border-red-800 bg-red-900/50 py-2 font-black text-xs uppercase tracking-wider disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        'Deny'
                      )}
                    </button>
                  </div>
                  {!canAffordAttorneyQuote && (
                    <p className="mt-2 text-[10px] text-red-400 font-bold">
                      Insufficient Troll Coins
                    </p>
                  )}
                </div>
              )}

              {hasAttorneyAccess && (
                <div className="mb-3 flex items-center gap-2 text-green-400 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  Attorney hired. You can now message your attorney.
                </div>
              )}

              {attorneyStatus === 'rejected' && (
                <div className="mb-3 flex items-center gap-2 text-red-400 text-xs font-bold">
                  <XCircle className="h-4 w-4" />
                  Request was declined.
                </div>
              )}

              <button
                type="button"
                onClick={handleRequestAttorney}
                disabled={
                  requestingAttorney ||
                  (attorneyStatus && attorneyStatus !== 'rejected') ||
                  hasAttorneyAccess
                }
                className="w-full rounded-xl border-2 border-blue-600 bg-blue-700 py-3 font-black text-xs uppercase tracking-wider disabled:opacity-40"
              >
                {requestingAttorney ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Requesting...
                  </span>
                ) : hasAttorneyAccess ? (
                  <span className="flex items-center justify-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Message My Attorney
                  </span>
                ) : attorneyStatus && attorneyStatus !== 'rejected' ? (
                  <span className="flex items-center justify-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Request Pending
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Scale className="h-4 w-4" />
                    Request Attorney
                  </span>
                )}
              </button>

              {hasAttorneyAccess && (
                <button
                  type="button"
                  onClick={() => navigate('/utromail')}
                  className="mt-2 w-full rounded-xl border-2 border-green-600 bg-green-700 py-3 font-black text-xs uppercase tracking-wider"
                >
                  <span className="flex items-center justify-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Message My Attorney
                  </span>
                </button>
              )}
            </section>

            {/* Contact Admin */}
            <section className="border border-slate-800 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-700 bg-amber-950/30">
                  <Building2 className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase tracking-tight">
                    Contact Admin
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Request assistance or a custom bond quote.
                  </p>
                </div>
              </div>

              {adminStatus && adminStatus !== 'rejected' && (
                <div className="mb-3 flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <UserCheck className="h-4 w-4" />
                  Status: {adminStatus}
                </div>
              )}

              {adminRequest && adminRequest.status === 'approved' && adminRequest.quoteAmount > 0 && (
                <div className="mb-3 border border-amber-800/50 bg-amber-950/30 p-3">
                  <p className="text-[10px] text-amber-400 uppercase font-black tracking-wider mb-1">
                    Admin Bond Quote
                  </p>
                  <p className="text-lg font-black text-white">
                    {adminRequest.quoteAmount.toLocaleString()} TC
                  </p>
                  {adminRequest.quoteMessage && (
                    <p className="mt-1 text-xs text-slate-400">
                      {adminRequest.quoteMessage}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleAcceptAdminBondQuote}
                      disabled={actionLoading || !canAffordAdminBondQuote}
                      className="flex-1 rounded-lg border-2 border-green-600 bg-green-700 py-2 font-black text-xs uppercase tracking-wider disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        'Accept'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleDenyAdminBondQuote}
                      disabled={actionLoading}
                      className="flex-1 rounded-lg border-2 border-red-800 bg-red-900/50 py-2 font-black text-xs uppercase tracking-wider disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        'Deny'
                      )}
                    </button>
                  </div>
                  {!canAffordAdminBondQuote && (
                    <p className="mt-2 text-[10px] text-red-400 font-bold">
                      Insufficient Troll Coins
                    </p>
                  )}
                </div>
              )}

              {adminStatus === 'rejected' && (
                <div className="mb-3 flex items-center gap-2 text-red-400 text-xs font-bold">
                  <XCircle className="h-4 w-4" />
                  Request was declined.
                </div>
              )}

              <button
                type="button"
                onClick={handleContactAdmin}
                disabled={requestingAdmin || (adminStatus && adminStatus !== 'rejected')}
                className="w-full rounded-xl border-2 border-amber-600 bg-amber-700 py-3 font-black text-xs uppercase tracking-wider disabled:opacity-40"
              >
                {requestingAdmin ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Contacting...
                  </span>
                ) : adminStatus && adminStatus !== 'rejected' ? (
                  <span className="flex items-center justify-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Request Pending
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Contact Admin
                  </span>
                )}
              </button>
            </section>
          </div>

          {/* Messaging */}
          <section className="border border-slate-800 bg-[#0a0a0a] p-5">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="h-5 w-5 text-green-400" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight">
                  Detention Communication
                </h2>
                <p className="text-slate-500 text-[10px]">
                  Attorney and administration messages are free.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setContactType('attorney')}
                disabled={!hasAttorneyAccess}
                className={`rounded-xl border-2 p-3 font-bold text-xs uppercase tracking-wider transition-all ${
                  contactType === 'attorney'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-700 text-slate-500'
                } ${!hasAttorneyAccess ? 'opacity-40' : ''}`}
              >
                <Scale className="mx-auto mb-1 h-5 w-5" />
                Attorney
              </button>

              <button
                type="button"
                onClick={() => setContactType('admin')}
                disabled={!adminStatus || adminStatus === 'rejected'}
                className={`rounded-xl border-2 p-3 font-bold text-xs uppercase tracking-wider transition-all ${
                  contactType === 'admin'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 text-slate-500'
                } ${(!adminStatus || adminStatus === 'rejected') ? 'opacity-40' : ''}`}
              >
                <Building2 className="mx-auto mb-1 h-5 w-5" />
                Admin
              </button>
            </div>

            {(!hasAttorneyAccess && (!adminStatus || adminStatus === 'rejected')) ? (
              <div className="py-6 text-center border border-dashed border-slate-700 rounded-xl">
                <Phone className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                <p className="text-slate-500 text-xs">
                  Request an Attorney or Contact Admin to enable messaging.
                </p>
              </div>
            ) : (
              <>
                {contactType === 'attorney' && hasAttorneyAccess ? (
                  <div className="py-6 text-center border border-dashed border-green-700/50 rounded-xl">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
                    <p className="mb-2 text-xs font-bold text-green-400">
                      Attorney access granted
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/utromail')}
                      className="mx-auto rounded-xl border-2 border-green-600 bg-green-700 px-4 py-2.5 font-black text-xs uppercase tracking-wider"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Message My Attorney
                      </span>
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={!contactType}
                      maxLength={2000}
                      rows={5}
                      placeholder={
                        contactType
                          ? `Write your message to ${
                              contactType === 'attorney' ? 'Attorney Services' : 'Administration'
                            }...`
                          : 'Select Attorney or Administration first...'
                      }
                      className="w-full rounded-xl border-2 border-slate-700 bg-black p-4 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-green-500 disabled:opacity-50 text-xs"
                    />

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 font-mono">
                        {message.length}/2000
                        {contactType === 'admin' && (
                          <span className={`ml-2 ${adminMessageCount >= 5 ? 'text-red-400' : 'text-slate-500'}`}>
                            ({adminMessageCount}/5)
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={handleSendMessage}
                        disabled={
                          sendingMessage ||
                          !contactType ||
                          !message.trim() ||
                          (contactType === 'admin' && adminMessageCount >= 5)
                        }
                        className="rounded-xl border-2 border-green-600 bg-green-700 px-5 py-2.5 font-black text-xs uppercase tracking-wider disabled:opacity-40"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Send className="h-4 w-4" />
                          {sendingMessage ? 'Sending...' : 'Send Message'}
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
