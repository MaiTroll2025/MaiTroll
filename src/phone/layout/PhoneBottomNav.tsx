import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ChevronUp,
  Coins,
  Home,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Radio,
  Search,
  Store,
  User,
  X,
} from 'lucide-react'

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

export default function PhoneBottomNav() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const roleAccess = usePhoneRoleAccess()
  const [searchQuery, setSearchQuery] = useState('')

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

  const handleSignOut = useCallback(async () => {
    await logout()
    navigate('/', { replace: true })
  }, [navigate, logout])

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (isPathHidden(pathname)) {
    return null
  }

  const openExplore = () => {
    setIsOpen(false)
    navigate(`/explore${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ''}`)
  }

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] ${
        isOpen
          ? 'inset-y-0 flex items-end bg-black/50'
          : ''
      }`}
      onClick={isOpen ? () => setIsOpen(false) : undefined}
    >
      {!isOpen && (
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
              <MoreHorizontal size={18} />
            )}
            <span className="text-[9px] font-black leading-none">
              {isOpen ? 'Close' : 'More'}
            </span>
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="relative z-10 max-h-[65vh] w-full overflow-y-auto border-t border-white/10 bg-[#050715]/95 backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto max-w-xl px-4 py-4">
            <div className="relative mb-4 pr-10">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close more menu"
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 active:bg-white/15"
              >
                <X size={17} />
              </button>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages, users, posts..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
                  onFocus={openExplore}
                />
              </div>
            </div>

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
