import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Play, Sparkles, Eye, Heart, Gift, BarChart3 } from 'lucide-react';
import { loadTreelzSettings, saveTreelzSettings, getUserTreelzAnalytics } from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function MobileTreelzSettingsPage() {
  const { user, profile: _profile } = useAuthStore()
  const [settings, setSettings] = useState(loadTreelzSettings())
  const [analytics, setAnalytics] = useState<any>(null)

  React.useEffect(() => {
    if (user) {
      getUserTreelzAnalytics(user.id).then(setAnalytics).catch(() => {})
    }
  }, [user])

  const updateSetting = (key: string, value: any) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveTreelzSettings(next)
  }

  return (
    <div className="min-h-screen bg-[#050715] text-white">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#050715]/90 px-4 py-3 backdrop-blur-xl">
        <Link to="/treelz" className="text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-sm font-black">Treelz Settings</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Analytics Section */}
        {analytics && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <BarChart3 className="h-3.5 w-3.5" />
              Your Analytics
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Views', value: analytics.views, icon: Eye, color: 'text-cyan-400' },
                { label: 'Total Trolls', value: analytics.trolls || 0, icon: Heart, color: 'text-pink-400' },
                { label: 'Watch Time', value: `${Math.round((analytics.watch_time || 0) / 60)}m`, icon: Play, color: 'text-green-400' },
                { label: 'Coins Earned', value: analytics.coins || 0, icon: Gift, color: 'text-yellow-400' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-1.5">
                    <stat.icon className={`h-3 w-3 ${stat.color}`} />
                    <span className="text-[10px] font-bold text-slate-400">{stat.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-white">{formatCount(stat.value)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Playback Settings */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
            <Play className="h-3.5 w-3.5" />
            Playback
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Auto-play Videos</p>
                <p className="text-[10px] text-slate-500">Videos play when scrolled into view</p>
              </div>
              <button
                onClick={() => updateSetting('autoPlayEnabled', !settings.autoPlayEnabled)}
                className={`h-6 w-11 rounded-full transition ${settings.autoPlayEnabled ? 'bg-cyan-500' : 'bg-white/20'}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition ${settings.autoPlayEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Auto-play Next</p>
                <p className="text-[10px] text-slate-500">Automatically go to next video when current ends</p>
              </div>
              <button
                onClick={() => updateSetting('autoPlayNext', !settings.autoPlayNext)}
                className={`h-6 w-11 rounded-full transition ${settings.autoPlayNext ? 'bg-cyan-500' : 'bg-white/20'}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition ${settings.autoPlayNext ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Sound On by Default</p>
                <p className="text-[10px] text-slate-500">Videos start with sound</p>
              </div>
              <button
                onClick={() => updateSetting('soundOnByDefault', !settings.soundOnByDefault)}
                className={`h-6 w-11 rounded-full transition ${settings.soundOnByDefault ? 'bg-cyan-500' : 'bg-white/20'}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow transition ${settings.soundOnByDefault ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Upload Settings */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            Upload
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-white">Upload Quality</p>
              <p className="mb-2 text-[10px] text-slate-500">Higher quality = larger file</p>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => updateSetting('uploadQuality', q)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                      settings.uploadQuality === q
                        ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                        : 'border-white/10 bg-white/5 text-slate-400'
                    }`}
                  >
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] text-slate-500">Max video length: <span className="font-bold text-white">10 minutes</span></p>
              <p className="text-[10px] text-slate-500">Max file size: <span className="font-bold text-white">250 MB</span></p>
              <p className="text-[10px] text-slate-500">Min video length: <span className="font-bold text-white">15 seconds</span></p>
            </div>
          </div>
        </section>

        {/* Links */}
        <section className="space-y-2">
          <Link to="/treelz/saved" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.08]">
            <span className="text-xs font-bold text-white">Saved Treelz</span>
            <span className="text-xs text-slate-500">→</span>
          </Link>
        </section>
      </div>
    </div>
  )
}
