import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Compass,
  Grid2X2,
  Home,
  LockKeyhole,
  Mail,
  Maximize2,
  MessageCircle,
  Minimize2,
  Phone,
  Settings2,
  Sparkles,
  Smartphone,
  Video,
  Users as UsersIcon,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useIsPhone } from './useIsPhone'
import { useUtromailMessagePopup } from '@/hooks/useUtromailMessagePopup'
import PhoneChat from './pages/PhoneChat'
import Call from '@/pages/Call'
import { supabase } from '@/lib/supabase'
import { CALL_PACKAGES, purchaseCallMinutes, type CallPackage } from '@/lib/callMinutes'
import { findOrCreateDirectThread } from '@/services/utromailService'
import { usePresenceStore } from '@/lib/presenceStore'
import { toast } from 'sonner'

/**
 * Web-only, floating MaiPhone Elite.
 * The visual shell is interactive React/CSS/SVG, NOT a static product image.
 * Existing Utromail and authentication integrations are retained.
 * The phone embeds the existing authorized Utromail and LiveKit surfaces.
 */

const POSITION_STORAGE_KEY = 'mai-elite-phone-position'
const THEME_STORAGE_KEY = 'mai-elite-phone-theme'
const COMPACT_WIDTH = 342
const COMPACT_HEIGHT = 642
const EXPANDED_WIDTH = 388
const EXPANDED_HEIGHT = 708

type PhonePosition = { x: number; y: number }
type PhonePage = 'home' | 'apps' | 'mail' | 'calls' | 'video' | 'city' | 'settings'
type PhoneTheme = 'violet' | 'cyan' | 'emerald'
type PhoneContact = {
  user_id: string
  username: string | null
  display_name: string | null
  phone_number: string | null
  is_admin: boolean
  is_online?: boolean
}

function clampPosition(next: PhonePosition, width: number, height: number): PhonePosition {
  if (typeof window === 'undefined') return next
  return {
    x: Math.max(8, Math.min(next.x, Math.max(8, window.innerWidth - width - 8))),
    y: Math.max(8, Math.min(next.y, Math.max(8, window.innerHeight - height - 8))),
  }
}

function getInitialPosition(): PhonePosition {
  if (typeof window === 'undefined') return { x: 24, y: 24 }
  const fallback = {
    x: Math.max(8, window.innerWidth - COMPACT_WIDTH - 24),
    y: Math.max(8, window.innerHeight - COMPACT_HEIGHT - 24),
  }
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY) || 'null') as PhonePosition | null
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return clampPosition(saved, COMPACT_WIDTH, COMPACT_HEIGHT)
    }
  } catch {
    // The stored position is optional.
  }
  return fallback
}

function getInitialTheme(): PhoneTheme {
  if (typeof window === 'undefined') return 'violet'
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'cyan' || saved === 'emerald' || saved === 'violet') return saved
  } catch {
    // Private browser storage may be unavailable.
  }
  return 'violet'
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.closest !== 'function') return false
  return (
    element.isContentEditable ||
    Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]'))
  )
}

function AppButton({ label, children, onClick, badge, tone = 'violet' }: {
  label: string
  children: ReactNode
  onClick: () => void
  badge?: boolean
  tone?: 'violet' | 'pink' | 'blue' | 'green' | 'amber'
}) {
  return (
    <button className="mei-app-button" type="button" onClick={onClick} aria-label={label}>
      <span className={`mei-app-icon mei-tone-${tone}`}>
        {children}
        {badge && <span className="mei-app-badge" aria-label="New activity" />}
      </span>
      <span className="mei-app-name">{label}</span>
    </button>
  )
}

