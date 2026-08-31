import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useGlobalActivity, { ActivityEvent } from '../../hooks/useGlobalActivity'
import { useAuthStore } from '../../lib/store'
import { useTCNNRoles } from '../../hooks/useTCNNRoles'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Home, Mail, HelpCircle, MessageCircle, Shield, FileText } from 'lucide-react'
import '../../styles/ticker.css'

const seoLinks = [
  { path: '/about', label: 'About', icon: Home },
  { path: '/contact', label: 'Contact', icon: Mail },
  { path: '/support', label: 'Support', icon: HelpCircle },
  { path: '/faq', label: 'FAQ', icon: MessageCircle },
  { path: '/privacy', label: 'Privacy', icon: Shield },
  { path: '/terms', label: 'Terms', icon: FileText },
]

const GlobalTicker = () => {
  const events = useGlobalActivity()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id)
  const [isHeartbeating, setIsHeartbeating] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [tickerMessage, setTickerMessage] = useState('')
  const [tickerType, setTickerType] = useState<'standard' | 'breaking'>('standard')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin
  const canEditTicker = isAdmin || isNewsCaster || isChiefNewsCaster

  const [currentEventIndex, setCurrentEventIndex] = useState(0)

  const handleTickerClick = (event: ActivityEvent) => {
    if (event.metadata?.url) {
      navigate(event.metadata.url)
    }
  }

  useEffect(() => {
    if (events.length > 0 && (events[0].priority === 'high' || events[0].priority === 'breaking')) {
      setIsHeartbeating(true)
      const timer = setTimeout(() => setIsHeartbeating(false), 1200)
      return () => clearTimeout(timer)
    }
  }, [events])

  const handleSubmitTicker = async () => {
    if (!tickerMessage.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsSubmitting(true)
    try {
      const cleanMessage = tickerMessage.trim()
      const { error } = await supabase.rpc('create_global_event', {
        p_type: tickerType === 'breaking' ? 'tcnn_breaking' : 'tcnn_live',
        p_title: tickerType === 'breaking' ? `BREAKING: ${cleanMessage}` : cleanMessage,
        p_icon: tickerType === 'breaking' ? 'alert' : 'newspaper',
        p_priority: tickerType === 'breaking' ? 3 : 1,
        p_metadata: {
          category: tickerType === 'breaking' ? 'breaking_news' : 'ticker_message',
          submitted_by: user?.id,
        },
      })

      if (error) throw error

      try {
        const notifTitle = getNotificationTitle(tickerType)
        await supabase.functions.invoke('global-ticker-notify', {
          body: {
            title: notifTitle,
            message: cleanMessage,
            type: 'announcement',
            icon: tickerType === 'breaking' ? 'alert' : 'newspaper',
            original_type: tickerType === 'breaking' ? 'tcnn_breaking' : 'tcnn_live',
            category: tickerType === 'breaking' ? 'breaking_news' : 'ticker_message',
            url: '/',
          },
        })
      } catch (notifyErr: any) {
        console.warn('Failed to send ticker notifications:', notifyErr)
      }

      toast.success(tickerType === 'breaking' ? 'Breaking news pushed!' : 'Ticker message pushed!')
      setShowEditModal(false)
      setTickerMessage('')
      setTickerType('standard')
    } catch (err: any) {
      console.error('Error pushing ticker:', err)
      toast.error(err.message || 'Failed to push ticker')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getEventStyles = (event: ActivityEvent): string => {
    switch (event.type) {
      case 'tcnn_breaking':
        return 'tcnn-breaking'
      case 'tcnn_live':
        return 'tcnn-live'
      case 'tcnn_article':
        return 'tcnn-article'
      case 'live':
        return 'event-live'
      case 'gift':
        return 'event-gift'
      case 'battle':
        return 'event-battle'
      default:
        return 'event-system'
    }
  }

  const getEventIcon = (event: ActivityEvent): string => {
    switch (event.type) {
      case 'tcnn_breaking':
        return '!'
      case 'tcnn_live':
        return 'TV'
      case 'tcnn_article':
        return 'NEWS'
      case 'live':
        return 'LIVE'
      case 'gift':
        return 'GIFT'
      case 'battle':
        return 'VS'
      default:
        return '*'
    }
  }

  const getNotificationTitle = (type: 'standard' | 'breaking'): string => {
    switch (type) {
      case 'breaking':
        return '🚨 BREAKING NEWS'
      case 'standard':
      default:
        return '📰 TCNN UPDATE'
    }
  }

  const hasBreakingNews = events.some(e => e.type === 'tcnn_breaking')
  const visibleEvents = events.slice(0, 20)
  const currentEvent = visibleEvents[currentEventIndex] || null

  useEffect(() => {
    if (visibleEvents.length <= 1) return
    const interval = setInterval(() => {
      setCurrentEventIndex((prev) => (prev + 1) % visibleEvents.length)
    }, 9000)
    return () => clearInterval(interval)
  }, [visibleEvents.length])

  return (
    <>
      <div className="ticker-two-system">
        {/* Top: Activity Ticker */}
        <div
          className={`ticker-wrap ${isHeartbeating ? 'heartbeat' : ''} ${hasBreakingNews ? 'breaking-news-active' : ''} ${canEditTicker ? 'cursor-pointer' : ''}`}
          onDoubleClick={() => canEditTicker && setShowEditModal(true)}
          title={canEditTicker ? 'Double-click to push new ticker message' : undefined}
        >
          <div className="ticker">
            {currentEvent ? (
              <div
                key={`${currentEvent.id}-${currentEvent.type}`}
                className={`ticker-item ${getEventStyles(currentEvent)} ${currentEvent.metadata?.url ? 'cursor-pointer hover:underline' : ''} animate-slide-right-to-left`}
                onClick={() => currentEvent.metadata?.url && handleTickerClick(currentEvent)}
                role={currentEvent.metadata?.url ? 'button' : undefined}
                tabIndex={currentEvent.metadata?.url ? 0 : undefined}
              >
                <span className="ticker-icon">{getEventIcon(currentEvent)}</span>
                <span className="ticker-message">{currentEvent.message}</span>
                {currentEvent.type === 'tcnn_breaking' && <span className="breaking-badge">BREAKING</span>}
                {currentEvent.type === 'tcnn_live' && <span className="live-badge">LIVE</span>}
              </div>
            ) : (
              <div className="ticker-item event-system animate-slide-right-to-left">
                <span className="ticker-icon">LIVE</span>
                <span className="ticker-message">Waiting for live city events...</span>
              </div>
            )}
          </div>

          {hasBreakingNews && (
            <div className="breaking-news-overlay">
              <span className="breaking-pulse">BREAKING NEWS</span>
            </div>
          )}
        </div>

        {/* Bottom: SEO Page Links */}
        <nav className="ticker-seo-links" aria-label="Quick links">
          <ul className="ticker-seo-list">
            {seoLinks.map((link) => {
              const Icon = link.icon
              return (
                <li key={link.path}>
                  <Link to={link.path} className="ticker-seo-link">
                    <Icon className="w-3 h-3" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {showEditModal && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md w-full max-h-[80vh] overflow-y-auto fixed top-[10%]">
            <div className="p-2">
              <h3 className="text-xl font-bold mb-4">Push Ticker Message</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Message</label>
                  <textarea
                    value={tickerMessage}
                    onChange={(e) => setTickerMessage(e.target.value)}
                    placeholder="Enter ticker message..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-slate-500 mt-1">{tickerMessage.length}/200 characters</p>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTickerType('standard')}
                      className={`px-4 py-2 rounded-lg border ${tickerType === 'standard' ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setTickerType('breaking')}
                      className={`px-4 py-2 rounded-lg border ${tickerType === 'breaking' ? 'bg-red-600 border-red-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      Breaking
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSubmitTicker}
                    disabled={isSubmitting || !tickerMessage.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    {isSubmitting ? 'Pushing...' : 'Push Live'}
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-slate-700 text-slate-400 rounded-lg hover:border-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default GlobalTicker
