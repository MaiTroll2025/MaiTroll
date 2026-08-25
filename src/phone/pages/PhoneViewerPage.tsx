import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  Gift,
  Heart,
  MessageCircle,
  MoreVertical,
  Radio,
  Send,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

interface PhoneViewerPageProps {
  streamId?: string
}

interface ChatMessage {
  id: string
  username: string
  message: string
}

const neonBlue = '#00BFFF'
const neonPurple = '#BF00FF'

export default function PhoneViewerPage({
  streamId,
}: PhoneViewerPageProps) {
  const navigate = useNavigate()

  const [showControls, setShowControls] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [liked, setLiked] = useState(false)
  const [following, setFollowing] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      username: 'MaiTroll',
      message: 'Welcome to the broadcast 👋',
    },
    {
      id: '2',
      username: 'Viewer',
      message: 'This is 🔥',
    },
    {
      id: '3',
      username: 'TrollKing',
      message: 'Who is winning tonight?',
    },
  ])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const toggleControls = () => {
    if (chatOpen) return
    setShowControls((value) => !value)
  }

  const sendMessage = () => {
    const trimmed = message.trim()

    if (!trimmed) return

    setChatMessages((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        username: 'You',
        message: trimmed,
      },
    ])

    setMessage('')
  }

  return (
    <div className="min-h-[100dvh] overflow-hidden bg-[#03030a] text-white">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#00BFFF]/10 blur-[120px]" />
        <div className="absolute -right-40 top-[25%] h-[500px] w-[500px] rounded-full bg-[#BF00FF]/10 blur-[130px]" />
        <div className="absolute bottom-[-200px] left-[20%] h-[500px] w-[500px] rounded-full bg-[#00BFFF]/8 blur-[140px]" />

        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(0,191,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(191,0,255,0.8)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <main className="relative z-10 min-h-[100dvh]">

        {/* ================================================================ */}
        {/* VIDEO STAGE                                                      */}
        {/* ================================================================ */}

        <section
          className="relative h-[56dvh] min-h-[390px] max-h-[650px] overflow-hidden bg-black"
          onClick={toggleControls}
        >

          {/* Broadcast surface */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#07152b] via-[#03030a] to-[#19062d]">

            {/*
             * EXISTING LIVEKIT VIDEO GOES HERE.
             *
             * Keep the actual video/broadcast engine from ViewerPage.
             * This component owns only the phone presentation.
             */}

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 shadow-[0_0_40px_rgba(0,191,255,0.12)]">
                  <Radio
                    size={28}
                    className="text-[#00BFFF]"
                  />
                </div>

                <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
                  Connecting to broadcast
                </p>
              </div>
            </div>

            {/* Video overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
          </div>

          {/* Top bar */}
          <div
            className={`absolute left-0 right-0 top-0 z-20 px-3 pt-[max(12px,env(safe-area-inset-top))] transition-all duration-300 ${
              showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div className="flex items-center justify-between">

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  navigate(-1)
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/45 text-white backdrop-blur-xl active:scale-90"
                aria-label="Go back"
              >
                <ArrowLeft size={19} />
              </button>

              <div className="flex items-center gap-2">

                <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-black/55 px-3 py-1.5 backdrop-blur-xl">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />

                  <span className="text-[9px] font-black uppercase tracking-wider">
                    Live
                  </span>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[9px] font-black backdrop-blur-xl">
                  <Eye
                    size={12}
                    className="text-[#00BFFF]"
                  />
                  1.2K
                </div>

                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/45 backdrop-blur-xl"
                >
                  <MoreVertical size={17} />
                </button>
              </div>
            </div>
          </div>

          {/* Right-side action rail */}
          <div
            className={`absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3 transition-all duration-300 ${
              showControls
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none translate-x-8 opacity-0'
            }`}
          >

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setLiked((value) => !value)
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-xl transition active:scale-90 ${
                liked
                  ? 'border-pink-400/40 bg-pink-500/20 text-pink-300'
                  : 'border-white/10 bg-black/45 text-white'
              }`}
            >
              <Heart
                size={19}
                fill={liked ? 'currentColor' : 'none'}
              />
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setChatOpen(true)
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00BFFF]/25 bg-[#00BFFF]/10 text-[#00BFFF] backdrop-blur-xl active:scale-90"
            >
              <MessageCircle size={19} />
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                toast.info('Gifts coming soon')
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#BF00FF]/25 bg-[#BF00FF]/10 text-[#BF00FF] backdrop-blur-xl active:scale-90"
            >
              <Gift size={19} />
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                navigator.clipboard.writeText(window.location.origin + '/viewer')
                toast.success('Link copied')
              }}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/45 text-white backdrop-blur-xl active:scale-90"
            >
              <Share2 size={18} />
            </button>
          </div>

          {/* Stream information over video */}
          <div
            className={`absolute bottom-0 left-0 right-0 z-20 p-4 transition-all duration-300 ${
              showControls ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
            }`}
          >
            <div className="flex items-end gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#00BFFF]/30 bg-gradient-to-br from-[#BF00FF] to-[#00BFFF] shadow-[0_0_25px_rgba(0,191,255,0.2)]">
                <Sparkles size={19} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-black">
                    Streamer Name
                  </p>

                  <span className="rounded-full bg-[#00BFFF]/15 px-2 py-0.5 text-[7px] font-black uppercase text-[#00BFFF]">
                    LIVE
                  </span>
                </div>

                <p className="mt-0.5 truncate text-[10px] font-bold text-zinc-300">
                  Welcome to the MaiTroll broadcast
                </p>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setFollowing((value) => !value)
                }}
                className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[9px] font-black transition active:scale-95 ${
                  following
                    ? 'bg-white/10 text-white'
                    : 'bg-gradient-to-r from-[#BF00FF] to-[#00BFFF] text-white shadow-[0_0_20px_rgba(0,191,255,0.18)]'
                }`}
              >
                <UserPlus size={12} />
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* STREAM INFO                                                      */}
        {/* ================================================================ */}

        <section className="relative border-b border-white/[0.07] bg-[#070711]/95 px-4 py-4">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#00BFFF]">
                Broadcasting Now
              </p>

              <h1 className="mt-1 text-base font-black text-white">
                Welcome to the MaiTroll Network
              </h1>
            </div>

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <ChevronDown size={17} className="text-zinc-400" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">

            <div className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
              <Users size={11} className="text-emerald-300" />
              <span className="text-[9px] font-bold text-zinc-400">
                1,248 watching
              </span>
            </div>

            <div className="rounded-full border border-[#BF00FF]/15 bg-[#BF00FF]/5 px-2.5 py-1.5 text-[9px] font-bold text-[#BF00FF]">
              {streamId ? `#${streamId.slice(0, 8)}` : 'MaiTroll Live'}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* CHAT                                                             */}
        {/* ================================================================ */}

        <section className="px-3 pb-32 pt-4">

          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00BFFF]/10">
                <MessageCircle
                  size={13}
                  className="text-[#00BFFF]"
                />
              </div>

              <div>
                <h2 className="text-xs font-black text-white">
                  Live Chat
                </h2>

                <p className="text-[8px] font-bold text-zinc-600">
                  Join the conversation
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setChatOpen((value) => !value)}
              className="text-[9px] font-black uppercase tracking-wider text-[#00BFFF]"
            >
              {chatOpen ? 'Close' : 'Open'}
            </button>
          </div>

          <div className="space-y-2">
            {chatMessages.slice(-5).map((chat) => (
              <div
                key={chat.id}
                className="flex gap-2 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2"
              >
                <span className="shrink-0 text-[9px] font-black text-[#BF00FF]">
                  @{chat.username}
                </span>

                <span className="min-w-0 text-[9px] font-medium text-zinc-400">
                  {chat.message}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================================ */}
        {/* MOBILE CHAT COMPOSER                                             */}
        {/* ================================================================ */}

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-[#05050c]/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl">

          <div className="flex items-center gap-2">

            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/10 text-[#BF00FF] active:scale-90"
              aria-label="Send gift"
            >
              <Gift size={18} />
            </button>

            <div className="relative flex-1">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    sendMessage()
                  }
                }}
                placeholder="Say something..."
                className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 pr-11 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#00BFFF]/30"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={!message.trim()}
                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-[#BF00FF] to-[#00BFFF] text-white transition active:scale-90 disabled:opacity-30"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Full chat sheet */}
        {chatOpen && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">

            <div className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-[28px] border-t border-[#00BFFF]/20 bg-[#070711] shadow-[0_-20px_80px_rgba(0,191,255,0.12)]">

              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">

                <div>
                  <p className="text-sm font-black text-white">
                    Live Chat
                  </p>

                  <p className="mt-0.5 text-[9px] font-bold text-zinc-600">
                    Everyone watching this broadcast
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-400"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-2">
                  {chatMessages.map((chat) => (
                    <div
                      key={chat.id}
                      className="rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2.5"
                    >
                      <span className="text-[9px] font-black text-[#00BFFF]">
                        @{chat.username}
                      </span>

                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {chat.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.07] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <div className="flex gap-2">
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        sendMessage()
                      }
                    }}
                    autoFocus
                    placeholder="Say something..."
                    className="h-11 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-[#00BFFF]/30"
                  />

                  <button
                    type="button"
                    onClick={sendMessage}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#BF00FF] to-[#00BFFF] text-white shadow-[0_0_22px_rgba(0,191,255,0.18)] active:scale-90"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        * {
          -webkit-tap-highlight-color: transparent;
        }

        ::-webkit-scrollbar {
          display: none;
        }

        html,
        body {
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}