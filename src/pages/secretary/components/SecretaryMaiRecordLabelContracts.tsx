import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../lib/store';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FileText,
  Loader2,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';

interface ArtistOption {
  id: string
  stage_name: string
  user_profiles?: {
    username?: string | null
  } | null
}

interface ContractWithArtist {
  id: string
  artist_id: string
  contract_number: string
  tier: string
  artist_split_bps: number
  label_split_bps: number
  effective_at: string
  probation_ends_at?: string | null
  expires_at?: string | null
  status: string
  terms_version: string
  artist_signed_at?: string | null
  mai_accepted_at?: string | null
  notarized_at?: string | null
  notarized_by?: string | null
  document_id?: string | null
  created_at: string
  artist?: {
    stage_name: string
    status: string
    user_profiles?: {
      username?: string | null
    } | null
  } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending_signature: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  pending_notarization: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  terminated: 'bg-red-500/20 text-red-300 border-red-500/30',
  superseded: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

const TIER_COLORS: Record<string, string> = {
  probation: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  standard: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  tier_90_10: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  tier_95_5: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

export default function SecretaryMaiRecordLabelContracts() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState<ContractWithArtist[]>([])
  const [artists, setArtists] = useState<ArtistOption[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pendingSignature: 0,
    pendingNotarization: 0,
    probation: 0,
    terminated: 0,
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    artist_id: '',
    tier: 'probation',
    artist_split_bps: 5000,
    label_split_bps: 5000,
    effective_at: format(new Date(), 'yyyy-MM-dd'),
    probation_ends_at: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    expires_at: '',
    status: 'pending_signature',
    terms_version: '1.0',
  })

  const loadContracts = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('record_label_contracts')
        .select('*, artist:record_label_artist_profiles!inner(id, stage_name, status, user_profiles:user_id(username))')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as ContractWithArtist[]
      setContracts(rows)

