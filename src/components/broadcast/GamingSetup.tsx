import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  BarChart3,
  ChevronDown,
  Gamepad2,
  Loader2,
  Mail,
  Mic,
  MicOff,
  MonitorPlay,
  MoreVertical,
  Pause,
  Play,
  Power,
  Radio,
  Settings,
  ShieldCheck,
  Square,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  AlertTriangle,
  Eye,
  Activity,
  Layout,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SceneConfig } from '@/components/broadcast/GamingSceneManager'
import TipBanner from '@/components/broadcast/TipBanner'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

interface GamingSetupProps {
  streamTitle?: string
  onStreamTitleChange?: (title: string) => void
  gameTitle?: string
  onGameChange?: (game: string) => void
  isMicEnabled?: boolean
  hasMicTrack?: boolean
  onToggleMic?: () => void
  errorMessage?: string | null
  className?: string
  viewerCount?: number
  streamDuration?: string
  username?: string
  userLevel?: number
  userAvatar?: string | null
  chatPanel?: React.ReactNode
  heartbeatStatus?: {
    isChatActive: boolean
    isAudioActive: boolean
    isIdle: boolean
    idleReason: string | null
  }
  scenes?: SceneConfig[]
  activeSceneId?: string | null
  onCreateScene?: (name: string) => void
  onDeleteScene?: (sceneId: string) => void
  onSwitchScene?: (sceneId: string) => void
  onUpdateScene?: (sceneId: string, updates: Partial<SceneConfig>) => void
  onAddTextOverlay?: (sceneId: string) => void
  onUpdateTextOverlay?: (sceneId: string, overlayId: string, updates: Partial<SceneConfig['textOverlays'][0]>) => void
  onDeleteTextOverlay?: (sceneId: string, overlayId: string) => void
  onSetBackgroundImage?: (sceneId: string, imageUrl: string | null) => void
}

// Two-phase flow: preview → live

