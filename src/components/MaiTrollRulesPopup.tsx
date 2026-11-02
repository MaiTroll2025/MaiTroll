import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const RULES_STORAGE_KEY = 'maitroll_rules_dismissed_at'
const RULES_TTL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

function shouldShowRules(): boolean {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY)
    if (!raw) return true
    const dismissedAt = Number(raw)
    if (isNaN(dismissedAt)) return true
    return Date.now() - dismissedAt < RULES_TTL_MS
  } catch {
    return true
  }
}

function dismissRules(): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, Date.now().toString())
  } catch {
    // ignore
  }
}

export default function MaiTrollRulesPopup({ onDismiss }: { onDismiss?: () => void }) {
  const [show, setShow] = useState<boolean>(false)

  useEffect(() => {
    setShow(shouldShowRules())
  }, [])

  if (!show) return null

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
            onClick={() => { dismissRules(); setShow(false); onDismiss?.() }}
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