function EliteWallpaper() {
  return (
    <svg className="mei-wallpaper" viewBox="0 0 330 625" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="mei-halo" cx="75%" cy="73%" r="70%">
          <stop offset="0" stopColor="#6f39ed" stopOpacity=".95" />
          <stop offset=".38" stopColor="#261169" stopOpacity=".6" />
          <stop offset="1" stopColor="#050614" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mei-ribbon" x1="0" y1="0" x2="1" y2=".7">
          <stop offset="0" stopColor="#16102e" />
          <stop offset=".23" stopColor="#e7b5ff" />
          <stop offset=".40" stopColor="#655bff" />
          <stop offset=".64" stopColor="#9b48e5" />
          <stop offset=".82" stopColor="#21115e" />
          <stop offset="1" stopColor="#0b0928" />
        </linearGradient>
        <linearGradient id="mei-shine" x1=".15" y1=".1" x2=".85" y2="1">
          <stop offset="0" stopColor="#fff0ff" />
          <stop offset=".16" stopColor="#c7c6ff" />
          <stop offset=".42" stopColor="#6f60ff" />
          <stop offset=".76" stopColor="#ad50fc" />
          <stop offset="1" stopColor="#180a5a" />
        </linearGradient>
        <filter id="mei-blur"><feGaussianBlur stdDeviation="17" /></filter>
        <filter id="mei-soft"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="330" height="625" fill="#07091a" />
      <ellipse cx="262" cy="423" rx="175" ry="263" fill="url(#mei-halo)" />
      <path d="M-92 221 C 15 222, 65 430, 176 320 S 312 165, 414 105 L 416 390 C 326 296, 238 299, 165 412 S 38 392,-92 330 Z" fill="#854bff" opacity=".46" filter="url(#mei-blur)" />
      <path d="M-67 200 C 62 244, 89 414, 188 321 S 307 161, 394 121 C 295 243, 260 301, 185 383 S 55 375,-67 270Z" fill="url(#mei-ribbon)" opacity=".91" />
      <path d="M-43 204 C 66 239, 90 372, 181 302 S 282 194, 370 135" stroke="url(#mei-shine)" strokeWidth="8" opacity=".82" fill="none" filter="url(#mei-soft)" />
      <path d="M-43 204 C 66 239, 90 372, 181 302 S 282 194, 370 135" stroke="url(#mei-shine)" strokeWidth="2" opacity=".92" fill="none" />
      <path d="M-65 393 C 64 347, 85 562, 184 464 S 275 311, 411 389 L 430 661 L-55 659Z" fill="#26105d" opacity=".82" />
      <path d="M-70 411 C 47 329, 107 543, 197 450 S 309 344, 403 375" stroke="#a66af7" strokeWidth="15" opacity=".5" fill="none" filter="url(#mei-blur)" />
      <path d="M-70 411 C 47 329, 107 543, 197 450 S 309 344, 403 375" stroke="url(#mei-shine)" strokeWidth="2" opacity=".75" fill="none" />
      <ellipse cx="178" cy="552" rx="176" ry="115" fill="#100c29" opacity=".6" />
    </svg>
  )
}

