import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  FileText,
  Sheet,
  Users,
  Folder,
  Plus,
  Share2,
  Copy,
  Trash2,
  X,
  ShieldCheck,
  Library,
  Loader2,
  Download,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DocumentEditor from './DocumentEditor'
import SpreadsheetEditor from './SpreadsheetEditor'
import {
  copySharedFileToAccount,
  createOfficeDocument,
  createOfficeFolder,
  createOfficeSpreadsheet,
  createOfficeTemplate,
  deleteOfficeDocument,
  deleteOfficeFolder,
  deleteOfficeSpreadsheet,
  fetchOfficeDocuments,
  fetchOfficeFolders,
  fetchOfficeSpreadsheets,
  fetchOfficeTemplates,
  fetchSharedWithMe,
  fetchSpreadsheetCells,
  getOfficeFileById,
  shareOfficeFilesWithUsers,
} from '@/services/officeService'
import type { OfficeDocument, OfficeFilePermission, OfficeFileListItem, OfficeFileType, OfficeFolder, OfficeSharedFile, OfficeSpreadsheet, OfficeTemplate } from '@/types/office'

type OfficeSection = 'documents' | 'spreadsheets' | 'shared' | 'templates'

interface TromailRecipient {
  user_id: string
  email_address: string
  role: string
  display_name: string | null
}

const panelClass = 'rounded-2xl border border-cyan-500/20 bg-slate-900/60 shadow-[0_0_35px_rgba(34,211,238,0.08)]'
const inputClass = 'border-cyan-500/30 bg-slate-950/80 text-white placeholder:text-slate-500'

