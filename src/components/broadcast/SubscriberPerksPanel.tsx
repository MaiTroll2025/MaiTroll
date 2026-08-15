import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { useSubscriberBadges } from '../../hooks/useCreatorSubscription'
import { toast } from 'sonner'
import { Crown, Gift, Megaphone, Mail, Send, X } from 'lucide-react'

interface SubscriberPerksPanelProps {
  broadcasterId: string
  streamId: string
  onClose: () => void
}

interface ShoutoutForm {
  subscriberUsername: string
  message: string
}

export default function SubscriberPerksPanel({ broadcasterId, streamId, onClose }: SubscriberPerksPanelProps) {
  const { user, profile } = useAuthStore()
  const { badges: subscriberBadges, loading } = useSubscriberBadges(broadcasterId)
  const [subscribers, setSubscribers] = useState<Array<{ username: string; tierName: string; tierColor: string }>>([])
  const [selectedSubscriber, setSelectedSubscriber] = useState<string>('')
  const [shoutoutMessage, setShoutoutMessage] = useState('')
  const [sendingShoutout, setSendingShoutout] = useState(false)
  const [sendingGift, setSendingGift] = useState(false)
  const [activeTab, setActiveTab] = useState<'shoutout' | 'gift' | 'dm'>('shoutout')

  useEffect(() => {
    const subs = Array.from(subscriberBadges.entries()).map(([username, badge]) => ({
      username,
      tierName: badge.tierName,
      tierColor: badge.tierColor,
    }))
    setSubscribers(subs)
  }, [subscriberBadges])

  const handleSendShoutout = async () => {
    if (!selectedSubscriber || !shoutoutMessage.trim() || !user) return
    setSendingShoutout(true)
    try {
      const { error } = await supabase.from('stream_messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content: `📢 SHOUTOUT: ${selectedSubscriber} - ${shoutoutMessage}`,
        type: 'system',
        user_profiles: {
          username: profile?.username || 'Broadcaster',
          avatar_url: profile?.avatar_url,
        },
      })

      if (error) throw error
      toast.success(`Shoutout sent to ${selectedSubscriber}!`)
      setShoutoutMessage('')
      setSelectedSubscriber('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send shoutout')
    } finally {
      setSendingShoutout(false)
    }
  }

  const handleSendMonthlyGift = async () => {
    if (!selectedSubscriber || !user) return
    setSendingGift(true)
    try {
      const { data, error } = await supabase.rpc('credit_coins', {
        p_user_id: selectedSubscriber,
        p_coins: 1000,
        p_reason: 'monthly_subscriber_gift',
      })

      if (error) throw error
      toast.success(`Monthly gift sent to ${selectedSubscriber}!`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send gift')
    } finally {
      setSendingGift(false)
    }
  }

  const handleSendDirectMessage = async () => {
    if (!selectedSubscriber) return
    try {
      const { data: recipient } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', selectedSubscriber)
        .single()

      if (!recipient) {
        toast.error('User not found')
        return
      }

      const { data: existingThread } = await supabase
        .from('utromail_threads')
        .select('id')
        .or(`and(created_by.eq.${user?.id},other_user_id.eq.${recipient.id}),and(created_by.eq.${recipient.id},other_user_id.eq.${user?.id})`)
        .maybeSingle()

      const threadId = existingThread?.id || (await supabase.from('utromail_threads').insert({
        created_by: user?.id,
        other_user_id: recipient.id,
        other_username: selectedSubscriber,
        last_message_at: new Date().toISOString(),
      }).select('id').single()).data?.id

      if (threadId) {
        window.location.href = `/utromail?threadId=${threadId}`
        onClose()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to open DM')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-cyan-400" />
            Subscriber Perks
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select Subscriber</label>
          <select
            value={selectedSubscriber}
            onChange={e => setSelectedSubscriber(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">Choose a subscriber...</option>
            {subscribers.map(sub => (
              <option key={sub.username} value={sub.username}>
                {sub.username} ({sub.tierName})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('shoutout')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'shoutout' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Megaphone className="w-4 h-4 inline mr-1" />
            Shoutout
          </button>
          <button
            onClick={() => setActiveTab('gift')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'gift' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Gift className="w-4 h-4 inline mr-1" />
            Monthly Gift
          </button>
          <button
            onClick={() => setActiveTab('dm')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'dm' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <Mail className="w-4 h-4 inline mr-1" />
            DM
          </button>
        </div>

        {activeTab === 'shoutout' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Shoutout Message</label>
              <textarea
                value={shoutoutMessage}
                onChange={e => setShoutoutMessage(e.target.value)}
                placeholder={`Give ${selectedSubscriber || 'a subscriber'} a shoutout!`}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
            <button
              onClick={handleSendShoutout}
              disabled={!selectedSubscriber || !shoutoutMessage.trim() || sendingShoutout}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {sendingShoutout ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="w-4 h-4" />}
              Send Shoutout
            </button>
          </div>
        )}

        {activeTab === 'gift' && (
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <Gift className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-sm text-yellow-200">Send 1,000 Troll Coins to {selectedSubscriber || 'a subscriber'}</p>
            </div>
            <button
              onClick={handleSendMonthlyGift}
              disabled={!selectedSubscriber || sendingGift}
              className="w-full py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {sendingGift ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Gift className="w-4 h-4" />}
              Send Monthly Gift
            </button>
          </div>
        )}

        {activeTab === 'dm' && (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <Mail className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-200">
                Open direct message with {selectedSubscriber || 'a subscriber'}
              </p>
              <p className="text-xs text-emerald-300/70 mt-1">
                {selectedSubscriber ? 'You can now DM them directly via Utromail' : 'Select a subscriber first'}
              </p>
            </div>
            <button
              onClick={handleSendDirectMessage}
              disabled={!selectedSubscriber}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Open DM
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
