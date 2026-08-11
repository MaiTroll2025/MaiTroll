import React, { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  FileText, Clock, CheckCircle, XCircle, Archive, Search, FileSignature,
  Briefcase, Users, Shield, Plus, Eye, Download, Stamp, AlertTriangle,
  ChevronRight, Filter, RefreshCw, Award, FileCheck
} from 'lucide-react'
import type {
  NotaryDocument, DocumentSignature, DocumentStamp, DocumentAuditLog,
  NotaryStats, NotaryTab
} from '@/types/notary'
import {
  fetchDocuments, fetchDocumentById, fetchDocumentSignatures,
  fetchDocumentStamp, fetchAuditLogs, fetchNotaryStats,
  fetchAllAuditLogs, createDocument, signDocument, approveDocument,
  rejectDocument, fetchDocumentTypes
} from '@/services/notaryService'
import { downloadPDF } from '@/services/notaryPDF'

export default function NotaryDashboard() {
  const { profile } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<NotaryTab>('my_documents')
  const [documents, setDocuments] = useState<NotaryDocument[]>([])
  const [stats, setStats] = useState<NotaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<NotaryDocument | null>(null)
  const [docSignatures, setDocSignatures] = useState<DocumentSignature[]>([])
  const [docStamp, setDocStamp] = useState<DocumentStamp | null>(null)
  const [auditLogs, setAuditLogs] = useState<DocumentAuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [allAuditLogs, setAllAuditLogs] = useState<DocumentAuditLog[]>([])
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<any[]>([])

  // Document creation state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContent, setNewDocContent] = useState('')
  const [newDocType, setNewDocType] = useState('custom')
  const [documentTypes, setDocumentTypes] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  // Signature state
  const [showSignModal, setShowSignModal] = useState(false)
  const [signLegalName, setSignLegalName] = useState('')
  const [signing, setSigning] = useState(false)

  // Approval state
  const [approvalComment, setApprovalComment] = useState('')
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  const userId = profile?.id
  const userRole = profile?.role || ''
  const isAdmin = profile?.is_admin || ['admin', 'ceo', 'superadmin', 'founder', 'owner'].includes(userRole)
  const isStaff = profile?.is_admin || ['admin', 'ceo', 'superadmin', 'founder', 'owner', 'moderator', 'lead_troll_officer', 'troll_officer', 'secretary', 'staff', 'prosecutor', 'attorney'].includes(userRole)
  const isTroller = userRole === 'troller' || profile?.is_troller

  // Auto-load document from ?doc= query param (e.g. from RTCAdminMonitor notary tab)
  useEffect(() => {
    const docId = searchParams.get('doc')
    if (!docId) return
    ;(async () => {
      try {
        const docResult = await fetchDocumentById(docId)
        if (docResult) {
          setSelectedDoc(docResult)
          setActiveTab('pending')
        }
      } catch {
        toast.error('Failed to load document')
      }
    })()
  }, [searchParams])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      switch (activeTab) {
        case 'my_documents': {
          if (!userId) break
          const { documents: docs } = await fetchDocuments({ submittedBy: userId })
          setDocuments(docs)
          break
        }
        case 'pending': {
          const { documents: docs } = await fetchDocuments({ status: 'pending' })
          setDocuments(docs)
          break
        }
        case 'approved': {
          const { documents: docs } = await fetchDocuments({ status: 'approved' })
          setDocuments(docs)
          break
        }
        case 'rejected': {
          const { documents: docs } = await fetchDocuments({ status: 'rejected' })
          setDocuments(docs)
          break
        }
        case 'archive': {
          const { documents: docs } = await fetchDocuments({ status: 'archived' })
          setDocuments(docs)
          break
        }
        case 'payroll': {
          const { documents: docs } = await fetchDocuments({ documentType: 'payroll_form', ...(isAdmin ? {} : { submittedBy: userId }) })
          setDocuments(docs)
          break
        }
        case 'loans': {
          const { documents: docs } = await fetchDocuments({ documentType: 'loan_agreement', ...(isAdmin ? {} : { submittedBy: userId }) })
          setDocuments(docs)
          break
        }
        case 'agency': {
          const { documents: docs } = await fetchDocuments({ documentType: 'agency_agreement', ...(isAdmin ? {} : { submittedBy: userId }) })
          setDocuments(docs)
          break
        }
        case 'staff_apps': {
          const { documents: docs } = await fetchDocuments({ documentType: 'staff_application', ...(isAdmin ? {} : { submittedBy: userId }) })
          setDocuments(docs)
          break
        }
      }
    } catch (err: any) {
      toast.error('Failed to load documents: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [activeTab, userId, isAdmin])

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchNotaryStats()
      setStats(s)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [])

  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await fetchAllAuditLogs(200)
      setAllAuditLogs(logs)
    } catch (err) {
      console.error('Failed to audit logs:', err)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
    loadStats()
    loadAuditLogs()
    fetchDocumentTypes().then(setDocumentTypes).catch(() => {})
  }, [loadDocuments, loadStats, loadAuditLogs])

  const openDocument = async (doc: NotaryDocument) => {
    setSelectedDoc(doc)
    try {
      const [sigs, stamp, logs] = await Promise.all([
        fetchDocumentSignatures(doc.id),
        fetchDocumentStamp(doc.id),
        fetchAuditLogs(doc.id)
      ])
      setDocSignatures(sigs)
      setDocStamp(stamp)
      setAuditLogs(logs)
    } catch (err: any) {
      toast.error('Failed to load document details')
    }
  }

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) {
      toast.error('Title and content are required')
      return
    }
    setCreating(true)
    try {
      await createDocument({
        title: newDocTitle,
        content: newDocContent,
        documentTypeSlug: newDocType
      })
      toast.success('Document created')
      setShowCreateModal(false)
      setNewDocTitle('')
      setNewDocContent('')
      setNewDocType('custom')
      loadDocuments()
      loadStats()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create document')
    } finally {
      setCreating(false)
    }
  }

  const handleSign = async () => {
    if (!selectedDoc || !signLegalName.trim()) {
      toast.error('Legal name is required')
      return
    }
    setSigning(true)
    try {
      await signDocument({
        documentId: selectedDoc.id,
        legalName: signLegalName,
        typedSignature: signLegalName
      })
      toast.success('Document signed successfully')
      setShowSignModal(false)
      setSignLegalName('')
      openDocument(selectedDoc)
      loadDocuments()
      loadStats()
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign')
    } finally {
      setSigning(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedDoc) return
    setProcessing(true)
    try {
      await approveDocument(selectedDoc.id, approvalComment)
      toast.success('Document approved and stamped')
      setApprovalComment('')
      openDocument(selectedDoc)
      loadDocuments()
      loadStats()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedDoc || !rejectionReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    setProcessing(true)
    try {
      await rejectDocument(selectedDoc.id, rejectionReason)
      toast.success('Document rejected')
      setShowRejectModal(false)
      setRejectionReason('')
      openDocument(selectedDoc)
      loadDocuments()
      loadStats()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!selectedDoc) return
    try {
      await downloadPDF({
        document: selectedDoc,
        signatures: docSignatures,
        stamp: docStamp
      })
      toast.success('PDF downloaded')
    } catch (err: any) {
      toast.error('Failed to download PDF')
    }
  }

  const handleUserSearch = async () => {
    if (!userSearchTerm.trim()) return
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, email, role, is_verified')
        .or(`username.ilike.%${userSearchTerm}%,email.ilike.%${userSearchTerm}%`)
        .limit(20)
      setUserSearchResults(data || [])
      if (data?.length) {
        // Load documents for first user
        const { documents: docs } = await fetchDocuments({ submittedBy: data[0].id })
        setDocuments(docs)
      }
    } catch (err) {
      toast.error('Search failed')
    }
  }

  const tabs: Array<{ id: NotaryTab; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
    { id: 'my_documents', label: 'My Documents', icon: <FileText size={14} /> },
    { id: 'pending', label: 'Pending Review', icon: <Clock size={14} />, adminOnly: !isStaff },
    { id: 'approved', label: 'Approved', icon: <CheckCircle size={14} />, adminOnly: !isStaff },
    { id: 'rejected', label: 'Rejected', icon: <XCircle size={14} />, adminOnly: !isStaff },
    { id: 'archive', label: 'Archive', icon: <Archive size={14} />, adminOnly: !isAdmin },
    { id: 'user_search', label: 'User Search', icon: <Search size={14} />, adminOnly: !isStaff },
    { id: 'approval_logs', label: 'Approval Logs', icon: <FileSignature size={14} />, adminOnly: !isStaff },
    { id: 'payroll', label: 'Payroll Docs', icon: <Briefcase size={14} />, adminOnly: !isStaff },
    { id: 'loans', label: 'Loan Docs', icon: <FileCheck size={14} />, adminOnly: !isStaff },
    { id: 'agency', label: 'Agency Contracts', icon: <Shield size={14} />, adminOnly: !isStaff },
    { id: 'staff_apps', label: 'Staff Applications', icon: <Users size={14} />, adminOnly: !isStaff },
    { id: 'create', label: 'New Document', icon: <Plus size={14} /> },
  ]

  if (isTroller) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">Trollers do not have access to the Notary Center.</p>
        </div>
      </div>
    )
  }

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin || isStaff)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Stamp className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold">Notary Center</h1>
                <p className="text-xs text-gray-500">Document Management & Approval System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stats && (
                <div className="flex items-center gap-4 text-xs text-gray-400 mr-4">
                  <span className="flex items-center gap-1"><Clock size={12} className="text-yellow-400" />{stats.pending} pending</span>
                  <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" />{stats.approved} approved</span>
                  <span className="flex items-center gap-1"><XCircle size={12} className="text-red-400" />{stats.rejected} rejected</span>
                </div>
              )}
              <button onClick={() => { loadDocuments(); loadStats(); loadAuditLogs() }} className="p-2 hover:bg-white/10 rounded-lg">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <div className="w-56 min-h-[calc(100vh-80px)] border-r border-white/10 bg-black/20 p-3 shrink-0">
          <div className="space-y-1">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'create') {
                    setShowCreateModal(true)
                    return
                  }
                  setActiveTab(tab.id)
                  setSelectedDoc(null)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <ChevronRight size={12} className="ml-auto" />
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {selectedDoc ? (
            /* Document Detail View */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedDoc(null)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
                  ← Back to list
                </button>
                <div className="flex items-center gap-2">
                  {selectedDoc.status !== 'approved' && selectedDoc.status !== 'rejected' && selectedDoc.submitted_by === userId && (
                    <button onClick={() => setShowSignModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm flex items-center gap-2">
                      <FileSignature size={14} /> Sign Document
                    </button>
                  )}
                  {isStaff && selectedDoc.status === 'pending' && (
                    <>
                      <button onClick={handleApprove} disabled={processing} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                        <CheckCircle size={14} /> Approve & Stamp
                      </button>
                      <button onClick={() => setShowRejectModal(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm flex items-center gap-2">
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}
                  <button onClick={handleDownloadPDF} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm flex items-center gap-2">
                    <Download size={14} /> Download PDF
                  </button>
                </div>
              </div>

              {/* Document Info */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedDoc.title}</h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded ${
                        selectedDoc.status === 'approved' ? 'bg-green-900 text-green-300' :
                        selectedDoc.status === 'rejected' ? 'bg-red-900 text-red-300' :
                        selectedDoc.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-gray-800 text-gray-400'
                      }`}>{selectedDoc.status.toUpperCase()}</span>
                      <span>{selectedDoc.document_type_slug}</span>
                      <span>v{selectedDoc.version}</span>
                      {selectedDoc.is_locked && <span className="text-blue-400 flex items-center gap-1"><Award size={10} /> Locked</span>}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-black/30 rounded-lg p-4 border border-white/5">
                  {selectedDoc.content}
                </div>
              </div>

              {/* Stamp */}
              {docStamp && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2"><Stamp size={14} /> Official Mai Troll Approval Stamp</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-gray-500 text-xs">Approval ID</span><p className="text-yellow-400 font-mono">{docStamp.stamp_id}</p></div>
                    <div><span className="text-gray-500 text-xs">Approver</span><p className="text-white">{docStamp.approver_username}</p></div>
                    <div><span className="text-gray-500 text-xs">Role</span><p className="text-white">{docStamp.approver_role}</p></div>
                    <div><span className="text-gray-500 text-xs">Date</span><p className="text-white">{new Date(docStamp.approval_date).toLocaleString()}</p></div>
                    <div className="col-span-2"><span className="text-gray-500 text-xs">Verification Code</span><p className="text-green-400 font-mono">{docStamp.verification_code}</p></div>
                    <div className="col-span-2"><span className="text-gray-500 text-xs">Document Hash</span><p className="text-gray-400 font-mono text-xs">{docStamp.document_checksum?.substring(0, 48)}...</p></div>
                  </div>
                </div>
              )}

              {/* Signatures */}
              {docSignatures.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><FileSignature size={14} /> Digital Signatures ({docSignatures.length})</h3>
                  <div className="space-y-3">
                    {docSignatures.map(sig => (
                      <div key={sig.id} className="bg-black/30 rounded-lg p-4 border border-white/5">
                        <div className="font-serif text-xl text-blue-400 italic mb-2">{sig.typed_signature}</div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <div>Legal Name: <span className="text-white">{sig.legal_name}</span> | Username: <span className="text-white">{sig.username}</span></div>
                          <div>Signed: {new Date(sig.signed_at).toLocaleString()} | Doc Version: v{sig.agreement_version}</div>
                          <div className="font-mono text-gray-600">Hash: {sig.signature_hash.substring(0, 40)}...</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Log */}
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock size={14} /> Document Timeline</h3>
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 text-xs border-b border-white/5 pb-2">
                      <span className="text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
                      <span className="text-blue-400 font-mono">{log.action}</span>
                      <span className="text-gray-400">by {log.actor_username} ({log.actor_role})</span>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <span className="text-gray-600">{JSON.stringify(log.details)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Document List View */
            <>
              {/* Search for user_search tab */}
              {activeTab === 'user_search' && (
                <div className="mb-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search by username, email, or user ID..."
                      value={userSearchTerm}
                      onChange={e => setUserSearchTerm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUserSearch()}
                      className="flex-1 px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm"
                    />
                    <button onClick={handleUserSearch} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
                      Search
                    </button>
                  </div>
                  {userSearchResults.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {userSearchResults.map(u => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            const { documents: docs } = await fetchDocuments({ submittedBy: u.id })
                            setDocuments(docs)
                          }}
                          className="w-full text-left px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700 rounded text-sm flex items-center justify-between"
                        >
                          <span>@{u.username} <span className="text-gray-500">({u.role})</span></span>
                          {u.is_verified && <span className="text-blue-400 text-xs">Verified</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Approval Logs tab */}
              {activeTab === 'approval_logs' ? (
                <div>
                  <h2 className="text-lg font-bold mb-4">Platform Approval Logs</h2>
                  <div className="space-y-1">
                    {allAuditLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 text-xs bg-white/[0.02] border border-white/5 rounded px-3 py-2">
                        <span className="text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          log.action.includes('approved') ? 'bg-green-900 text-green-300' :
                          log.action.includes('rejected') ? 'bg-red-900 text-red-300' :
                          log.action.includes('signed') ? 'bg-blue-900 text-blue-300' :
                          'bg-gray-800 text-gray-400'
                        }`}>{log.action}</span>
                        <span className="text-gray-400">{log.actor_username}</span>
                        <span className="text-gray-600">Doc: {log.document_id?.substring(0, 8)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Document List */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">{visibleTabs.find(t => t.id === activeTab)?.label}</h2>
                    <span className="text-xs text-gray-500">{documents.length} documents</span>
                  </div>
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading...</div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No documents found</div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => openDocument(doc)}
                          className="w-full text-left bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl p-4 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-gray-500" />
                              <div>
                                <div className="font-semibold text-sm">{doc.title}</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {doc.document_type_slug} | v{doc.version} | {new Date(doc.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                doc.status === 'approved' ? 'bg-green-900 text-green-300' :
                                doc.status === 'rejected' ? 'bg-red-900 text-red-300' :
                                doc.status === 'pending' ? 'bg-yellow-900 text-yellow-300' :
                                'bg-gray-800 text-gray-400'
                              }`}>{doc.status.toUpperCase()}</span>
                              {doc.is_locked && <Award size={12} className="text-blue-400" />}
                              <ChevronRight size={14} className="text-gray-600" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Create New Document</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Document Type</label>
                <select value={newDocType} onChange={e => setNewDocType(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm">
                  {documentTypes.map(dt => (
                    <option key={dt.slug} value={dt.slug}>{dt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Title</label>
                <input type="text" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm" placeholder="Document title..." />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Content</label>
                <textarea value={newDocContent} onChange={e => setNewDocContent(e.target.value)} rows={8} className="w-full px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm resize-none" placeholder="Document content..." />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">Cancel</button>
                <button onClick={handleCreateDocument} disabled={creating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal */}
      {showSignModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-2">Sign Document</h3>
            <p className="text-sm text-gray-400 mb-4">"{selectedDoc.title}"</p>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-4 text-sm text-yellow-300">
              <AlertTriangle size={14} className="inline mr-2" />
              By signing, you confirm you have read and agree to the terms.
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Legal Full Name (this becomes your signature)</label>
              <input type="text" value={signLegalName} onChange={e => setSignLegalName(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm" placeholder="Enter your legal name..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSignModal(false)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSign} disabled={signing || !signLegalName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50">
                {signing ? 'Signing...' : 'Sign Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-2">Reject Document</h3>
            <p className="text-sm text-gray-400 mb-4">"{selectedDoc.title}"</p>
            <div className="mb-4">
              <label className="text-xs text-gray-400 block mb-1">Rejection Reason</label>
              <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} className="w-full px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm resize-none" placeholder="Reason for rejection..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm">Cancel</button>
              <button onClick={handleReject} disabled={processing || !rejectionReason.trim()} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm disabled:opacity-50">
                {processing ? 'Rejecting...' : 'Reject Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
