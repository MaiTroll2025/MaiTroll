import React, { useState } from 'react'
import ExecutiveSecretariesTab from './components/ExecutiveSecretariesTab'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'

type TabId = 'assignments'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'assignments', label: 'Secretary Assignments', icon: <Users className="w-4 h-4" /> },
]

export default function ExecutiveSecretaries() {
  const [activeTab, setActiveTab] = useState<TabId>('assignments')

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <div>
          <h1 className="text-3xl font-bold text-white">Executive Secretaries</h1>
          <p className="text-slate-400">Manage secretary assignments and grant exclusive founder rewards</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <ExecutiveSecretariesTab />
      </div>
    </div>
  )
}
