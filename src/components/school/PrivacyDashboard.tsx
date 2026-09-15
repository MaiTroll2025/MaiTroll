import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Shield, Lock, FileText, Eye, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface PrivacySettings {
  id: string
  institution_id: string
  ferpa_mode_enabled: boolean
  restricted_mode: boolean
  require_parental_consent: boolean
  minor_age_threshold: number
  allow_student_opt_out: boolean
  audit_data_access: boolean
  require_annual_privacy_agreement: boolean
  privacy_agreement_version: string
  compliance_notes?: string
}

interface AgreementStatus {
  agreement_version: string
  status: string
  signed_at: string | null
  expires_at: string | null
}

interface AuditEntry {
  id: string
  viewer_user_id: string
  viewed_user_id: string
  action: string
  description: string | null
  source: string | null
  created_at: string
}

interface Props {
  institutionId: string
  institutionName: string
  isInstructor: boolean
  isStaff: boolean
}

export default function PrivacyDashboard({ institutionId, institutionName, isInstructor, isStaff }: Props) {
  const { user, profile } = useAuthStore()
  const [settings, setSettings] = useState<PrivacySettings | null>(null)
  const [agreement, setAgreement] = useState<AgreementStatus | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchAll = async () => {
    if (!institutionId) return
    try {
      const { data: s } = await supabase.rpc('get_institution_privacy_settings', {
        p_institution_id: institutionId
      })
      setSettings(s || null)

      if (isInstructor) {
        const { data: a } = await supabase.rpc('get_instructor_privacy_agreement_status', {
          p_institution_id: institutionId
        })
        setAgreement(a || null)
      }

      if (isStaff) {
        const { data: audit } = await supabase.rpc('get_data_access_audit_log', {
          p_institution_id: institutionId,
          p_limit: 50
        })
        setAuditLog(audit || [])
      }
    } catch (err) {
      console.error('Error fetching privacy data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [institutionId, isInstructor, isStaff])

  const handleSignAgreement = async () => {
    if (!institutionId) return
    setSigning(true)
    try {
      await supabase.rpc('sign_instructor_privacy_agreement', {
        p_institution_id: institutionId
      })
      await fetchAll()
    } catch (err) {
      console.error('Error signing agreement:', err)
    } finally {
      setSigning(false)
    }
  }

  const handleExportAudit = async () => {
    if (!institutionId) return
    setExporting(true)
    try {
      const { data: audit } = await supabase.rpc('get_data_access_audit_log', {
        p_institution_id: institutionId,
        p_limit: 10000
      })
      const rows = audit || []
      const header = 'ID,Viewer,Viewed,Action,Description,Source,CreatedAt\n'
      const csv = rows.map(r =>
        [r.id, r.viewer_user_id, r.viewed_user_id, r.action, r.description || '', r.source || '', r.created_at].join(',')
      ).join('\n')
      const blob = new Blob([header + csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `data-access-audit-${institutionId}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting audit log:', err)
    } finally {
      setExporting(false)
    }
  }

  const toggleSetting = async (key: string, value: boolean | number) => {
    if (!institutionId || !isStaff) return
    try {
      const payload: any = { p_institution_id: institutionId }
      payload['p_' + key] = value
      const { data } = await supabase.rpc('update_institution_privacy_settings', payload)
      if (data) setSettings(data)
    } catch (err) {
      console.error('Error updating setting:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-white size-8" />
      </div>
    )
  }

const isSigned = agreement?.status === 'signed'
  const needsSigning = isInstructor && agreement && agreement.status !== 'signed'
  const hasAgreement = isInstructor && agreement && agreement.status === 'signed'
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Privacy & FERPA Compliance</h2>
          <p className="text-white/60 text-sm">{institutionName}</p>
        </div>
        {isStaff && (
          <button
            onClick={handleExportAudit}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-[#6366f1]/30 hover:bg-[#6366f1]/40 text-white rounded-lg border border-[#6366f1]/50 transition disabled:opacity-50"
          >
            <FileText className="size-4" />
            {exporting ? 'Exporting...' : 'Export Audit (CSV)'}
          </button>
        )}
      </div>

      {needsSigning && (
        <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 text-yellow-400" />
            <div>
              <p className="text-white text-sm font-semibold">Annual privacy agreement required</p>
              <p className="text-white/60 text-xs">Sign the FERPA privacy agreement to continue accessing student data.</p>
            </div>
          </div>
          <button
            onClick={handleSignAgreement}
            disabled={signing}
            className="px-4 py-2 bg-yellow-600/40 hover:bg-yellow-600/60 text-yellow-100 rounded-lg border border-yellow-500/50 transition text-sm font-semibold disabled:opacity-50"
          >
            {signing ? 'Signing...' : 'Sign Agreement'}
          </button>
        </div>
      )}

      {hasAgreement && (
        <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="size-5 text-green-400" />
          <div>
            <p className="text-white text-sm font-semibold">Privacy agreement signed</p>
            <p className="text-white/60 text-xs">
              Version {agreement?.agreement_version} signed on{' '}
              {agreement?.signed_at ? new Date(agreement.signed_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="size-6 text-green-400" />
            <h3 className="text-xl font-bold text-white">FERPA Compliance</h3>
            {settings?.ferpa_mode_enabled ? (
              <CheckCircle className="size-5 text-green-400 ml-auto" />
            ) : (
              <XCircle className="size-5 text-red-400 ml-auto" />
            )}
          </div>
          <div className="space-y-3 text-sm text-white/70">
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Student data is encrypted and access-controlled</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Verified email addresses used for authentication only</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>Complete audit logs of all data access by staff</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-1">✓</span>
              <span>RLS policies restrict access to institution members only</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-sm">FERPA Mode</span>
              {isStaff ? (
                <button
                  onClick={() => toggleSetting('ferpa_mode_enabled', !settings?.ferpa_mode_enabled)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    settings?.ferpa_mode_enabled
                      ? 'bg-green-600/30 text-green-200'
                      : 'bg-red-600/30 text-red-200'
                  }`}
                >
                  {settings?.ferpa_mode_enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              ) : (
                <span className={`text-xs font-semibold ${
                  settings?.ferpa_mode_enabled ? 'text-green-400' : 'text-red-400'
                }`}>
                  {settings?.ferpa_mode_enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="size-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Access Controls</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Restricted Mode</span>
              <span className={`text-xs font-semibold ${
                settings?.restricted_mode ? 'text-green-400' : 'text-red-400'
              }`}>
                {settings?.restricted_mode ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Parental Consent Required</span>
              <span className={`text-xs font-semibold ${
                settings?.require_parental_consent ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {settings?.require_parental_consent ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Minor Age Threshold</span>
              <span className="text-white/70 text-xs">{settings?.minor_age_threshold}+</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Student Opt-Out Allowed</span>
              <span className={`text-xs font-semibold ${
                settings?.allow_student_opt_out ? 'text-green-400' : 'text-red-400'
              }`}>
                {settings?.allow_student_opt_out ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Audit Data Access</span>
              <span className={`text-xs font-semibold ${
                settings?.audit_data_access ? 'text-green-400' : 'text-red-400'
              }`}>
                {settings?.audit_data_access ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="size-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">Data Access Audit Log</h3>
          <span className="text-white/40 text-sm ml-auto">{auditLog.length} records</span>
        </div>
        {auditLog.length === 0 ? (
          <p className="text-white/40 text-sm">No data access events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 border-b border-white/10">
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4">Source</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white/60 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-1 bg-[#6366f1]/20 text-[#a5b4fc] rounded text-xs font-semibold">
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-white/70">{entry.description || '—'}</td>
                    <td className="py-2 pr-4 text-white/50 text-xs">{entry.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-3">What Data We Collect</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold text-green-400 mb-2">Collected (for auth & verification)</p>
            <ul className="space-y-1 text-white/70">
              <li>• Verified email address</li>
              <li>• Institution affiliation</li>
              <li>• Program/department field</li>
              <li>• Verification status</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-red-400 mb-2">Never Collected</p>
            <ul className="space-y-1 text-white/70">
              <li>• Phone numbers</li>
              <li>• Physical location / GPS</li>
              <li>• Social Security Numbers</li>
              <li>• Financial account details</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