      setStats({
        total: rows.length,
        active: rows.filter((c) => c.status === 'active').length,
        pendingSignature: rows.filter((c) => c.status === 'pending_signature').length,
        pendingNotarization: rows.filter((c) => c.status === 'pending_notarization').length,
        probation: rows.filter((c) => c.tier === 'probation').length,
        terminated: rows.filter((c) => c.status === 'terminated').length,
      })
    } catch (err: unknown) {
      console.error('Failed to load MAI Record Label contracts:', err)
      const message = err instanceof Error ? err.message : 'Failed to load contracts'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadArtists = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('record_label_artist_profiles')
        .select('id, stage_name, user_profiles:user_id(username)')
        .in('status', ['active', 'probation'])
        .order('stage_name', { ascending: true })

      if (error) throw error
      setArtists((data || []) as ArtistOption[])
    } catch (err) {
      console.error('Failed to load artists:', err)
    }
  }, [])

  useEffect(() => {
    loadContracts()
    loadArtists()
  }, [loadContracts, loadArtists])

  const resetForm = () => {
    setForm({
      artist_id: '',
      tier: 'probation',
      artist_split_bps: 5000,
      label_split_bps: 5000,
      effective_at: format(new Date(), 'yyyy-MM-dd'),
      probation_ends_at: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      expires_at: '',
      status: 'pending_signature',
      terms_version: '1.0',
    })
  }

  const handleCreateContract = async () => {
    if (!form.artist_id) {
      toast.error('Select an artist')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        artist_id: form.artist_id,
        tier: form.tier,
        artist_split_bps: form.artist_split_bps,
        label_split_bps: form.label_split_bps,
        effective_at: new Date(form.effective_at).toISOString(),
        status: form.status,
        terms_version: form.terms_version,
        created_by: user?.id,
      }

      if (form.probation_ends_at) {
        payload.probation_ends_at = new Date(form.probation_ends_at).toISOString()
      }
      if (form.expires_at) {
        payload.expires_at = new Date(form.expires_at).toISOString()
      }

      const { data, error } = await supabase
        .from('record_label_contracts')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      const contractContent = `
MAI RECORD LABEL ARTIST AGREEMENT
===============================
Contract Number: ${data.contract_number}
Date: ${format(new Date(), 'MMMM d, yyyy')}

PARTIES:
- Artist: ${artists.find(a => a.id === form.artist_id)?.stage_name || 'Artist'}
- Label: MAI Record Label

TERMS:
- Tier: ${form.tier}
- Artist Split: ${(form.artist_split_bps / 100).toFixed(0)}%
- Label Split: ${(form.label_split_bps / 100).toFixed(0)}%
- Effective Date: ${form.effective_at}
${form.probation_ends_at ? `- Probation Ends: ${form.probation_ends_at}` : ''}
${form.expires_at ? `- Expires: ${form.expires_at}` : ''}
- Terms Version: ${form.terms_version}

This contract is governed by the terms and conditions of MAI Record Label.
      `.trim()

      const { error: notaryError } = await supabase.rpc('create_contract_notary_document', {
        p_contract_id: data.id,
        p_contract_number: data.contract_number,
        p_artist_id: form.artist_id,
        p_artist_stage_name: artists.find(a => a.id === form.artist_id)?.stage_name || 'Artist',
        p_tier: form.tier,
        p_artist_split_bps: form.artist_split_bps,
        p_label_split_bps: form.label_split_bps,
        p_effective_at: new Date(form.effective_at).toISOString(),
        p_probation_ends_at: form.probation_ends_at ? new Date(form.probation_ends_at).toISOString() : null,
        p_expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        p_terms_version: form.terms_version,
        p_content: contractContent,
        p_created_by: user?.id,
      })

      if (notaryError) {
        console.error('Failed to create notary document:', notaryError)
        toast.error('Contract created but notary document failed. Please contact support.')
      } else {
        toast.success('Contract created and sent to artist for signature')

        await supabase.rpc('notify_artist_new_contract', {
          p_contract_id: data.id,
          p_artist_id: form.artist_id,
          p_contract_number: data.contract_number,
        })
      }

      setShowCreateModal(false)
      resetForm()
      await loadContracts()
    } catch (err: any) {
      console.error('Failed to create contract:', err)
      toast.error(err?.message || 'Failed to create contract')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            MAI Record Label Contracts
          </h2>
          <p className="text-sm text-slate-400">
            Review active contracts, splits, and status across the label.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Contract
          </button>
          <button
            onClick={loadContracts}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatBadge label="Total Contracts" value={stats.total} color="text-white" />
        <StatBadge label="Active" value={stats.active} color="text-emerald-300" />
        <StatBadge label="Pending Signature" value={stats.pendingSignature} color="text-yellow-300" />
        <StatBadge label="Pending Notarization" value={stats.pendingNotarization} color="text-orange-300" />
        <StatBadge label="Probation" value={stats.probation} color="text-blue-300" />
        <StatBadge label="Terminated" value={stats.terminated} color="text-red-300" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/90">
              <tr className="text-slate-300">
                <th className="px-4 py-3 text-left font-semibold">Contract #</th>
                <th className="px-4 py-3 text-left font-semibold">Artist</th>
                <th className="px-4 py-3 text-left font-semibold">Tier</th>
                <th className="px-4 py-3 text-left font-semibold">Split</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Effective</th>
                <th className="px-4 py-3 text-left font-semibold">Probation Ends</th>
                <th className="px-4 py-3 text-left font-semibold">Signed</th>
                <th className="px-4 py-3 text-left font-semibold">Notarized</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No contracts found
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="border-t border-slate-800/80 hover:bg-slate-900/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">
                      {contract.contract_number}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {contract.artist?.stage_name || '—'}
                      <span className="block text-xs text-slate-500">
                        @{contract.artist?.user_profiles?.username || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-black uppercase tracking-wider ${TIER_COLORS[contract.tier] || 'border-gray-500 text-gray-300'}`}>
                        {contract.tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {(contract.artist_split_bps / 100).toFixed(0)}% /{' '}
                      {(contract.label_split_bps / 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-black uppercase tracking-wider ${STATUS_COLORS[contract.status] || 'border-gray-500 text-gray-300'}`}>
                        {contract.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {format(new Date(contract.effective_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {contract.probation_ends_at
                        ? format(new Date(contract.probation_ends_at), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {contract.artist_signed_at
                        ? format(new Date(contract.artist_signed_at), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {contract.notarized_at
                        ? format(new Date(contract.notarized_at), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {contract.status === 'pending_notarization' && (
                        <button
                          onClick={async () => {
                            try {
                              const { error } = await supabase.rpc('notarize_contract_document', {
                                p_contract_id: contract.id,
                                p_document_id: contract.document_id,
                                p_notary_id: user?.id,
                                p_comments: 'Contract notarized by secretary',
                              })
                              if (error) throw error
                              toast.success('Contract notarized successfully')
                              await loadContracts()
                            } catch (err: any) {
                              toast.error(err?.message || 'Failed to notarize contract')
                            }
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Notarize
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Create Contract
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Artist</label>
                <select
                  value={form.artist_id}
                  onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                >
                  <option value="">Select artist...</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.stage_name} {artist.user_profiles?.username ? `(@${artist.user_profiles.username})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tier</label>
                  <select
                    value={form.tier}
                    onChange={(e) => setForm({ ...form, tier: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                  >
                    <option value="probation">Probation</option>
                    <option value="standard">Standard</option>
                    <option value="tier_90_10">90/10</option>
                    <option value="tier_95_5">95/5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                  >
                    <option value="pending_signature">Pending Signature</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Artist Split (%)</label>
                  <input
                    type="number"
                    value={form.artist_split_bps / 100}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                      setForm({ ...form, artist_split_bps: val * 100, label_split_bps: (100 - val) * 100 })
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Label Split (%)</label>
                  <input
                    type="number"
                    value={form.label_split_bps / 100}
                    readOnly
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500 opacity-70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={form.effective_at}
                    onChange={(e) => setForm({ ...form, effective_at: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Probation Ends</label>
                  <input
                    type="date"
                    value={form.probation_ends_at}
                    onChange={(e) => setForm({ ...form, probation_ends_at: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Expires At (optional)</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateContract}
                disabled={saving || !form.artist_id}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-black"
              >
                {saving ? 'Creating...' : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  )
}
