import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { useShareAThon } from '../../contexts/ShareAThonContext'
import { toast } from 'sonner'
import {
  Share2,
  ArrowLeft,
  Upload,
  Link,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'x', label: 'X', icon: '𝕏' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'discord', label: 'Discord', icon: '💬' },
  { id: 'reddit', label: 'Reddit', icon: '🤖' }
]

export default function ShareAThonSubmit() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { event, myEligibility, isEligible, submitShare, mySubmissions, loading } = useShareAThon()

  const [platform, setPlatform] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!platform) {
      toast.error('Please select a platform')
      return
    }

    if (!shareUrl.trim()) {
      toast.error('Please provide a share URL or screenshot link')
      return
    }

    setSubmitting(true)
    try {
      const success = await submitShare(platform, shareUrl.trim(), null, notes.trim() || null)
      if (success) {
        setPlatform('')
        setShareUrl('')
        setNotes('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (!isEligible) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="glass rounded-2xl p-8 max-w-md text-center border border-yellow-400/15">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-yellow-400 mb-2">Not Eligible</h2>
          <p className="text-gray-400 text-sm mb-4">
            You are not eligible to submit share proofs for this event. Only broadcasters with status before the event started can participate.
          </p>
          <button
            onClick={() => navigate('/shareathon')}
            className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all"
          >
            Back to Event
          </button>
        </div>
      </div>
    )
  }

  const pendingCount = mySubmissions.filter(s => s.status === 'pending').length
  const approvedCount = mySubmissions.filter(s => s.status === 'approved').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/shareathon')}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Submit Share Proof
            </h1>
            <p className="text-sm text-gray-400">Share your Mai Troll stream to external platforms</p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass rounded-xl p-4 border border-white/5">
            <div className="text-xs text-gray-400 mb-1">Pending Review</div>
            <div className="text-xl font-bold text-yellow-400">{pendingCount}</div>
          </div>
          <div className="glass rounded-xl p-4 border border-white/5">
            <div className="text-xs text-gray-400 mb-1">Approved</div>
            <div className="text-xl font-bold text-green-400">{approvedCount}</div>
          </div>
        </div>

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-white/5 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-cyan-400" />
            New Submission
          </h2>

          {/* Platform Selection */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2">Platform *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    platform === p.id
                      ? 'bg-gradient-to-r from-cyan-600/30 to-purple-600/30 border border-cyan-400/40 text-white'
                      : 'bg-black/20 border border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span>{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Share URL */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2">
              <Link className="w-4 h-4 inline mr-1" />
              Share URL *
            </label>
            <input
              type="url"
              value={shareUrl}
              onChange={(e) => setShareUrl(e.target.value)}
              placeholder="https://tiktok.com/@yourusername/video/..."
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Paste the link to your shared post/story about Mai Troll
            </p>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context about your share..."
              rows={3}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !platform || !shareUrl.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>

        {/* Previous Submissions */}
        {mySubmissions.length > 0 && (
          <div className="glass rounded-2xl p-6 border border-white/5">
            <h2 className="text-lg font-bold mb-4">Previous Submissions</h2>
            <div className="space-y-3">
              {mySubmissions.map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {PLATFORMS.find(p => p.id === sub.platform)?.icon || '🔗'}
                    </span>
                    <div>
                      <div className="text-sm font-medium capitalize">{sub.platform}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(sub.created_at).toLocaleDateString()} at {new Date(sub.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.share_url && (
                      <a
                        href={sub.share_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                      >
                        <Link className="w-3.5 h-3.5 text-gray-400" />
                      </a>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      sub.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      sub.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      sub.status === 'more_info_requested' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {sub.status === 'approved' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                      {sub.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
