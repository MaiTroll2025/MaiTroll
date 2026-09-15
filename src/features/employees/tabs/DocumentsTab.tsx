import React, {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import type { EmployeeProfileLike } from '../permissions'
import {
  canViewDocument,
  getDocumentSensitivity,
  isAdmin as isAdminProfile,
  isLeadOrSecretary,
  type AccessProfileLike,
} from '../../../lib/documentAccess'
import type { DocumentFormProps } from '../components/documents/DocumentFormShell'

const DOCS_BUCKET = 'employee-documents'
const CATEGORY_ORDER: string[] = [
  'onboarding',
  'legal',
  'tax',
  'payroll',
  'hr',
  'policy',
  'training',
]

type DocStatus =
  | 'not_sent'
  | 'sent'
  | 'submitted'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'waived'
  | 'completed'

const STATUS_META: Record<
  DocStatus,
  { label: string; pill: string }
> = {
  not_sent: {
    label: 'Not Started',
    pill: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/20',
  },
  sent: {
    label: 'In Progress',
    pill: 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/20',
  },
  submitted: {
    label: 'Submitted',
    pill: 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20',
  },
  needs_correction: {
    label: 'Needs Correction',
    pill: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20',
  },
  approved: {
    label: 'Approved',
    pill: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20',
  },
  rejected: {
    label: 'Rejected',
    pill: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20',
  },
  waived: {
    label: 'Waived',
    pill: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/20',
  },
  completed: {
    label: 'Completed',
    pill: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20',
  },
}

/**
 * Shared props contract for every generated form component. This mirrors the
 * We import `DocumentFormProps` directly from DocumentFormShell.tsx
 * (built by another agent) so the dynamically-loaded forms and this
 * host share one type identity and type-check cleanly.
 */
type DocumentFormComponent = ComponentType<DocumentFormProps>

/**
 * document_key -> generated form component.
 *
 * The form components are default-exported from
 * src/features/employees/components/documents/ and are being built by another
 * agent. We wire the imports defensively via React.lazy so that:
 *   - a not-yet-created module fails gracefully into a fallback card, and
 *   - each form is code-split.
 *
 * Both snake_case and legacy mixed-case document_keys are mapped.
 */
const FORM_LOADERS: Record<string, () => Promise<{ default: DocumentFormComponent }>> = {
  offer_letter: () => import('../components/documents/OfferLetterForm'),
  direct_deposit: () => import('../components/documents/DirectDepositForm'),
  emergency_contact: () => import('../components/documents/EmergencyContactForm'),
  handbook_acknowledgement: () =>
    import('../components/documents/HandbookAcknowledgementForm'),
  code_of_conduct: () => import('../components/documents/CodeOfConductForm'),
  confidentiality: () => import('../components/documents/ConfidentialityNDAForm'),
  confidentiality_nda: () => import('../components/documents/ConfidentialityNDAForm'),
  acceptable_use: () => import('../components/documents/AcceptableUseForm'),
  harassment_policy: () => import('../components/documents/AntiHarassmentForm'),
  anti_harassment: () => import('../components/documents/AntiHarassmentForm'),
  background_authorization: () =>
    import('../components/documents/BackgroundAuthorizationForm'),
  tc_enrollment: () => import('../components/documents/TcEnrollmentForm'),
  TC_enrollment: () => import('../components/documents/TcEnrollmentForm'),
  role_training: () => import('../components/documents/RoleTrainingForm'),
  form_i9: () => import('../components/documents/FormI9'),
  i9_identity_documents: () =>
    import('../components/documents/I9IdentityDocumentsForm'),
  form_w4: () => import('../components/documents/FormW4'),
  state_withholding: () => import('../components/documents/StateWithholdingForm'),
  state_new_hire_reporting: () => import('../components/documents/StateNewHireReportingForm'),
}

const lazyCache = new Map<string, DocumentFormComponent>()

function resolveFormComponent(documentKey: string): DocumentFormComponent | null {
  const loader =
    FORM_LOADERS[documentKey] ?? FORM_LOADERS[documentKey.toLowerCase()]
  if (!loader) return null
  const cached = lazyCache.get(documentKey)
  if (cached) return cached
  const Lazy = lazy(loader) as unknown as DocumentFormComponent
  lazyCache.set(documentKey, Lazy)
  return Lazy
}

/** Isolate a missing/broken form module so it never crashes the whole tab. */
class FormErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Document form failed to render:', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

interface DocTemplate {
  document_key: string
  document_name: string
  category: string
  description: string | null
  required: boolean
  applies_to_roles: string[] | null
  applies_to_categories: string[] | null
  sort_order: number | null
}

interface DocItem {
  id: string
  document_key: string
  document_name: string
  category: string
  required: boolean
  status: DocStatus
  due_date: string | null
  file_url: string | null
  notes: string | null
  reviewed_reason: string | null
  reviewed_by: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

function statusFromDb(value: string | null): DocStatus {
  switch (value) {
    case 'not_sent':
    case 'sent':
    case 'submitted':
    case 'needs_correction':
    case 'approved':
    case 'rejected':
    case 'waived':
    case 'completed':
      return value
    default:
      return 'not_sent'
  }
}

/** Employee may edit while the doc is not yet locked by an approval. */
function employeeCanEdit(status: DocStatus): boolean {
  return (
    status === 'not_sent' ||
    status === 'sent' ||
    status === 'submitted' ||
    status === 'needs_correction'
  )
}

function parseInitialData(notes: string | null): Record<string, any> | null {
  if (!notes) return null
  const trimmed = notes.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function templateAppliesToEmployee(
  template: DocTemplate,
  role?: string | null,
): boolean {
  const roleMatch =
    !template.applies_to_roles ||
    template.applies_to_roles.length === 0 ||
    (role ? template.applies_to_roles.includes(role) : false)

  const categoryMatch =
    !template.applies_to_categories ||
    template.applies_to_categories.length === 0 ||
    template.applies_to_categories.includes(template.category)

  return roleMatch && categoryMatch
}

interface DocumentsTabProps {
  profile: EmployeeProfileLike | null
  realProfile: EmployeeProfileLike
  previewMode?: boolean
}

export default function DocumentsTab({
  profile,
  realProfile,
}: DocumentsTabProps) {
  const { user } = useAuthStore()
  const employeeId = user?.id ?? null

  // The viewer is always looking at their OWN documents in this tab.
  const viewerProfile = (realProfile ?? profile) as AccessProfileLike | null
  const viewerIsAdmin = isAdminProfile(viewerProfile)
  const viewerIsLeadOrSecretary =
    !viewerIsAdmin && isLeadOrSecretary(viewerProfile)

  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [items, setItems] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const mergeItems = useCallback(
    (prev: DocItem[], incoming: DocItem[]): DocItem[] => {
      const map = new Map<string, DocItem>()
      for (const item of prev) map.set(item.document_key, item)
      for (const item of incoming) map.set(item.document_key, item)
      return Array.from(map.values()).sort((a, b) => {
        const ca = CATEGORY_ORDER.indexOf(a.category)
        const cb = CATEGORY_ORDER.indexOf(b.category)
        if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb)
        return a.document_name.localeCompare(b.document_name)
      })
    },
    [],
  )

  const ensureItemsExist = useCallback(
    async (tpls: DocTemplate[], existing: DocItem[]) => {
      if (!employeeId) return

      const role = profile?.role
      const missing = tpls.filter(
        (template) =>
          templateAppliesToEmployee(template, role) &&
          !existing.some(
            (item) => item.document_key === template.document_key,
          ),
      )

      if (missing.length === 0) return

      const payload = missing.map((template) => ({
        employee_id: employeeId,
        document_key: template.document_key,
        document_name: template.document_name,
        category: template.category,
        required: template.required,
        status: 'not_sent',
        notes: template.description ?? null,
      }))

      const { data, error } = await supabase
        .from('hr_onboarding_items')
        .upsert(payload, { onConflict: 'employee_id,document_key' })
        .select(
          'id, document_key, document_name, category, required, status, due_date, file_url, notes, reviewed_reason, reviewed_by, submitted_at, reviewed_at',
        )

      if (error) {
        console.error('Unable to create missing document items:', error)
        return
      }

      if (data && data.length > 0) {
        const created = (data as Array<Record<string, any>>).map((row) => ({
          id: row.id as string,
          document_key: row.document_key as string,
          document_name: row.document_name as string,
          category: row.category as string,
          required: Boolean(row.required),
          status: statusFromDb(row.status),
          due_date: (row.due_date as string) ?? null,
          file_url: (row.file_url as string) ?? null,
          notes: (row.notes as string) ?? null,
          reviewed_reason: (row.reviewed_reason as string) ?? null,
          reviewed_by: (row.reviewed_by as string) ?? null,
          submitted_at: (row.submitted_at as string) ?? null,
          reviewed_at: (row.reviewed_at as string) ?? null,
        }))
        setItems((prev) => mergeItems(prev, created))
      }
    },
    [employeeId, profile?.role, mergeItems],
  )

  const loadData = useCallback(async () => {
    if (!employeeId) return

    setSyncing(true)
    try {
      const [{ data: tplData, error: tplError }, { data: itemData, error: itemError }] =
        await Promise.all([
          supabase
            .from('employee_document_templates')
            .select(
              'document_key, document_name, category, description, required, applies_to_roles, applies_to_categories, sort_order',
            )
            .eq('active', true)
            .order('sort_order', { ascending: true, nullsFirst: false }),
          supabase
            .from('hr_onboarding_items')
            .select(
              'id, document_key, document_name, category, required, status, due_date, file_url, notes, reviewed_reason, reviewed_by, submitted_at, reviewed_at',
            )
            .eq('employee_id', employeeId)
            .order('category', { ascending: true }),
        ])

      if (tplError) throw tplError
      if (itemError) throw itemError

      const fetchedTemplates = (tplData ?? []) as DocTemplate[]
      const fetchedItems = ((itemData ?? []) as Array<Record<string, any>>).map(
        (row) => ({
          id: row.id as string,
          document_key: row.document_key as string,
          document_name: row.document_name as string,
          category: row.category as string,
          required: Boolean(row.required),
          status: statusFromDb(row.status),
          due_date: (row.due_date as string) ?? null,
          file_url: (row.file_url as string) ?? null,
          notes: (row.notes as string) ?? null,
          reviewed_reason: (row.reviewed_reason as string) ?? null,
          reviewed_by: (row.reviewed_by as string) ?? null,
          submitted_at: (row.submitted_at as string) ?? null,
          reviewed_at: (row.reviewed_at as string) ?? null,
        }),
      )

      setTemplates(fetchedTemplates)
      setItems(fetchedItems)

      await ensureItemsExist(fetchedTemplates, fetchedItems)
    } catch (error) {
      console.error('Unable to load employee documents:', error)
      toast.error('Could not load your required documents.')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [employeeId, ensureItemsExist])

  useEffect(() => {
    if (!employeeId) {
      setLoading(false)
      return
    }
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, loadData])

  useEffect(() => {
    if (!employeeId) return

    const channel = supabase
      .channel(`emp-docs:${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hr_onboarding_items',
          filter: `employee_id=eq.${employeeId}`,
        },
        () => {
          void loadData()
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Employee documents subscription failed: ${status}`)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [employeeId, loadData])

  const handleSave = useCallback(
    async (item: DocItem, data: Record<string, any>, pdf?: File | Blob | null): Promise<void> => {
      if (!employeeId) return Promise.resolve()

      setSavingKey(item.document_key)
      try {
        let fileUrl = item.file_url

        // If the form produced a PDF (its Download PDF), persist it to storage
        // and record the URL. Keep the existing bucket / path pattern.
        if (pdf) {
          const path = `${employeeId}/${item.document_key}-${Date.now()}.pdf`
          const { error: uploadError } = await supabase.storage
            .from(DOCS_BUCKET)
            .upload(path, pdf, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'application/pdf',
            })

          if (uploadError) throw uploadError

          const { data: urlData } = supabase.storage
            .from(DOCS_BUCKET)
            .getPublicUrl(path)

          fileUrl = urlData?.publicUrl ?? path
        }

        const now = new Date().toISOString()

        const { error: updateError } = await supabase
          .from('hr_onboarding_items')
          .update({
            status: 'submitted',
            notes: JSON.stringify(data),
            file_url: fileUrl,
            submitted_at: now,
            resubmit_required: false,
          })
          .eq('id', item.id)

        if (updateError) throw updateError

        try {
          await supabase.rpc('log_employee_audit', {
            p_actor: user?.id,
            p_action: 'document_submitted',
            p_target: user?.id,
            p_department: 'human_resources',
            p_new: { document_key: item.document_key },
          })
        } catch {
          // Audit logging is best-effort; ignore if RPC is unavailable.
        }

        toast.success(`Submitted: ${item.document_name}`)
        await loadData()
      } catch (error) {
        console.error('Unable to submit document:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Unable to submit this document.',
        )
      } finally {
        setSavingKey(null)
      }
    },
    [employeeId, loadData, user?.id],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, DocItem[]>()
    for (const item of items) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ca = CATEGORY_ORDER.indexOf(a)
      const cb = CATEGORY_ORDER.indexOf(b)
      return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb)
    })
  }, [items])

  const requiredItems = items.filter((item) => item.required)
  const completedRequired = requiredItems.filter(
    (item) =>
      item.status === 'approved' ||
      item.status === 'completed' ||
      item.status === 'waived',
  )
  const pendingRequired = requiredItems.length - completedRequired.length

  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const selectedItem = useMemo(
    () => items.find((item) => item.document_key === selectedKey) ?? null,
    [items, selectedKey],
  )

  if (!employeeId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#101520]/75 p-8 text-center text-slate-400">
        Unable to identify your employee account.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-[#101520]/75 p-8">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
          <p className="mt-4 text-sm font-bold text-slate-200">
            Loading your documents
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#101520]/95 p-4 shadow-2xl shadow-black/20 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Required Documents
            </p>
            <h3 className="mt-1 text-lg font-black text-white">
              {completedRequired.length} of {requiredItems.length} required completed
            </h3>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {pendingRequired > 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-bold text-amber-100">
                Required documents pending — employment pending documents
              </p>
              <p className="mt-1 text-xs text-amber-100/70">
                {pendingRequired} required{' '}
                {pendingRequired === 1 ? 'document is' : 'documents are'} not
                yet approved. Please complete and submit each outstanding form.
              </p>
            </div>
          </div>
        ) : requiredItems.length > 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <p className="text-sm font-bold text-emerald-100">
              All required documents are complete.
            </p>
          </div>
        ) : null}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#101520]/75 p-8 text-center text-slate-400">
          No required documents are currently assigned to your profile.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#101520]/95 p-4 shadow-2xl shadow-black/20 sm:p-5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Select a document
          </label>
          <select
            value={selectedKey ?? ''}
            onChange={(e) => setSelectedKey(e.target.value || null)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="" disabled>
              Choose a document...
            </option>
            {grouped.map(([category, categoryItems]) =>
              categoryItems.map((item) => (
                <option key={item.id} value={item.document_key}>
                  {item.document_name} ({category})
                </option>
              )),
            )}
          </select>

          {selectedItem && (
            <div className="mt-4">
              <DocumentRow
                item={selectedItem}
                saving={savingKey === selectedItem.document_key}
                viewerIsAdmin={viewerIsAdmin}
                viewerIsLeadOrSecretary={viewerIsLeadOrSecretary}
                onSave={handleSave}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusPills({ item }: { item: DocItem }) {
  const meta = STATUS_META[item.status]
  const showReason =
    (item.status === 'needs_correction' || item.status === 'rejected') &&
    item.reviewed_reason

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
        <p className="text-sm font-bold text-white">{item.document_name}</p>
        {item.required ? (
          <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-200 ring-1 ring-rose-400/20">
            Required
          </span>
        ) : (
          <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300 ring-1 ring-slate-400/20">
            Optional
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.pill}`}
        >
          {meta.label}
        </span>
      </div>

      {showReason && (
        <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {item.reviewed_reason}
        </p>
      )}

      {item.due_date && (
        <p className="text-[11px] text-slate-500">Due {item.due_date}</p>
      )}
    </div>
  )
}

function DocumentRow({
  item,
  saving,
  viewerIsAdmin,
  viewerIsLeadOrSecretary,
  onSave,
}: {
  item: DocItem
  saving: boolean
  viewerIsAdmin: boolean
  viewerIsLeadOrSecretary: boolean
  onSave: (
    item: DocItem,
    data: Record<string, any>,
    pdf?: File | Blob | null,
  ) => Promise<void>
}) {
  const level = getDocumentSensitivity(item.document_key)
  const isSensitive = level === 'sensitive' || level === 'admin_only'

  // Lead / secretary MUST NEVER see sensitive forms — render a locked card
  // with no data at all. Employees see their own sensitive forms; admins too.
  if (isSensitive && viewerIsLeadOrSecretary && !viewerIsAdmin) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <StatusPills item={item} />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-slate-400">
          <Lock className="h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <p className="text-sm font-bold text-slate-200">
              Restricted — Admin Only
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              This document contains sensitive personal information and is only
              visible to administrators.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const FormComponent = resolveFormComponent(item.document_key)
  const canEdit = employeeCanEdit(item.status)
  const initialData = parseInitialData(item.notes)

  const fallbackCard = (
    <div className="px-4 py-4">
      <StatusPills item={item} />
      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-400">
        This document form is not available yet. Please check back shortly.
      </div>
      {item.file_url && (
        <a
          href={item.file_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200"
        >
          View uploaded file
        </a>
      )}
    </div>
  )

  if (!FormComponent) return fallbackCard

  return (
    <div className="px-4 py-4">
      <FormErrorBoundary fallback={fallbackCard}>
        <Suspense
          fallback={
            <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
              Loading {item.document_name}…
            </div>
          }
        >
          <FormComponent
            documentKey={item.document_key}
            documentName={item.document_name}
            category={item.category}
            required={item.required}
            status={item.status}
            canEdit={canEdit && !saving}
            initialData={initialData}
            onSave={(data, signatureName, pdf) => onSave(item, data, pdf)}
          />
        </Suspense>
      </FormErrorBoundary>
    </div>
  )
}
