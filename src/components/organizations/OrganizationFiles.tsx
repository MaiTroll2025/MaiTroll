import React, { useMemo, useState } from 'react'
import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { ORG_FILE_FOLDERS, useOrganizationFiles } from '@/hooks/useOrganizationFiles'
import type { OrganizationRecord } from '@/hooks/useOrganizations'

export default function OrganizationFiles({ organization, canManage = false }: { organization: OrganizationRecord; canManage?: boolean }) {
  const { files, loading, uploading, uploadFile, downloadFile, softDeleteFile } = useOrganizationFiles(organization.id)
  const [folder, setFolder] = useState('General')
  const [accessLevel, setAccessLevel] = useState<'admin_only' | 'org_admin' | 'org_staff'>('org_staff')
  const [description, setDescription] = useState('')
  const grouped = useMemo(() => {
    return files.reduce<Record<string, typeof files>>((acc, file) => {
      acc[file.folder || 'General'] = acc[file.folder || 'General'] || []
      acc[file.folder || 'General'].push(file)
      return acc
    }, {})
  }, [files])

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await uploadFile(file, folder, accessLevel, description)
    event.target.value = ''
    setDescription('')
  }

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-lg border border-purple-500/20 bg-[#14101f] p-4">
        <h2 className="mb-1 text-sm font-semibold text-white">Files</h2>
        <p className="mb-4 text-xs text-zinc-400">Files are private to this organization.</p>

        <div className="space-y-3">
          <label className="block text-xs text-zinc-300">
            Folder
            <select value={folder} onChange={(event) => setFolder(event.target.value)} className="mt-1 w-full rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-white">
              {ORG_FILE_FOLDERS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-300">
            Access
            <select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as any)} className="mt-1 w-full rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-white">
              <option value="org_staff">Org staff</option>
              <option value="org_admin">Org admins</option>
              <option value="admin_only">Mai Troll admins only</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-300">
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 h-20 w-full resize-none rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-white" />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload File'}
            <input type="file" className="hidden" disabled={uploading} onChange={onPick} />
          </label>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto rounded-lg border border-purple-500/20 bg-[#14101f] p-4">
        {loading && <div className="text-sm text-zinc-400">Loading files...</div>}
        {!loading && files.length === 0 && <div className="text-sm text-zinc-500">No files uploaded yet.</div>}
        <div className="space-y-5">
          {Object.entries(grouped).map(([group, groupFiles]) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-200">{group}</h3>
              <div className="space-y-2">
                {groupFiles.map((file) => (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-300" />
                        <span className="truncate text-sm font-medium text-white">{file.file_name}</span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {file.access_level.replace('_', ' ')} • {new Date(file.created_at).toLocaleDateString()} • v{file.version}
                      </div>
                      {file.description && <p className="mt-1 text-xs text-zinc-400">{file.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => downloadFile(file)} className="rounded-md border border-purple-500/20 p-2 text-purple-200 hover:bg-purple-500/10" title="Download">
                        <Download className="h-4 w-4" />
                      </button>
                      {canManage && (
                        <button onClick={() => softDeleteFile(file)} className="rounded-md border border-red-500/20 p-2 text-red-300 hover:bg-red-500/10" title="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
