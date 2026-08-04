import React, { useState, useEffect } from 'react'
import { X, Sparkles, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useInstallPrompt } from '../../pwa/useInstallPrompt'
import { isStandalone, isIos } from '../../pwa/install'
import IosInstallModal from '../IosInstallModal'

export default function JoinPoster() {
  const [open, setOpen] = useState(false)
  const [showIosInstallModal, setShowIosInstallModal] = useState(false)
  const navigate = useNavigate()
  const { canPromptInstall, promptInstall } = useInstallPrompt()
  const [isPwaInstalled, setIsPwaInstalled] = useState(false)

  useEffect(() => {
    try {
      if (!sessionStorage.getItem('join_poster_seen')) {
        setOpen(true)
        sessionStorage.setItem('join_poster_seen', '1')
      }
    } catch {}

    setIsPwaInstalled(isStandalone())
  }, [])

  useEffect(() => {
    if (isStandalone()) {
      setOpen(false)
    }
  }, [isStandalone])

  const handleInstall = async () => {
    if (canPromptInstall) {
      const result = await promptInstall()
      if (result === 'accepted') {
        setShowIosInstallModal(false)
      }
    } else if (isIos()) {
      setShowIosInstallModal(true)
    }
  }

  if (!open) {
    const showInstallButton = !isPwaInstalled && (canPromptInstall || isIos());
    return (
      <button
        aria-label="Why Join"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-6 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 text-white shadow-[0_0_28px_rgba(99,102,241,0.45)] animate-pulse hover:scale-105 transition-transform"
      >
        <div className="relative">
          <Sparkles className="w-6 h-6" />
          {showInstallButton && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full"></div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="relative z-10 max-w-xl mx-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#071023]/90 to-[#0b1020]/90 p-6 shadow-2xl">
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300"
          aria-label="Close poster"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shadow-lg">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Why Join Mai Troll?</h3>
            <p className="mt-2 text-sm text-slate-300">Fast facts to get you started — no barriers, lots of rewards.</p>

            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>• Weekly payouts — 97% retained in cashouts</li>
              <li>• 100% coins are yours to keep</li>
              <li>• Create agencies without high level requirements</li>
              <li>• Work for Mai Troll and earn real rewards</li>
              <li>• Battle from day one — jump in immediately</li>
              <li>• Goo Live by Clicking Go live in sidebar</li>
              <li>• Cashout 1x per week</li>
              <li>• Cashout any day of the week</li>
              <li>• Go live without thousands of followers</li>
              <li>• Violations are handled seriously — not just bans</li>
              <li className="text-emerald-300 font-semibold">XXXX TROLL ON AND DONT GET ARRESTED XXXX</li>
            </ul>

            {!isPwaInstalled && (
              <div className="mt-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm mb-2">
                  <Download className="w-4 h-4" />
                  Install Official App
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  Get the Mai Troll app for the best experience with push notifications and instant loading.
                </p>
                <button
                  onClick={handleInstall}
                  className="w-full rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white hover:from-emerald-400 hover:to-teal-400 transition"
                >
                  {canPromptInstall ? 'Install App Now' : isIos() ? 'View Installation Instructions' : 'Get App'}
                </button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/join')}
                className="rounded-md bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-bold text-white"
              >
                Get Started
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>

      <IosInstallModal 
        isOpen={showIosInstallModal} 
        onClose={() => setShowIosInstallModal(false)}
        enableDontShowAgain={false}
      />
    </div>
  )
}
