import React, { useState } from 'react'
import { Bell, MessageCircle } from 'lucide-react'
import GlobalTicker from '@/components/header/GlobalTicker'
import PhoneDrawer from './PhoneDrawer'

interface PhoneHeaderProps {
  title?: string
  showActions?: boolean
}

export default function PhoneHeader({
  title = 'MAiTROLL.com',
  showActions = true,
}: PhoneHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <PhoneDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#03030a]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">

          {/* Menu */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition active:scale-95"
          >
            <span className="text-xl leading-none">☰</span>
          </button>

          {/* Brand */}
          <div className="min-w-0 flex-1 px-3 text-center">
            <h1 className="truncate bg-gradient-to-r from-[#00BFFF] via-white to-[#BF00FF] bg-clip-text text-lg font-black tracking-tight text-transparent">
              {title}
            </h1>

            <div className="mt-0.5 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />

              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Live Network
              </span>
            </div>
          </div>

          {/* Actions */}
          {showActions ? (
            <div className="flex shrink-0 items-center gap-2">

              <button
                type="button"
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 text-[#00BFFF] transition active:scale-90"
              >
                <Bell
                  size={18}
                  strokeWidth={2}
                />

                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#BF00FF] shadow-[0_0_8px_#BF00FF]" />
              </button>

              <button
                type="button"
                aria-label="Messages"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 text-[#BF00FF] transition active:scale-90"
              >
                <MessageCircle
                  size={18}
                  strokeWidth={2}
                />
              </button>

            </div>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        {/* Global activity ticker */}
        <div className="border-t border-white/5 px-3 py-1.5">
          <GlobalTicker />
        </div>
      </header>
    </>
  )
}