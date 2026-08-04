import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Megaphone,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import OrganizationCard from '@/components/organizations/OrganizationCard'
import OrganizationMessages from '@/components/organizations/OrganizationMessages'
import OrganizationFiles from '@/components/organizations/OrganizationFiles'
import OrganizationMembers from '@/components/organizations/OrganizationMembers'
import OrganizationAuditLog from '@/components/organizations/OrganizationAuditLog'
import {
  isOrgStaffProfile,
  useOrganizations,
  type OrganizationRecord,
} from '@/hooks/useOrganizations'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const tabs = ['overview', 'messages', 'files', 'members', 'announcements', 'audit'] as const
type OrgTab = (typeof tabs)[number]

const statusClasses: Record<string, string> = {
  active: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200',
  onboarding: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-200',
  suspended: 'border-red-300/30 bg-red-500/10 text-red-200',
  dropped: 'border-slate-400/30 bg-slate-500/10 text-slate-300',
}

const tabIcons: Record<OrgTab, React.ReactNode> = {
  overview: <ShieldCheck className="h-4 w-4" />,
  messages: <MessageCircle className="h-4 w-4" />,
  files: <FileText className="h-4 w-4" />,
  members: <Users className="h-4 w-4" />,
  announcements: <Megaphone className="h-4 w-4" />,
  audit: <CheckCircle2 className="h-4 w-4" />,
}

const pageShell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050714] px-4 pb-8 pt-24 text-white md:px-6'
const glassPanel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const innerPanel =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const inputClass =
  'rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15'
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'

function EmptyState() {
  return (
    <div className={cn(innerPanel, 'flex h-full min-h-[420px] flex-col items-center justify-center p-8 text-center')}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
        <Building2 className="h-8 w-8 text-cyan-200" />
      </div>
      <h2 className="text-xl font-black text-white">No Organization Selected</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        Create an organization or select one from the list to manage staff, students, files,
        messages, announcements, and audit history.
      </p>
    </div>
  )
}

function CreateOrganizationForm({
  onCreate,
}: {
  onCreate: (values: Partial<OrganizationRecord>) => Promise<OrganizationRecord | null>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    org_type: 'orphanage',
    primary_contact_name: '',
    primary_contact_phone: '',
    description: '',
    is_public: false,
  })

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Organization name is required')
      return
    }

    setSaving(true)

    try {
      const created = await onCreate(form)

      if (created) {
        setOpen(false)
        setForm({
          name: '',
          email: '',
          org_type: 'orphanage',
          primary_contact_name: '',
          primary_contact_phone: '',
          description: '',
          is_public: false,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={primaryBtn}>
        <Plus className="h-4 w-4" />
        New Organization
      </button>
    )
  }

  return (
    <div className={cn(innerPanel, 'p-4')}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Create Organization</h3>
          <p className="text-sm text-slate-400">Add a partner organization to the MAI Class ecosystem.</p>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-500/20">
          Cancel
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Organization name"
          className={inputClass}
        />

        <input
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="Primary email"
          className={inputClass}
        />

        <select
          value={form.org_type}
          onChange={(event) => setForm((prev) => ({ ...prev, org_type: event.target.value }))}
          className={inputClass}
        >
          <option value="orphanage" className="bg-slate-950">Orphanage</option>
          <option value="school" className="bg-slate-950">School</option>
          <option value="nonprofit" className="bg-slate-950">Nonprofit</option>
          <option value="business" className="bg-slate-950">Business</option>
          <option value="program" className="bg-slate-950">Program</option>
        </select>

        <input
          value={form.primary_contact_name}
          onChange={(event) => setForm((prev) => ({ ...prev, primary_contact_name: event.target.value }))}
          placeholder="Primary contact"
          className={inputClass}
        />

        <input
          value={form.primary_contact_phone}
          onChange={(event) => setForm((prev) => ({ ...prev, primary_contact_phone: event.target.value }))}
          placeholder="Phone"
          className={inputClass}
        />

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 text-sm font-bold text-cyan-100">
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(event) => setForm((prev) => ({ ...prev, is_public: event.target.checked }))}
            className="h-4 w-4 accent-cyan-300"
          />
          Visible to regular users
        </label>

        <textarea
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Notes / description"
          className={cn(inputClass, 'h-24 resize-none md:col-span-2')}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className={secondaryBtn}>
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className={primaryBtn}>
          {saving ? 'Creating...' : 'Create Organization'}
        </button>
      </div>
    </div>
  )
}

