import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  Handshake,
  Lock,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Shield,
  Unlock,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { moderation } from '@/services/maitrollModeration'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { sendNotification } from '../lib/sendNotification'
import BondRequestModal from '../components/jail/BondRequestModal'

interface Inmate {
  id: string
  user_id: string
  username: string
  avatar_url: string | null
  reason: string
  sentence_days: number
  release_time: string
  bond_amount: number
  bond_posted: boolean
  message_minutes: number
  message_minutes_used: number
  created_at: string
}

const MESSAGE_COST = 10
const MINUTES_PRICE = 50
const DEFAULT_BOND_AMOUNT = 100

export default function InmatesPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [inmates, setInmates] = useState<Inmate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInmate, setSelectedInmate] = useState<Inmate | null>(null)

  const [messageText, setMessageText] = useState('')
  const [minutesToBuy, setMinutesToBuy] = useState(1)
  const [postingBond, setPostingBond] = useState(false)
  const [buyingMinutes, setBuyingMinutes] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [startingCall, setStartingCall] = useState(false)
  const [showBondRequest, setShowBondRequest] = useState(false)

  const canMod =
    profile?.role === 'admin' ||
    profile?.is_admin ||
    profile?.is_troll_officer ||
    profile?.is_lead_officer ||
    profile?.role === 'lead_troll_officer'

  const filteredInmates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return inmates
    return inmates.filter((inmate) => {
      return (
        inmate.username.toLowerCase().includes(query) ||
        inmate.reason?.toLowerCase().includes(query)
      )
    })
  }, [inmates, searchQuery])

  const selectedRemainingMinutes = selectedInmate
    ? Math.max(0, selectedInmate.message_minutes - selectedInmate.message_minutes_used)
    : 0

  useEffect(() => {
    fetchInmates()
  }, [])

  const fetchInmates = async () => {
    setLoading(true)
    try {
      const { data: jailData, error: jailError } = await supabase
        .from('jail')
        .select('*')
        .order('created_at', { ascending: false })
      if (jailError) throw jailError

      const userIds = Array.from(
        new Set((jailData || []).map((inmate: any) => inmate.user_id).filter(Boolean))
      )
      const userProfiles: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', userIds)
        if (profilesError) throw profilesError
        ;(profilesData || []).forEach((p: any) => {
          userProfiles[p.id] = p
        })
      }

      const now = new Date()
      const activeInmates = (jailData || [])
        .filter((inmate: any) => {
          if (inmate.bond_posted) return false
          if (inmate.status && inmate.status !== 'jailed') return false
          if (!inmate.release_time) return true
          return new Date(inmate.release_time) > now
        })
        .map((inmate: any) => {
          const inmateProfile = userProfiles[inmate.user_id] || {}
          return {
            id: inmate.id,
            user_id: inmate.user_id,
            username: inmateProfile.username || 'Unknown',
            avatar_url: inmateProfile.avatar_url || null,
            reason: inmate.reason || 'Pending review',
            sentence_days: inmate.sentence_days || 1,
            release_time: inmate.release_time,
            bond_amount: inmate.bond_amount || DEFAULT_BOND_AMOUNT,
            bond_posted: inmate.bond_posted || false,
            message_minutes: inmate.message_minutes || 0,
            message_minutes_used: inmate.message_minutes_used || 0,
            created_at: inmate.created_at,
          }
        })

      setInmates(activeInmates)
      if (selectedInmate) {
        const updated = activeInmates.find((i) => i.id === selectedInmate.id)
        setSelectedInmate(updated || null)
      }
    } catch (error: any) {
      console.error('Error fetching inmates:', error)
      toast.error(error.message || 'Failed to load inmates')
    } finally {
      setLoading(false)
    }
  }

  const formatReleaseTime = (releaseTime: string) => {
    if (!releaseTime) return 'Pending release time'
    const release = new Date(releaseTime)
    const now = new Date()
    const diff = release.getTime() - now.getTime()
    if (diff <= 0) return 'Released'
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if (days > 0) return `${days}d ${hours}h remaining`
    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
  }

  const getBalance = async () => {
    if (!user?.id) throw new Error('You must be logged in.')
    const { data, error } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', user.id)
      .single()
    if (error) throw error
    return Number(data?.troll_coins || 0)
  }

  const deductCoins = async (amount: number) => {
    if (!user?.id) throw new Error('You must be logged in.')
    const balance = await getBalance()
    if (balance < amount) throw new Error('Insufficient Troll Coins.')
    const { error } = await supabase
      .from('user_profiles')
      .update({ troll_coins: balance - amount })
      .eq('id', user.id)
    if (error) throw error
  }

  const handlePostBond = async () => {
    if (!user || !selectedInmate) return
    const bondAmount = selectedInmate.bond_amount || DEFAULT_BOND_AMOUNT
    if (
      !confirm(
        `Post ${bondAmount} Troll Coins bond for ${selectedInmate.username}? This will immediately release the inmate.`
      )
    ) {
      return
    }
    setPostingBond(true)
    try {
      await deductCoins(bondAmount)
      const releaseNow = new Date().toISOString()
      const { error: jailError } = await supabase
        .from('jail')
        .update({
          bond_posted: true,
          bond_posted_by: user.id,
          bond_amount: bondAmount,
          release_time: releaseNow,
          status: 'released_bond',
        })
        .eq('id', selectedInmate.id)
      if (jailError) throw jailError
      await supabase.from('jail_transactions').insert({
        jail_id: selectedInmate.id,
        user_id: user.id,
        transaction_type: 'bond',
        amount: bondAmount,
        recipient_type: 'admin',
        notes: `Bond posted for ${selectedInmate.username}. Inmate released.`,
      })
      await supabase.from('jail_notifications').insert({
        user_id: selectedInmate.user_id,
        notification_type: 'bond_posted',
        title: 'Bond Posted',
        message: `Your bond of ${bondAmount} Troll Coins was posted. You have been released from jail.`,
        data: { amount: bondAmount, posted_by: user.id, jail_id: selectedInmate.id, released_at: releaseNow },
      })
      toast.success(`${selectedInmate.username} has been released. Bond posted.`)
      setSelectedInmate(null)
      await fetchInmates()
    } catch (error: any) {
      console.error('Failed to post bond:', error)
      toast.error(error.message || 'Failed to post bond')
    } finally {
      setPostingBond(false)
    }
  }

  const handleBuyMinutes = async () => {
    if (!user || !selectedInmate) return
    const totalCost = minutesToBuy * MINUTES_PRICE
    if (
      !confirm(
        `Buy ${minutesToBuy} inmate chat minute(s) for ${totalCost} Troll Coins?`
      )
    ) {
      return
    }
    setBuyingMinutes(true)
    try {
      await deductCoins(totalCost)
      const nextMinutes = Number(selectedInmate.message_minutes || 0) + minutesToBuy
      const { error: jailError } = await supabase
        .from('jail')
        .update({ message_minutes: nextMinutes })
        .eq('id', selectedInmate.id)
      if (jailError) throw jailError
      await supabase.from('jail_transactions').insert({
        jail_id: selectedInmate.id,
        user_id: user.id,
        transaction_type: 'message_fee',
        amount: totalCost,
        recipient_type: 'public_pool',
        notes: `Purchased ${minutesToBuy} inmate chat minute(s) for ${selectedInmate.username}`,
      })
      toast.success('Chat minutes purchased.')
      await fetchInmates()
    } catch (error: any) {
      console.error('Failed to buy minutes:', error)
      toast.error(error.message || 'Failed to buy minutes')
    } finally {
      setBuyingMinutes(false)
    }
  }

  const handleSendMessage = async () => {
    if (!user || !selectedInmate) return

    const cleanMessage = messageText.trim()
    if (!cleanMessage) {
      toast.error('Enter a message first.')
      return
    }
    if (selectedRemainingMinutes <= 0) {
      toast.error('No chat minutes available. Buy minutes first.')
      return
    }

    setSendingMessage(true)
    try {
      // Canonical moderation check
      const modResult = await moderation.checkContent(user.id, cleanMessage, 'inmate_message');
      if (!modResult.allowed) {
        toast.error(modResult.message || 'That message violates Mai Troll\'s chat rules and was not sent.');
        setSendingMessage(false)
        return
      }

      await deductCoins(MESSAGE_COST)

      const { error: messageError } = await supabase.from('inmate_messages').insert({
        inmate_id: selectedInmate.user_id,
        sender_id: user.id,
        recipient_id: selectedInmate.user_id,
        message: cleanMessage,
        cost: MESSAGE_COST,
        is_free_message: false,
      })
      if (messageError) throw messageError

      const { error: jailError } = await supabase
        .from('jail')
        .update({
          message_minutes_used: Number(selectedInmate.message_minutes_used || 0) + 1,
        })
        .eq('id', selectedInmate.id)
      if (jailError) throw jailError

      await supabase.from('jail_transactions').insert({
        jail_id: selectedInmate.id,
        user_id: user.id,
        transaction_type: 'message',
        amount: MESSAGE_COST,
        recipient_type: 'public_pool',
        notes: `Message sent to inmate ${selectedInmate.username}`,
      })

      const senderUsername = profile?.username || 'Someone'

      // Find or create a conversation between sender and inmate
      let conversationId: string | null = null
      try {
        const { data: foundConvId } = await supabase.rpc('find_shared_conversation', {
          p_user_id: user.id,
          p_other_user_id: selectedInmate.user_id,
        })
        conversationId = foundConvId || null
      } catch {
        // RPC may not exist yet, fall through to create
      }

      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ created_by: user.id })
          .select()
          .single()
        if (!convError && newConv) {
          conversationId = newConv.id
          await supabase.from('conversation_members').insert([
            { conversation_id: conversationId, user_id: user.id, role: 'owner' },
            { conversation_id: conversationId, user_id: selectedInmate.user_id, role: 'member' },
          ])
        }
      }

      // Insert into conversation_messages so inmate sees it in inbox
      if (conversationId) {
        await supabase.from('conversation_messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: cleanMessage,
        })

        // Send notification with conversation link
        await sendNotification(
          selectedInmate.user_id,
          'message',
          `New message from @${senderUsername}`,
          cleanMessage.length > 100 ? cleanMessage.substring(0, 100) + '...' : cleanMessage,
          {
            conversation_id: conversationId,
            sender_id: user.id,
            sender_username: senderUsername,
          }
        ).catch(() => {})
      }

      // Legacy jail notification (kept for backward compat)
      await supabase.from('jail_notifications').insert({
        user_id: selectedInmate.user_id,
        notification_type: 'inmate_message_received',
        title: `New message from @${senderUsername}`,
        message: `"${cleanMessage.substring(0, 100)}${cleanMessage.length > 100 ? '...' : ''}"`,
        data: {
          inmate_id: selectedInmate.user_id,
          sender_id: user.id,
          sender_username: senderUsername,
          jail_id: selectedInmate.id,
          conversation_id: conversationId,
        },
      })

      toast.success('Message sent.')
      setMessageText('')
      await fetchInmates()
    } catch (error: any) {
      console.error('Failed to send message:', error)
      toast.error(error.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleStartCall = async () => {
    if (!user || !selectedInmate) return
    setStartingCall(true)
    try {
      const { data, error } = await supabase.rpc('start_inmate_call', {
        p_inmate_id: selectedInmate.user_id,
        p_jail_id: selectedInmate.id,
      })
      if (error) throw error
      if (data?.success === false) throw new Error(data?.error || 'Failed to start call')
      const roomId = data?.room_id || data?.call_id || selectedInmate.user_id
      toast.success('Inmate call started.')
      navigate(`/jail/calls/${roomId}`)
    } catch (error: any) {
      console.error('Failed to start inmate call:', error)
      toast.error(error.message || 'Call could not be started. Check inmate call RPC/table.')
    } finally {
      setStartingCall(false)
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.13),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(239,68,68,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.1),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-6 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-red-200">
                <Lock className="h-4 w-4" />
                Mai Troll Jail Registry
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                City Jail
                <span className="block bg-gradient-to-r from-cyan-300 via-red-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Inmate Control
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                View inmates, post bond for release, purchase chat minutes, send paid messages, and start inmate calls.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard icon={Users} label="Inmates" value={inmates.length} />
              <StatCard icon={Handshake} label="Bond" value="Enabled" />
              <StatCard icon={MessageSquare} label="Chat Cost" value={`${MESSAGE_COST} TC`} />
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-[2rem] border border-cyan-400/15 bg-slate-950/70 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search inmates by username or reason..."
                className="h-13 w-full rounded-2xl border border-cyan-400/20 bg-black/40 py-3 pl-12 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>
            <button
              type="button"
              onClick={fetchInmates}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Jail
            </button>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60">
            <div className="mb-5 h-14 w-14 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
            <p className="text-lg font-black text-cyan-200">Loading jail registry...</p>
          </div>
        ) : filteredInmates.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60 px-6 text-center">
            <Lock className="mb-5 h-16 w-16 text-slate-600" />
            <h2 className="text-2xl font-black text-white">No Inmates Found</h2>
            <p className="mt-2 text-sm text-slate-400">No active inmates match your search.</p>
          </div>
        ) : (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredInmates.map((inmate) => (
              <InmateCard
                key={inmate.id}
                inmate={inmate}
                selected={selectedInmate?.id === inmate.id}
                onClick={() => setSelectedInmate(inmate)}
                formatReleaseTime={formatReleaseTime}
              />
            ))}
          </section>
        )}
      </main>

      {selectedInmate && (
        <aside className="fixed right-0 top-0 z-40 h-full w-full overflow-y-auto border-l border-cyan-400/20 bg-slate-950/95 p-5 shadow-[0_0_80px_rgba(34,211,238,0.14)] backdrop-blur-xl md:w-[440px]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Selected Inmate</p>
              <h2 className="text-2xl font-black text-white">{selectedInmate.username}</h2>
            </div>
            <button
              onClick={() => setSelectedInmate(null)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6 flex items-center gap-4 rounded-[2rem] border border-cyan-400/15 bg-black/30 p-4">
            <Avatar inmate={selectedInmate} size="lg" />
            <div>
              <p className="text-xl font-black text-white">{selectedInmate.username}</p>
              <p className="text-sm text-slate-400">Jailed {new Date(selectedInmate.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="space-y-4">
            <InfoPanel title="Sentence">
              <InfoRow label="Reason" value={selectedInmate.reason || 'Pending review'} />
              <InfoRow label="Sentence" value={`${selectedInmate.sentence_days} days`} />
              <InfoRow label="Release" value={formatReleaseTime(selectedInmate.release_time)} danger />
              <InfoRow label="Bond" value={`${selectedInmate.bond_amount || DEFAULT_BOND_AMOUNT} TC`} />
            </InfoPanel>

            <InfoPanel title="Bond Release">
              <p className="mb-4 text-sm leading-6 text-slate-400">
                Any user can post bond. Once bond is posted, the inmate is released immediately.
              </p>
              <button
                type="button"
                onClick={handlePostBond}
                disabled={postingBond || selectedInmate.bond_posted}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_0_26px_rgba(16,185,129,0.2)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Unlock className="h-4 w-4" />
                {postingBond ? 'Posting Bond...' : `Post Bond & Release - ${selectedInmate.bond_amount || DEFAULT_BOND_AMOUNT} TC`}
              </button>
              {user?.id === selectedInmate.user_id && (
                <button
                  type="button"
                  onClick={() => setShowBondRequest(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  <Handshake className="h-4 w-4" />
                  Request Bond from Followers
                </button>
              )}
            </InfoPanel>

            <InfoPanel title="Inmate Chat">
              <div className="mb-4 rounded-2xl border border-cyan-400/10 bg-black/30 p-4">
                <InfoRow label="Minutes" value={`${selectedRemainingMinutes} / ${selectedInmate.message_minutes}`} />
                <InfoRow label="Message Cost" value={`${MESSAGE_COST} TC`} />
                <InfoRow label="Minute Price" value={`${MINUTES_PRICE} TC`} />
              </div>
              <textarea
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Write a paid inmate message..."
                maxLength={500}
                className="mb-3 min-h-[110px] w-full rounded-2xl border border-cyan-400/20 bg-black/40 p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={sendingMessage || selectedRemainingMinutes <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.2)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4" />
                {sendingMessage ? 'Sending...' : `Send Message - ${MESSAGE_COST} TC`}
              </button>
              <div className="mt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Buy Chat Minutes</p>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {[1, 2, 5, 10].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setMinutesToBuy(amount)}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                        minutesToBuy === amount
                          ? 'border-cyan-300/40 bg-cyan-400 text-slate-950'
                          : 'border-cyan-400/15 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleBuyMinutes}
                  disabled={buyingMinutes}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/15 px-5 py-3 text-sm font-black text-fuchsia-200 transition hover:bg-fuchsia-500/25 disabled:opacity-50"
                >
                  <Coins className="h-4 w-4" />
                  {buyingMinutes ? 'Buying...' : `Buy ${minutesToBuy} Minute(s) - ${minutesToBuy * MINUTES_PRICE} TC`}
                </button>
              </div>
            </InfoPanel>

            <InfoPanel title="Inmate Calls">
              <p className="mb-4 text-sm leading-6 text-slate-400">
                Start a paid inmate call using your existing call cost system.
              </p>
              <button
                type="button"
                onClick={handleStartCall}
                disabled={startingCall}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
              >
                <Phone className="h-4 w-4" />
                {startingCall ? 'Starting Call...' : 'Start Inmate Call'}
              </button>
            </InfoPanel>

            {canMod && (
              <InfoPanel title="Staff Actions">
                <button
                  type="button"
                  onClick={() => navigate(`/troll-court?defendant=${selectedInmate.user_id}`)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-300/20 bg-purple-500/10 px-5 py-3 text-sm font-black text-purple-200 transition hover:bg-purple-500/20"
                >
                  <Shield className="h-4 w-4" />
                  Summon to Court
                </button>
              </InfoPanel>
            )}
          </div>
        </aside>
      )}

      {showBondRequest && selectedInmate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[2rem] border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_0_70px_rgba(34,211,238,0.14)]">
            <BondRequestModal
              inmateId={selectedInmate.user_id}
              onClose={() => setShowBondRequest(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function InmateCard({
  inmate,
  selected,
  onClick,
  formatReleaseTime,
}: {
  inmate: Inmate
  selected: boolean
  onClick: () => void
  formatReleaseTime: (releaseTime: string) => string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-[2rem] border bg-slate-950/75 p-5 text-left shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_0_60px_rgba(34,211,238,0.16)] ${
        selected ? 'border-cyan-300/50' : 'border-cyan-400/15'
      }`}
    >
      <div className="mb-5 flex items-center gap-4">
        <Avatar inmate={inmate} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black text-white">{inmate.username}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-black uppercase tracking-[0.16em] text-red-300">
            <Lock className="h-3 w-3" />
            Incarcerated
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <MiniRow label="Sentence" value={`${inmate.sentence_days} days`} />
        <MiniRow label="Remaining" value={formatReleaseTime(inmate.release_time)} danger />
        <MiniRow label="Bond" value={`${inmate.bond_amount || DEFAULT_BOND_AMOUNT} TC`} />
        <MiniRow label="Chat" value={`${Math.max(0, inmate.message_minutes - inmate.message_minutes_used)} min`} />
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Reason</p>
          <p className="line-clamp-2 text-sm text-slate-300">{inmate.reason}</p>
        </div>
      </div>
    </button>
  )
}

function Avatar({ inmate, size = 'md' }: { inmate: Inmate; size?: 'md' | 'lg' }) {
  const className = size === 'lg' ? 'h-20 w-20 rounded-3xl' : 'h-14 w-14 rounded-2xl'
  return (
    <div className={`${className} overflow-hidden border border-cyan-300/20 bg-slate-800`}>
      {inmate.avatar_url ? (
        <img src={inmate.avatar_url} alt={inmate.username} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-cyan-500/10 text-xl font-black text-cyan-200">
          {inmate.username.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-4">
      <Icon className="mb-3 h-5 w-5 text-cyan-300" />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-cyan-400/15 bg-black/30 p-4">
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-cyan-300">{title}</h3>
      {children}
    </section>
  )
}

function InfoRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-right text-sm font-black ${danger ? 'text-red-300' : 'text-white'}`}>{value}</span>
    </div>
  )
}

function MiniRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`font-black ${danger ? 'text-red-300' : 'text-cyan-100'}`}>{value}</span>
    </div>
  )
}
