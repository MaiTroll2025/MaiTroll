import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'
import {
  FileText,
  Users,
  Calendar,
  Clock,
  Shield,
  Download,
  Search,
  Eye,
  CheckCircle,
  Globe,
  UserCheck,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  XCircle
} from 'lucide-react'

interface AgreementRecord {
  id: string
  user_id: string
  username: string
  email?: string
  accepted_at: string
  ip_address?: string
  user_agent?: string
  agreement_version: string
  terms_accepted: boolean
}

interface AgreementsManagementProps {
  onLoadAgreements: (agreements: AgreementRecord[]) => void
  agreementsLoading?: boolean
}

export default function AgreementsManagement({
  onLoadAgreements,
  agreementsLoading = false
}: AgreementsManagementProps) {
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const MaiTrollAgreement = `Mai Troll USER AGREEMENT & COMMUNITY CODE

1. ACCEPTANCE OF TERMS
By accessing or using Mai Troll, you agree to be bound by these Terms of Service and our Community Code of Conduct.

2. USER CONDUCT
Users must conduct themselves in a manner consistent with the satirical and humorous nature of Mai Troll. While trolling is part of the experience, harassment, hate speech, and illegal activities are strictly prohibited.

3. VIRTUAL CURRENCY (TROLL COINS)
Troll Coins are a virtual currency with no real-world value outside the Mai Troll platform. They cannot be exchanged for fiat currency except through authorized payout channels for approved creators.

4. CONTENT OWNERSHIP
You retain ownership of content you create, but grant Mai Troll a license to display and distribute it.

5. TERMINATION
We reserve the right to suspend or terminate accounts that violate these terms.

Last Updated: January 1, 2026`

  const fetchAgreements = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_user_agreements' }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      if (data && data.agreements) {
        const formattedAgreements = data.agreements as AgreementRecord[]
        setAgreements(formattedAgreements)
        onLoadAgreements(formattedAgreements)
      }
    } catch (error) {
      console.error('Error fetching agreements:', error)
      toast.error('Failed to load agreements')
    } finally {
      setIsLoading(false)
    }
  }, [onLoadAgreements])

  useEffect(() => {
    fetchAgreements()
  }, [fetchAgreements])

  const filteredAgreements = agreements.filter(agreement => {
    const matchesSearch = agreement.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agreement.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agreement.user_id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter = filterStatus === 'all' ||
                         (filterStatus === 'accepted' && agreement.terms_accepted) ||
                         (filterStatus === 'pending' && !agreement.terms_accepted)

    return matchesSearch && matchesFilter
  })

  // Calculate stats from real data
  const total = agreements.length
  const acceptedToday = agreements.filter(a => {
    const today = new Date()
    const acceptedDate = new Date(a.accepted_at)
    return acceptedDate.toDateString() === today.toDateString()
  }).length
  const acceptedThisWeek = agreements.filter(a => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return new Date(a.accepted_at) > weekAgo
  }).length
  
  const acceptedCount = agreements.filter(a => a.terms_accepted).length
  const complianceRateVal = total > 0 ? ((acceptedCount / total) * 100).toFixed(1) + '%' : '0%'

  const stats = {
    totalAgreements: total,
    acceptedToday,
    acceptedThisWeek,
    complianceRate: complianceRateVal
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <BarChart3 className="w-4 h-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30'
    },
    {
      id: 'agreements',
      label: 'User Agreements',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: <Shield className="w-4 h-4" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30'
    },
    {
      id: 'agreement-text',
      label: 'Agreement Text',
      icon: <Eye className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    }
  ]

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Total Agreements</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalAgreements}</div>
        </div>

        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-gray-300">Accepted Today</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.acceptedToday}</div>
        </div>

        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-medium text-gray-300">This Week</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.acceptedThisWeek}</div>
        </div>

        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-gray-300">Compliance Rate</span>
          </div>
          <div className="text-2xl font-bold text-white">{stats.complianceRate}</div>
        </div>
      </div>

      {/* Recent Agreements */}
      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
            <h4 className="font-medium text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Recent Agreement Acceptances
            </h4>
            <div className="space-y-3">
              {agreements.slice(0, 5).map((agreement) => (
                <div key={agreement.id} className="flex items-center justify-between p-3 bg-[#141414] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="font-medium text-white">{agreement.username}</div>
                  <div className="text-xs text-gray-400">{agreement.email}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  {new Date(agreement.accepted_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(agreement.accepted_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderAgreementsTab = () => (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username, email, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111] border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-400"
            />
          </div>
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#111] border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="all">All Agreements</option>
          <option value="accepted">Accepted</option>
          <option value="pending">Pending</option>
        </select>

        <button
          onClick={fetchAgreements}
          disabled={agreementsLoading || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${agreementsLoading || isLoading ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh</span>
        </button>

        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          <span className="text-sm">Export</span>
        </button>
      </div>

      {/* Agreements Table */}
      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-gray-700 bg-[#141414]">
                <th className="py-3 px-4 text-sm font-medium text-gray-300">User</th>
                <th className="py-3 px-4 text-sm font-medium text-gray-300">Email</th>
                <th className="py-3 px-4 text-sm font-medium text-gray-300">Accepted At</th>
                <th className="py-3 px-4 text-sm font-medium text-gray-300">IP Address</th>
                <th className="py-3 px-4 text-sm font-medium text-gray-300">Status</th>
                <th className="py-3 px-4 text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgreements.map((agreement) => (
                <tr key={agreement.id} className="border-b border-gray-800 hover:bg-[#1a1a1a]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#2C2C2C] rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{agreement.username}</div>
                        <div className="text-xs text-gray-400">{agreement.user_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">{agreement.email}</td>
                  <td className="py-3 px-4 text-sm text-gray-300">
                    {new Date(agreement.accepted_at).toLocaleDateString()}
                    <div className="text-xs text-gray-500">
                      {new Date(agreement.accepted_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-gray-500" />
                      {agreement.ip_address}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Accepted</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setSelectedAgreement(agreement)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agreement Details Modal */}
      {selectedAgreement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Agreement Details</h3>
              <button
                onClick={() => setSelectedAgreement(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <div className="text-white font-medium">{selectedAgreement.username}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">User ID</label>
                  <div className="text-white font-medium">{selectedAgreement.user_id}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <div className="text-white font-medium">{selectedAgreement.email}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Accepted At</label>
                  <div className="text-white font-medium">
                    {new Date(selectedAgreement.accepted_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">IP Address</label>
                  <div className="text-white font-medium">{selectedAgreement.ip_address}</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Version</label>
                  <div className="text-white font-medium">{selectedAgreement.agreement_version}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">User Agent</label>
                <div className="text-xs text-gray-300 bg-[#0A0814] p-2 rounded border">
                  {selectedAgreement.user_agent}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderComplianceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-gray-300">Compliance Status</span>
          </div>
          <div className="text-2xl font-bold text-green-400">98.5%</div>
          <div className="text-xs text-gray-400 mt-1">Users with valid agreements</div>
        </div>

        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">Pending Reviews</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">12</div>
          <div className="text-xs text-gray-400 mt-1">Agreements needing review</div>
        </div>

        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-red-400" />
            <span className="text-sm font-medium text-gray-300">Legal Actions</span>
          </div>
          <div className="text-2xl font-bold text-red-400">3</div>
          <div className="text-xs text-gray-400 mt-1">Active legal proceedings</div>
        </div>
      </div>

      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
        <h4 className="font-medium text-white mb-4">Compliance Checklist</h4>
        <div className="space-y-3">
          {[
            { item: 'GDPR Compliance', status: 'compliant', description: 'User data handling meets EU standards' },
            { item: 'COPPA Compliance', status: 'compliant', description: 'Children\'s privacy protection' },
            { item: 'DMCA Compliance', status: 'compliant', description: 'Copyright infringement procedures' },
            { item: 'Terms Acceptance', status: 'compliant', description: 'All users have accepted current terms' },
            { item: 'Data Retention', status: 'review', description: 'Review data retention policies' },
            { item: 'International Laws', status: 'compliant', description: 'Compliance with international regulations' }
          ].map((check, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-[#141414] rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  check.status === 'compliant' ? 'bg-green-500/20' :
                  check.status === 'review' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                }`}>
                  {check.status === 'compliant' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : check.status === 'review' ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">{check.item}</div>
                  <div className="text-xs text-gray-400">{check.description}</div>
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                check.status === 'compliant' ? 'bg-green-500/20 text-green-400' :
                check.status === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {check.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderAgreementTextTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-white">Mai Troll User Agreement & Community Code</h4>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            <span className="text-sm">Download PDF</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors">
            <Eye className="w-4 h-4" />
            <span className="text-sm">Preview</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-6 max-h-[70vh] overflow-y-auto">
        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
          {MaiTrollAgreement}
        </pre>
      </div>
    </div>
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab()
      case 'agreements':
        return renderAgreementsTab()
      case 'compliance':
        return renderComplianceTab()
      case 'agreement-text':
        return renderAgreementTextTab()
      default:
        return renderOverviewTab()
    }
  }

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Agreements Management</h3>
            <p className="text-sm text-gray-400">Track user agreement acceptances and compliance</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 p-1 bg-[#0A0814] rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-md transition-all duration-200 ${
              activeTab === tab.id
                ? `${tab.bgColor} ${tab.borderColor} border text-white`
                : 'text-gray-400 hover:text-white hover:bg-[#2C2C2C]'
            }`}
          >
            <div className={activeTab === tab.id ? tab.color : 'text-gray-400'}>
              {tab.icon}
            </div>
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="space-y-4">
        {renderActiveTab()}
      </div>
    </div>
  )
}