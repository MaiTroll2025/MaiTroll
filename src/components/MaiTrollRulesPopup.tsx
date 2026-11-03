import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuthStore } from '../lib/store'

const RULES_STORAGE_KEY = 'maitroll_rules_cadence_v1'
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
const WEEKLY_INTERVAL_MS = 7 * DAILY_INTERVAL_MS

type RulesDismissal = {
  dismissedAt: number
  dismissalCount: number
}

function getStorageKey(userId: string): string {
  return `${RULES_STORAGE_KEY}:${userId}`
}

function readDismissal(userId: string): RulesDismissal | null {
  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('dismissedAt' in parsed)
      || !('dismissalCount' in parsed)
      || typeof parsed.dismissedAt !== 'number'
      || typeof parsed.dismissalCount !== 'number'
      || !Number.isFinite(parsed.dismissedAt)
      || !Number.isInteger(parsed.dismissalCount)
      || parsed.dismissalCount < 1
    ) return null
    return { dismissedAt: parsed.dismissedAt, dismissalCount: parsed.dismissalCount }
  } catch (error) {
    console.warn('[MaiTrollRulesPopup] Unable to read dismissal history.', error)
    return null
  }
}

function shouldShowRules(userId: string): boolean {
  const dismissal = readDismissal(userId)
  if (!dismissal) return true
  const interval = dismissal.dismissalCount < 2 ? DAILY_INTERVAL_MS : WEEKLY_INTERVAL_MS
  return Date.now() - dismissal.dismissedAt >= interval
}

function dismissRules(userId: string): void {
  const dismissal = readDismissal(userId)
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify({
      dismissedAt: Date.now(),
      dismissalCount: (dismissal?.dismissalCount || 0) + 1,
    }))
  } catch (error) {
    console.warn('[MaiTrollRulesPopup] Unable to save dismissal history.', error)
  }
}

export default function MaiTrollRulesPopup({ onDismiss }: { onDismiss?: () => void }) {
  const userId = useAuthStore((state) => state.user?.id)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const [show, setShow] = useState<boolean>(false)
  const storageUserId = userId || 'anonymous'

  useEffect(() => {
    if (isAuthLoading) {
      setShow(false)
      return
    }
    setShow(shouldShowRules(storageUserId))
  }, [isAuthLoading, storageUserId])

  if (!show) return null

  const handleDismiss = () => {
    dismissRules(storageUserId)
    setShow(false)
    onDismiss?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl border-4 border-[#bf00ff] bg-[#0a080f] rounded-3xl shadow-[0_0_60px_rgba(191,0,255,0.35)] overflow-hidden">
        {/* Masthead */}
        <div className="p-6 border-b border-[#bf00ff]/40 flex items-start gap-3 bg-[#0a080f]/80">
          <div className="flex items-center justify-center rounded-full border-2 border-[#39ff14] bg-[#39ff14]/10 p-1">
            <span className="text-[#39ff14] font-black text-xs">MAITROLL</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white tracking-tighter leading-tight">Mai Troll Rules</h1>
            <p className="text-[11px] text-[#bf00ff]/80 font-bold uppercase tracking-widest mt-1">City Ordinance • Bulletin</p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-bold text-white hover:bg-white/10 transition"
            title="Close"
          >
            <X size={12} /> Close
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Lede */}
          <p className="text-sm text-slate-300 italic leading-relaxed border-l-2 border-[#39ff14] pl-3 py-1 my-1">
            Welcome to Mai Troll — a virtual city. Have fun, broadcast, Battle, Send Gifts. We&rsquo;re just like TikTok, Bigo, Live Me and Favorited — except we&rsquo;re a city. More freedom, same common sense.
          </p>

          {/* Rules list */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 border-b border-white/5 pb-1">Main Rules</h2>
            <ul className="space-y-1 text-sm text-slate-200 leading-relaxed list-disc pl-5">
              <li>No exposed privates.</li>
              <li>All privates must be covered at all times.</li>
              <li>Nothing illegal per your jurisdiction, per state.</li>
              <li>No AI content lol.</li>
              <li>No bullying.</li>
              <li>No harassment.</li>
              <li>No soliciting.</li>
              <li>If you have a kid and leave kid on screen, officers will arrest you for a minimum of 30 mins in app.</li>
            </ul>
          </div>

          {/* Cashout note */}
          <div className="rounded-xl border border-[#39ff14]/30 bg-[#39ff14]/10 p-4">
            <p className="text-sm text-[#39ff14] font-bold mb-1 flex items-center gap-1">
              <span>💸</span> Daily Cashouts
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Get coins in a broadcast and cashout any time — once per day. Yes, you heard right.
            </p>
          </div>

          <div className="pt-2 text-[10px] text-slate-500 text-center uppercase tracking-widest">
            Mai Troll — run based as a city. Read it, heed it, broadcast it.
          </div>
        </div>
      </div>
    </div>
  )
}
