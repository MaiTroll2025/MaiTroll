import React, { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { X, Gavel, Plus, Trash2, Coins, AlertTriangle, CheckCircle } from 'lucide-react'

interface JudgeSentencingModalProps {
  isOpen: boolean
  onClose: () => void
  caseData: any
  onSuccess?: () => void
}

const SENTENCE_TYPES = [
  { value: 'jail', label: 'Jail / Arrest', defaultDuration: 1440, unit: 'minutes' },
  { value: 'broadcast_restriction', label: 'Broadcast Restriction', defaultDuration: 1440, unit: 'minutes' },
  { value: 'chat_restriction', label: 'Chat Restriction', defaultDuration: 360, unit: 'minutes' },
  { value: 'cashout_restriction', label: 'Cash-out Restriction', defaultDuration: 4320, unit: 'minutes' },
  { value: 'license_suspension', label: 'License Suspension', defaultDuration: 10080, unit: 'minutes' },
] as const

type SentenceType = (typeof SENTENCE_TYPES)[number]['value']

interface SentenceItem {
  id: string
  type: SentenceType
  duration_minutes: number
  duration_text: string
  start_immediately: boolean
}

export default function JudgeSentencingModal({ isOpen, onClose, caseData, onSuccess }: JudgeSentencingModalProps) {
  const { user, profile } = useAuthStore()
  const [sentences, setSentences] = useState<SentenceItem[]>([])
  const [selectedType, setSelectedType] = useState<SentenceType>('jail')
  const [durationMinutes, setDurationMinutes] = useState(1440)
  const [fineAmount, setFineAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const addSentence = () => {
    const typeConfig = SENTENCE_TYPES.find((t) => t.value === selectedType)
    const durationText = formatDuration(durationMinutes)

    setSentences((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: selectedType,
        duration_minutes: durationMinutes,
        duration_text: durationText,
        start_immediately: true,
      },
    ])

    setDurationMinutes(typeConfig?.defaultDuration ?? 60)
    setSelectedType('jail')
  }

  const removeSentence = (id: string) => {
    setSentences((prev) => prev.filter((s) => s.id !== id))
  }

  const handleIssueSentence = async () => {
    if (!caseData?.id) return
    if (!caseData?.defendant_id) {
      toast.error('This case has no defendant assigned. Assign a defendant before issuing a sentence.')
      return
    }
    if (sentences.length === 0 && fineAmount <= 0) {
      toast.error('Add at least one sentence or fine before issuing.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('issue_court_sentence', {
        p_case_id: caseData.id,
        p_sentences: sentences,
        p_fine_amount: fineAmount,
      })

      if (error) throw error

      // Handle jail separately via existing jail system
      const jailSentences = sentences.filter((s) => s.type === 'jail')
      for (const jail of jailSentences) {
        const releaseTime = new Date()
        releaseTime.setMinutes(releaseTime.getMinutes() + jail.duration_minutes)

        const { data: existingJail } = await supabase
          .from('jail')
          .select('id')
          .eq('user_id', caseData.defendant_id)
          .maybeSingle()

        if (existingJail) {
          await supabase
            .from('jail')
            .update({
              release_time: releaseTime.toISOString(),
              reason: `Court sentence - Case #${String(caseData.id).slice(0, 8)}`,
              sentence_days: Math.max(1, Math.ceil(jail.duration_minutes / 1440)),
              status: 'jailed',
            })
            .eq('id', existingJail.id)
        } else {
          await supabase.from('jail').insert({
            user_id: caseData.defendant_id,
            release_time: releaseTime.toISOString(),
            reason: `Court sentence - Case #${String(caseData.id).slice(0, 8)}`,
            sentence_days: Math.max(1, Math.ceil(jail.duration_minutes / 1440)),
            arrested_by: user?.id,
            status: 'jailed',
          })
        }

        await supabase
          .from('user_profiles')
          .update({ is_jailed: true })
          .eq('id', caseData.defendant_id)
      }

      // Handle license suspension via existing driver license system
      const licenseSentences = sentences.filter((s) => s.type === 'license_suspension')
      for (const license of licenseSentences) {
        const suspendedUntil = new Date()
        suspendedUntil.setMinutes(suspendedUntil.getMinutes() + license.duration_minutes)

        await supabase
          .from('user_driver_licenses')
          .upsert(
            {
              user_id: caseData.defendant_id,
              status: 'suspended',
              suspended_until: suspendedUntil.toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
      }

      toast.success('Sentence issued successfully')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('Error issuing sentence:', err)
      toast.error(err?.message || 'Failed to issue sentence')
    } finally {
      setLoading(false)
      setShowConfirm(false)
      setSentences([])
      setFineAmount(0)
    }
  }

  const summarySentences = useMemo(() => {
    return sentences.map((s) => {
      const typeConfig = SENTENCE_TYPES.find((t) => t.value === s.type)
      return {
        ...s,
        label: typeConfig?.label ?? s.type,
      }
    })
  }, [sentences])

  if (!isOpen || !caseData) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#120F1D] border border-red-500/30 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1A1625]">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/20 p-2 rounded-lg">
              <Gavel className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Issue Sentence</h2>
              <p className="text-xs text-gray-400">
                Case #{String(caseData.id).slice(0, 8)} • Defendant: {caseData.defendant?.username || 'Unknown'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {!showConfirm ? (
          <>
            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Add Sentence */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h3 className="text-sm font-bold text-red-400 mb-3 uppercase tracking-wider">Add Punishment</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={selectedType}
                    onChange={(e) => {
                      const newType = e.target.value as SentenceType
                      setSelectedType(newType)
                      const config = SENTENCE_TYPES.find((t) => t.value === newType)
                      if (config) setDurationMinutes(config.defaultDuration)
                    }}
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                  >
                    {SENTENCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-32 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                    placeholder="Minutes"
                  />

                  <button
                    onClick={addSentence}
                    className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>

              {/* Sentences List */}
              {sentences.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Selected Sentences</h3>
                  {sentences.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {SENTENCE_TYPES.find((t) => t.value === s.type)?.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          Duration: {s.duration_text} • Starts immediately
                        </p>
                      </div>
                      <button
                        onClick={() => removeSentence(s.id)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Fine */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h3 className="text-sm font-bold text-amber-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Coins size={16} />
                  Troll Coin Fine (Admin Pool)
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-400">Coins</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Fines are transferred to the existing Admin Pool. Do not hard-code amounts.
                </p>
              </div>

              {/* Case Summary */}
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Case Summary</h3>
                <p className="text-sm text-gray-300">
                  Defendant: <span className="font-bold text-white">{caseData.defendant?.username || 'Unknown'}</span>
                </p>
                {!caseData?.defendant_id && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    No defendant assigned. Assign a defendant before issuing a sentence.
                  </p>
                )}
                <p className="text-sm text-gray-300">
                  Reason: <span className="font-bold text-white">{caseData.reason || caseData.description || 'N/A'}</span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-[#1A1625] flex items-center justify-between">
              <div className="text-xs text-gray-500">
                * All sentences are final and recorded in the immutable court ledger.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={sentences.length === 0 && fineAmount <= 0 || !caseData?.defendant_id}
                  className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  Review Sentence
                  <Gavel size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                <h3 className="text-lg font-bold text-red-300 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  CASE #{String(caseData.id).slice(0, 8)}
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Defendant</p>
                    <p className="text-sm font-bold text-white">{caseData.defendant?.username || 'Unknown'}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Sentence</p>
                    <div className="space-y-1">
                      {summarySentences.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{s.label}</span>
                          <span className="font-bold text-white">{s.duration_text}</span>
                        </div>
                      ))}
                      {fineAmount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">Troll Coin Fine</span>
                          <span className="font-bold text-amber-300">{fineAmount.toLocaleString()} Coins</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
                <p className="text-xs text-amber-200/70">
                  Once confirmed, all punishments will take effect immediately. Temporary restrictions will
                  automatically expire at their end time. Troll Coin fines will be transferred to the Admin Pool.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-[#1A1625] flex items-center justify-between">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleIssueSentence}
                disabled={loading || !caseData?.defendant_id}
                className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Issuing...' : 'Issue Sentence'}
                <Gavel size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 minutes'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} min` : `${hours} hour${hours > 1 ? 's' : ''}`
  }
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (hours > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`
  }
  return `${days} day${days > 1 ? 's' : ''}`
}
