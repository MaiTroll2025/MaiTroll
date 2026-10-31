/**
 * HytroGaming broadcaster studio — screen-first, persistent-chat redesign.
 * Preserves the original GamingSetup props and all streaming callbacks.
 * Chat is supplied by parent via chatPanel (no mock chat or altered backend).
 * Optional gameCatalogSearch enables a full remote catalog without exposing keys.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Gamepad2, Loader2, Mail, Maximize2, Mic, MicOff, MonitorPlay, Power, Radio, Search, Settings, Users, Video, VideoOff, X, MessageCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SceneConfig } from '@/components/broadcast/GamingSceneManager'
import TipBanner from '@/components/broadcast/TipBanner'
import ProfileFrame from '@/components/profile/ProfileFrame'
import { useUserFrame } from '@/hooks/useUserFrame'

const GAME_CATALOG = [
  'Fortnite',
  'Minecraft',
  'Roblox',
  'Grand Theft Auto V',
  'Grand Theft Auto Online',
  'Grand Theft Auto VI',
  'Red Dead Redemption 2',
  'Call of Duty: Warzone',
  'Call of Duty: Black Ops 6',
  'Call of Duty: Modern Warfare III',
  'Call of Duty: Modern Warfare II',
  'Valorant',
  'Counter-Strike 2',
  'Apex Legends',
  'Overwatch 2',
  'Rainbow Six Siege',
  'Rainbow Six Extraction',
  'PUBG: Battlegrounds',
  'Escape from Tarkov',
  'The Finals',
  'Delta Force',
  'Battlefield 2042',
  'Battlefield V',
  'Battlefield 1',
  'Halo Infinite',
  'Halo: The Master Chief Collection',
  'Destiny 2',
  'Warframe',
  'Splitgate 2',
  'Helldivers 2',
  'Deep Rock Galactic',
  'Palworld',
  'ARK: Survival Ascended',
  'ARK: Survival Evolved',
  'Rust',
  'DayZ',
  '7 Days to Die',
  'Project Zomboid',
  'Sons of the Forest',
  'The Forest',
  'Subnautica',
  "No Man's Sky",
  'Sea of Thieves',
  'Among Us',
  'Fall Guys',
  'Lethal Company',
  'Phasmophobia',
  'Content Warning',
  'Dead by Daylight',
  'Resident Evil 4',
  'Resident Evil Village',
  'Resident Evil 7',
  'Silent Hill 2',
  'The Outlast Trials',
  'Little Nightmares',
  "Five Nights at Freddy's",
  'Dying Light 2',
  'The Last of Us Part I',
  'The Last of Us Part II',
  'Elden Ring',
  'Elden Ring Nightreign',
  'Dark Souls III',
  'Sekiro: Shadows Die Twice',
  'Bloodborne',
  'Lies of P',
  'Black Myth: Wukong',
  'Monster Hunter Wilds',
  'Monster Hunter World',
  'Monster Hunter Rise',
  "Dragon's Dogma 2",
  "Baldur's Gate 3",
  'Diablo IV',
  'Path of Exile 2',
  'Path of Exile',
  'World of Warcraft',
  'Final Fantasy XIV',
  'Final Fantasy VII Rebirth',
  'Final Fantasy XVI',
  'Genshin Impact',
  'Honkai: Star Rail',
  'Zenless Zone Zero',
  'Wuthering Waves',
  'Lost Ark',
  'New World',
  'Guild Wars 2',
  'The Elder Scrolls Online',
  'The Elder Scrolls V: Skyrim',
  'Fallout 4',
  'Fallout 76',
  'Starfield',
  'Cyberpunk 2077',
  'The Witcher 3: Wild Hunt',
  'Hogwarts Legacy',
  "Assassin's Creed Shadows",
  "Assassin's Creed Mirage",
  "Assassin's Creed Valhalla",
  'Ghost of Tsushima',
  'God of War Ragnarök',
  'God of War',
  'Horizon Forbidden West',
  'Horizon Zero Dawn',
  'Spider-Man 2',
  "Marvel's Spider-Man",
  "Marvel's Spider-Man: Miles Morales",
  'Marvel Rivals',
  'League of Legends',
  'Dota 2',
  'Teamfight Tactics',
  'Smite 2',
  'Heroes of the Storm',
  'Rocket League',
  'EA Sports FC 25',
  'EA Sports FC 24',
  'eFootball',
  'NBA 2K25',
  'NBA 2K24',
  'Madden NFL 25',
  'Madden NFL 24',
  'MLB The Show 25',
  'NHL 25',
  'WWE 2K25',
  'UFC 5',
  'F1 25',
  'F1 24',
  'Forza Horizon 5',
  'Forza Motorsport',
  'Gran Turismo 7',
  'Assetto Corsa Competizione',
  'iRacing',
  'Need for Speed Unbound',
  'The Crew Motorfest',
  'Mario Kart 8 Deluxe',
  'Super Smash Bros. Ultimate',
  'Super Mario Bros. Wonder',
  'Super Mario Odyssey',
  'Mario Party Superstars',
  'Super Mario Party Jamboree',
  'The Legend of Zelda: Tears of the Kingdom',
  'The Legend of Zelda: Breath of the Wild',
  'Pokémon Scarlet',
  'Pokémon Violet',
  'Pokémon Legends: Arceus',
  'Animal Crossing: New Horizons',
  'Splatoon 3',
  'Pikmin 4',
  'Metroid Dread',
  'Kirby and the Forgotten Land',
  'Street Fighter 6',
  'Tekken 8',
  'Mortal Kombat 1',
  'Guilty Gear Strive',
  'Dragon Ball: Sparking! ZERO',
  'Dragon Ball FighterZ',
  'Brawlhalla',
  'MultiVersus',
  'Super Auto Pets',
  'Hearthstone',
  'Magic: The Gathering Arena',
  'Yu-Gi-Oh! Master Duel',
  'Clash Royale',
  'Clash of Clans',
  'Brawl Stars',
  'Mobile Legends: Bang Bang',
  'Honor of Kings',
  'League of Legends: Wild Rift',
  'PUBG Mobile',
  'Call of Duty: Mobile',
  'Free Fire',
  'Pokémon GO',
  'Stumble Guys',
  'Geometry Dash',
  'OSU!',
  'Beat Saber',
  'VRChat',
  'Rec Room',
  'Microsoft Flight Simulator',
  'Euro Truck Simulator 2',
  'American Truck Simulator',
  'Farming Simulator 25',
  'The Sims 4',
  'Stardew Valley',
  'Terraria',
  'Core Keeper',
  "Don't Starve Together",
  'RimWorld',
  'Factorio',
  'Satisfactory',
  'Oxygen Not Included',
  'Cities: Skylines II',
  'Civilization VI',
  'Civilization VII',
  'Age of Empires IV',
  'Age of Empires II',
  'StarCraft II',
  'Total War: Warhammer III',
  'Crusader Kings III',
  'Europa Universalis IV',
  'Football Manager 2024',
  'Football Manager 2025',
  'Chess',
  'Just Chatting',
  'Retro Gaming',
  'Other Game'
] as const

interface GamingSetupProps {
  streamTitle?: string
  onStreamTitleChange?: (title: string) => void
  /** Optional remote game-catalog search: inject from a server-backed IGDB/RAWG/etc integration. */
  gameCatalogSearch?: (query: string) => Promise<string[]>
  gameTitle?: string
  onGameChange?: (game: string) => void
  isMicEnabled?: boolean
  hasMicTrack?: boolean
  onToggleMic?: () => void
  onStartPreview?: () => void | Promise<void>
  onStopPreview?: () => void | Promise<void>
  onGoLive?: () => void | Promise<void>
  onEndStream?: () => void | Promise<void>
  isPreviewing?: boolean
  isLive?: boolean
  isConnecting?: boolean
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
  screenStream?: MediaStream | null
  cameraStream?: MediaStream | null
  micStream?: MediaStream | null
  screenAudioTrack?: unknown | null
  hasScreenAudioTrack?: boolean
  hasCameraTrack?: boolean
  isCameraEnabled?: boolean
  onToggleCamera?: () => void
  inlineAgreementChecked?: boolean
  onInlineAgreementChange?: (checked: boolean) => void
  streamId?: string
  userId?: string
  rtmpUrl?: string
  streamKey?: string
  agoraChannel?: string
  cameraPreview?: React.ReactNode
  obsStatus?: string
  isGeneratingCredentials?: boolean
  isObsConnected?: boolean
  bitrate?: string | number
  streamHealth?: string
  onGenerateCredentials?: () => void | Promise<void>
  onRegenerateCredentials?: () => void | Promise<void>
  onTestStream?: () => void | Promise<void>
  // Camera overlay layout (percent-based, synced to viewers)
  cameraLayout?: {
    xPercent: number
    yPercent: number
    widthPercent: number
    radius: number
  }
  onUpdateCameraLayout?: (updates: Partial<{
    xPercent: number
    yPercent: number
    widthPercent: number
    radius: number
  }>) => void
  // On-screen overlay text
  overlayText?: string
  overlayTextVisible?: boolean
  onSetOverlayText?: (text: string) => void
  onToggleOverlayText?: () => void
  onClearOverlayText?: () => void
}


