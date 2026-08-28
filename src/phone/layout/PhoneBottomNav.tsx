import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronUp,
  Coins,
  Home,
  LogOut,
  MessageCircle,
  Radio,
  Sparkles,
  Store,
  User,
  Wallet,
  Zap,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { getPhoneNavSections, type PhoneNavSection } from '../phoneNav'
import { usePhoneRoleAccess } from '../usePhoneRoleAccess'

const HIDDEN_PATHS = [
  '/broadcast',
  '/broadcast/',
  '/broadcast/setup',
  '/mai-piks',
  '/viewer',
  '/live/',
  '/watch/',
  '/stream/',
  '/utromail',
  '/utromail/',
  '/tromail',
  '/tromail/',
]

function isPathHidden(pathname: string): boolean {
  for (const prefix of HIDDEN_PATHS) {
    if (prefix.endsWith('/')) {
      if (pathname.startsWith(prefix)) return true
    } else {
      if (pathname === prefix || pathname.startsWith(prefix + '/')) return true
    }
  }
  return false
}

type PhoneUserCard = {
  id: string | null
  username: string
  displayName: string
  avatarUrl: string | null
  role: string
  level: number
  xp: number
  trollCoins: number
  hypeCoins: number
  trollmonds: number
}

const DEFAULT_USER: PhoneUserCard = {
  id: null,
  username: 'Guest',
  displayName: 'Guest',
  avatarUrl: null,
  role: 'user',
  level: 1,
  xp: 0,
  trollCoins: 0,
  hypeCoins: 0,
  trollmonds: 0,
}

function getStringValue(source: any, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function getNumberValue(source: any, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== null && value !== undefined && value !== '') {
      const numeric = Number(value)
      if (!Number.isNaN(numeric)) return numeric
    }
  }
  return fallback
}

export default function PhoneBottomNav() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { user, profile, logout } = useAuthStore()
  const roleAccess = usePhoneRoleAccess()

  const [userCard, setUserCard] = useState<PhoneUserCard>(DEFAULT_USER)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const sections: PhoneNavSection[] = useMemo(
    () => getPhoneNavSections(roleAccess),
    [roleAccess],
  )

  const visibleSections = useMemo(
    () =>
      sections.filter((section) =>
        section.items.some((item) => item.show !== false),
      ),
    [sections],
  )

  useEffect(() => {
    if (!user?.id) {
      setUserCard(DEFAULT_USER)
      return
    }

    let cancelled = false

    async function load() {
      setLoadingProfile(true)
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select(
            'id, username, display_name, avatar_url, role, troll_role, level, xp, troll_coins, hype_coins, trollmonds',
          )
          .eq('id', user.id)
          .maybeSingle()

        if (!cancelled && data) {
          setUserCard({
            id: data.id ?? user.id,
            username: getStringValue(data, ['username'], user.email ?? 'User'),
            displayName: getStringValue(
              data,
              ['display_name'],
              getStringValue(data, ['username'], 'User'),
            ),
            avatarUrl: data.avatar_url ?? null,
            role: getStringValue(data, ['role', 'troll_role'], 'user'),
            level: getNumberValue(data, ['level'], 1),
            xp: getNumberValue(data, ['xp'], 0),
            trollCoins: getNumberValue(data, ['troll_coins'], 0),
            hypeCoins: getNumberValue(data, ['hype_coins'], 0),
            trollmonds: getNumberValue(data, ['trollmonds'], 0),
          })
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLoadingProfile(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id, supabase])

  const handleSignOut = useCallback(async () => {
    await logout()
    navigate('/', { replace: true })
  }, [navigate, logout])

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (isPathHidden(pathname)) {
    return null
  }

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] ${
        isOpen ? 'pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)]' : ''
      }`}
    >
      {/* Always-visible bottom tab bar */}
      <div className="mx-auto flex max-w-xl items-center justify-around border-t border-white/10 bg-[#050715]/95 px-1 py-2 backdrop-blur-xl">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${
              isActive ? 'text-cyan-400' : 'text-slate-400'
            }`
          }
        >
          <Home size={18} />
          <span className="text-[9px] font-black leading-none">Home</span>
        </NavLink>

        <NavLink
          to="/broadcast/setup"
          className={({ isActive }) =>
            `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${
              isActive ? 'text-cyan-400' : 'text-slate-400'
            }`
          }
        >
          <Radio size={18} />
          <span className="text-[9px] font-black leading-none">Go Live</span>
        </NavLink>

        <NavLink
          to="/utromail"
          className={({ isActive }) =>
            `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${
              isActive ? 'text-cyan-400' : 'text-slate-400'
            }`
          }
        >
          <MessageCircle size={18} />
          <span className="text-[9px] font-black leading-none">Chats</span>
        </NavLink>

        <NavLink
          to="/store"
          className={({ isActive }) =>
            `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${
              isActive ? 'text-cyan-400' : 'text-slate-400'
            }`
          }
        >
          <Store size={18} />
          <span className="text-[9px] font-black leading-none">Coins</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${
              isActive ? 'text-cyan-400' : 'text-slate-400'
            }`
          }
        >
          <User size={18} />
          <span className="text-[9px] font-black leading-none">Profile</span>
        </NavLink>

        <button
          type="button"
          className="flex min-w-0 shrink flex-col items-center gap-1 px-1 text-slate-400"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronUp size={18} />
          ) : (
            <Sparkles size={18} />
          )}
          <span className="text-[9px] font-black leading-none">
            {isOpen ? 'Close' : 'More'}
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="max-h-[65vh] overflow-y-auto border-t border-white/10 bg-[#050715]/95 backdrop-blur-xl">
          <div className="mx-auto max-w-xl px-4 py-4">
            {visibleSections.map((section) => (
              <div key={section.title} className="mb-4">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items
                    .filter((item) => item.show !== false)
                    .map((item) => (
                      <NavLink
                        key={item.path + item.label}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 transition active:scale-[0.98]',
                            isActive
                              ? 'bg-cyan-500/10 text-cyan-300'
                              : 'bg-white/[0.03] text-slate-300 active:bg-white/[0.06]',
                          ]
                            .filter(Boolean)
                            .join(' ')
                        }
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs">
                          {item.label.charAt(0)}
                        </span>
                        <span className="text-xs font-bold">
                          {item.label}
                        </span>
                      </NavLink>
                    ))}
                </div>
              </div>
            ))}

            <div className="mt-4 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-black text-red-400"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