export default function OrganizationDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuthStore() as any
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedOrgId = searchParams.get('orgId')
  const requestedTab = (searchParams.get('tab') as OrgTab | null) || 'overview'
  const [activeTab, setActiveTab] = useState<OrgTab>(
    tabs.includes(requestedTab as OrgTab) ? requestedTab : 'overview'
  )

  const {
    organizations,
    selectedOrg,
    setSelectedOrg,
    memberCounts,
    loading,
    isStaff,
    reload,
    createOrganization,
    updateOrganization,
    setOrganizationStatus,
  } = useOrganizations(requestedOrgId)

  const canAccess = Boolean(
    (profile && profile.organization_id) || isOrgStaffProfile(profile)
  )

  const canManageSelected = useMemo(() => {
    if (!selectedOrg) return false
    return isStaff || selectedOrg.admin_user_id === profile?.id
  }, [isStaff, profile?.id, selectedOrg])

  if (!profile) {
    navigate('/auth', { replace: true })
    return null
  }

  if (!canAccess) {
    return (
      <div className={pageShell}>
        <BackgroundFX />

        <div className="relative z-10 mx-auto max-w-xl">
          <div className="rounded-[2rem] border border-red-300/25 bg-red-500/10 p-6 shadow-[0_0_45px_rgba(239,68,68,0.16)] backdrop-blur-2xl">
            <h1 className="text-xl font-black text-red-100">Organization Access Required</h1>
            <p className="mt-2 text-sm text-red-100/80">
              Organization access is available to Mai Troll staff and organization accounts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const chooseOrg = (org: OrganizationRecord, tab: OrgTab = activeTab) => {
    setSelectedOrg(org)
    setActiveTab(tab)
    setSearchParams({ orgId: org.id, tab })
  }

  const chooseTab = (tab: OrgTab) => {
    setActiveTab(tab)
    if (selectedOrg) setSearchParams({ orgId: selectedOrg.id, tab })
  }

  const toggleVisibility = async () => {
    if (!selectedOrg) return

    const updated = await updateOrganization(selectedOrg.id, {
      is_public: !selectedOrg.is_public,
    })

    if (updated) {
      toast.success(
        updated.is_public
          ? 'Organization visible to regular users'
          : 'Organization hidden from regular users'
      )
    }
  }

  return (
    <div className={pageShell}>
      <BackgroundFX />

      <div className="relative z-10 mx-auto flex h-[calc(100vh-120px)] max-w-7xl flex-col gap-4">
        <header className={cn(glassPanel, 'shrink-0 p-5')}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Building2 className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                    Organization Management
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    MAI Class partner hub for staff, students, files, messages, and audit actions.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => reload()} className={secondaryBtn}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>

              {isStaff && <CreateOrganizationForm onCreate={createOrganization} />}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_1fr]">
          <aside className={cn(glassPanel, 'min-h-0 overflow-hidden p-3')}>
            <div className="mb-3 flex items-center justify-between px-2">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">
                  Organizations
                </h2>
                <p className="text-xs text-slate-500">{organizations.length} total records</p>
              </div>
            </div>

            <div className="h-[calc(100%-48px)] overflow-y-auto pr-1">
              {loading && (
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-sm text-cyan-100">
                  Loading organizations...
                </div>
              )}

              {!loading && organizations.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-500">
                  No organizations yet.
                </div>
              )}

              <div className="space-y-3">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className={cn(
                      'rounded-2xl border transition',
                      selectedOrg?.id === org.id
                        ? 'border-cyan-300/45 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                        : 'border-transparent'
                    )}
                  >
                    <OrganizationCard
                      organization={org}
                      memberCount={memberCounts[org.id] || org.current_student_count || 0}
                      selected={selectedOrg?.id === org.id}
                      onOpen={() => chooseOrg(org)}
                      onQuickTab={(tab) => chooseOrg(org, tab as OrgTab)}
                      onStatus={(status) => setOrganizationStatus(org.id, status)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="min-h-0 overflow-hidden">
            {!selectedOrg ? (
              <EmptyState />
            ) : selectedOrg.status === 'suspended' || selectedOrg.status === 'dropped' ? (
              <div className={cn(glassPanel, 'flex h-full min-h-0 flex-col gap-4 p-6')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-white">{selectedOrg.name}</h2>
                    <p className="mt-1 text-sm text-red-200">
                      This organization is {selectedOrg.status}. Member access to files and messages is restricted.
                    </p>
                  </div>

                  {isStaff && (
                    <button
                      onClick={() => setOrganizationStatus(selectedOrg.id, 'active')}
                      className={primaryBtn}
                    >
                      Restore Organization
                    </button>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                  <OrganizationAuditLog organization={selectedOrg} />
                </div>
              </div>
            ) : (
              <div className={cn(glassPanel, 'flex h-full min-h-0 flex-col overflow-hidden')}>
                <div className="shrink-0 border-b border-cyan-300/15 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black text-white">{selectedOrg.name}</h2>

                        <span
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em]',
                            statusClasses[selectedOrg.status] || statusClasses.onboarding
                          )}
                        >
                          {selectedOrg.status}
                        </span>

                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 p-1.5">
                          {selectedOrg.is_public ? (
                            <Eye className="h-4 w-4 text-cyan-200" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-slate-500" />
                          )}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {selectedOrg.primary_contact_email || selectedOrg.email || 'No email'} •{' '}
                        {selectedOrg.org_type || 'program'}
                      </p>
                    </div>

                    {canManageSelected && (
                      <button onClick={toggleVisibility} className={secondaryBtn}>
                        {selectedOrg.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {selectedOrg.is_public ? 'Hide Profile' : 'Show Profile'}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => chooseTab(tab)}
                        className={cn(
                          'inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black capitalize transition',
                          activeTab === tab
                            ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
                            : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:text-white'
                        )}
                      >
                        {tabIcons[tab]}
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  {activeTab === 'overview' && (
                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className={cn(innerPanel, 'p-5 xl:col-span-2')}>
                        <h3 className="mb-4 text-lg font-black text-white">Overview</h3>

                        <div className="grid gap-3 text-sm md:grid-cols-2">
                          <InfoRow label="Contact" value={selectedOrg.primary_contact_name || 'Not set'} />
                          <InfoRow label="Email" value={selectedOrg.primary_contact_email || selectedOrg.email || 'Not set'} />
                          <InfoRow label="Phone" value={selectedOrg.primary_contact_phone || selectedOrg.phone || 'Not set'} />
                          <InfoRow
                            label="Students"
                            value={`${selectedOrg.current_student_count || 0}/${selectedOrg.student_limit || 100}`}
                          />
                        </div>

                        <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300">
                          {selectedOrg.description || 'No public description yet.'}
                        </p>

                        {selectedOrg.notes && (
                          <p className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-sm text-slate-400">
                            {selectedOrg.notes}
                          </p>
                        )}
                      </div>

                      <div className={cn(innerPanel, 'p-5')}>
                        <h3 className="mb-4 text-lg font-black text-white">Quick Checks</h3>

                        <div className="space-y-3 text-sm text-slate-300">
                          {[
                            'Organization scoped access',
                            'Soft suspend/drop controls',
                            'Private file storage',
                            'Student payout lock',
                          ].map((item) => (
                            <div key={item} className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'messages' && <OrganizationMessages organization={selectedOrg} />}
                  {activeTab === 'files' && <OrganizationFiles organization={selectedOrg} canManage={canManageSelected} />}
                  {activeTab === 'members' && <OrganizationMembers organization={selectedOrg} canManage={canManageSelected} />}
                  {activeTab === 'announcements' && <OrganizationMessages organization={selectedOrg} />}
                  {activeTab === 'audit' && <OrganizationAuditLog organization={selectedOrg} />}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300/70">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  )
}