import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ClipboardList,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Link2,
  Copy,
  Send,
  Loader2,
  UserCog,
  Filter,
  Inbox,
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { validateFile, FILE_VALIDATION } from '@/lib/fileValidation'
import {
  BETA_FEEDBACK_CATEGORIES,
  BETA_FEEDBACK_DEVICES,
  BETA_FEEDBACK_PRIORITIES,
  BETA_FEEDBACK_SEVERITIES,
  BETA_FEEDBACK_STATUSES,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  SEVERITY_LABELS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type BetaFeedback,
  type BetaFeedbackCategory,
  type BetaFeedbackDevice,
  type BetaFeedbackPriority,
  type BetaFeedbackReply,
  type BetaFeedbackSeverity,
  type BetaFeedbackStatus,
  type BetaFeedbackUserGroup,
  type BetaFeedbackWithUser,
  type BetaReplyVisibility,
} from '@/types/betaFeedback'
import {
  addInternalNote,
  addReply,
  archiveFeedback,
  assignFeedback,
  bulkUpdate,
  captureEnvironment,
  getAssignableStaff,
  getAuditLog,
  getFeedbackById,
  getInternalNotes,
  getModeratorFeedback,
  getMyFeedback,
  getReplies,
  getStats,
  getUserFeedback,
  getUserGroups,
  isChatDisabledKnown,
  markDuplicate,
  respondToFeedback,
  restoreFeedback,
  setPriority,
  submitBetaFeedback,
  updateStatus,
  uploadScreenshot,
} from '@/services/betaFeedback'

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: BetaFeedbackStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: BetaFeedbackPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_BADGE_CLASSES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function Avatar({ url, size = 32 }: { url: string | null | undefined; size?: number }) {
  const [errored, setErrored] = useState(false)
  if (errored || !url) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setErrored(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  )
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/60'
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400'

// ----------------------------------------------------------------------------
// Submit form (normal users)
// ----------------------------------------------------------------------------
function SubmitForm({ userId, onSubmitted }: { userId: string; onSubmitted: (f: BetaFeedback) => void }) {
  const location = useLocation()
  const [category, setCategory] = useState<BetaFeedbackCategory>('Bug Report')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [affectedFeature, setAffectedFeature] = useState('')
  const [device, setDevice] = useState<BetaFeedbackDevice | ''>('')
  const [severity, setSeverity] = useState<BetaFeedbackSeverity | ''>('')
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const titleError = title.trim().length < 5 || title.trim().length > 150
  const descError = description.trim().length < 10 || description.trim().length > 5000

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (titleError || descError) {
      toast.error('Please check the title (5-150 chars) and description (10-5000 chars).')
      return
    }
    setSubmitting(true)
    try {
      let finalUrl = screenshotUrl.trim() || null
      if (file) {
        const v = validateFile(file, FILE_VALIDATION.image.types, FILE_VALIDATION.image.maxSize, 'Screenshot')
        if (!v.valid) {
          toast.error(v.error || 'Invalid file')
          setSubmitting(false)
          return
        }
        finalUrl = await uploadScreenshot(file, userId)
      }
      const capture = captureEnvironment(location.pathname)
      const created = await submitBetaFeedback({
        category,
        title: title.trim(),
        description: description.trim(),
        affected_feature: affectedFeature.trim() || null,
        device_type: device || null,
        severity: severity || null,
        screenshot_url: finalUrl,
        capture,
      })
      toast.success(`Feedback submitted (${created.public_id})`)
      setTitle('')
      setDescription('')
      setAffectedFeature('')
      setDevice('')
      setSeverity('')
      setScreenshotUrl('')
      setFile(null)
      onSubmitted(created)
    } catch (err) {
      if (isChatDisabledKnown(err)) {
        toast.error('Your ability to submit new feedback is currently disabled due to an active chat restriction.')
      } else {
        toast.error((err as Error)?.message || 'Failed to submit feedback')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <h3 className="text-lg font-bold text-white">Submit Feedback</h3>

      <div>
        <label className={labelClass}>Feedback category *</label>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as BetaFeedbackCategory)}>
          {BETA_FEEDBACK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Title *</label>
        <input
          className={inputClass}
          value={title}
          maxLength={150}
          placeholder="Short summary of the issue or idea"
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="mt-1 text-right text-xs text-slate-500">{title.trim().length}/150</div>
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          className={`${inputClass} min-h-[140px] resize-y`}
          value={description}
          maxLength={5000}
          placeholder="Describe what happened, what you expected, and steps to reproduce."
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="mt-1 text-right text-xs text-slate-500">{description.trim().length}/5000</div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Page or feature affected</label>
          <input
            className={inputClass}
            value={affectedFeature}
            placeholder="e.g. Broadcast chat"
            onChange={(e) => setAffectedFeature(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Device type</label>
          <select className={inputClass} value={device} onChange={(e) => setDevice(e.target.value as BetaFeedbackDevice | '')}>
            <option value="">Prefill below / unknown</option>
            {BETA_FEEDBACK_DEVICES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Severity (optional, user-reported)</label>
          <select className={inputClass} value={severity} onChange={(e) => setSeverity(e.target.value as BetaFeedbackSeverity | '')}>
            <option value="">Not selected</option>
            {BETA_FEEDBACK_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Screenshot URL (optional)</label>
          <input
            className={inputClass}
            value={screenshotUrl}
            placeholder="https://…"
            onChange={(e) => setScreenshotUrl(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Or upload a screenshot (optional)</label>
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-600/80 file:px-3 file:py-2 file:text-white hover:file:bg-cyan-500"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <div className="mt-1 text-xs text-cyan-300">Selected: {file.name}</div>}
      </div>

      <p className="text-xs text-slate-500">
        We automatically capture your current page, browser, device, and app version — you do not need to enter those manually.
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 sticky bottom-0"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        {submitting ? 'Submitting…' : 'Submit Feedback'}
      </button>
    </form>
  )
}

// ----------------------------------------------------------------------------
// Replies section (shared by user + moderator)
// ----------------------------------------------------------------------------
interface ReplyWithAuthor extends BetaFeedbackReply {
  author?: { username: string | null; avatar_url: string | null } | null
}

function RepliesSection({
  feedbackId,
  isModerator,
  canUserReply,
  reloadToken,
  onChanged,
}: {
  feedbackId: string
  isModerator: boolean
  canUserReply: boolean
  reloadToken: number
  onChanged: () => void
}) {
  const [replies, setReplies] = useState<ReplyWithAuthor[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = (await getReplies(feedbackId)) as unknown as ReplyWithAuthor[]
      setReplies(data)
    } catch {
      /* ignore */
    }
  }, [feedbackId])

  useEffect(() => {
    load()
  }, [load, reloadToken])

  const send = async (visibility: BetaReplyVisibility) => {
    if (!body.trim() || sending) return
    setSending(true)
    try {
      await addReply(feedbackId, body.trim(), visibility)
      setBody('')
      await load()
      onChanged()
    } catch (err) {
      if (isChatDisabledKnown(err)) {
        toast.error('Your ability to reply is currently disabled due to an active chat restriction.')
      } else {
        toast.error((err as Error)?.message || 'Failed to send reply')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-white">Conversation</h4>
      <div className="space-y-2">
        {replies.length === 0 && <p className="text-sm text-slate-500">No replies yet.</p>}
        {replies.map((r) => (
          <div
            key={r.id}
            className={`rounded-lg border p-2 text-sm ${
              r.visibility === 'staff_only'
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                : 'border-white/10 bg-slate-800/40 text-slate-200'
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              <Avatar url={r.author?.avatar_url} size={20} />
              <span>@{r.author?.username || 'user'}</span>
              {r.visibility === 'staff_only' && (
                <span className="rounded bg-amber-500/30 px-1 text-[10px] font-bold text-amber-200">STAFF ONLY</span>
              )}
              <span className="ml-auto">{formatDate(r.created_at)}</span>
            </div>
            <div className="whitespace-pre-wrap">{r.body}</div>
          </div>
        ))}
      </div>
      {canUserReply && !isModerator && (
        <div className="space-y-2">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={body}
            placeholder="Reply to the moderator…"
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            type="button"
            disabled={sending || !body.trim()}
            onClick={() => send('user_visible')}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      )}
      {isModerator && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={body}
            placeholder="Add a staff-only note or user-visible reply…"
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={sending || !body.trim()}
              onClick={() => send('user_visible')}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Reply to user
            </button>
            <button
              type="button"
              disabled={sending || !body.trim()}
              onClick={() => send('staff_only')}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Staff-only note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Feedback detail (moderator)
// ----------------------------------------------------------------------------
function FeedbackDetail({
  feedback,
  isModerator,
  currentUserId,
  reloadToken,
  onChanged,
  onBack,
}: {
  feedback: BetaFeedbackWithUser
  isModerator: boolean
  currentUserId: string
  reloadToken: number
  onChanged: () => void
  onBack: () => void
}) {
  const [tab, setTab] = useState<'details' | 'notes' | 'audit' | 'replies'>('details')
  const [status, setStatus] = useState<BetaFeedbackStatus>(feedback.status)
  const [priority, setPriorityState] = useState<BetaFeedbackPriority>(feedback.priority)
  const [assignedTo, setAssignedTo] = useState<string>(feedback.assigned_to ?? '')
  const [staff, setStaff] = useState<{ id: string; username: string | null }[]>([])
  const [response, setResponse] = useState(feedback.moderator_response ?? '')
  const [note, setNote] = useState('')
  const [duplicateOf, setDuplicateOf] = useState('')
  const [notes, setNotes] = useState<{ id: string; note: string; created_at: string; moderator_id: string }[]>([])
  const [audit, setAudit] = useState<
    { id: string; action: string; actor?: { username: string | null }; old_values: unknown; new_values: unknown; created_at: string }[]
  >([])
  const [busy, setBusy] = useState(false)

  const refreshDetail = useCallback(async () => {
    try {
      const [n, a] = await Promise.all([getInternalNotes(feedback.id), getAuditLog(feedback.id)])
      setNotes(n as never)
      setAudit(a as never)
    } catch {
      /* ignore */
    }
  }, [feedback.id])

  useEffect(() => {
    setStatus(feedback.status)
    setPriorityState(feedback.priority)
    setAssignedTo(feedback.assigned_to ?? '')
    setResponse(feedback.moderator_response ?? '')
    refreshDetail()
  }, [feedback, refreshDetail])

  useEffect(() => {
    if (tab === 'notes' || tab === 'audit') refreshDetail()
  }, [tab, refreshDetail])

  useEffect(() => {
    getAssignableStaff().then((s) => setStaff(s.map((x) => ({ id: x.id, username: x.username })))).catch(() => {})
  }, [])

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(successMsg)
      onChanged()
    } catch (err) {
      toast.error((err as Error)?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
        tab === key ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-cyan-300 hover:underline">
        ← Back to reports
      </button>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-cyan-300">{feedback.public_id}</span>
          <StatusBadge status={feedback.status} />
          <PriorityBadge priority={feedback.priority} />
          <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">{feedback.category}</span>
        </div>
        <h3 className="text-lg font-bold text-white">{feedback.title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{feedback.description}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-3">
          <div>Feature: {feedback.affected_feature || '—'}</div>
          <div>Route: {feedback.affected_route || '—'}</div>
          <div>Device: {feedback.device_type || '—'}</div>
          <div>Browser: {feedback.browser_name || '—'}</div>
          <div>Severity: {feedback.severity ? SEVERITY_LABELS[feedback.severity] : '—'}</div>
          <div>Created: {formatDate(feedback.created_at)}</div>
          <div>Viewport: {feedback.viewport_width && feedback.viewport_height ? `${feedback.viewport_width}x${feedback.viewport_height}` : '—'}</div>
          <div>PWA: {feedback.is_pwa ? 'Yes' : 'No'}</div>
          <div>Version: {feedback.app_version || '—'}</div>
        </div>
        {feedback.screenshot_url && (
          <a href={feedback.screenshot_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-cyan-300 hover:underline">
            View screenshot
          </a>
        )}
        {feedback.moderator_response && (
          <div className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2 text-sm text-cyan-100">
            <span className="font-semibold">Moderator response: </span>
            {feedback.moderator_response}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-slate-900/40 p-1">
        {tabBtn('details', 'Moderate')}
        {tabBtn('notes', 'Internal Notes')}
        {tabBtn('audit', 'Audit History')}
        {tabBtn('replies', 'Replies')}
      </div>

      {tab === 'details' && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as BetaFeedbackStatus)}>
                {BETA_FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={priority} onChange={(e) => setPriorityState(e.target.value as BetaFeedbackPriority)}>
                {BETA_FEEDBACK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Assign to</label>
              <select className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    @{s.username || s.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || status === feedback.status}
              onClick={() => run(() => updateStatus(feedback.id, status), 'Status updated')}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Save status
            </button>
            <button
              type="button"
              disabled={busy || priority === feedback.priority}
              onClick={() => run(() => setPriority(feedback.id, priority), 'Priority updated')}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Save priority
            </button>
            <button
              type="button"
              disabled={busy || assignedTo === (feedback.assigned_to ?? '')}
              onClick={() => run(() => assignFeedback(feedback.id, assignedTo || null), 'Assignment updated')}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Save assignment
            </button>
            <button
              type="button"
              disabled={busy || !!feedback.archived_at}
              onClick={() => run(() => archiveFeedback(feedback.id), 'Archived')}
              className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" /> Archive
            </button>
            <button
              type="button"
              disabled={busy || !feedback.archived_at}
              onClick={() => run(() => restoreFeedback(feedback.id), 'Restored')}
              className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
            >
              <ArchiveRestore className="h-4 w-4" /> Restore
            </button>
          </div>

          <div>
            <label className={labelClass}>Public response to user</label>
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              value={response}
              maxLength={5000}
              onChange={(e) => setResponse(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !response.trim()}
              onClick={() => run(() => respondToFeedback(feedback.id, response.trim()), 'Response sent')}
              className="mt-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Send response
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Mark as duplicate of (public ID)</label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={duplicateOf}
                  placeholder="TC-BETA-1234"
                  onChange={(e) => setDuplicateOf(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !duplicateOf.trim()}
                  onClick={() => run(async () => {
                    const target = await getFeedbackById(duplicateOf.trim())
                    if (!target) throw new Error('Target not found')
                    await markDuplicate(feedback.id, target.id)
                  }, 'Marked as duplicate')}
                  className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" /> Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h4 className="text-sm font-bold text-amber-200">Internal notes (staff only)</h4>
          <div className="space-y-2">
            {notes.length === 0 && <p className="text-sm text-slate-500">No internal notes.</p>}
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2 text-sm text-amber-100">
                <div className="mb-1 text-xs text-amber-300/70">{formatDate(n.created_at)}</div>
                {n.note}
              </div>
            ))}
          </div>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={note}
            placeholder="Add an internal note…"
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !note.trim()}
            onClick={() => run(async () => { await addInternalNote(feedback.id, note.trim()); setNote('') }, 'Note added')}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h4 className="text-sm font-bold text-white">Audit history</h4>
          <div className="space-y-2">
            {audit.length === 0 && <p className="text-sm text-slate-500">No audit entries.</p>}
            {audit.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/10 bg-slate-800/40 p-2 text-sm text-slate-300">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-cyan-300">{a.action}</span>
                  <span>by @{a.actor?.username || 'system'}</span>
                  <span className="ml-auto">{formatDate(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'replies' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <RepliesSection
            feedbackId={feedback.id}
            isModerator={isModerator}
            canUserReply={false}
            reloadToken={reloadToken}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// User feedback list
// ----------------------------------------------------------------------------
function UserFeedbackList({
  userId,
  chatDisabled,
  reloadToken,
  onReload,
}: {
  userId: string
  chatDisabled: boolean
  reloadToken: number
  onReload: () => void
}) {
  const [items, setItems] = useState<BetaFeedback[]>([])
  const [statusFilter, setStatusFilter] = useState<BetaFeedbackStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMyFeedback(userId, { status: statusFilter === 'all' ? null : statusFilter })
      setItems(data)
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }, [userId, statusFilter])

  useEffect(() => {
    load()
  }, [load, reloadToken])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
        >
          All
        </button>
        {BETA_FEEDBACK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusFilter === s ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 text-center text-slate-500">
          <Inbox className="mx-auto mb-2 h-8 w-8" />
          You have not submitted any feedback yet.
        </div>
      )}

      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
              <span className="font-mono text-xs font-bold text-cyan-300">{f.public_id}</span>
              <span className="flex-1 truncate text-sm font-semibold text-white">{f.title}</span>
              <StatusBadge status={f.status} />
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expanded === f.id ? 'rotate-180' : ''}`} />
            </button>
            {expanded === f.id && (
              <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={f.priority} />
                  <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">{f.category}</span>
                  {f.severity && <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">{SEVERITY_LABELS[f.severity]}</span>}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-300">{f.description}</p>
                <div className="text-xs text-slate-500">Submitted {formatDate(f.created_at)}</div>
                {f.moderator_response && (
                  <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2 text-sm text-cyan-100">
                    <span className="font-semibold">Moderator: </span>
                    {f.moderator_response}
                  </div>
                )}
                <RepliesSection
                  feedbackId={f.id}
                  isModerator={false}
                  canUserReply={!chatDisabled}
                  reloadToken={reloadToken}
                  onChanged={onReload}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Moderator view
// ----------------------------------------------------------------------------
type ModTab = 'overview' | 'groups' | 'all' | 'critical' | 'unresolved' | 'assigned' | 'fixed' | 'archived'

const MOD_TABS: { key: ModTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'groups', label: 'User Groups' },
  { key: 'all', label: 'All Reports' },
  { key: 'critical', label: 'Critical' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'assigned', label: 'Assigned to Me' },
  { key: 'fixed', label: 'Recently Fixed' },
  { key: 'archived', label: 'Archived' },
]

function ModeratorView({ userId, reloadToken, onReload }: { userId: string; reloadToken: number; onReload: () => void }) {
  const [tab, setTab] = useState<ModTab>('overview')
  const [stats, setStats] = useState<{ total: number; submitted: number; under_review: number; critical: number; fixed: number; unique_reporters: number } | null>(null)
  const [groups, setGroups] = useState<BetaFeedbackUserGroup[]>([])
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [groupFeedback, setGroupFeedback] = useState<Record<string, BetaFeedbackWithUser[]>>({})
  const [items, setItems] = useState<BetaFeedbackWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<BetaFeedbackWithUser | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<{ status?: BetaFeedbackStatus | ''; priority?: BetaFeedbackPriority | ''; category?: string; archive?: boolean | null }>({})

  // filters
  const [fUsername, setFUsername] = useState('')
  const [fStatus, setFStatus] = useState<BetaFeedbackStatus | ''>('')
  const [fCategory, setFCategory] = useState<string>('')
  const [fPriority, setFPriority] = useState<BetaFeedbackPriority | ''>('')
  const [fDevice, setFDevice] = useState<string>('')

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats()
      setStats(s)
    } catch {
      /* ignore */
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const g = await getUserGroups(100, 0)
      setGroups(g)
    } catch {
      /* ignore */
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getModeratorFeedback(
        {
          username: fUsername || null,
          status: fStatus || null,
          category: (fCategory || null) as never,
          priority: fPriority || null,
          device: (fDevice || null) as never,
          assignedToMe: tab === 'assigned',
          onlyArchived: tab === 'archived',
        },
        userId,
        300
      )
      let filtered = data
      if (tab === 'critical') filtered = data.filter((d) => d.priority === 'critical' && !d.archived_at)
      if (tab === 'unresolved') filtered = data.filter((d) => !['fixed', 'closed', 'declined', 'duplicate'].includes(d.status))
      if (tab === 'fixed') filtered = data.filter((d) => d.status === 'fixed').sort((a, b) => (b.resolved_at || '').localeCompare(a.resolved_at || ''))
      setItems(filtered)
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [fUsername, fStatus, fCategory, fPriority, fDevice, tab, userId])

  useEffect(() => {
    loadStats()
    loadGroups()
  }, [loadStats, loadGroups, reloadToken])

  useEffect(() => {
    if (tab === 'overview' || tab === 'groups') return
    loadList()
  }, [loadList, tab, reloadToken])

  const toggleSelect = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDetail = async (id: string) => {
    try {
      const f = await getFeedbackById(id)
      if (f) {
        setSelected(f)
        setSelectedId(id)
      }
    } catch {
      /* ignore */
    }
  }

  const applyBulk = async () => {
    const ids = Array.from(selection)
    if (ids.length === 0) return
    try {
      const updated = await bulkUpdate(ids, {
        status: bulk.status || null,
        priority: bulk.priority || null,
        category: (bulk.category || null) as BetaFeedbackCategory | null,
        archive: bulk.archive ?? null,
      })
      toast.success(`Updated ${updated} report(s)`)
      setSelection(new Set())
      setBulk({})
      onReload()
    } catch (err) {
      toast.error((err as Error)?.message || 'Bulk update failed')
    }
  }

  const loadGroupFeedback = async (uid: string) => {
    if (groupFeedback[uid]) {
      setExpandedGroup(expandedGroup === uid ? null : uid)
      return
    }
    try {
      const data = await getUserFeedback(uid)
      setGroupFeedback((prev) => ({ ...prev, [uid]: data as BetaFeedbackWithUser[] }))
      setExpandedGroup(uid)
    } catch {
      /* ignore */
    }
  }

  if (selected) {
    return (
      <FeedbackDetail
        feedback={selected}
        isModerator
        currentUserId={userId}
        reloadToken={reloadToken}
        onChanged={() => {
          onReload()
          openDetail(selected.id)
        }}
        onBack={() => {
          setSelected(null)
          setSelectedId(null)
        }}
      />
    )
  }

  const summaryCards = [
    { label: 'Total Reports', value: stats?.total ?? 0 },
    { label: 'Submitted', value: stats?.submitted ?? 0 },
    { label: 'Under Review', value: stats?.under_review ?? 0 },
    { label: 'Critical', value: stats?.critical ?? 0 },
    { label: 'Fixed', value: stats?.fixed ?? 0 },
    { label: 'Unique Reporters', value: stats?.unique_reporters ?? 0 },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            <div className="text-2xl font-bold text-white">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {MOD_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'groups' ? (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.user_id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
              <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => loadGroupFeedback(g.user_id)}>
                <Avatar url={g.avatar_url} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">@{g.username || 'unknown'}</span>
                    <span className="rounded-full bg-cyan-600/30 px-2 py-0.5 text-xs font-bold text-cyan-200">{g.submission_count}</span>
                    {g.unresolved_count > 0 && (
                      <span className="rounded-full bg-orange-600/30 px-2 py-0.5 text-xs font-bold text-orange-200">{g.unresolved_count} open</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">Last activity {formatDate(g.latest_submission_at)}</div>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 ${expandedGroup === g.user_id ? 'rotate-180' : ''}`} />
              </button>
              {expandedGroup === g.user_id && (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {(groupFeedback[g.user_id] ?? []).map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-800/40 p-2">
                      <span className="font-mono text-xs font-bold text-cyan-300">{f.public_id}</span>
                      <span className="flex-1 truncate text-sm text-white">{f.title}</span>
                      <StatusBadge status={f.status} />
                      <button type="button" onClick={() => openDetail(f.id)} className="text-xs text-cyan-300 hover:underline">
                        Open
                      </button>
                    </div>
                  ))}
                  {(groupFeedback[g.user_id] ?? []).length === 0 && <p className="text-sm text-slate-500">No reports.</p>}
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-slate-500">No reporters yet.</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <div className="flex-1 min-w-[140px]">
              <label className={labelClass}>Search username</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                <input className={`${inputClass} pl-8`} value={fUsername} placeholder="username" onChange={(e) => setFUsername(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={fStatus} onChange={(e) => setFStatus(e.target.value as BetaFeedbackStatus | '')}>
                <option value="">Any</option>
                {BETA_FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select className={inputClass} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                <option value="">Any</option>
                {BETA_FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={fPriority} onChange={(e) => setFPriority(e.target.value as BetaFeedbackPriority | '')}>
                <option value="">Any</option>
                {BETA_FEEDBACK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Device</label>
              <select className={inputClass} value={fDevice} onChange={(e) => setFDevice(e.target.value)}>
                <option value="">Any</option>
                {BETA_FEEDBACK_DEVICES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={loadList} className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>

          {selection.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-3">
              <span className="text-sm font-semibold text-white">{selection.size} selected</span>
              <select className={`${inputClass} w-auto`} value={bulk.status ?? ''} onChange={(e) => setBulk((b) => ({ ...b, status: e.target.value as BetaFeedbackStatus | '' }))}>
                <option value="">Set status…</option>
                {BETA_FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select className={`${inputClass} w-auto`} value={bulk.priority ?? ''} onChange={(e) => setBulk((b) => ({ ...b, priority: e.target.value as BetaFeedbackPriority | '' }))}>
                <option value="">Set priority…</option>
                {BETA_FEEDBACK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
              <select className={`${inputClass} w-auto`} value={bulk.category ?? ''} onChange={(e) => setBulk((b) => ({ ...b, category: e.target.value }))}>
                <option value="">Set category…</option>
                {BETA_FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button type="button" onClick={() => setBulk((b) => ({ ...b, archive: true }))} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600">
                Archive
              </button>
              <button type="button" onClick={applyBulk} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
                Apply
              </button>
              <button type="button" onClick={() => setSelection(new Set())} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && items.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 text-center text-slate-500">
              <Inbox className="mx-auto mb-2 h-8 w-8" /> No reports in this view.
            </div>
          )}

          <div className="space-y-2">
            {items.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <input type="checkbox" checked={selection.has(f.id)} onChange={() => toggleSelect(f.id)} className="h-4 w-4 accent-cyan-500" />
                <Avatar url={f.user_profiles?.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-300">{f.public_id}</span>
                    <span className="truncate text-sm font-semibold text-white">{f.title}</span>
                    <StatusBadge status={f.status} />
                    <PriorityBadge priority={f.priority} />
                  </div>
                  <div className="text-xs text-slate-400">
                    @{f.user_profiles?.username || 'unknown'} · {f.category} · {formatDate(f.created_at)}
                  </div>
                </div>
                <button type="button" onClick={() => openDetail(f.id)} className="text-xs text-cyan-300 hover:underline">
                  Open
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Main page
// ----------------------------------------------------------------------------
export default function BetaFeedbackPage() {
  const { user, profile } = useAuthStore()
  const [isModerator, setIsModerator] = useState(false)
  const [chatDisabled, setChatDisabled] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .rpc('is_beta_feedback_moderator', { p_user_id: user.id })
      .then(
        ({ data }) => {
          if (active) setIsModerator(Boolean(data))
        },
        () => {}
      )
    supabase
      .rpc('is_user_chat_disabled', { p_user_id: user.id })
      .then(
        ({ data }) => {
          if (active) setChatDisabled(Boolean(data))
        },
        () => {}
      )
    return () => {
      active = false
    }
  }, [user])

  // Realtime: only subscribe to this user's own rows, or all rows for moderators.
  useEffect(() => {
    if (!user) return
    const filter = isModerator ? undefined : `user_id=eq.${user.id}`
    const channel = supabase
      .channel(`beta-feedback-rt:${user.id}:${isModerator}`)
      .on(
        'postgres_changes',
        filter
          ? { event: '*', schema: 'public', table: 'beta_feedback', filter }
          : { event: '*', schema: 'public', table: 'beta_feedback' },
        () => reload()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, isModerator, reload])

  if (!user) {
    return <div className="p-6 text-center text-slate-400">Please sign in to use Beta Feedback.</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 pb-28 pt-4 sm:px-4">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-cyan-400" />
          <h1 className="text-2xl font-black tracking-tight text-white">BETA TEST FEEDBACK</h1>
        </div>
        <p className="text-sm text-slate-400">
          Help us improve Mai Troll by reporting bugs, sharing suggestions, or telling us what is working well.
        </p>
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Please do not submit passwords, payment information, private messages, or other sensitive personal
            information.
          </span>
        </div>
      </header>

      {chatDisabled && !isModerator && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your ability to submit new feedback is currently disabled due to an active chat restriction.
          </span>
        </div>
      )}

      {isModerator ? (
        <ModeratorView userId={user.id} reloadToken={reloadToken} onReload={reload} />
      ) : (
        <div className="space-y-6">
          {!chatDisabled && (
            <SubmitForm userId={user.id} onSubmitted={() => reload()} />
          )}
          <UserFeedbackList userId={user.id} chatDisabled={chatDisabled} reloadToken={reloadToken} onReload={reload} />
        </div>
      )}
    </div>
  )
}