const PHONE_CSS = `
.mei-mount{position:fixed;z-index:90;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;user-select:none;-webkit-user-select:none;touch-action:none}
.mei-mount *{box-sizing:border-box}
.mei-mount button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.mei-mount button:focus-visible{outline:2px solid #b67eff;outline-offset:3px}
.mei-mini{display:flex;align-items:center;gap:11px;padding:11px 15px;border:1px solid #b38bff9e;background:linear-gradient(130deg,#211539,#090d20);color:white;border-radius:20px;box-shadow:0 10px 28px #0008,0 0 22px #7d4fff55;white-space:nowrap}
.mei-mini svg{color:#dfafff}.mei-mini-title{font-size:12px;font-weight:800;letter-spacing:.025em}.mei-mini-sub{font-size:10px;color:#cfc1e5}
.mei-shell{--mei-accent:#a95bff;--mei-edge:#c88cff;--mei-rgb:169,91,255;width:342px;height:642px;position:relative;padding:8px;border-radius:45px;background:linear-gradient(132deg,#d1bedc 0%,#6c536f 10%,#18111f 22%,#08070c 39%,#25182e 67%,#c4a8d9 87%,#3f2c4c 100%);border:1px solid #c4a8da;max-height:calc(100dvh - 16px);box-shadow:0 0 0 1px #211829,0 18px 45px #000c,0 0 32px rgba(var(--mei-rgb),.40),inset 1px 1px 1px #ffdcff88;transition:width .2s ease,height .2s ease}
.mei-shell.is-expanded{width:388px;height:708px}
.mei-shell[data-theme=cyan]{--mei-accent:#31befe;--mei-edge:#84e1ff;--mei-rgb:49,190,254}
.mei-shell[data-theme=emerald]{--mei-accent:#48f3b4;--mei-edge:#80ffc7;--mei-rgb:72,243,180}
.mei-power,.mei-volume{position:absolute;z-index:3;width:4px;background:linear-gradient(90deg,#60416e,var(--mei-edge),#3e2553);box-shadow:0 0 12px rgba(var(--mei-rgb),.9);border:1px solid #7a598d}
.mei-power{right:-5px;top:139px;height:66px;border-radius:0 4px 4px 0;cursor:pointer}
.mei-volume{left:-5px;top:134px;height:70px;border-radius:4px 0 0 4px;pointer-events:none}
.mei-screen{position:relative;width:100%;height:100%;overflow:hidden;border:3px solid #090713;border-radius:38px;background:#060818;isolation:isolate}
.mei-wallpaper{position:absolute;inset:0;width:100%;height:100%;z-index:-2;pointer-events:none;opacity:1}
.mei-screen[data-theme=cyan] .mei-wallpaper{filter:hue-rotate(75deg) saturate(1.3)}
.mei-screen[data-theme=emerald] .mei-wallpaper{filter:hue-rotate(165deg) saturate(.95)}
.mei-screen:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#04040c35 0%,transparent 31%,transparent 72%,#030410a8 100%);z-index:-1;pointer-events:none}
.mei-island{position:absolute;z-index:12;left:50%;top:8px;transform:translateX(-50%);height:21px;width:92px;border-radius:20px;background:linear-gradient(130deg,#030308,#111121);border:1px solid #3e304d;box-shadow:0 1px 6px #0009;pointer-events:none}
.mei-island:before{content:"";position:absolute;left:25px;top:8px;width:26px;height:5px;border-radius:4px;background:#1f1830}
.mei-island:after{content:"";position:absolute;right:17px;top:7px;width:7px;height:7px;border-radius:50%;background:#112a56;box-shadow:inset 0 0 0 2px #0d0c15}
.mei-status{position:absolute;z-index:10;left:0;right:0;top:0;height:43px;padding:13px 17px 0;display:flex;align-items:flex-start;justify-content:space-between;cursor:grab;touch-action:none;font-size:11px;font-weight:800;text-shadow:0 1px 3px #0009}
.mei-status:active{cursor:grabbing}.mei-status-icons{display:flex;gap:5px;align-items:center;margin-top:1px}.mei-status-icons svg{width:13px;height:13px}
.mei-frame-controls{position:absolute;z-index:20;right:10px;top:43px;display:flex;gap:4px;opacity:.28;transition:opacity .15s}
.mei-shell:hover .mei-frame-controls,.mei-frame-controls:focus-within{opacity:1}
.mei-frame-controls button{display:grid;place-items:center;width:23px;height:23px;border:1px solid #ffffff2a;border-radius:50%;background:#0b0926a8;color:white}
.mei-frame-controls button:hover{background:#593c8c}
.mei-home{position:absolute;inset:43px 0 22px}
.mei-date{position:absolute;top:65px;left:0;right:0;text-align:center;color:#e1d8ef;font-size:12px;text-shadow:0 2px 5px #0008}
.mei-clock{position:absolute;top:89px;left:0;right:0;text-align:center;font-size:67px;line-height:1;font-weight:250;letter-spacing:-4px;text-shadow:0 5px 22px #0007}
.mei-rail{position:absolute;right:10px;top:36%;display:grid;gap:13px;z-index:3}
.mei-rail button{width:31px;height:31px;border:0;color:#e9e1ff;background:#0e0e2e3d;display:grid;place-items:center;border-radius:11px;filter:drop-shadow(0 0 5px #9875ff55)}
.mei-rail button:hover,.mei-rail button:focus-visible{background:#8c4de04d;color:white}
.mei-rail svg{width:20px;height:20px;stroke-width:1.7}
.mei-ai-card{position:absolute;left:16px;bottom:112px;right:55px;display:flex;gap:9px;align-items:center;padding:12px 10px;text-align:left;border:1px solid #ad74ffae;border-radius:21px;background:linear-gradient(110deg,#241458cc,#2c1955bf);box-shadow:0 10px 27px #0005,inset 0 1px #ffffff18;color:white;backdrop-filter:blur(9px)}
.mei-ai-card:hover{border-color:#eedaff;box-shadow:0 0 18px rgba(var(--mei-rgb),.5)}
.mei-ai-symbol{height:42px;width:42px;display:grid;place-items:center;flex:none;border-radius:50%;border:1px solid #8b65ff;background:#332186bd;color:#a1f1ff;box-shadow:0 0 15px #6036ff7d}
.mei-ai-card strong{display:block;font-size:15px;font-weight:600}.mei-ai-card small{display:block;color:#dbd0ec;font-size:10px;line-height:1.5;margin-top:2px}
.mei-dock{position:absolute;bottom:28px;left:12px;right:12px;display:flex;justify-content:space-around;gap:7px;align-items:center}
.mei-dock button{width:53px;height:54px;border:1px solid #c8a9ff5a;border-radius:16px;color:#faf5ff;background:linear-gradient(135deg,#5640a3bf,#170c42ed);box-shadow:inset 0 1px #ffffff31,0 4px 10px #0007;display:grid;place-items:center}
.mei-dock button:hover{transform:translateY(-2px);border-color:var(--mei-edge)}
.mei-dock svg{width:23px;height:23px;stroke-width:1.9}
.mei-homebar{position:absolute;z-index:15;bottom:8px;left:50%;transform:translateX(-50%);width:98px;height:4px;border:0;padding:0;border-radius:10px;background:#f2eafe;box-shadow:0 0 10px var(--mei-accent);cursor:pointer}
.mei-page{position:absolute;inset:43px 0 26px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#6a4386 transparent;padding:14px 15px 18px;background:linear-gradient(180deg,#0a0a1c9c,#080516c4);backdrop-filter:blur(17px);touch-action:pan-y;user-select:text;-webkit-user-select:text}
.mei-page-header{display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-right:20px}
.mei-back{width:30px;height:30px;flex:none;border:1px solid #ffffff35;border-radius:11px;background:#ffffff15;color:white;display:grid;place-items:center}
.mei-page-title{font-size:21px;font-weight:780;letter-spacing:-.6px;margin:0}.mei-page-subtitle{font-size:11px;color:#d7c5ec;margin:3px 0 0}
.mei-glass{background:linear-gradient(125deg,#ffffff1c,#ffffff0b);border:1px solid #ffffff26;border-radius:17px;box-shadow:inset 0 1px #ffffff0d}
.mei-card{padding:14px;margin-bottom:12px}.mei-card h3{font-size:13px;margin:0 0 7px;font-weight:800}.mei-card p{margin:0;color:#d2c5e6;font-size:11px;line-height:1.6}
.mei-mail-embed{padding:0!important;margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:hidden;height:100%}
.mei-mail-embed>div{height:100%}.mei-number-input{width:100%;margin-top:10px;padding:10px 12px;border:0;border-radius:12px;background:#ffffff12;color:white;outline:none;font-size:12px}.mei-number-input::placeholder{color:#cdbde388}
.mei-primary{width:100%;margin-top:12px;padding:12px;border-radius:13px;border:1px solid #bf7dff;color:white;background:linear-gradient(120deg,var(--mei-accent),#4633a9);font-size:12px;font-weight:750}
.mei-primary:hover{filter:brightness(1.12)}.mei-secondary{width:100%;margin-top:10px;padding:11px;border:1px solid #ffffff36;color:#fff;background:#ffffff14;border-radius:13px;font-size:12px}
.mei-app-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:19px 8px;margin-top:25px}
.mei-app-button{display:flex;flex-direction:column;align-items:center;gap:7px;background:none;border:0;color:white;min-width:0;padding:0}
.mei-app-icon{position:relative;display:grid;place-items:center;width:61px;height:61px;border-radius:19px;border:1px solid #ffffff4b;box-shadow:inset 0 1px #ffffff36,0 8px 16px #0007;background:linear-gradient(135deg,#8757e4,#261353)}
.mei-app-icon svg{width:27px;height:27px}.mei-app-name{font-size:10px;white-space:nowrap}.mei-tone-blue{background:linear-gradient(135deg,#347ff1,#1e245a)}
.mei-tone-green{background:linear-gradient(135deg,#21a992,#104943)}.mei-tone-amber{background:linear-gradient(135deg,#d78d36,#66302d)}.mei-tone-pink{background:linear-gradient(135deg,#bb4adc,#4e145f)}
.mei-app-badge{position:absolute;right:-2px;top:-3px;width:10px;height:10px;background:#ff4b87;border:2px solid #130c2d;border-radius:50%}
.mei-list-button{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:12px;border:1px solid #ffffff1c;border-radius:14px;background:#ffffff12;color:#fff;margin-bottom:8px}
.mei-list-button:hover{background:#ffffff24}.mei-list-button strong{display:block;font-size:12px}.mei-list-button small{color:#cdbde3;font-size:10px}.mei-list-button > svg:last-child{margin-left:auto}
.mei-avatar{width:35px;height:35px;flex:none;display:grid;place-items:center;border-radius:12px;background:#873dca55;color:#dfbaff}
.mei-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:1.6px;color:#c4a1ed;font-weight:800;margin:20px 0 10px}
.mei-theme-picks{display:flex;gap:9px;margin-top:10px}.mei-theme-picks button{flex:1;height:63px;border-radius:13px;border:2px solid transparent;display:flex;align-items:end;justify-content:center;padding:7px;font-size:10px;color:white}
.mei-theme-picks button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 14px rgba(var(--mei-rgb),.55)}
.mei-theme-violet{background:linear-gradient(145deg,#140725,#843ae7)}.mei-theme-cyan{background:linear-gradient(145deg,#061e3e,#26aeef)}.mei-theme-emerald{background:linear-gradient(145deg,#071d1b,#25b788)}
.mei-preview{height:215px;display:grid;place-items:center;background:#05070d;border-radius:15px;overflow:hidden;border:1px solid #ffffff28;margin-bottom:12px;position:relative}
.mei-preview video{width:100%;height:100%;object-fit:cover}.mei-preview p{font-size:11px;color:#c6b6db;text-align:center;padding:20px;line-height:1.6}
.mei-notification{position:absolute;z-index:9;left:13px;right:48px;top:192px;display:flex;align-items:center;gap:7px;padding:9px;border:1px solid #b97aff74;background:#1b1042db;border-radius:13px;backdrop-filter:blur(15px);color:white;text-align:left;box-shadow:0 8px 20px #0005}
.mei-notification strong{display:block;font-size:10px}.mei-notification small{display:block;font-size:9px;color:#d5c4ec;max-width:175px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mei-foot-note{font-size:10px;color:#bbaad4;line-height:1.6;margin-top:13px}
@media (prefers-reduced-motion:reduce){.mei-shell,.mei-frame-controls,.mei-dock button{transition:none!important}}
`

