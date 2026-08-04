import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Shield, CheckCircle, XCircle, User, ExternalLink, Clock, FileText, Download } from 'lucide-react'

interface CelebApplication {
  id: string
  user_id: string
  full_name: string | null
  phone_number: string | null
  email: string | null
  social_media: Record<string, string>
  status: 'pending' | 'in_review' | 'approved' | 'denied'
  reviewer_id: string | null
  admin_note: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  user_profiles?: {
    username: string | null
    email: string | null
  }
  celeb_verification_documents?: Array<{
    document_type: string
    storage_path: string
    uploaded_at: string
  }>
}

export default function CelebVerificationDashboard() {
  const { profile } = useAuthStore()
  const [applications, setApplications] = useState<CelebApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'approved' | 'denied'>('all')
  const [selectedApp, setSelectedApp] = useState<CelebApplication | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('celeb_applications')
        .select(`
          *,
          user_profiles!inner(username, email),
          celeb_verification_documents(document_type, storage_path, uploaded_at)
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setApplications((data as unknown as CelebApplication[]) || [])
    } catch (error: unknown) {
      console.error('Error loading celeb applications:', error)
      toast.error('Failed to load Celeb applications')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (!isAdmin) return
    loadApplications()
    const interval = window.setInterval(loadApplications, 30_000)
    return () => {
      window.clearInterval(interval)
    }
  }, [isAdmin, filter, loadApplications])

  const handleReview = async (applicationId: string, action: 'approve' | 'deny' | 'request_info') => {
    if (!selectedApp) return
    setProcessing(applicationId)
    try {
      const { data, error } = await supabase.functions.invoke('celeb-review-action', {
        body: {
          application_id: applicationId,
          action,
          admin_note: adminNote || undefined
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success(`Application ${action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'marked for review'}`)
      setSelectedApp(null)
      setAdminNote('')
      loadApplications()
    } catch (error: any) {
      console.error('Error reviewing application:', error)
      toast.error(error.message || 'Failed to update application')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'in_review': return 'bg-blue-500/20 text-blue-400'
      case 'approved': return 'bg-green-500/20 text-green-400'
      case 'denied': return 'bg-red-500/20 text-red-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'denied': return <XCircle className="w-4 h-4" />
      case 'in_review': return <Clock className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const handleViewDocument = async (storagePath: string) => {
    try {
      const { data: { signedUrl } } = await supabase.storage
        .from('celeb-documents')
        .createSignedUrl(storagePath, 120)

      if (signedUrl) {
        window.open(signedUrl, '_blank')
      }
    } catch (err) {
      console.error('Failed to create signed URL:', err)
      toast.error('Unable to view document')
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-white">
        Admin access only.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-yellow-400" />
        <h1 className="text-3xl font-bold">Celeb Verification Dashboard</h1>
      </div>

      <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
        Review celebrity applications. Identity documents are stored in a private bucket and only accessible via signed URLs.
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'pending', 'in_review', 'approved', 'denied'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-yellow-500/20 border border-yellow-400 text-yellow-300'
                : 'bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">
          Loading Celeb applications...
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No applications found.
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-slate-900/50 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
              onClick={() => {
                setSelectedApp(app)
                setAdminNote(app.admin_note || '')
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">{app.user_profiles?.username || 'Unknown'}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(app.status)}`}>
                      {getStatusIcon(app.status)}
                      {app.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{app.full_name}</p>
                  {app.email && <p className="text-xs text-slate-400">{app.email}</p>}
                  {app.phone_number && <p className="text-xs text-slate-400">{app.phone_number}</p>}
                  {app.social_media && Object.keys(app.social_media).length > 0 && (
                    <div className="flex gap-3 mt-2">
                      {Object.entries(app.social_media).map(([platform, url]) => (
                        <a key={platform} href={url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {platform}: {url.replace(/^https?:\/\//, '')}
                        </a>
                      ))}
                    </div>
                  )}
                  {app.celeb_verification_documents && app.celeb_verification_documents.length > 0 && (
                    <div className="flex gap-3 mt-2">
                      {app.celeb_verification_documents.map((doc) => (
                        <button
                          key={doc.storage_path}
                          onClick={(e) => { e.stopPropagation(); handleViewDocument(doc.storage_path) }}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {doc.document_type.replace('_', ' ')} — uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Applied: {new Date(app.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  <Download className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Review Application</h2>
            <p className="text-sm text-slate-300 mb-4">
              Applicant: <span className="text-white font-semibold">{selectedApp.user_profiles?.username}</span>
              <br />
              Name: <span className="text-white">{selectedApp.full_name || 'N/A'}</span>
              <br />
              Status: <span className={`capitalize ${getStatusColor(selectedApp.status)} px-2 py-0.5 rounded text-xs`}>
                {selectedApp.status}
              </span>
            </p>

            {selectedApp.celeb_verification_documents && selectedApp.celeb_verification_documents.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Identity Documents</h3>
                <div className="space-y-2">
                  {selectedApp.celeb_verification_documents.map((doc) => (
                    <button
                      key={doc.storage_path}
                      onClick={() => handleViewDocument(doc.storage_path)}
                      className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      <FileText className="w-4 h-4" />
                      {doc.document_type.replace('_', ' ')} — {new Date(doc.uploaded_at).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Admin Note</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add a note for the applicant..."
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50 resize-y"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReview(selectedApp.id, 'request_info')}
                disabled={processing === selectedApp.id}
                className="flex-1 px-4 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-lg font-medium hover:bg-blue-600/30 transition-all disabled:opacity-50"
              >
                Request Info
              </button>
              <button
                onClick={() => handleReview(selectedApp.id, 'deny')}
                disabled={processing === selectedApp.id}
                className="flex-1 px-4 py-2 bg-red-600/20 border border-red-500/50 text-red-300 rounded-lg font-medium hover:bg-red-600/30 transition-all disabled:opacity-50"
              >
                Deny
              </button>
              <button
                onClick={() => handleReview(selectedApp.id, 'approve')}
                disabled={processing === selectedApp.id}
                className="flex-1 px-4 py-2 bg-green-600/20 border border-green-500/50 text-green-300 rounded-lg font-medium hover:bg-green-600/30 transition-all disabled:opacity-50"
              >
                {processing === selectedApp.id ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