export function GamingSetup({
  streamTitle = 'Ranked Grind to Top 1 | Mai Troll',
  isMicEnabled = true,
  hasMicTrack = false,
  onToggleMic,
  onStartPreview,
  onStopPreview,
  onGoLive,
  onEndStream,
  isPreviewing = false,
  isLive = false,
  isConnecting = false,
  errorMessage,
  className,
  viewerCount = 0,
  streamDuration = '00:00:00',
  username = 'Gamer',
  userLevel = 1,
  userAvatar = null,
  chatPanel,
  onStreamTitleChange,
  onGameChange,
  gameTitle = '',
  heartbeatStatus,
  scenes = [],
  activeSceneId = null,
  onCreateScene,
  onDeleteScene,
  onSwitchScene,
  onUpdateScene,
  onAddTextOverlay,
  onUpdateTextOverlay,
  onDeleteTextOverlay,
  onSetBackgroundImage,
  screenStream = null,
  cameraStream = null,
  micStream = null,
  screenAudioTrack = null,
  hasScreenAudioTrack = false,
  hasCameraTrack = false,
  isCameraEnabled = false,
  onToggleCamera,
  inlineAgreementChecked = false,
  onInlineAgreementChange,
streamId,
  userId
  }: GamingSetupProps) {
  const [showGameSearch, setShowGameSearch] = React.useState(false)
  const [gameSearchQuery, setGameSearchQuery] = React.useState('')
  const [selectedGame, setSelectedGame] = React.useState<string>('')
  const [showScenePanel, setShowScenePanel] = React.useState(false)

  const POPULAR_GAMES = [
    'Fortnite','Apex Legends','Call of Duty: Warzone','Valorant','League of Legends',
    'Counter-Strike 2','Dota 2','Overwatch 2','Rocket League','Fall Guys',
    'Grand Theft Auto V','Red Dead Redemption 2','Elden Ring','Cyberpunk 2077',
    'The Witcher 3','World of Warcraft','Final Fantasy XIV','Destiny 2','Rainbow Six Siege',
    'SplitGate','Halo Infinite','Call of Duty: Modern Warfare II','PUBG','ARMA 3',
    'Escape from Tarkov','Dead by Daylight','Among Us','Brawlhalla',
    'Super Smash Bros. Ultimate','Street Fighter 6','Mortal Kombat 1',
    'FIFA 24','NBA 2K24','Madden NFL 24','F1 23',
  ]

  const filteredGames = React.useMemo(() => {
    if (!gameSearchQuery) return POPULAR_GAMES.slice(0, 15)
    return POPULAR_GAMES.filter(g => g.toLowerCase().includes(gameSearchQuery.toLowerCase())).slice(0, 10)
  }, [gameSearchQuery])

  // Status config for two-phase flow: preview → live
  const statusConfig = React.useMemo(() => {
    if (isConnecting) return { label: 'Going Live...', detail: 'Joining Agora and publishing tracks.', className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100', dotClassName: 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)] animate-pulse' }
    if (isLive) return { label: 'Live on HytroGaming', detail: 'Your screen + camera are being broadcast via Agora.', className: 'border-red-400/30 bg-red-500/10 text-red-100', dotClassName: 'bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.95)] animate-pulse' }
    if (isPreviewing) return { label: 'Preview Mode', detail: 'Screen captured locally. Adjust camera/mic, then click Go Live.', className: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100', dotClassName: 'bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]' }
    return { label: 'Ready to Share', detail: 'Click "Start Preview" to capture your screen and see it locally.', className: 'border-white/10 bg-white/[0.04] text-slate-200', dotClassName: 'bg-slate-400' }
  }, [isConnecting, isLive, isPreviewing])

  return (
    <div className={cn('flex h-screen flex-col overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#05080f] text-white', 'bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.12),transparent_30%),linear-gradient(180deg,#05080f,#02040a)]', className)}>
      {/* Tip Banner — shows when gifts are sent during stream */}
      {streamId && <TipBanner streamId={streamId} />}

      {/* ── Header ── */}
      <header className="border-b border-cyan-400/15 bg-black/35 px-4 py-3 backdrop-blur-2xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.22)]"><Gamepad2 className="h-6 w-6 text-cyan-200" /></div>
              <div className="leading-none"><div className="text-2xl font-black italic tracking-tight"><span className="text-cyan-300">Troll</span>{' '}<span className="bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">City</span></div></div>
            </div>
            <div className="hidden rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-2.5 text-sm font-black text-emerald-200 shadow-[0_0_24px_rgba(74,222,128,0.18)] md:flex md:items-center md:gap-2"><Gamepad2 className="h-4 w-4" />HytroGaming</div>
          </div>
          <div className="hidden items-center gap-3 rounded-2xl border border-cyan-400/15 bg-white/[0.04] px-3 py-2 md:flex">
            {userAvatar ? <div style={{ overflow: 'visible' }}><ProfileFrame frame={useUserFrame(userId)} avatarUrl={userAvatar} username={username} size="sm" /></div> : <div className="grid h-10 w-10 place-items-center rounded-xl border border-purple-300/40 bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black">{username.slice(0, 2).toUpperCase()}</div>}
            <div><p className="text-sm font-black">{username}</p><p className="text-xs font-bold text-cyan-300">LVL {userLevel}</p></div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <main className="grid min-h-0 flex-1 gap-4 p-4 sm:p-6 xl:grid-cols-[360px_minmax(560px,1fr)_360px] 2xl:grid-cols-[420px_minmax(680px,1fr)_420px]">

        {/* ── Left Column: Controls + Settings ── */}
        <section className="space-y-4">

          {/* Screen Share Control Panel */}
          <Panel>
            <PanelHeader icon={<MonitorPlay className="h-4 w-4" />} title="Screen Share" right={isLive && <span className="flex items-center gap-1 text-xs font-black text-red-300"><span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />LIVE</span>} />
            <div className="p-4">
              {/* Status indicator */}
              <div className={cn('rounded-2xl border px-4 py-3', statusConfig.className)}>
                <div className="flex items-start gap-3">
                  <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', statusConfig.dotClassName)} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide">{statusConfig.label}</p>
                    <p className="mt-1 text-[11px] leading-5 opacity-80">{statusConfig.detail}</p>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {errorMessage && (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
                    <p className="text-xs text-red-200">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Main action buttons — two-phase: preview → live */}
              <div className="mt-4 grid gap-2">
                {/* Phase 1: Not previewing, not live → show "Start Preview" */}
                {!isPreviewing && !isLive && !isConnecting && (
                  <button type="button" onClick={onStartPreview} className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-[0_0_30px_rgba(59,130,246,0.35)] transition hover:scale-[1.01]">
                    <MonitorPlay className="h-5 w-5" />
                    Start Preview
                  </button>
                )}

                {/* Connecting spinner */}
                {isConnecting && (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3.5 text-sm font-black text-cyan-200">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Going Live...
                  </div>
                )}

                {/* Phase 2: Previewing but not live → show "Go Live" + "Stop Preview" */}
                {isPreviewing && !isLive && !isConnecting && (
                  <>
                    <button type="button" onClick={onGoLive} disabled={!inlineAgreementChecked} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3.5 text-sm font-black text-white shadow-[0_0_30px_rgba(52,211,153,0.35)] transition hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                      <Radio className="h-5 w-5" />
                      Go Live
                    </button>
                    <button type="button" onClick={onStopPreview} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/[0.08]">
                      Stop Preview
                    </button>
                  </>
                )}

                {/* Phase 3: Live → show "End Stream" */}
                {isLive && (
                  <button type="button" onClick={onEndStream} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20">
                    <Power className="h-5 w-5" />
                    End Stream
                  </button>
                )}

                {/* Mic toggle */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {isMicEnabled ? <Mic className="h-4 w-4 text-emerald-300" /> : <MicOff className="h-4 w-4 text-red-300" />}
                  <span className="text-xs font-bold text-slate-300">Microphone</span>
                </div>
                <button type="button" onClick={onToggleMic} disabled={!onToggleMic} className={cn('grid h-9 w-9 place-items-center rounded-lg border transition', isMicEnabled ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15' : 'border-red-300/30 bg-red-500/10 text-red-200 hover:bg-red-500/15')}>
                  {isMicEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              </div>

              {/* Camera toggle (webcam overlay, like OBS) */}
              <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {isCameraEnabled ? <Video className="h-4 w-4 text-emerald-300" /> : <VideoOff className="h-4 w-4 text-red-300" />}
                  <span className="text-xs font-bold text-slate-300">Camera</span>
                </div>
                <button type="button" onClick={onToggleCamera} disabled={!onToggleCamera} className={cn('grid h-9 w-9 place-items-center rounded-lg border transition', isCameraEnabled ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15' : 'border-red-300/30 bg-red-500/10 text-red-200 hover:bg-red-500/15')}>
                  {isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
              </div>

              {/* Device Status Indicators */}
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Device Status</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', isCameraEnabled ? 'bg-emerald-400' : 'bg-slate-600')} />
                    <span className="text-[10px] text-slate-400">Camera</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', isMicEnabled ? 'bg-emerald-400' : 'bg-slate-600')} />
                    <span className="text-[10px] text-slate-400">Microphone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', isPreviewing || isLive ? 'bg-emerald-400' : 'bg-slate-600')} />
                    <span className="text-[10px] text-slate-400">Screen Share</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', hasScreenAudioTrack ? 'bg-emerald-400' : 'bg-slate-600')} />
                    <span className="text-[10px] text-slate-400">Game Audio</span>
                  </div>
                </div>
              </div>

              {/* Broadcast Agreement */}
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-black/20 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <ShieldCheck size={12} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Broadcast Agreement</span>
                </div>
                <div className="max-h-28 overflow-y-auto rounded-lg bg-zinc-800/60 border border-zinc-700 p-2 mb-2 text-[10px] text-zinc-300 leading-relaxed space-y-1.5">
                  <p>By starting a broadcast, I confirm that I am at least 18 years old and will comply with all applicable laws in my jurisdiction. I understand that I am solely responsible for the content I create, stream, share, or display on Mai Troll.</p>
                  <p>I agree not to broadcast illegal activity, sell or promote controlled substances, threaten or harm others, share non-consensual content, or violate Mai Troll's Terms of Service or Community Guidelines.</p>
                  <p>I further acknowledge that I am of legal age in my jurisdiction to consume any products, substances, beverages, or other items that may be displayed or consumed during my broadcast, and that any such activity is conducted at my own responsibility and in compliance with local laws.</p>
                  <p>Mai Troll reserves the right to remove content, suspend broadcasts, restrict features, or terminate accounts that violate these rules.</p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={inlineAgreementChecked}
                      onChange={(e) => onInlineAgreementChange?.(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      'w-4 h-4 rounded border-2 transition-all',
                      inlineAgreementChecked
                        ? 'bg-amber-500 border-amber-500'
                        : 'bg-zinc-800 border-zinc-600 group-hover:border-zinc-500'
                    )}>
                      {inlineAgreementChecked && (
                        <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-300 leading-snug">
                    I am 18 years of age or older and agree to the Broadcast Agreement, Terms of Service, and Community Guidelines.
                  </span>
                </label>
              </div>

              {/* Heartbeat status */}
              {heartbeatStatus && isLive && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Activity Monitor</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', heartbeatStatus.isChatActive ? 'bg-emerald-400' : 'bg-amber-400')} />
                      <span className="text-[10px] text-slate-400">Chat</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', heartbeatStatus.isAudioActive ? 'bg-emerald-400' : 'bg-amber-400')} />
                      <span className="text-[10px] text-slate-400">Audio</span>
                    </div>
                  </div>
                  {heartbeatStatus.isIdle && heartbeatStatus.idleReason && (
                    <p className="mt-2 text-[10px] text-amber-300">{heartbeatStatus.idleReason}</p>
                  )}
                </div>
              )}
            </div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader icon={<Settings className="h-4 w-4" />} title="Stream Settings" />
            <div className="divide-y divide-white/10 p-4">
              <div className="pb-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wide">Stream Title</label>
                <input type="text" value={streamTitle} onChange={(e) => onStreamTitleChange?.(e.target.value)} placeholder="Enter stream title..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/50" />
              </div>
              <div className="pt-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wide">Game</label>
                <div className="mt-2 relative">
                  <button type="button" onClick={() => setShowGameSearch(!showGameSearch)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-medium text-white flex items-center justify-between text-left">
                    <span>{selectedGame || gameTitle || 'Select a game...'}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {showGameSearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#07111d] shadow-2xl z-50 max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-white/10">
                        <input type="text" value={gameSearchQuery} onChange={(e) => setGameSearchQuery(e.target.value)} placeholder="Search games..." className="w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none" />
                      </div>
                      <div className="p-2">
                        {filteredGames.map((game) => (
                          <button key={game} type="button" onClick={() => { setSelectedGame(game); onGameChange?.(game); setShowGameSearch(false) }} className="w-full rounded-lg px-3 py-2 text-sm text-left text-white hover:bg-white/10 transition-colors">{game}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <SettingRow label="Engine" value="Agora RTC (Browser)" />
              <SettingRow label="Latency" value="Ultra Low (< 1s)" />
            </div>
          </Panel>

          {/* Scenes Panel */}
          {scenes && scenes.length > 0 && onSwitchScene && (
            <Panel>
              <PanelHeader icon={<Layout className="h-4 w-4" />} title="Scenes" right={<button type="button" onClick={() => setShowScenePanel(!showScenePanel)} className="text-xs text-slate-400 hover:text-white">{showScenePanel ? 'Hide' : 'Edit'}</button>} />
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {scenes.map((scene) => (
                    <button key={scene.id} type="button" onClick={() => onSwitchScene(scene.id)} disabled={!isPreviewing && !isLive} className={cn('rounded-lg px-3 py-1.5 text-[11px] font-bold transition', scene.id === activeSceneId ? 'border border-cyan-300/40 bg-cyan-400/20 text-cyan-100' : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white disabled:opacity-40')}>
                      {scene.name}
                    </button>
                  ))}
                </div>
                {showScenePanel && activeSceneId && onUpdateScene && (
                  <div className="mt-3 space-y-2">
                    {scenes.find(s => s.id === activeSceneId)?.textOverlays.map((overlay) => (
                      <div key={overlay.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={overlay.text} onChange={(e) => onUpdateTextOverlay?.(activeSceneId, overlay.id, { text: e.target.value })} className="flex-1 rounded bg-transparent px-2 py-1 text-xs text-white outline-none" />
                          <input type="color" value={overlay.color} onChange={(e) => onUpdateTextOverlay?.(activeSceneId, overlay.id, { color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => onAddTextOverlay?.(activeSceneId)} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-white/[0.08]">
                      + Add Text Overlay
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </section>

        {/* ── Center Column: Preview + Status ── */}
        <section className="space-y-4">
          {/* Screen Share Preview */}
          <Panel className="overflow-hidden">
            <PanelHeader icon={<MonitorPlay className="h-4 w-4" />} title={isLive ? 'Live Preview' : 'Preview'} right={<div className="flex items-center gap-3 text-xs font-black"><span className="rounded-lg bg-cyan-400/10 px-2 py-1 text-cyan-200">Agora RTC</span><span className="flex items-center gap-1 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />{isLive ? 'LIVE' : isPreviewing ? 'PREVIEW' : 'READY'}</span></div>} />
            <div className="relative aspect-video overflow-hidden bg-black">
              {/* Screen share preview — shows during both preview and live phases */}
              {(isPreviewing || isLive) && screenStream ? (
                <div className="h-full w-full bg-black">
                  <LocalVideoPreview stream={screenStream} />
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.12),transparent_30%),#02040a] px-6 text-center">
                  <MonitorPlay className="h-16 w-16 text-cyan-300/40" />
                  <p className="mt-4 text-lg font-black text-white/70">Ready to Share</p>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">Click "Start Preview" to capture your screen and see it locally before going live.</p>
                  <p className="mt-3 text-xs text-slate-600">Browser → Agora RTC → HytroGaming Viewers</p>
                </div>
              )}

              {/* Scene overlay preview */}
              {activeSceneId && scenes && (() => {
                const activeScene = scenes.find(s => s.id === activeSceneId)
                if (!activeScene) return null
                return (
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: activeScene.backgroundImage ? 'transparent' : activeScene.backgroundColor + '20' }}>
                    {activeScene.backgroundImage && <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${activeScene.backgroundImage})` }} />}
                    {activeScene.textOverlays.map((overlay) => (
                      <div key={overlay.id} className="absolute" style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, fontSize: `${overlay.fontSize}px`, color: overlay.color, fontWeight: overlay.bold ? 'bold' : 'normal', transform: 'translate(-50%, -50%)' }}>
                        {overlay.text}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* Draggable camera overlay (like OBS) — shows during both preview and live */}
              {(isPreviewing || isLive) && isCameraEnabled && cameraStream && (
                <DraggableCameraOverlay stream={cameraStream} />
              )}

              {/* Stream info overlay */}
              <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl">
                {userAvatar ? <div style={{ overflow: 'visible' }}><ProfileFrame frame={useUserFrame(userId)} avatarUrl={userAvatar} username={username} size="sm" /></div> : <div className="grid h-11 w-11 place-items-center rounded-xl border border-purple-300/30 bg-purple-500/20 text-xs font-black">{username.slice(0, 2).toUpperCase()}</div>}
                <div>
                  <p className="text-xs font-black uppercase">{username}</p>
                  <div className="mt-1 h-2 w-40 rounded-full bg-white/15"><div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" /></div>
                </div>
                <span className="text-xs font-black">100 / 100</span>
              </div>

              {/* Viewer count */}
              <div className="absolute bottom-5 right-5 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xl font-black backdrop-blur-xl flex items-center gap-2">
                <Eye className="h-5 w-5 text-cyan-300" />
                {viewerCount}
              </div>
            </div>
          </Panel>

          {/* Stream Metrics */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader icon={<Radio className="h-4 w-4" />} title="Agora Connection" />
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn('relative grid h-16 w-16 place-items-center rounded-full border bg-black', isLive ? 'border-emerald-400/40 shadow-[0_0_30px_rgba(74,222,128,0.20)]' : isPreviewing ? 'border-cyan-400/40' : 'border-slate-600')}>
                    <MonitorPlay className={cn('h-7 w-7', isLive ? 'text-emerald-300' : isPreviewing ? 'text-cyan-300' : 'text-slate-500')} />
                    {isLive && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white"><ShieldCheck className="h-3 w-3" /></span>}
                  </div>
                  <div>
                    <p className={cn('text-sm font-black uppercase', isLive ? 'text-red-300' : isPreviewing ? 'text-cyan-300' : 'text-slate-400')}>
                      {isLive ? 'Live' : isPreviewing ? 'Preview' : 'Not Connected'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Hytrogaming Engine</p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader icon={<BarChart3 className="h-4 w-4" />} title="Stream Metrics" />
              <div className="grid grid-cols-2 gap-3 p-4">
                <StatusMetric label="Viewers" value={viewerCount.toLocaleString()} icon={<Users className="h-3 w-3" />} />
                <StatusMetric label="Duration" value={streamDuration} icon={<Activity className="h-3 w-3" />} />
                <StatusMetric label="Engine" value="Agora" icon={<Radio className="h-3 w-3" />} />
                <StatusMetric label="Status" value={isLive ? 'LIVE' : isPreviewing ? 'Preview' : 'Ready'} good={isLive || isPreviewing} icon={<Eye className="h-3 w-3" />} />
              </div>
            </Panel>
          </div>
        </section>

        {/* ── Right Column: Chat ── */}
        <section className="flex flex-col space-y-4">
          <Panel className="flex flex-1 flex-col" style={{ minHeight: 480 }}>
            <PanelHeader icon={<Mail className="h-4 w-4" />} title="Chat" right={<CounterBadge value={isLive ? 'Live' : 'Offline'} />} />
            <div className="min-h-0 flex-1 overflow-hidden p-2">{chatPanel || <p className="py-4 text-center text-xs text-slate-500">Start streaming to enable chat</p>}</div>
          </Panel>

          {/* Quick Info */}
          <Panel>
            <PanelHeader icon={<ShieldCheck className="h-4 w-4" />} title="HytroGaming" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MonitorPlay className="h-3.5 w-3.5 text-cyan-300" />
                <span>Browser-native screen sharing</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Radio className="h-3.5 w-3.5 text-emerald-300" />
                <span>Agora RTC — Ultra low latency</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Pause className="h-3.5 w-3.5 text-amber-300" />
                <span>Pause to save Agora minutes</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Activity className="h-3.5 w-3.5 text-purple-300" />
                <span>Auto-disconnect on idle</span>
              </div>
            </div>
          </Panel>
        </section>
      </main>
    </div>
  )
}

// ─── UI Components ────────────────────────────────────────────────────────────

function Panel({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div style={style} className={cn('rounded-2xl border border-cyan-400/20 bg-[#07111d]/82 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-xl', className)}>{children}</div>
}

function PanelHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-cyan-400/15 px-4 py-3"><div className="flex items-center gap-2 text-cyan-300">{icon}<h3 className="text-sm font-black uppercase tracking-wide">{title}</h3></div>{right}</div>
}

function SettingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-slate-300">{label}</span><div className="max-w-[65%] truncate text-right font-semibold text-slate-200">{value}</div></div>
}

function CounterBadge({ value }: { value: string }) { return <span className={cn('rounded-lg px-2 py-1 text-[10px] font-black text-white', value === 'Live' ? 'bg-red-600' : 'bg-purple-600')}>{value}</span> }

function StatusMetric({ label, value, good, icon }: { label: string; value: string; good?: boolean; icon?: React.ReactNode }) {
  return <div><div className="flex items-center gap-1">{icon}<p className={cn('text-xs font-black', good ? 'text-emerald-300' : 'text-white')}>{value}</p></div><p className="mt-1 text-[10px] font-semibold text-slate-500">{label}</p></div>
}

/** Shows when screen is actively being shared */
function ScreenShareActiveIndicator({ isLive }: { isLive: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center">
      <div className="relative">
        <div className="grid h-24 w-24 place-items-center rounded-[2rem] border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.16)]">
          <MonitorPlay className="h-12 w-12 text-cyan-200" />
        </div>
        {isLive && (
          <span className="absolute -right-1 -top-1 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white shadow-lg shadow-red-600/30">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <div>
        <p className="text-xl font-black text-white">{isLive ? 'Broadcasting Live' : 'Preview Mode'}</p>
        <p className="mt-2 text-sm text-slate-400">
          {isLive
            ? 'Your screen is being broadcast to viewers via Agora RTC.'
            : 'Preview your screen locally. Toggle camera/mic, then click Go Live.'}
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Local Preview</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" />No OBS Required</span>
      </div>
    </div>
  )
}

/** Renders a local MediaStream into a video element (for preview) */
function LocalVideoPreview({ stream, muted = true }: { stream: MediaStream | null; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    return () => { el.srcObject = null; };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="h-full w-full object-contain"
    />
  );
}

/** Draggable camera overlay — like OBS webcam overlay */
function DraggableCameraOverlay({ stream }: { stream: MediaStream | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Attach camera stream to video element
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    return () => { el.srcObject = null; };
  }, [stream]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="absolute z-30 cursor-move"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className={cn(
        'relative overflow-hidden rounded-xl border-2 shadow-2xl transition',
        isDragging ? 'border-cyan-300 shadow-cyan-500/30' : 'border-white/20'
      )} style={{ width: 200, height: 150 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover bg-black"
        />
        {/* Camera label */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white/70 flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
          CAM
        </div>
      </div>
    </div>
  );
}

export default GamingSetup