export default function MaiElitePhone() {
  const isPhone = useIsPhone()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const incomingMessage = useUtromailMessagePopup()

  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<PhonePosition>(getInitialPosition)
  const [page, setPage] = useState<PhonePage>('home')
  const [theme, setTheme] = useState<PhoneTheme>(getInitialTheme)
  const [clock, setClock] = useState(() => new Date())
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [contacts, setContacts] = useState<PhoneContact[]>([])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [mailThreadId, setMailThreadId] = useState<string | null>(null)
  const [dialedNumber, setDialedNumber] = useState('')
  const [replacementNumber, setReplacementNumber] = useState('')
  const [selectedContact, setSelectedContact] = useState<PhoneContact | null>(null)
  const [activeCall, setActiveCall] = useState<{ type: 'audio' | 'video'; contact: PhoneContact } | null>(null)
  const [callMinutes, setCallMinutes] = useState({ audio: 0, video: 0 })
  const [missedCalls, setMissedCalls] = useState(0)
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds)

  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const previousMessageRef = useRef<unknown>(null)
  const latestPositionRef = useRef(position)

  const width = expanded ? EXPANDED_WIDTH : COMPACT_WIDTH
  const height = expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT

  const openPhone = useCallback(() => {
    setOpen(true)
    setMinimized(false)
  }, [])

  const registerPhone = useCallback(async () => {
    const { data, error } = await supabase.rpc('register_maielite_phone')
    if (error) {
      console.error('[MaiElitePhone] Registration failed:', error)
      toast.error('Phone registration is unavailable right now.')
      return
    }
    setPhoneNumber(String(data?.phone_number || ''))
  }, [])

  const goToPage = useCallback((next: PhonePage) => {
    setPage(next)
    openPhone()
  }, [openPhone])

  const goToUtromail = useCallback(() => {
    setPage('mail')
  }, [])

  const loadPhoneData = useCallback(async () => {
    const [directory, balances] = await Promise.all([
      supabase.rpc('get_maielite_phone_directory'),
      supabase.rpc('get_call_balances', { p_user_id: user?.id }),
    ])
    if (directory.error) {
      console.error('[MaiElitePhone] Directory failed:', directory.error)
    } else {
      setContacts((directory.data || []).map((contact: PhoneContact) => ({
        ...contact,
        is_online: onlineUserIds.has(contact.user_id),
      })))
    }
    if (!balances.error) {
      setCallMinutes({
        audio: balances.data?.audio_minutes || 0,
        video: balances.data?.video_minutes || 0,
      })
    }
    const { count, error: missedError } = await supabase
      .from('maielite_phone_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'missed')
    if (missedError) {
      console.error('[MaiElitePhone] Missed calls failed:', missedError)
    } else {
      setMissedCalls(count || 0)
    }
  }, [onlineUserIds, user?.id])

  const buyMinutes = useCallback(async (pkg: CallPackage) => {
    if (!user?.id) return
    const result = await purchaseCallMinutes(user.id, pkg)
    if (!result.success) {
      toast.error(result.error || 'Unable to purchase minutes.')
      return
    }
    toast.success(`${pkg.minutes} ${pkg.type} minutes added.`)
    await loadPhoneData()
  }, [loadPhoneData, user?.id])

  const saveContact = useCallback(async (contactId: string) => {
    if (!user?.id) return
    const { error } = await supabase.from('maielite_phone_contacts').upsert({
      owner_id: user.id,
      contact_id: contactId,
    }, { onConflict: 'owner_id,contact_id' })
    if (error) {
      console.error('[MaiElitePhone] Could not save contact:', error)
      toast.error('Unable to save contact.')
      return
    }
    toast.success('Contact saved.')
  }, [user?.id])

  const messageContact = useCallback(async (contactId: string) => {
    if (!user?.id) return
    try {
      const thread = await findOrCreateDirectThread(user.id, contactId)
      setPage('mail')
      setMailThreadId(thread.id)
    } catch (error) {
      console.error('[MaiElitePhone] Could not open contact thread:', error)
      toast.error('Unable to open this contact thread.')
    }
  }, [user?.id])

  const placeDialedCall = useCallback((type: 'audio' | 'video') => {
    const contact = contacts.find((entry) => entry.phone_number === dialedNumber)
    if (!contact) {
      toast.error('Enter a registered 4-digit MaiElite number.')
      return
    }
    setSelectedContact(contact)
    setActiveCall({ type, contact })
  }, [contacts, dialedNumber])

  useEffect(() => {
    if (!open || (page !== 'calls' && page !== 'video') || activeCall) return
    const handleDialKey = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        setDialedNumber((value) => `${value}${event.key}`.slice(0, 4))
      } else if (event.key === 'Backspace') {
        setDialedNumber((value) => value.slice(0, -1))
      } else if (event.key === 'Escape') {
        setDialedNumber('')
      } else if (event.key === 'Enter' && dialedNumber.length === 4) {
        event.preventDefault()
        placeDialedCall(page === 'video' ? 'video' : 'audio')
      }
    }
    window.addEventListener('keydown', handleDialKey)
    return () => window.removeEventListener('keydown', handleDialKey)
  }, [activeCall, dialedNumber, open, page, placeDialedCall])

  const sharePhoneNumber = useCallback(async () => {
    if (!phoneNumber) return
    try {
      await navigator.clipboard.writeText(phoneNumber)
      toast.success('Your MaiElite number was copied.')
    } catch (error) {
      console.error('[MaiElitePhone] Could not share phone number:', error)
      toast.error(`Your MaiElite number is ${phoneNumber}`)
    }
  }, [phoneNumber])

  const changePhoneNumber = useCallback(async () => {
    const next = replacementNumber.trim()
    if (!/^[0-9]{4}$/.test(next)) {
      toast.error('Enter a phone number with exactly 4 digits.')
      return
    }
    const { data, error } = await supabase.rpc('change_maielite_phone_number', { p_phone_number: next })
    if (error) {
      console.error('[MaiElitePhone] Number change failed:', error)
      toast.error(error.message)
      return
    }
    setPhoneNumber(String(data?.phone_number || next))
    setReplacementNumber('')
    toast.success(data?.charged ? 'Number changed for 100 Troll Coins.' : 'Your first number change was free.')
  }, [replacementNumber])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user?.id || isPhone) return
    const handleOpenPhone = () => openPhone()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        openPhone()
      } else if (event.key === 'Escape') {
        setMinimized((wasMinimized) => (open && !wasMinimized ? true : wasMinimized))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mai-elite-phone-open', handleOpenPhone)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mai-elite-phone-open', handleOpenPhone)
    }
  }, [isPhone, open, openPhone, user?.id])

  useEffect(() => {
    if (!open || !user?.id || isPhone) return
    void registerPhone()
    void loadPhoneData()
  }, [isPhone, loadPhoneData, open, registerPhone, user?.id])

  useEffect(() => {
    if (!user?.id || isPhone || !incomingMessage.visible || !incomingMessage.message) {
      if (!incomingMessage.visible) previousMessageRef.current = null
      return
    }
    if (previousMessageRef.current === incomingMessage.message) return
    previousMessageRef.current = incomingMessage.message
    setPage('mail')
    openPhone()
  }, [incomingMessage.message, incomingMessage.visible, isPhone, openPhone, user?.id])

  useEffect(() => {
    setPosition((previous) => {
      const next = clampPosition(previous, width, minimized ? 58 : height)
      latestPositionRef.current = next
      return next
    })
  }, [width, height, minimized])

  useEffect(() => {
    const onResize = () => setPosition((previous) => {
      const next = clampPosition(previous, width, minimized ? 58 : height)
      latestPositionRef.current = next
      return next
    })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [width, height, minimized])

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* optional */ }
  }, [theme])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  // Drop any previous user's UI when the authenticated account changes.
  useEffect(() => {
    if (!user?.id) {
      setOpen(false)
      setPage('home')
    }
  }, [user?.id])

  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - position.x, offsetY: event.clientY - position.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const next = clampPosition({ x: event.clientX - dragRef.current.offsetX, y: event.clientY - dragRef.current.offsetY }, width, height)
    latestPositionRef.current = next
    setPosition(next)
  }
  const onDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    try { localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(latestPositionRef.current)) } catch { /* optional */ }
  }

  if (isPhone || !user?.id) return null

  const currentTime = clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const currentDate = clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const newMail = Boolean(incomingMessage.visible && incomingMessage.message)
  const openSite = (path: string) => {
    navigate(path)
    setMinimized(true)
  }

  return (
    <>
      <style>{PHONE_CSS}</style>
      {!open ? (
        <button
          type="button"
          aria-label="Open MaiPhone Elite (P)"
          onClick={openPhone}
          style={{ position: 'fixed', right: 22, bottom: 20, zIndex: 90, display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: 20, background: 'linear-gradient(135deg,#422278,#100b27)', border: '1px solid #c184ff', color: '#e8c8ff', boxShadow: '0 0 25px #9f4bfc77' }}
        >
          <Smartphone size={29} />
        </button>
      ) : (
        <div className="mei-mount" style={{ left: position.x, top: position.y }}>
          {minimized ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={openPhone} className="mei-mini" aria-label="Restore MaiPhone Elite">
                <Sparkles size={20} />
                <span><span className="mei-mini-title">MaiPhone Elite</span><br /><span className="mei-mini-sub">Tap to restore · P</span></span>
                {newMail && <span style={{ color: '#ff91c5' }}>●</span>}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close MaiPhone Elite" style={{ background: '#211539', color: '#fff', border: '1px solid #b38bff88', borderRadius: 12, padding: 9 }}><X size={16} /></button>
            </div>
          ) : (
            <section className={`mei-shell ${expanded ? 'is-expanded' : ''}`} data-theme={theme} aria-label="MaiPhone Elite virtual smartphone">
              <span className="mei-volume" aria-hidden="true" />
              <button type="button" className="mei-power" title="Minimize phone" aria-label="Minimize phone using side button" onClick={() => setMinimized(true)} />
              <div className="mei-screen" data-theme={theme}>
                <EliteWallpaper />
                <span className="mei-island" aria-hidden="true" />
                <div className="mei-status" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} title="Drag the phone here">
                  <span>{currentTime}</span>
                  <span className="mei-status-icons" aria-label={online ? 'Online' : 'Offline'}>
                    {online ? <Wifi size={13} /> : <WifiOff size={13} />}
                    <LockKeyhole size={12} />
                  </span>
                </div>
                <div className="mei-frame-controls" aria-label="Phone window controls">
                  <button type="button" title="Minimize" aria-label="Minimize" onClick={() => setMinimized(true)}><Minimize2 size={12} /></button>
                  <button type="button" title={expanded ? 'Normal size' : 'Expand'} aria-label={expanded ? 'Normal size' : 'Expand'} onClick={() => setExpanded((value) => !value)}><Maximize2 size={12} /></button>
                  <button type="button" title="Close" aria-label="Close phone" onClick={() => setOpen(false)}><X size={12} /></button>
                </div>

                {page === 'home' ? (
                  <div className="mei-home">
                    <div className="mei-date">{currentDate}</div>
                    <div className="mei-clock">{currentTime}</div>
                    {newMail && (
                      <button type="button" className="mei-notification" onClick={goToUtromail}>
                        <MessageCircle size={17} color="#c99aff" />
                        <span><strong>New Utromail · {incomingMessage.message?.sender?.username || 'MaiTroll user'}</strong><small>{incomingMessage.message?.body || 'Open your message'}</small></span>
                        <ChevronRight size={14} />
                      </button>
                    )}
                    <nav className="mei-rail" aria-label="Quick phone apps">
                      <button type="button" onClick={() => setPage('home')} title="Home" aria-label="Home"><Home /></button>
                      <button type="button" onClick={() => goToPage('apps')} title="App library" aria-label="App library"><Grid2X2 /></button>
                      <button type="button" onClick={() => goToPage('city')} title="MaiTroll City" aria-label="MaiTroll City"><Compass /></button>
                    </nav>
                    <button type="button" className="mei-ai-card" onClick={() => goToPage('mail')}>
                      <span className="mei-ai-symbol"><Mail size={26} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}><strong>MaiElite Phone</strong><small>{phoneNumber ? `Your number · ${phoneNumber}` : 'Registering your number…'}</small></span>
                      <ChevronRight size={19} />
                    </button>
                    <div className="mei-dock" aria-label="Phone dock">
                      <button type="button" onClick={() => goToPage('calls')} title="MaiCall" aria-label="MaiCall"><Phone /></button>
                      <button type="button" onClick={() => goToPage('mail')} title="Utromail" aria-label="Utromail"><MessageCircle /></button>
                      <button type="button" onClick={() => goToPage('city')} title="MaiTroll City" aria-label="MaiTroll City"><Compass /></button>
                      <button type="button" onClick={() => goToPage('calls')} title="Contacts" aria-label="Contacts"><UsersIcon /></button>
                    </div>
                  </div>
                ) : (
                  <div className="mei-page">
                    <div className="mei-page-header">
                      <button type="button" className="mei-back" onClick={() => setPage('home')} aria-label="Back to home"><ArrowLeft size={18} /></button>
                      <div><h2 className="mei-page-title">{{ apps: 'App Library', mail: 'Utromail', calls: 'MaiCall', video: 'MaiVideo', city: 'MaiTroll City', settings: 'Settings', home: 'Home' }[page]}</h2><p className="mei-page-subtitle">MaiPhone ELITE</p></div>
                    </div>

                    {page === 'apps' && (
                      <>
                        <p className="mei-page-subtitle">Your MaiTroll universe, inside your phone.</p>
                        <div className="mei-app-grid">
                          <AppButton label="Utromail" tone="violet" badge={newMail} onClick={() => setPage('mail')}><Mail /></AppButton>
                          <AppButton label="MaiCall" tone="green" onClick={() => setPage('calls')}><Phone /></AppButton>
                          <AppButton label="MaiVideo" tone="pink" onClick={() => setPage('video')}><Video /></AppButton>
                          <AppButton label="MaiTroll" tone="blue" onClick={() => setPage('city')}><Home /></AppButton>
                          <AppButton label="Settings" tone="blue" onClick={() => setPage('settings')}><Settings2 /></AppButton>
                        </div>
                      </>
                    )}

                    {page === 'mail' && (
                      <>
                        {newMail && (
                          <button className="mei-list-button" type="button" onClick={goToUtromail}>
                            <span className="mei-avatar"><MessageCircle size={20} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}><strong>{incomingMessage.message?.sender?.username || 'New Utromail'}</strong><small style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{incomingMessage.message?.body}</small></span>
                            <ChevronRight size={16} />
                          </button>
                        )}
                        <div className="mei-glass mei-card mei-mail-embed"><PhoneChat compact initialThreadId={mailThreadId} /></div>
                      </>
                    )}

                    {(page === 'calls' || page === 'video') && (
                      <>
                        {activeCall && selectedContact ? (
                          <div className="mei-glass mei-card mei-call-embed">
                            <Call embedded onCallEnded={() => { setActiveCall(null); setSelectedContact(null) }} roomId={`maielite-${user.id}-${selectedContact.user_id}`} callType={activeCall.type} otherUserId={selectedContact.user_id} />
                          </div>
                        ) : (
                          <div className="mei-glass mei-card">
                            <h3>{page === 'video' ? 'Video calling' : 'Audio calling'}</h3>
                            <p>{page === 'video' ? 'Camera and microphone are used only during a video call.' : 'Audio calls never request or publish camera video.'}</p>
                            <p className="mei-page-subtitle">Your number: {phoneNumber || 'Registering…'} · {page === 'video' ? callMinutes.video : callMinutes.audio} minutes</p>
                            {missedCalls > 0 && <p style={{ color: '#ff9dbd', fontSize: 11 }}>Missed calls: {missedCalls}</p>}
                            <button type="button" className="mei-secondary" onClick={() => void sharePhoneNumber()}>Share my number</button>
                            <div style={{ marginTop: 12, padding: 10, borderRadius: 16, background: '#05060d99' }}>
                              <div style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, minHeight: 34 }}>
                                {dialedNumber || '----'}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                                  <button key={key} type="button" className="mei-secondary" onClick={() => {
                                    if (/^[0-9]$/.test(key)) setDialedNumber((value) => `${value}${key}`.slice(0, 4))
                                  }}>{key}</button>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <button type="button" className="mei-secondary" onClick={() => setDialedNumber((value) => value.slice(0, -1))}>Delete</button>
                                <button type="button" className="mei-secondary" disabled={dialedNumber.length !== 4} onClick={() => void placeDialedCall(page === 'video' ? 'video' : 'audio')}>Call</button>
                              </div>
                              <small style={{ display: 'block', marginTop: 6, textAlign: 'center', color: '#bdaed0' }}>Use the keypad or your PC keyboard</small>
                            </div>
                            <div className="mei-contact-list">
                              {contacts.map((contact) => (
                                <div key={contact.user_id} className="mei-list-button">
                                  <button type="button" onClick={() => { setSelectedContact(contact); setActiveCall({ type: page === 'video' ? 'video' : 'audio', contact }) }} style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8, minWidth: 0, background: 'none', border: 0, color: 'inherit', textAlign: 'left' }}>
                                    <span className="mei-avatar">{contact.is_admin ? 'CEO' : '☎'}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}><strong>{contact.is_admin ? 'CEO' : contact.display_name || contact.username || 'MaiTroll user'}</strong><small>{contact.is_online ? 'Online' : 'Offline'} · {contact.is_admin ? 'Private number' : contact.phone_number || 'Phone not registered'}</small></span>
                                  </button>
                                  <button type="button" onClick={() => void messageContact(contact.user_id)} aria-label="Open message thread" style={{ background: 'none', border: 0, color: '#bcdfff', padding: 5, fontSize: 10 }}>Mail</button>
                                  <button type="button" onClick={() => void saveContact(contact.user_id)} aria-label="Save contact" style={{ background: 'none', border: 0, color: '#d9a5ff', padding: 5 }}>+</button>
                                  <ChevronRight size={16} />
                                </div>
                              ))}
                            </div>
                            <div className="mei-minute-store">
                              <strong>Minute store</strong><span>10 Troll Coins = 30 minutes</span>
                              <button type="button" className="mei-secondary" onClick={() => void buyMinutes(CALL_PACKAGES[page === 'video' ? 'video' : 'audio'][0])}>Buy 30 minutes · 10 coins</button>
                            </div>
                          </div>
                        )}
                        <button type="button" className="mei-list-button" onClick={() => setPage(page === 'calls' ? 'video' : 'calls')}>
                          {page === 'calls' ? <Video size={19} /> : <Phone size={19} />}
                          <span style={{ flex: 1, fontSize: 12 }}>Switch to {page === 'calls' ? 'video' : 'audio'} calling</span>
                          <ChevronRight size={16} />
                        </button>
                      </>
                    )}

                    {page === 'city' && (
                      <>
                        <div className="mei-glass mei-card"><h3>Your city. Your world.</h3><p>Return to the existing MaiTroll homepage without opening a duplicate city experience.</p><button type="button" className="mei-primary" onClick={() => openSite('/')}>Enter MaiTroll City</button></div>
                        <button type="button" className="mei-list-button" onClick={() => setPage('mail')}><Mail size={19} /><span style={{ flex: 1, fontSize: 12 }}>Check Utromail</span><ChevronRight size={16} /></button>
                      </>
                    )}

                    {page === 'settings' && (
                      <>
                        <div className="mei-glass mei-card"><h3>Elite appearance</h3><p>Choose the phone&apos;s accent and wallpaper color.</p><div className="mei-theme-picks"><button className="mei-theme-violet" type="button" aria-pressed={theme === 'violet'} onClick={() => setTheme('violet')}>Violet {theme === 'violet' && <Check size={12} />}</button><button className="mei-theme-cyan" type="button" aria-pressed={theme === 'cyan'} onClick={() => setTheme('cyan')}>Cyan {theme === 'cyan' && <Check size={12} />}</button><button className="mei-theme-emerald" type="button" aria-pressed={theme === 'emerald'} onClick={() => setTheme('emerald')}>Emerald {theme === 'emerald' && <Check size={12} />}</button></div></div>
                        <div className="mei-glass mei-card"><h3>Phone window</h3><p>Press P to open anywhere on the desktop web app, except while typing. Drag by the status bar.</p><button className="mei-secondary" type="button" onClick={() => setExpanded((previous) => !previous)}>{expanded ? 'Use compact size' : 'Use expanded size'}</button></div>
                        <div className="mei-glass mei-card">
                          <h3>Phone number</h3>
                          <p>Your current number is <strong>{phoneNumber || 'Registering…'}</strong>. The first change is free; later changes cost 100 Troll Coins.</p>
                          <input value={replacementNumber} onChange={(event) => setReplacementNumber(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="New 4-digit number" className="mei-number-input" />
                          <button type="button" className="mei-secondary" onClick={() => void changePhoneNumber()}>Change number</button>
                        </div>
                        <div className="mei-glass mei-card"><h3>Privacy</h3><p>Camera and microphone permissions are requested only when their real features are initiated. Incoming Utromail uses your existing account integration.</p></div>
                      </>
                    )}

                  </div>
                )}

                <button type="button" className="mei-homebar" aria-label="Go to phone home" title="Home" onClick={() => setPage('home')} />
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}
