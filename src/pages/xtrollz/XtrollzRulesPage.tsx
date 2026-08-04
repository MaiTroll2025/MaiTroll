import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

export default function XtrollzRulesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isAccepting, setIsAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  const currentVersion = '1.0'

  useEffect(() => {
    if (!user?.id) return

    const checkAcceptance = async () => {
      const { data } = await supabase
        .from('xtrollz_rules_acceptance')
        .select('id')
        .eq('user_id', user.id)
        .eq('rules_version', currentVersion)
        .maybeSingle()

      setAccepted(Boolean(data))
    }

    void checkAcceptance()
  }, [user?.id])

  const handleAccept = async () => {
    if (!user?.id || isAccepting) return

    setIsAccepting(true)
    setError('')

    try {
      const { error } = await supabase.from('xtrollz_rules_acceptance').insert({
        user_id: user.id,
        rules_version: currentVersion,
      })

      if (error) throw error
      setAccepted(true)
    } catch (e) {
      setError('Failed to save acceptance. Please try again.')
      console.warn('[XTrollzRules] acceptance error:', e)
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl p-4">
        <div className="flex items-center gap-3 py-4">
          <button
            type="button"
            onClick={() => navigate('/xtrollz')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-300/20 bg-pink-500/10 shadow-[0_0_22px_rgba(236,72,153,0.18)]">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">XTrollz Rules & Guidelines</h1>
              <p className="text-xs text-white/60">Version {currentVersion}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4 md:p-6">
          <div className="space-y-6 text-sm text-white/80">
            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h2 className="text-lg font-black text-white">Age Restriction</h2>
              <p className="mt-2 text-white/70">
                XTrollz is restricted to approved users who are at least 21 years old.
                Government-issued identification is required.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h2 className="text-lg font-black text-white">Content Rules</h2>
              <p className="mt-2 font-black text-red-300">NO FULL NUDITY IS ALLOWED.</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
                <li>Only the approved XTrollz streamer may appear in an XTrollz stream.</li>
                <li>No guests. No co-hosts. No second person may appear.</li>
                <li>No person under 21 may appear visually or audibly as a participant.</li>
                <li>Prohibited content includes full nudity, visible genitals, visible anus, explicit sexual acts, sexual violence, exploitation, trafficking, revenge content, or content involving minors.</li>
                <li>Hidden-camera sexual content, bestiality, forced sexual activity, and recorded content without permission are prohibited.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h2 className="text-lg font-black text-white">Staff Monitoring</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
                <li>XTrollz streams may be monitored by authorized Mai Troll staff, including private streams.</li>
                <li>Private stream passwords do not prevent authorized staff monitoring.</li>
                <li>Streamers cannot remove, mute, ban, or block authorized monitoring staff.</li>
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <h2 className="text-lg font-black text-white">Payments</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-white/70">
                <li>Troll Coins must be purchased in Mai Troll. XTrollz does not sell Troll Coins directly.</li>
                <li>XCoins are XTrollz earnings and are separately tracked.</li>
                <li>The $1 application fee does not guarantee approval.</li>
              </ul>
            </section>
          </div>

          <div className="mt-6">
            {accepted ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200">
                <CheckCircle2 size={16} />
                Rules accepted
              </div>
            ) : (
              <button
                type="button"
                disabled={!user || isAccepting}
                onClick={() => void handleAccept()}
                className="w-full rounded-xl bg-pink-600 px-4 py-3 text-sm font-black text-white hover:bg-pink-500 disabled:opacity-50"
              >
                {isAccepting ? 'Saving…' : 'I accept the XTrollz Rules & Guidelines'}
              </button>
            )}

            {error ? <p className="mt-2 text-xs text-white/60">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
