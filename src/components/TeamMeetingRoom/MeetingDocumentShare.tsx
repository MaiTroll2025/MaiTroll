import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Share2, X, FileText, Trash2, Loader2, Search, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import {
  shareDocumentInMeeting,
  getMeetingDocuments,
  getAvailableDocumentsForMeeting,
  removeMeetingDocument,
  MeetingDocumentWithDetails,
} from '@/lib/meetingDocuments';
import type { OrganizationDocument } from '@/types/contracts';

interface MeetingDocumentShareProps {
  meetingId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MeetingDocumentShare({ meetingId, isOpen, onClose }: MeetingDocumentShareProps) {
  const { user } = useAuthStore();

  const [sharedDocs, setSharedDocs] = useState<MeetingDocumentWithDetails[]>([]);
  const [availableDocs, setAvailableDocs] = useState<OrganizationDocument[]>([]);
  const [showBrowse, setShowBrowse] = useState(false);
  const [_loading, _setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSharedDocs = useCallback(async () => {
    if (!meetingId) return;
    const docs = await getMeetingDocuments(meetingId);
    setSharedDocs(docs);
  }, [meetingId]);

  const loadAvailableDocs = useCallback(async () => {
    const docs = await getAvailableDocumentsForMeeting(meetingId);
    setAvailableDocs(docs);
  }, [meetingId]);

  useEffect(() => {
    if (isOpen) {
      loadSharedDocs();
      loadAvailableDocs();
    }
  }, [isOpen, loadSharedDocs, loadAvailableDocs]);

  const handleShare = async (docId: string) => {
    if (!user?.id) return;
    setSharing(docId);
    try {
      const result = await shareDocumentInMeeting({
        meetingId,
        documentId: docId,
        sharedBy: user.id,
      });
      if (result.success) {
        toast.success('Document shared');
        loadSharedDocs();
        loadAvailableDocs();
      } else {
        toast.error(result.error || 'Failed to share');
      }
    } finally {
      setSharing(null);
    }
  };

  const handleRemove = async (meetingDocId: string) => {
    const success = await removeMeetingDocument(meetingDocId);
    if (success) {
      toast.success('Document removed');
      loadSharedDocs();
      loadAvailableDocs();
    } else {
      toast.error('Failed to remove');
    }
  };

  const filteredAvailable = availableDocs.filter(doc =>
    doc.document_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-cyan-500/20 bg-slate-950 shadow-[0_0_50px_rgba(34,211,238,0.1)] overflow-hidden flex flex-col"
          >
            <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-5 py-4 flex items-center justify-between border-b border-cyan-500/20">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Meeting Documents</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Shared Documents */}
              <div>
                <h3 className="text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Shared in Meeting ({sharedDocs.length})
                </h3>
                {sharedDocs.length === 0 ? (
                  <div className="text-center py-6 rounded-xl border border-dashed border-slate-700">
                    <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No documents shared yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sharedDocs.map(doc => (
                      <div key={doc.id} className="rounded-lg border border-cyan-500/10 bg-slate-900/60 p-3 flex items-center gap-3">
                        <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{doc.document_title || 'Untitled'}</p>
                          <p className="text-xs text-slate-500">{doc.document_type} • Shared {new Date(doc.shared_at).toLocaleString()}</p>
                        </div>
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </a>
                        )}
                        <button
                          onClick={() => handleRemove(doc.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Browse & Share */}
              <div>
                <button
                  onClick={() => setShowBrowse(!showBrowse)}
                  className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2 hover:text-purple-200 transition-colors"
                >
                  <FolderOpen className="h-4 w-4" />
                  {showBrowse ? 'Hide' : 'Browse File Cabinet'} to Share
                </button>

                <AnimatePresence>
                  {showBrowse && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                          <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search documents..."
                            className="w-full rounded-lg border border-cyan-500/20 bg-slate-900/60 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/40"
                          />
                        </div>

                        {filteredAvailable.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">No documents available to share</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {filteredAvailable.map(doc => (
                              <div key={doc.id} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 flex items-center gap-3">
                                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white truncate">{doc.document_title || 'Untitled'}</p>
                                  <p className="text-xs text-slate-500">{doc.document_type}</p>
                                </div>
                                <button
                                  onClick={() => handleShare(doc.id)}
                                  disabled={sharing === doc.id}
                                  className="flex items-center gap-1 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                                >
                                  {sharing === doc.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Share2 className="h-3 w-3" />
                                  )}
                                  Share
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