const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-xl border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const cardBase = 'rounded-2xl border border-white/10 bg-[#0c1424]/95 shadow-lg shadow-black/20'

type StudioTab = 'stream' | 'scenes' | 'overlays' | 'settings'

export function GamingSetup(props: GamingSetupProps) {
  const {
    className, streamTitle = 'Ranked Grind to Top 1 | Mai Troll', onStreamTitleChange,
    gameTitle = '', onGameChange, gameCatalogSearch, isMicEnabled = true, onToggleMic,
    onStartPreview, onStopPreview, onGoLive, onEndStream, isPreviewing = false,
    isLive = false, isConnecting = false, errorMessage, viewerCount = 0,
    streamDuration = '00:00:00', username = 'Gamer', userLevel = 1,
    userAvatar = null, userId, chatPanel, heartbeatStatus, scenes = [], activeSceneId,
    onSwitchScene, onUpdateScene, onAddTextOverlay, onUpdateTextOverlay,
    screenStream, cameraStream, hasScreenAudioTrack = false, isCameraEnabled = false,
    onToggleCamera, inlineAgreementChecked = false, onInlineAgreementChange, streamId,
    cameraLayout = { xPercent: 3, yPercent: 3, widthPercent: 32, radius: 12 },
    onUpdateCameraLayout, overlayText = '', overlayTextVisible = true,
    onSetOverlayText, onToggleOverlayText, onClearOverlayText,
  } = props
  const userFrame = useUserFrame(userId)
  const [tab, setTab] = useState<StudioTab>('stream')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [gamePickerOpen, setGamePickerOpen] = useState(false)
  const [gameSearch, setGameSearch] = useState('')
  const [remoteGames, setRemoteGames] = useState<string[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [studioChatWide, setStudioChatWide] = useState(false)
  const [expandedPreview, setExpandedPreview] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gameCatalogSearch || !gamePickerOpen || !gameSearch.trim()) {
      setRemoteGames([])
      return
    }
    let cancelled = false
    const id = window.setTimeout(() => {
      setRemoteLoading(true)
      gameCatalogSearch(gameSearch.trim()).then((games) => {
        if (!cancelled) setRemoteGames(Array.isArray(games) ? games.filter((x): x is string => typeof x === 'string') : [])
      }).catch(() => { if (!cancelled) setRemoteGames([]) })
        .finally(() => { if (!cancelled) setRemoteLoading(false) })
    }, 280)
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [gameCatalogSearch, gameSearch, gamePickerOpen])

  const games = useMemo(() => {
    const q = gameSearch.trim().toLowerCase()
    const all = Array.from(new Set([...remoteGames, ...GAME_CATALOG]))
    return all.filter(g => !q || g.toLowerCase().includes(q)).slice(0, 75)
  }, [remoteGames, gameSearch])

  const chooseGame = (game: string) => {
    const selected = game.trim().slice(0, 120)
    if (!selected) return
    onGameChange?.(selected)
    setGamePickerOpen(false)
    setGameSearch('')
  }

  const status = isConnecting ? 'Connecting' : isLive ? 'LIVE' : isPreviewing ? 'PREVIEW' : 'OFFLINE'
  const action = isConnecting ? null : isLive ? 'end' : isPreviewing ? 'live' : 'preview'
  const screenReady = Boolean((isPreviewing || isLive) && screenStream)
  const previewNode = (
    <div ref={previewRef} className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
      {/* Preserve the source aspect ratio; ultrawide and portrait shares remain visible. */}
      <div className="relative h-full w-full overflow-hidden bg-black">
        {screenReady ? <LocalVideoPreview stream={screenStream!} /> : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_center,#11304a_0%,#030611_62%)] p-5 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-3xl border border-cyan-400/25 bg-cyan-500/10"><MonitorPlay className="h-10 w-10 text-cyan-300" /></div>
            <p className="text-lg font-extrabold">Your game will appear here</p>
            <p className="max-w-md text-xs text-slate-400">Capture a game window, browser tab, or entire display. The preview scales without cropping.</p>
            {!isPreviewing && !isLive && <button type="button" onClick={onStartPreview} disabled={!onStartPreview || isConnecting} className={cn(buttonBase,'border-cyan-400/30 bg-cyan-500 px-4 py-2.5 text-white')}>Start Screen Preview</button>}
          </div>
        )}
        {activeSceneId && (() => {
          const scene = scenes.find(s => s.id === activeSceneId)
          if (!scene) return null
          return <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: scene.backgroundImage ? 'transparent' : `${scene.backgroundColor}20` }}>
            {scene.backgroundImage && <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${scene.backgroundImage})` }} />}
            {scene.textOverlays.map(overlay => <div key={overlay.id} className="absolute" style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, color: overlay.color, fontSize: `${overlay.fontSize}px`, fontWeight: overlay.bold ? 'bold' : 'normal', transform: 'translate(-50%,-50%)' }}>{overlay.text}</div>)}
          </div>
        })()}
        {/* Broadcast overlay text — wired to the overlay controls */}
        {overlayText && overlayTextVisible && (
          <div className="pointer-events-none absolute left-0 right-0 top-4 flex justify-center">
            <div className="rounded-lg bg-black/60 px-4 py-1.5 text-sm font-extrabold text-white shadow-lg ring-1 ring-white/10">
              {overlayText}
            </div>
          </div>
        )}
        {(isPreviewing || isLive) && isCameraEnabled && cameraStream && <DraggableCameraOverlay stream={cameraStream} layout={cameraLayout} onUpdate={onUpdateCameraLayout} />}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/75 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
        <span className={cn('h-2 w-2 rounded-full',isLive?'bg-red-500 animate-pulse':isPreviewing?'bg-cyan-400':'bg-slate-500')} />{status}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/75 px-2.5 py-1.5 text-xs font-bold"><Eye className="mr-1 inline h-3.5 w-3.5" />{viewerCount.toLocaleString()}</div>
    </div>
  )

  return (
    <div className={cn('flex h-[100dvh] min-h-[560px] w-full min-w-0 flex-col overflow-hidden bg-[#050812] text-white',className)}>
      {streamId && <TipBanner streamId={streamId} />}
      <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0a1020] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setSidebarOpen(v=>!v)} className="hidden rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10 lg:block" aria-label={sidebarOpen?'Collapse controls':'Expand controls'}>{sidebarOpen?<PanelLeftClose className="h-4 w-4"/>:<PanelLeftOpen className="h-4 w-4"/>}</button>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600"><Gamepad2 className="h-6 w-6" /></div>
          <div className="min-w-0 leading-tight"><h1 className="truncate text-base font-black tracking-tight sm:text-xl">HYTRO<span className="text-cyan-300">GAMING</span></h1><p className="hidden text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:block">Creator Studio</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black', isLive?'border-red-500/40 bg-red-500/15 text-red-300':isPreviewing?'border-cyan-400/30 bg-cyan-400/10 text-cyan-200':'border-white/10 text-slate-400')}><span className={cn('h-2 w-2 rounded-full',isLive?'bg-red-400 animate-pulse':isPreviewing?'bg-cyan-400':'bg-slate-500')} />{status}</span>
          <span className="hidden text-xs font-semibold text-slate-300 md:inline"><Users className="mr-1 inline h-3.5 w-3.5" />{viewerCount.toLocaleString()}</span>
          <span className="hidden text-xs font-mono text-slate-400 sm:inline">{streamDuration}</span>
          {userAvatar ? <div className="hidden sm:block"><ProfileFrame frame={userFrame} avatarUrl={userAvatar} username={username} size="sm" /></div>:<div className="hidden h-9 w-9 place-items-center rounded-full bg-violet-500/30 text-xs font-bold sm:grid">{username.slice(0,2).toUpperCase()}</div>}
        </div>
      </header>

      <div className={cn('grid min-h-0 min-w-0 flex-1 gap-2 overflow-y-auto p-2 sm:gap-3 sm:p-3 lg:overflow-hidden', sidebarOpen ? 'lg:grid-cols-[260px_minmax(0,1fr)_310px] 2xl:grid-cols-[285px_minmax(0,1fr)_350px]' : 'lg:grid-cols-[minmax(0,1fr)_310px] 2xl:grid-cols-[minmax(0,1fr)_350px]', studioChatWide && 'lg:!grid-cols-[minmax(0,1fr)_400px]')}>
        {/* Control column: independently scrollable without moving the game or chat. */}
        {sidebarOpen && <aside className={cn('min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b1221] p-3 [scrollbar-width:thin]','block lg:block',studioChatWide && 'lg:hidden')}>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Studio controls</h2><Settings className="h-4 w-4 text-slate-500"/></div>
          <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1">
            {(['stream','scenes','overlays','settings'] as StudioTab[]).map(t=><button key={t} type="button" onClick={()=>setTab(t)} className={cn('rounded-lg px-1 py-2 text-[10px] font-extrabold capitalize',tab===t?'bg-cyan-500/20 text-cyan-200':'text-slate-400 hover:text-white')}>{t}</button>)}
          </div>
          {tab==='stream' && <div className="space-y-4">
            <div><label className="mb-1 block text-[11px] font-semibold text-slate-400">STREAM TITLE</label><input value={streamTitle} onChange={e=>onStreamTitleChange?.(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-cyan-400" placeholder="Name your stream" /></div>
            <GamePicker open={gamePickerOpen} onOpen={setGamePickerOpen} value={gameTitle} search={gameSearch} onSearch={setGameSearch} games={games} isLoading={remoteLoading} onChoose={chooseGame}/>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onToggleMic} disabled={!onToggleMic} className={cn(buttonBase,'min-h-12 px-2',isMicEnabled?'border-emerald-400/25 bg-emerald-500/10 text-emerald-300':'border-red-400/25 bg-red-500/10 text-red-300')}>{isMicEnabled?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}{isMicEnabled?'Mic On':'Mic Off'}</button>
              <button type="button" onClick={onToggleCamera} disabled={!onToggleCamera} className={cn(buttonBase,'min-h-12 px-2',isCameraEnabled?'border-emerald-400/25 bg-emerald-500/10 text-emerald-300':'border-red-400/25 bg-red-500/10 text-red-300')}>{isCameraEnabled?<Video className="h-4 w-4"/>:<VideoOff className="h-4 w-4"/>}{isCameraEnabled?'Cam On':'Cam Off'}</button>
            </div>
            <div className={cn(cardBase,'space-y-2 p-3 text-xs')}><h3 className="font-extrabold text-slate-200">Capture status</h3><Indicator good={Boolean(isPreviewing||isLive)} label="Screen capture"/><Indicator good={isMicEnabled} label="Microphone"/><Indicator good={isCameraEnabled} label="Camera"/><Indicator good={hasScreenAudioTrack} label="Game sound"/></div>
            {heartbeatStatus && isLive && <div className={cn(cardBase,'p-3 text-xs')}><p className="mb-2 font-bold">Activity monitor</p><Indicator good={heartbeatStatus.isChatActive} label="Chat activity"/><Indicator good={heartbeatStatus.isAudioActive} label="Audio activity"/>{heartbeatStatus.isIdle && <p className="mt-2 text-amber-300">{heartbeatStatus.idleReason || 'Idle'}</p>}</div>}
          </div>}
          {tab==='scenes' && <div className="space-y-2">{scenes.length===0?<p className="text-xs text-slate-400">No scenes configured.</p>:scenes.map(scene=><button key={scene.id} type="button" onClick={()=>onSwitchScene?.(scene.id)} disabled={!onSwitchScene || (!isPreviewing&&!isLive)} className={cn(buttonBase,'w-full justify-start px-3 py-3 text-left',activeSceneId===scene.id?'border-cyan-400/30 bg-cyan-500/20 text-cyan-200':'border-white/10 bg-white/5 text-slate-300')}>{scene.name}</button>)}<p className="text-[11px] text-slate-500">Scene switching retains the existing scene manager.</p></div>}
          {tab==='overlays' && <div className="space-y-3"><OverlayTextControls text={overlayText} visible={overlayTextVisible} onSetText={onSetOverlayText} onToggle={onToggleOverlayText} onClear={onClearOverlayText}/><div className={cn(cardBase,'space-y-2 p-3 text-xs')}><p className="font-bold">Camera placement</p><p>X: {Math.round(cameraLayout.xPercent)}% · Y: {Math.round(cameraLayout.yPercent)}%</p><p>Width: {Math.round(cameraLayout.widthPercent)}% · Radius: {cameraLayout.radius}px</p><p className="text-slate-400">Drag the webcam overlay on the preview to reposition or resize it.</p></div>{activeSceneId && onUpdateScene && scenes.find(s=>s.id===activeSceneId)?.textOverlays.map(item=><div key={item.id} className="flex items-center gap-2"><input aria-label="Scene text" value={item.text} onChange={e=>onUpdateTextOverlay?.(activeSceneId,item.id,{text:e.target.value})} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 p-2 text-xs"/><input aria-label="Scene text color" type="color" value={item.color} onChange={e=>onUpdateTextOverlay?.(activeSceneId,item.id,{color:e.target.value})}/></div>)}{activeSceneId&&onAddTextOverlay&&<button type="button" className={cn(buttonBase,'border-white/10 p-2')} onClick={()=>onAddTextOverlay(activeSceneId)}>+ Add scene text</button>}</div>}
          {tab==='settings' && <div className="space-y-3 text-xs"><div className={cn(cardBase,'space-y-2 p-3')}><p>Engine: Agora RTC</p><p>Preview: Browser screen capture</p><p className="text-slate-400">Bitrate, connection, and publishing are controlled by the parent broadcaster page.</p></div><Agreement checked={inlineAgreementChecked} onChange={onInlineAgreementChange}/></div>}
        </aside>}

        {/* Main live canvas: use all remaining width, not a fixed-size fake screen. */}
        <main className="flex min-h-[480px] min-w-0 flex-col gap-2 overflow-y-auto overscroll-contain lg:min-h-0 lg:overflow-hidden">
          <section className="flex min-h-[260px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#080d17] lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4"><div className="flex min-w-0 items-center gap-2"><MonitorPlay className="h-4 w-4 shrink-0 text-cyan-300"/><h2 className="truncate text-sm font-extrabold">Game screen</h2><span className="hidden rounded bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-200 sm:inline">Source ratio preserved</span></div><button type="button" onClick={()=>setExpandedPreview(true)} aria-label="Expand game preview" className="rounded-lg p-2 hover:bg-white/10"><Maximize2 className="h-4 w-4"/></button></div>
            {previewNode}
          </section>
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-4">
            <Metric label="Viewers" value={viewerCount.toLocaleString()} icon={<Users className="h-4 w-4"/>}/>
            <Metric label="Duration" value={streamDuration} icon={<Activity className="h-4 w-4"/>}/>
            <Metric label="Capture" value={screenReady?'Active':'Off'} icon={<MonitorPlay className="h-4 w-4"/>}/>
            <div className="hidden sm:block"><Metric label="Connection" value={isLive?'LIVE':isPreviewing?'Preview':'Ready'} icon={<Radio className="h-4 w-4"/>}/></div>
          </div>
          {errorMessage && <div role="alert" className="flex shrink-0 items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2.5 text-xs text-red-200"><AlertTriangle className="h-4 w-4 shrink-0"/>{errorMessage}</div>}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0c1424] p-2.5">
            <div className="flex items-center gap-2"><button type="button" onClick={onToggleMic} disabled={!onToggleMic} title={isMicEnabled?'Mute microphone':'Unmute microphone'} className={cn(buttonBase,'h-10 w-10',isMicEnabled?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-red-500/30 bg-red-500/10 text-red-300')}>{isMicEnabled?<Mic className="h-4 w-4"/>:<MicOff className="h-4 w-4"/>}</button><button type="button" onClick={onToggleCamera} disabled={!onToggleCamera} title={isCameraEnabled?'Disable camera':'Enable camera'} className={cn(buttonBase,'h-10 w-10',isCameraEnabled?'border-emerald-500/20 bg-emerald-500/10 text-emerald-300':'border-red-500/30 bg-red-500/10 text-red-300')}>{isCameraEnabled?<Video className="h-4 w-4"/>:<VideoOff className="h-4 w-4"/>}</button></div>
            <div className="flex flex-wrap gap-2">{action==='preview'&&<button type="button" onClick={onStartPreview} disabled={!onStartPreview} className={cn(buttonBase,'border-cyan-400/25 bg-cyan-500 px-4 py-3 text-white')}><MonitorPlay className="h-4 w-4"/>Start Preview</button>}{isConnecting&&<span className="flex items-center gap-2 px-3 text-xs text-cyan-300"><Loader2 className="h-4 w-4 animate-spin"/>Connecting...</span>}{action==='live'&&<><button type="button" onClick={onStopPreview} disabled={!onStopPreview} className={cn(buttonBase,'border-white/10 bg-white/5 px-3 py-3')}>Stop Preview</button><button type="button" onClick={onGoLive} disabled={!inlineAgreementChecked||!onGoLive} title={!inlineAgreementChecked?'Accept the broadcast agreement to go live':undefined} className={cn(buttonBase,'border-emerald-400/30 bg-emerald-600 px-4 py-3 text-white')}><Radio className="h-4 w-4"/>Go Live</button></>}{action==='end'&&<button type="button" onClick={onEndStream} disabled={!onEndStream} className={cn(buttonBase,'border-red-400/30 bg-red-600 px-4 py-3 text-white')}><Power className="h-4 w-4"/>End Stream</button>}</div>
          </div>
          {!inlineAgreementChecked&&!isLive && <div className="shrink-0 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2"><Agreement checked={inlineAgreementChecked} onChange={onInlineAgreementChange} compact/></div>}
        </main>

        {/* Chat stays visible at desktop widths. The injected chat component owns its own message scrolling/input. */}
        <aside className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1221] lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-3"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-cyan-300"/><h2 className="text-sm font-black">Live Chat</h2><span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-black',isLive?'bg-red-500/20 text-red-300':'bg-white/10 text-slate-400')}>{isLive?'LIVE':'STANDBY'}</span></div><button type="button" onClick={()=>setStudioChatWide(v=>!v)} aria-label={studioChatWide?'Normal chat width':'Widen chat'} className="hidden rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10 lg:inline-flex">{studioChatWide?<ChevronRight className="h-4 w-4"/>:<ChevronLeft className="h-4 w-4"/>}</button></div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 [overflow-wrap:anywhere]">{chatPanel ?? <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-400"><Mail className="h-7 w-7 text-slate-500"/><p className="text-xs">Your existing live chat appears here when connected.</p></div>}</div>
          <div className="shrink-0 border-t border-white/10 px-3 py-2 text-center text-[10px] text-slate-500">Chat stays docked beside the game on desktop</div>
        </aside>
      </div>
      {expandedPreview && <div role="dialog" aria-modal="true" aria-label="Expanded game preview" className="fixed inset-0 z-[100] flex flex-col bg-black p-3"><div className="mb-2 flex shrink-0 justify-between text-sm font-bold"><span>Game Preview</span><button type="button" onClick={()=>setExpandedPreview(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close expanded preview"><X className="h-5 w-5"/></button></div><div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">{screenReady?<LocalVideoPreview stream={screenStream!}/>:<p className="text-slate-400">Start preview to see your game</p>}</div></div>}
    </div>
  )
}

function Indicator({good,label}:{good:boolean;label:string}){return <div className="flex items-center gap-2 py-1 text-slate-300"><span className={cn('h-2 w-2 rounded-full',good?'bg-emerald-400':'bg-slate-500')}/>{label}</div>}
function Metric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="min-w-0 rounded-xl border border-white/10 bg-[#0c1424] px-3 py-2"><p className="flex items-center gap-1.5 truncate text-xs font-bold text-white">{icon}{value}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</p></div>}
function GamePicker({open,onOpen,value,search,onSearch,games,isLoading,onChoose}:{open:boolean;onOpen:(v:boolean)=>void;value:string;search:string;onSearch:(v:string)=>void;games:string[];isLoading:boolean;onChoose:(g:string)=>void}){
  const custom=search.trim() && !games.some(g=>g.toLowerCase()===search.trim().toLowerCase())
  return <div className="relative"><label className="mb-1 block text-[11px] font-semibold text-slate-400">GAME CATEGORY</label><button type="button" onClick={()=>onOpen(!open)} className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-sm"><span className="truncate">{value || 'Choose or search for any game'}</span><ChevronDown className="h-4 w-4 shrink-0"/></button>{value==='Grand Theft Auto VI'&&<span className="mt-1 inline-block rounded bg-amber-400/15 px-2 py-1 text-[10px] font-bold text-amber-200">Coming Soon</span>}{open&&<div className="relative z-40 mt-2 overflow-hidden rounded-xl border border-cyan-400/25 bg-[#0c1526] shadow-2xl"><div className="flex items-center gap-2 border-b border-white/10 p-2"><Search className="h-4 w-4 text-cyan-300"/><input autoFocus value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search all games or enter a custom title" className="min-w-0 flex-1 bg-transparent p-1 text-xs text-white outline-none"/><button type="button" onClick={()=>onOpen(false)} aria-label="Close game search"><X className="h-4 w-4"/></button></div><div className="max-h-48 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">{isLoading&&<p className="px-2 py-1 text-xs text-cyan-200">Searching catalog...</p>}{games.map(g=><button key={g} type="button" onClick={()=>onChoose(g)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10"><span className="truncate">{g}</span>{g==='Grand Theft Auto VI'&&<span className="ml-2 shrink-0 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">Coming Soon</span>}</button>)}{custom&&<button type="button" onClick={()=>onChoose(search)} className="w-full rounded-lg border-t border-white/10 px-3 py-3 text-left text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">Use custom game: “{search.trim()}”</button>}{games.length===0&&!custom&&<p className="p-3 text-xs text-slate-400">No matches. Type a game name to add it.</p>}</div></div>}</div>
}
function Agreement({checked,onChange,compact=false}:{checked:boolean;onChange?:(v:boolean)=>void;compact?:boolean}){const [details,setDetails]=useState(false);return <div className="text-[11px]"><label className="flex cursor-pointer items-start gap-2 text-slate-300"><input type="checkbox" checked={checked} onChange={e=>onChange?.(e.target.checked)} disabled={!onChange} className="mt-0.5 accent-cyan-400"/><span>I confirm I am at least 18, and I accept the Broadcast Agreement, Terms of Service, and Community Guidelines.</span></label><button type="button" onClick={()=>setDetails(v=>!v)} className="mt-1.5 text-amber-300 underline underline-offset-2">{details?'Hide':'Read'} broadcast agreement</button>{details&&<div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 leading-relaxed text-slate-300"><p>I confirm that I am at least 18 years old and will comply with all applicable laws in my jurisdiction. I am responsible for the content I create, stream, share, or display on Mai Troll.</p><p>I agree not to broadcast illegal activity, sell or promote controlled substances, threaten or harm others, share non-consensual content, or violate Mai Troll's Terms of Service or Community Guidelines.</p><p>I am of legal age in my jurisdiction to consume any products, substances, beverages, or other items shown or consumed during my broadcast, and any such activity complies with local laws.</p><p>Mai Troll may remove content, suspend broadcasts, restrict features, or terminate accounts for violations.</p></div>}</div>}
function OverlayTextControls({text,visible,onSetText,onToggle,onClear}:{text:string;visible:boolean;onSetText?:(v:string)=>void;onToggle?:()=>void;onClear?:()=>void}){const [input,setInput]=useState(text);useEffect(()=>setInput(text),[text]);return <div className={cn(cardBase,'space-y-2 p-3')}><div className="flex items-center justify-between text-xs font-extrabold"><span>On-screen text</span><button type="button" onClick={onToggle} disabled={!onToggle} aria-label={visible?'Hide overlay text':'Show overlay text'}>{visible?<Eye className="h-4 w-4 text-emerald-300"/>:<EyeOff className="h-4 w-4 text-slate-400"/>}</button></div><input value={input} onChange={e=>setInput(e.target.value)} onBlur={()=>onSetText?.(input)} onKeyDown={e=>{if(e.key==='Enter')onSetText?.(input)}} className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs outline-none" placeholder="Type your overlay text"/><div className="flex gap-2"><button type="button" onClick={()=>onSetText?.(input)} disabled={!onSetText} className={cn(buttonBase,'flex-1 border-white/10 px-2 py-2')}>Apply</button><button type="button" onClick={()=>{setInput('');onClear?.()}} disabled={!onClear} className={cn(buttonBase,'border-red-400/25 px-2 py-2 text-red-200')}>Clear</button></div></div>}

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

/** Draggable + resizable camera overlay — like OBS webcam overlay.
    Position/size are percent-based and synced to viewers via stream metadata.
    Supports mouse and touch input. */
function DraggableCameraOverlay({
  stream,
  layout,
  onUpdate,
}: {
  stream: MediaStream | null
  layout: { xPercent: number; yPercent: number; widthPercent: number; radius: number }
  onUpdate?: (updates: Partial<{ xPercent: number; yPercent: number; widthPercent: number; radius: number }>) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 });
  const resizeStart = useRef({ width: 0, clientX: 0, clientY: 0 });

  // Keep latest props in refs so callbacks stay stable
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Attach camera stream to video element
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    return () => { el.srcObject = null; };
  }, [stream]);

  const MIN_WIDTH = 12;
  const MAX_WIDTH = 60;

  const applyUpdate = useCallback((next: Partial<{ xPercent: number; yPercent: number; widthPercent: number; radius: number }>) => {
    const l = layoutRef.current;
    const w = Number.isFinite(next.widthPercent) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next.widthPercent!)) : l.widthPercent;
    const x = Number.isFinite(next.xPercent) ? Math.min(95 - w, Math.max(0, next.xPercent!)) : l.xPercent;
    const y = Number.isFinite(next.yPercent) ? Math.min(85, Math.max(0, next.yPercent!)) : l.yPercent;
    const r = Number.isFinite(next.radius) ? Math.min(28, Math.max(0, next.radius!)) : l.radius;
    onUpdateRef.current?.({ xPercent: x, yPercent: y, widthPercent: w, radius: r });
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => {
    e.preventDefault();
    setIsDragging(true);
    const l = layoutRef.current;
    dragStart.current = { x: l.xPercent, y: l.yPercent, clientX, clientY };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => {
    e.preventDefault();
    setIsResizing(true);
    const l = layoutRef.current;
    resizeStart.current = { width: l.widthPercent, clientX, clientY };
  }, []);

  const moveHandler = useCallback((clientX: number, clientY: number) => {
    if (isDragging) {
      const dx = clientX - dragStart.current.clientX;
      const dy = clientY - dragStart.current.clientY;
      const dxPct = (dx / (containerRef.current?.parentElement?.clientWidth || window.innerWidth)) * 100;
      const dyPct = (dy / (containerRef.current?.parentElement?.clientHeight || window.innerHeight)) * 100;
      applyUpdate({ xPercent: dragStart.current.x + dxPct, yPercent: dragStart.current.y + dyPct });
    }
    if (isResizing) {
      const dx = clientX - resizeStart.current.clientX;
      const dxPct = (dx / (containerRef.current?.parentElement?.clientWidth || window.innerWidth)) * 100;
      applyUpdate({ widthPercent: resizeStart.current.width + dxPct });
    }
  }, [isDragging, isResizing, applyUpdate]);

  const endHandler = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handleMove = (e: MouseEvent) => moveHandler(e.clientX, e.clientY);
    const handleUp = () => endHandler();
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, isResizing, moveHandler, endHandler]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handleMove = (e: TouchEvent) => {
      const t = e.touches[0];
      moveHandler(t.clientX, t.clientY);
    };
    const handleUp = () => endHandler();
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, isResizing, moveHandler, endHandler]);

  return (
    <div
      ref={containerRef}
      className="absolute z-30 pointer-events-auto"
      style={{
        left: `${layout.xPercent}%`,
        top: `calc(env(safe-area-inset-top) + ${layout.yPercent}%)`,
        width: `${layout.widthPercent}%`,
        aspectRatio: '4 / 3',
        borderRadius: `${layout.radius}px`,
        maxWidth: '100%',
      }}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border-2 shadow-2xl transition',
          (isDragging || isResizing) ? 'border-cyan-300 shadow-cyan-500/30' : 'border-white/20'
        )}
        // Drag anywhere on the card body — the resize corner stops propagation so it wins.
        onMouseDown={(e) => { e.preventDefault(); handleDragStart(e, e.clientX, e.clientY); }}
        onTouchStart={(e) => { if (e.touches.length === 1) { e.preventDefault(); handleDragStart(e, e.touches[0].clientX, e.touches[0].clientY); } }}
      >
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
        {/* Resize handle (bottom-right corner) — stops propagation so it wins over card drag */}
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize bg-white/20 hover:bg-white/40 rounded-bl-[inherit] transition"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleResizeStart(e, e.clientX, e.clientY); }}
          onTouchStart={(e) => { e.stopPropagation(); if (e.touches.length === 1) { e.preventDefault(); handleResizeStart(e, e.touches[0].clientX, e.touches[0].clientY); } }}
          title="Drag to resize camera"
        />
      </div>
    </div>
  );
}


export default GamingSetup
