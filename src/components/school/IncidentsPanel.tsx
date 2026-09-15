import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader, AlertTriangle, FileText, Shield, Plus, X, CheckCircle, Clock } from 'lucide-react'

interface Incident {
  id: string
  target_student_id: string | null
  stream_id: string | null
  incident_type: string
  severity: string
  description: string
  rule_violated: string | null
  status: string
  linked_report_id: string | null
  created_at: string
}

interface Rule {
  id: string
  rule_code: string
  title: string
  description: string
  category: string
  enforcement: string
  is_active: boolean
}

interface Props {
  institutionId: string
  institutionName: string
  isStaff: boolean
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-green-600/20 text-green-300',
  medium: 'bg-yellow-600/20 text-yellow-300',
  high: 'bg-orange-600/20 text-orange-300',
  critical: 'bg-red-600/20 text-red-300',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-600/20 text-red-300',
  under_review: 'bg-yellow-600/20 text-yellow-300',
  escalated: 'bg-purple-600/20 text-purple-300',
  resolved: 'bg-green-600/20 text-green-300',
  closed: 'bg-blue-600/20 text-blue-300',
}

export default function IncidentsPanel({ institutionId, institutionName, isStaff }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    incident_type: 'rule_violation',
    severity: 'medium',
    description: '',
    rule_violated: '',
  })

  const fetchAll = async () => {
    if (!institutionId) return
    try {
      const { data: inc } = await supabase.rpc('list_school_incidents', {
        p_institution_id: institutionId,
        p_limit: 100,
      })
      setIncidents(inc || [])

      const { data: r } = await supabase.rpc('list_school_rules', {
        p_institution_id: institutionId,
      })
      setRules(r || [])
    } catch (err) {
      console.error('Error fetching incidents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [institutionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!institutionId || !form.description.trim()) return
    setSubmitting(true)
    try {
      await supabase.rpc('file_school_incident', {
        p_institution_id: institutionId,
        p_incident_type: form.incident_type,
        p_severity: form.severity,
        p_description: form.description,
        p_rule_violated: form.rule_violated || undefined,
      })
      setForm({ incident_type: 'rule_violation', severity: 'medium', description: '', rule_violated: '' })
      setShowForm(false)
      await fetchAll()
    } catch (err) {
      console.error('Error filing incident:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (id: string, status: string) => {
    try {
      await supabase.rpc('update_school_incident', {
        p_incident_id: id,
        p_status: status,
        p_resolution_notes: 'Resolved by staff.',
      })
      await fetchAll()
    } catch (err) {
      console.error('Error resolving incident:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-white size-8" />
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">School Incidents & Rule Violations</h2>
          <p className="text-white/60 text-sm">{institutionName}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-white rounded-lg border border-purple-500/50 transition"
        >
          <Plus className="size-4" />
          File Incident
        </button>
      </div>

      {showForm && (
        <div className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">File New Incident</h3>
            <button onClick={() => setShowForm(false)} className="text-white/60 hover:text-white">
              <X className="size-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Incident Type</label>
                <select
                  value={form.incident_type}
                  onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="rule_violation">Rule Violation</option>
                  <option value="harassment">Harassment</option>
                  <option value="bullying">Bullying</option>
                  <option value="explicit_content">Explicit Content</option>
                  <option value="violence">Violence</option>
                  <option value="hate_speech">Hate Speech</option>
                  <option value="spam">Spam</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-white/70 text-sm mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Rule Violated (optional)</label>
              <select
                value={form.rule_violated}
                onChange={(e) => setForm({ ...form, rule_violated: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">No specific rule</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.rule_code}>
                    {r.rule_code} - {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Describe the incident..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.description.trim()}
                className="px-4 py-2 bg-purple-600/40 hover:bg-purple-600/60 text-white rounded-lg border border-purple-500/50 transition disabled:opacity-50"
              >
                {submitting ? 'Filing...' : 'File Incident'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Active Incidents</h3>
          {incidents.filter(i => i.status !== 'resolved' && i.status !== 'closed').length === 0 ? (
            <p className="text-white/40 text-sm">No active incidents.</p>
          ) : (
            <div className="space-y-3">
              {incidents
                .filter(i => i.status !== 'resolved' && i.status !== 'closed')
                .map((inc) => (
                  <div key={inc.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SEVERITY_COLORS[inc.severity]}`}>
                            {inc.severity.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded text-xs font-semibold">
                            {inc.incident_type.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[inc.status]}`}>
                            {inc.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-white/80 text-sm">{inc.description}</p>
                        {inc.rule_violated && (
                          <p className="text-white/50 text-xs mt-1">Rule: {inc.rule_violated}</p>
                        )}
                        <p className="text-white/40 text-xs mt-2">
                          {new Date(inc.created_at).toLocaleString()}
                        </p>
                      </div>
                      {isStaff && inc.status === 'open' && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleResolve(inc.id, 'under_review')}
                            className="px-2 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-200 rounded text-xs transition"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleResolve(inc.id, 'resolved')}
                            className="px-2 py-1 bg-green-600/30 hover:bg-green-600/50 text-green-200 rounded text-xs transition"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Resolved / Closed</h3>
          {incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length === 0 ? (
            <p className="text-white/40 text-sm">No resolved incidents yet.</p>
          ) : (
            <div className="space-y-3">
              {incidents
                .filter(i => i.status === 'resolved' || i.status === 'closed')
                .map((inc) => (
                  <div key={inc.id} className="bg-white/5 border border-white/10 rounded-lg p-4 opacity-75">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="size-4 text-green-400" />
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-600/20 text-green-300">
                        {inc.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-white/50 text-xs">
                        {new Date(inc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-white/70 text-sm">{inc.description}</p>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="size-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">School Code of Conduct</h3>
          <span className="text-white/40 text-sm ml-auto">{rules.length} rules</span>
        </div>
        {rules.length === 0 ? (
          <p className="text-white/40 text-sm">No rules defined yet. Staff can add rules to set expectations.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="px-2 py-1 bg-[#6366f1]/20 text-[#a5b4fc] rounded text-xs font-semibold whitespace-nowrap">
                    {rule.rule_code}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-semibold text-sm">{rule.title}</h4>
                      <span className="text-white/40 text-xs">•</span>
                      <span className="text-white/50 text-xs">{rule.category.replace(/_/g, ' ')}</span>
                      <span className="text-white/40 text-xs ml-auto">{rule.enforcement}</span>
                    </div>
                    <p className="text-white/70 text-sm">{rule.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-3">How Incidents Are Handled</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-white/80">
          <div>
            <p className="font-semibold text-white mb-2">1. File Incident</p>
            <p>Instructors report rule violations with severity and description.</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">2. Route to Moderation</p>
            <p>Incidents automatically create a moderation report so career/mod roles can act.</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">3. Resolve & Record</p>
            <p>Staff resolve incidents and maintain a complete compliance trail.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
