import React, { Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../lib/store'

const OfficerOWCDashboard = React.lazy(() => import('../../../pages/OfficerOWCDashboard'))
const OfficerModeration = React.lazy(() => import('../../../pages/OfficerModeration'))
const OfficerVote = React.lazy(() => import('../../../pages/OfficerVote'))

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </div>
  )
}

export default function DepartmentToolsTab({ profile }: { profile?: any; realProfile?: any }) {
  const navigate = useNavigate()
  const { profile: _p } = useAuthStore()
  const officer = profile?.role === 'troll_officer' || profile?.role === 'lead_troll_officer' || profile?.is_troll_officer || profile?.is_lead_officer

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Open Department Tools to access your full role dashboard.</p>
      <button
        type="button"
        onClick={() => navigate('/department-tools')}
        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 px-5 py-3 text-sm font-black text-white shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:scale-[1.02]"
      >
        Open Department Tools
      </button>

      {officer && (
        <>
          <Frame title="Officer Work Credit (OWC)">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
              <OfficerOWCDashboard />
            </Suspense>
          </Frame>
          <Frame title="Moderation Tools">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
              <OfficerModeration />
            </Suspense>
          </Frame>
          <Frame title="Officer of the Week Vote">
            <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
              <OfficerVote />
            </Suspense>
          </Frame>
        </>
      )}
    </div>
  )
}
