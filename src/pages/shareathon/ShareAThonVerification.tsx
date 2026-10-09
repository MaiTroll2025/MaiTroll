import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { ShareAThonProvider } from '../../contexts/ShareAThonContext'
import { useShareAThon } from '../../hooks/useShareAThon'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ExternalLink,
  Clock,
  Loader2,
  Search,
  MessageSquare
} from 'lucide-react'

interface SubmissionWithProfile {
  id: string
  event_id: string
  user_id: string
  platform: string
  share_url: string | null
  screenshot_url: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected' | 'more_info_requested'
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  username?: string
  display_name?: string
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵',
  facebook: '📘',
  instagram: '📸',
  x: '𝕏',
  youtube: '▶️',
  discord: '💬',
  reddit: '🤖'
}

function VerificationQueueContent() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { event, allSubmissions, reviewSubmission, loading: eventLoading, refreshSubmissions } = useShareAThon()

  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied')
      navigate('/')
    }
  }, [isAdmin, navigate])

  useEffect(() => {
    if (event && isAdmin) {
      refreshSubmissions().finally(() => setLoading(false))
    }
  }, [event, isAdmin, refreshSubmissions])

  const handleReview = async (submissionId: string, action: 'approved' | 'rejected' | 'more_info_requested') => {
    const success = await reviewSubmission(submissionId, action, adminNote || null)
    if (success) {
      setSelectedSubmission(null)
      setAdminNote('')
    }
  }

  const submissions: SubmissionWithProfile[] = allSubmissions.map(s => ({
    ...s,
    username: (s as any).username || 'Unknown',
    display_name: (s as any).display_name || (s as any).username || 'Unknown'
  }))

  const filteredSubmissions = submissions.filter(s => {
    const matchesFilter = filter === 'all' || s.status === filter
    const matchesSearch = !searchTerm ||
      s.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.platform?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const pendingCount = submissions.filter(s => s.status === 'pending').length

  if (eventLoading && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/admin/shareathon/dashboard')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent flex items-center gap-2">
              <Eye className="w-6 h-6 text-yellow-400" />
              Verification Queue
            </h1>
            <p className="text-sm text-gray-400">Review and approve share submissions</p>
          </div>
          {pendingCount > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm font-semibold">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'pending'
                  ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                  : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
                  : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              All ({submissions.length})
            </button>
          </div>
          <div className="relative flex-1 sm:flex-initial w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by user or platform..."
              className="w-full sm:w-64 pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/5">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-400">No submissions to review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.map(sub => (
              <div
                key={sub.id}
                className={`glass rounded-2xl border transition-all ${
                  sub.status === 'pending' ? 'border-yellow-500/20' :
                  sub.status === 'approved' ? 'border-green-500/20' :
                  sub.status === 'rejected' ? 'border-red-500/20' :
                  'border-white/5'
                }`}
              >
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{PLATFORM_ICONS[sub.platform] || '🔗'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{sub.display_name || sub.username}</span>
                          <span className="text-xs text-gray-500">@{sub.username}</span>
                        </div>
                        <div className="text-xs text-gray-400 capitalize flex items-center gap-2 mt-0.5">
                          <span>{sub.platform}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sub.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        sub.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        sub.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        sub.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {sub.status.replace(/_/g, ' ')}
                      </span>

                      {sub.share_url && (
                        <a
                          href={sub.share_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                          title="Open share link"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      )}

                      {sub.status === 'pending' && (
                        <button
                          onClick={() => setSelectedSubmission(selectedSubmission === sub.id ? null : sub.id)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-all"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>

                  {sub.notes && (
                    <p className="text-xs text-gray-400 mt-2 pl-11">{sub.notes}</p>
                  )}

                  {sub.admin_notes && (
                    <p className="text-xs text-yellow-400/70 mt-1 pl-11 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Admin: {sub.admin_notes}
                    </p>
                  )}
                </div>

                {/* Review Panel */}
                {selectedSubmission === sub.id && sub.status === 'pending' && (
                  <div className="border-t border-white/5 p-4 bg-black/20">
                    <div className="mb-3">
                      <label className="block text-xs font-semibold mb-1.5 text-gray-300">Admin Notes (optional)</label>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Add a note about your decision..."
                        rows={2}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleReview(sub.id, 'approved')}
                        className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-sm font-semibold transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(sub.id, 'rejected')}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold transition-all flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleReview(sub.id, 'more_info_requested')}
                        className="px-4 py-2 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-sm font-semibold transition-all flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Request More Info
                      </button>
                      <button
                        onClick={() => { setSelectedSubmission(null); setAdminNote('') }}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ShareAThonVerification() {
  return (
    <ShareAThonProvider>
      <VerificationQueueContent />
    </ShareAThonProvider>
  )
}