function downloadBlob(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const defaultTemplates: Array<Pick<OfficeTemplate, 'title' | 'file_type' | 'description'>> = [
  { title: 'Policy Notice', file_type: 'document', description: 'Official policy or announcement layout.' },
  { title: 'Meeting Notes', file_type: 'document', description: 'Agenda, attendees, decisions, and follow-ups.' },
  { title: 'Budget Tracker', file_type: 'spreadsheet', description: 'Income, expenses, totals, and monthly summary.' },
  { title: 'Event Roster', file_type: 'spreadsheet', description: 'Attendance, roles, times, and notes.' },
]

export default function TroMailOfficePage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [section, setSection] = useState<OfficeSection>('documents')
  const [folders, setFolders] = useState<OfficeFolder[]>([])
  const [documents, setDocuments] = useState<OfficeDocument[]>([])
  const [spreadsheets, setSpreadsheets] = useState<OfficeSpreadsheet[]>([])
  const [sharedFiles, setSharedFiles] = useState<OfficeSharedFile[]>([])
  const [templates, setTemplates] = useState<OfficeTemplate[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<OfficeDocument | null>(null)
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<OfficeSpreadsheet | null>(null)
  const [openPermissionLevel, setOpenPermissionLevel] = useState<OfficeFilePermission>('owner')
  const [newFolderName, setNewFolderName] = useState('')
  const [newDocumentTitle, setNewDocumentTitle] = useState('')
  const [newSpreadsheetTitle, setNewSpreadsheetTitle] = useState('')
  const [isAdminDocument, setIsAdminDocument] = useState(false)
  const [shareFile, setShareFile] = useState<{ fileId: string; fileType: OfficeFileType; ownerId: string; permissionLevel: OfficeFilePermission; isAdminDocument?: boolean } | null>(null)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipients, setRecipients] = useState<TromailRecipient[]>([])
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])
  const [sharePermission, setSharePermission] = useState<OfficeFilePermission>('editor')
  const [isLoading, setIsLoading] = useState(false)

  const filteredRecipients = useMemo(() => recipients.filter((recipient) => {
    const haystack = `${recipient.email_address} ${recipient.role} ${recipient.display_name || ''}`.toLowerCase()
    return haystack.includes(recipientSearch.toLowerCase())
  }), [recipientSearch, recipients])

  const documentItems: OfficeFileListItem[] = useMemo(() => documents.map((document) => ({
    id: document.id,
    title: document.title,
    file_type: 'document',
    owner_id: document.owner_id,
    folder_id: document.folder_id,
    permission_level: 'owner',
    is_admin_document: document.is_admin_document,
    is_read_only: document.is_read_only,
    updated_at: document.updated_at,
    created_at: document.created_at,
    folder: document.folder || undefined,
  })), [documents])

  const spreadsheetItems: OfficeFileListItem[] = useMemo(() => spreadsheets.map((spreadsheet) => ({
    id: spreadsheet.id,
    title: spreadsheet.title,
    file_type: 'spreadsheet',
    owner_id: spreadsheet.owner_id,
    folder_id: spreadsheet.folder_id,
    permission_level: 'owner',
    updated_at: spreadsheet.updated_at,
    created_at: spreadsheet.created_at,
    folder: spreadsheet.folder || undefined,
  })), [spreadsheets])

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const [folderData, documentData, spreadsheetData, sharedData, templateData] = await Promise.all([
        fetchOfficeFolders(user.id),
        fetchOfficeDocuments(user.id, selectedFolderId || undefined),
        fetchOfficeSpreadsheets(user.id, selectedFolderId || undefined),
        fetchSharedWithMe(user.id),
        fetchOfficeTemplates(),
      ])
      setFolders(folderData)
      setDocuments(documentData)
      setSpreadsheets(spreadsheetData)
      setSharedFiles(sharedData)
      setTemplates(templateData)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load TroMail Office.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedFolderId, user?.id])

  const loadRecipients = async () => {
    const { data, error } = await supabase.from('tromail_accounts').select('user_id, email_address, role, display_name').eq('is_active', true)
    if (error) throw error
    setRecipients((data || []) as TromailRecipient[])
  }

  useEffect(() => {
    loadData()
    loadRecipients().catch(() => undefined)
  }, [loadData, section, selectedFolderId, user.id])

  const createFolder = async () => {
    if (!user?.id || !newFolderName.trim()) return
    try {
      await createOfficeFolder(user.id, newFolderName, null)
      setNewFolderName('')
      toast.success('Folder created.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create folder.')
    }
  }

  const deleteFolder = async (folderId: string) => {
    if (!window.confirm('Delete this folder? Files inside will be moved out of the folder.')) return
    try {
      await deleteOfficeFolder(folderId)
      toast.success('Folder deleted.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete folder.')
    }
  }

  const createDocument = async () => {
    if (!user?.id || !newDocumentTitle.trim()) {
      toast.error('Enter a document title.')
      return
    }
    try {
      const document = await createOfficeDocument({
        ownerId: user.id,
        title: newDocumentTitle,
        content: '<p>Start typing...</p>',
        folderId: selectedFolderId || null,
        isAdminDocument: isAdminDocument,
        isReadOnly: isAdminDocument,
      })
      setNewDocumentTitle('')
      setIsAdminDocument(false)
      setSelectedDocument(document)
      toast.success('Document created.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create document.')
    }
  }

  const createSpreadsheet = async () => {
    if (!user?.id || !newSpreadsheetTitle.trim()) {
      toast.error('Enter a spreadsheet title.')
      return
    }
    try {
      const spreadsheet = await createOfficeSpreadsheet({
        ownerId: user.id,
        title: newSpreadsheetTitle,
        folderId: selectedFolderId || null,
        initialData: { A1: 'Item', B1: 'Value', A2: 'Total', B2: '=SUM(B1:B1)' },
      })
      setNewSpreadsheetTitle('')
      setSelectedSpreadsheet(spreadsheet)
      toast.success('Spreadsheet created.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create spreadsheet.')
    }
  }

  const deleteFile = async (fileId: string, fileType: OfficeFileType) => {
    if (!window.confirm('Delete this file?')) return
    try {
      if (fileType === 'document') await deleteOfficeDocument(fileId)
      else await deleteOfficeSpreadsheet(fileId)
      toast.success('File deleted.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete file.')
    }
  }

  const savePersonalCopy = async (sharedFile: OfficeSharedFile) => {
    if (!user?.id) return
    try {
      await copySharedFileToAccount({ sharedFile, newOwnerId: user.id })
      toast.success('Personal copy saved.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save personal copy.')
    }
  }

  const shareSelectedFile = async () => {
    if (!shareFile || selectedRecipientIds.length === 0) {
      toast.error('Choose at least one recipient.')
      return
    }

    try {
      await shareOfficeFilesWithUsers({
        files: [{
          file_id: shareFile.fileId,
          file_type: shareFile.fileType,
          owner_id: shareFile.ownerId,
          is_admin_document: shareFile.isAdminDocument,
        }],
        sharedWithUserIds: selectedRecipientIds,
        permissionLevel: sharePermission,
      })
      toast.success('File shared.')
      setShareFile(null)
      setSelectedRecipientIds([])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to share file.')
    }
  }

  const createTemplateFromFile = async (file: OfficeFileListItem) => {
    if (!user?.id) return
    const title = window.prompt('Template title', `${file.title} Template`)
    if (!title) return

    try {
      await createOfficeTemplate({
        title,
        fileType: file.file_type,
        description: `Created from ${file.title}`,
        contentJson: { fileId: file.id, title: file.title, file_type: file.file_type },
      })
      toast.success('Template created.')
      setTemplates(await fetchOfficeTemplates())
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create template.')
    }
  }

  const createFromTemplate = async (template: OfficeTemplate) => {
    if (!user?.id) return
    try {
      if (template.file_type === 'document') {
        const document = await createOfficeDocument({
          ownerId: user.id,
          title: template.title,
          content: '<p>Template ready for editing.</p>',
          folderId: selectedFolderId || null,
        })
        setSelectedDocument(document)
      } else {
        const spreadsheet = await createOfficeSpreadsheet({
          ownerId: user.id,
          title: template.title,
          folderId: selectedFolderId || null,
          initialData: { A1: 'Template', B1: 'Ready' },
        })
        setSelectedSpreadsheet(spreadsheet)
      }
      toast.success('File created from template.')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create file from template.')
    }
  }

  const downloadSharedFile = async (sharedFile: OfficeSharedFile) => {
    try {
      if (sharedFile.file_type === 'document') {
        const file = (await getOfficeFileById(sharedFile.file_id, 'document')) as OfficeDocument
        downloadBlob(`${file.title || 'document'}.html`, file.content || '', 'text/html')
        return
      }

      const cells = await fetchSpreadsheetCells(sharedFile.file_id)
      const csv = cells.map((cell) => `"${cell.cell_reference}","${(cell.value || '').replace(/"/g, '""')}"`).join('\n')
      downloadBlob(`${sharedFile.spreadsheet?.title || 'spreadsheet'}.csv`, csv, 'text/csv')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download file.')
    }
  }

  const openFile = async (file: OfficeFileListItem, permissionLevel: OfficeFilePermission = 'owner') => {
    setOpenPermissionLevel(permissionLevel)
    if (file.file_type === 'document') {
      const document = documents.find((item) => item.id === file.id) || await getOfficeFileById(file.id, 'document')
      setSelectedDocument(document as OfficeDocument)
      setSelectedSpreadsheet(null)
    } else {
      const spreadsheet = spreadsheets.find((item) => item.id === file.id) || await getOfficeFileById(file.id, 'spreadsheet')
      setSelectedSpreadsheet(spreadsheet as OfficeSpreadsheet)
      setSelectedDocument(null)
    }
  }

  if (selectedDocument || selectedSpreadsheet) {
    return selectedDocument ? (
      <DocumentEditor
        user={user!}
        profile={profile}
        officeDocument={selectedDocument}
        folders={folders}
        permissionLevel={openPermissionLevel}
        onBack={() => { setSelectedDocument(null); setSelectedSpreadsheet(null); setOpenPermissionLevel('owner'); loadData() }}
        onRefresh={loadData}
        onOpenShare={(fileId, fileType, permissionLevel) => {
          const file = documentItems.find((item) => item.id === fileId)
          setShareFile(file || selectedDocument ? { fileId, fileType, ownerId: (file || selectedDocument)?.owner_id || user!.id, permissionLevel, isAdminDocument: selectedDocument?.is_admin_document } : null)
        }}
      />
    ) : (
      <SpreadsheetEditor
        user={user!}
        profile={profile}
        spreadsheet={selectedSpreadsheet}
        folders={folders}
        permissionLevel={openPermissionLevel}
        onBack={() => { setSelectedDocument(null); setSelectedSpreadsheet(null); setOpenPermissionLevel('owner'); loadData() }}
        onRefresh={loadData}
        onOpenShare={(fileId, fileType, permissionLevel) => {
          const file = spreadsheetItems.find((item) => item.id === fileId)
          setShareFile(file || selectedSpreadsheet ? { fileId, fileType, ownerId: (file || selectedSpreadsheet)?.owner_id || user!.id, permissionLevel } : null)
        }}
      />
    )
  }

  const activeFiles = section === 'documents' ? documentItems : section === 'spreadsheets' ? spreadsheetItems : []

  return (
    <div className="min-h-screen bg-[#0A0814] text-white" dir="ltr">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-500 shadow-[0_0_25px_rgba(34,211,238,0.25)]">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">TroMail Office</h1>
              <p className="text-xs text-cyan-300">Documents, spreadsheets, sharing, templates, and protected admin documents.</p>
            </div>
          </div>
          <Button onClick={() => navigate('/tromail')} variant="ghost" className="border border-cyan-500/20 text-cyan-200 hover:bg-cyan-500/20">Back to TroMail</Button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-cyan-500/20 pb-4">
          {[
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'spreadsheets', label: 'Spreadsheets', icon: Sheet },
            { id: 'shared', label: 'Shared With Me', icon: Users },
            { id: 'templates', label: 'Templates', icon: Library },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id as OfficeSection)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${section === item.id ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.13)]' : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className={`${panelClass} flex items-center justify-center py-12`}>
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        )}

        {!isLoading && section === 'shared' && (
          <div className="space-y-3">
            {sharedFiles.length === 0 ? (
              <div className={`${panelClass} p-8 text-center`}>
                <Users className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                <p className="text-slate-400">No shared Office files yet.</p>
              </div>
            ) : sharedFiles.map((sharedFile) => {
              const file = sharedFile.file_type === 'document' ? sharedFile.document : sharedFile.spreadsheet
              const ownerName = sharedFile.owner?.display_name || sharedFile.owner?.username || sharedFile.owner?.role || 'Unknown user'
              return (
                <div key={sharedFile.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {sharedFile.file_type === 'document' ? <FileText className="h-4 w-4 text-cyan-300" /> : <Sheet className="h-4 w-4 text-purple-300" />}
                        <p className="font-bold text-white">{file?.title}</p>
                      </div>
                      <p className="text-xs text-slate-400">Shared by {ownerName} • {sharedFile.permission_level} • {new Date(sharedFile.created_at).toLocaleString()}</p>
                      {sharedFile.file_type === 'document' && (sharedFile.document?.is_admin_document || sharedFile.document?.is_read_only) && (
                        <p className="mt-1 text-xs text-purple-300"><ShieldCheck className="mr-1 inline h-3 w-3" />Admin Document = Read Only</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openFile({ id: sharedFile.file_id, title: file?.title || 'Shared File', file_type: sharedFile.file_type, owner_id: sharedFile.owner_id, folder_id: null, permission_level: sharedFile.permission_level, updated_at: sharedFile.created_at, created_at: sharedFile.created_at }, sharedFile.permission_level)}>Open</Button>
                      <Button size="sm" variant="ghost" onClick={() => savePersonalCopy(sharedFile)} className="text-cyan-200 hover:bg-cyan-500/20"><Copy className="mr-1 h-4 w-4" />Save Copy</Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadSharedFile(sharedFile)} className="text-cyan-200 hover:bg-cyan-500/20"><Download className="mr-1 h-4 w-4" />Download</Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!isLoading && section === 'templates' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...defaultTemplates, ...templates].map((template, index) => (
              <div key={`${template.title}-${index}`} className={`${panelClass} p-5`}>
                <div className="mb-3 flex items-center gap-2">
                  {template.file_type === 'document' ? <FileText className="h-5 w-5 text-cyan-300" /> : <Sheet className="h-5 w-5 text-purple-300" />}
                  <h3 className="font-bold text-white">{template.title}</h3>
                </div>
                <p className="min-h-12 text-sm text-slate-400">{template.description}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => createFromTemplate(template as OfficeTemplate)}>Use</Button>
                  {templates.includes(template as OfficeTemplate) && <Button size="sm" variant="ghost" onClick={() => deleteOfficeTemplate((template as OfficeTemplate).id)} className="text-red-300 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (section === 'documents' || section === 'spreadsheets') && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className={`${panelClass} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Folders</h2>
                <Button size="sm" onClick={createFolder} disabled={!newFolderName.trim()} className="bg-cyan-600 hover:bg-cyan-500"><Plus className="mr-1 h-4 w-4" /></Button>
              </div>
              <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder name" className={`mb-3 ${inputClass}`} />
              <div className="space-y-2">
                <button onClick={() => setSelectedFolderId('')} className={`w-full rounded-xl border p-3 text-left ${!selectedFolderId ? 'border-cyan-400/40 bg-cyan-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                  All Files
                </button>
                {folders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-2">
                    <button onClick={() => setSelectedFolderId(folder.id)} className={`flex-1 rounded-xl border p-3 text-left ${selectedFolderId === folder.id ? 'border-cyan-400/40 bg-cyan-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                      <Folder className="mr-2 inline h-4 w-4 text-cyan-300" />{folder.name}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => deleteFolder(folder.id)} className="text-red-300 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>

              <div className="my-5 border-t border-cyan-500/20" />

              {section === 'documents' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-cyan-200">Create Document</h3>
                  <Input value={newDocumentTitle} onChange={(e) => setNewDocumentTitle(e.target.value)} placeholder="Document title" className={inputClass} />
                  {(profile?.is_admin || profile?.role === 'admin' || profile?.troll_role === 'admin') && (
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={isAdminDocument} onChange={(e) => setIsAdminDocument(e.target.checked)} className="rounded" />
                      Administrator document (read-only)
                    </label>
                  )}
                  <Button onClick={createDocument} className="w-full bg-cyan-600 hover:bg-cyan-500"><FileText className="mr-2 h-4 w-4" />Create Document</Button>
                </div>
              )}

              {section === 'spreadsheets' && (
                <div className="space-y-3">
                  <h3 className="font-bold text-purple-200">Create Spreadsheet</h3>
                  <Input value={newSpreadsheetTitle} onChange={(e) => setNewSpreadsheetTitle(e.target.value)} placeholder="Spreadsheet title" className={inputClass} />
                  <Button onClick={createSpreadsheet} className="w-full bg-purple-600 hover:bg-purple-500"><Sheet className="mr-2 h-4 w-4" />Create Spreadsheet</Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {activeFiles.length === 0 ? (
                <div className={`${panelClass} p-8 text-center`}>
                  {section === 'documents' ? <FileText className="mx-auto mb-3 h-12 w-12 text-slate-600" /> : <Sheet className="mx-auto mb-3 h-12 w-12 text-slate-600" />}
                  <p className="text-slate-400">No {section} found.</p>
                </div>
              ) : activeFiles.map((file) => (
                <div key={file.id} className={`${panelClass} p-4`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {file.file_type === 'document' ? <FileText className="h-5 w-5 text-cyan-300" /> : <Sheet className="h-5 w-5 text-purple-300" />}
                        <h3 className="truncate font-bold text-white">{file.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        {file.folder?.name || 'No folder'} • Updated {new Date(file.updated_at).toLocaleString()}
                      </p>
                      {file.is_admin_document && <p className="mt-1 text-xs text-purple-300"><ShieldCheck className="mr-1 inline h-3 w-3" />Admin Document = Read Only</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openFile(file)}>Open</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShareFile({ fileId: file.id, fileType: file.file_type, ownerId: file.owner_id, permissionLevel: 'editor', isAdminDocument: file.is_admin_document })} className="text-cyan-200 hover:bg-cyan-500/20"><Share2 className="mr-1 h-4 w-4" />Share</Button>
                      <Button size="sm" variant="ghost" onClick={() => createTemplateFromFile(file)} className="text-cyan-200 hover:bg-cyan-500/20"><Library className="mr-1 h-4 w-4" />Template</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteFile(file.id, file.file_type)} className="text-red-300 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {shareFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Share Office File</h3>
              <button onClick={() => { setShareFile(null); setSelectedRecipientIds([]) }} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-3 rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 text-sm text-purple-100">
              <ShieldCheck className="mr-2 inline h-4 w-4" />Administrator documents are always shared as Viewer / read-only.
            </div>
            <div className="mb-3 flex gap-2">
              <Input value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} placeholder="Search TroMail users" className={inputClass} />
              <select value={sharePermission} onChange={(e) => setSharePermission(e.target.value as OfficeFilePermission)} disabled={shareFile.isAdminDocument} className={`rounded-lg border p-2 ${inputClass}`}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <div className="mb-4 max-h-60 overflow-y-auto rounded-xl border border-cyan-500/20 bg-slate-900/50 p-2">
              {filteredRecipients.map((recipient) => {
                const checked = selectedRecipientIds.includes(recipient.user_id)
                return (
                  <button key={recipient.user_id} onClick={() => setSelectedRecipientIds(checked ? selectedRecipientIds.filter((id) => id !== recipient.user_id) : [...selectedRecipientIds, recipient.user_id])} className={`mb-2 flex w-full items-center justify-between rounded-lg border p-3 text-left ${checked ? 'border-cyan-400/40 bg-cyan-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                    <span>
                      <span className="block font-semibold text-white">{recipient.display_name || recipient.email_address}</span>
                      <span className="text-xs text-slate-400">{recipient.role} • {recipient.email_address}</span>
                    </span>
                    <span className={`h-4 w-4 rounded border ${checked ? 'border-cyan-300 bg-cyan-500' : 'border-slate-500'}`} />
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShareFile(null); setSelectedRecipientIds([]) }}>Cancel</Button>
              <Button onClick={shareSelectedFile} disabled={selectedRecipientIds.length === 0} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"><Share2 className="mr-2 h-4 w-4" />Share</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function deleteOfficeTemplate(templateId: string) {
  const { supabase } = await import('@/lib/supabase')
  const { error } = await supabase.from('office_templates').delete().eq('id', templateId)
  if (error) throw error
}
