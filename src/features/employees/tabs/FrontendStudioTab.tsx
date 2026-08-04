import React, { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Eye,
  LayoutDashboard,
  Loader2,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { canEmployee } from '../permissions'
import { PermissionGate } from '../components/PermissionGate'

type DraftStatus =
  | 'draft'
  | 'approved'
  | 'published'
  | 'rolled_back'

type HomepageSection =
  | 'troll_wall'
  | 'broadcasters'
  | 'podcasts'
  | 'auctions'
  | 'games'
  | 'families'
  | 'promo_slots'

type FrontendConfig = {
  theme: 'dark' | 'midnight' | 'purple'
  accentStyle: 'purple' | 'cyan' | 'pink' | 'gold'
  homepage: {
    showTrollWall: boolean
    trollWallTitle: string
    trollWallWidth: 'small' | 'medium' | 'large'
    trollWallPostLimit: number
    showPostComposer: boolean
    showBroadcasters: boolean
    showPodcasts: boolean
    showAuctions: boolean
    showGames: boolean
    showFamilies: boolean
    showPromoSlots: boolean
    promoPosition: 'right' | 'bottom'
    sectionOrder: HomepageSection[]
  }
  navigation: {
    showDesktopSidebar: boolean
    showBottomNavigation: boolean
    stickyBottomNavigation: boolean
  }
  cards: {
    roundedCorners: boolean
    glowEffects: boolean
    animations: boolean
    compactSpacing: boolean
  }
}

type FrontendDraft = {
  id: string
  title: string
  config: FrontendConfig
  author_id: string
  status: DraftStatus
  approved_by?: string | null
  published_at?: string | null
  created_at?: string
  updated_at?: string
}

const DEFAULT_CONFIG: FrontendConfig = {
  theme: 'dark',
  accentStyle: 'purple',
  homepage: {
    showTrollWall: true,
    trollWallTitle: 'Troll Wall',
    trollWallWidth: 'small',
    trollWallPostLimit: 10,
    showPostComposer: true,
    showBroadcasters: true,
    showPodcasts: true,
    showAuctions: true,
    showGames: true,
    showFamilies: true,
    showPromoSlots: true,
    promoPosition: 'right',
    sectionOrder: [
      'troll_wall',
      'broadcasters',
      'podcasts',
      'auctions',
      'games',
      'families',
      'promo_slots',
    ],
  },
  navigation: {
    showDesktopSidebar: true,
    showBottomNavigation: true,
    stickyBottomNavigation: true,
  },
  cards: {
    roundedCorners: true,
    glowEffects: true,
    animations: true,
    compactSpacing: false,
  },
}

const SECTION_LABELS: Record<HomepageSection, string> = {
  troll_wall: 'Troll Wall',
  broadcasters: 'Broadcasters',
  podcasts: 'Podcasts',
  auctions: 'Auctions',
  games: 'Games',
  families: 'Families',
  promo_slots: 'Promotional Slots',
}

const statusStyles: Record<DraftStatus, string> = {
  draft: 'border-slate-400/20 bg-slate-500/10 text-slate-300',
  approved:
    'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
  published: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
  rolled_back: 'border-red-400/20 bg-red-500/10 text-red-300',
}

function normalizeConfig(config: any): FrontendConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(config || {}),
    homepage: {
      ...DEFAULT_CONFIG.homepage,
      ...(config?.homepage || {}),
      sectionOrder:
        Array.isArray(config?.homepage?.sectionOrder) &&
        config.homepage.sectionOrder.length > 0
          ? config.homepage.sectionOrder
          : DEFAULT_CONFIG.homepage.sectionOrder,
    },
    navigation: {
      ...DEFAULT_CONFIG.navigation,
      ...(config?.navigation || {}),
    },
    cards: {
      ...DEFAULT_CONFIG.cards,
      ...(config?.cards || {}),
    },
  }
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]"
    >
      <div>
        <p className="text-sm font-bold text-white">{label}</p>

        {description && (
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>

      <span
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-cyan-500' : 'bg-slate-700',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 h-4 w-4 rounded-full bg-white transition',
            checked ? 'left-6' : 'left-1',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span
      className={[
        'rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide',
        statusStyles[status],
      ].join(' ')}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export default function FrontendStudioTab({
  profile,
  realProfile,
}: {
  profile?: any
  realProfile?: any
}) {
  const { user } = useAuthStore()

  const canPublish = canEmployee(realProfile, 'publish_frontend')

  const [drafts, setDrafts] = useState<FrontendDraft[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(
    null,
  )

  const [title, setTitle] = useState('')
  const [config, setConfig] =
    useState<FrontendConfig>(DEFAULT_CONFIG)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [previewMode, setPreviewMode] = useState<
    'desktop' | 'mobile'
  >('desktop')

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) || null,
    [drafts, selectedDraftId],
  )

  const load = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('frontend_studio_drafts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const loadedDrafts = ((data as FrontendDraft[]) || []).map(
        (draft) => ({
          ...draft,
          config: normalizeConfig(draft.config),
        }),
      )

      setDrafts(loadedDrafts)

      setSelectedDraftId((current) => {
        if (
          current &&
          loadedDrafts.some((draft) => draft.id === current)
        ) {
          return current
        }

        return loadedDrafts[0]?.id || null
      })
    } catch (error: any) {
      console.error('Unable to load frontend drafts:', error)
      toast.error(error?.message || 'Unable to load frontend drafts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setTitle('')
    setConfig(DEFAULT_CONFIG)
    setSelectedDraftId(null)
  }

  const editDraft = (draft: FrontendDraft) => {
    setSelectedDraftId(draft.id)
    setTitle(draft.title)
    setConfig(normalizeConfig(draft.config))
  }

  const updateHomepage = <K extends keyof FrontendConfig['homepage']>(
    key: K,
    value: FrontendConfig['homepage'][K],
  ) => {
    setConfig((current) => ({
      ...current,
      homepage: {
        ...current.homepage,
        [key]: value,
      },
    }))
  }

  const updateNavigation = <
    K extends keyof FrontendConfig['navigation'],
  >(
    key: K,
    value: FrontendConfig['navigation'][K],
  ) => {
    setConfig((current) => ({
      ...current,
      navigation: {
        ...current.navigation,
        [key]: value,
      },
    }))
  }

  const updateCards = <K extends keyof FrontendConfig['cards']>(
    key: K,
    value: FrontendConfig['cards'][K],
  ) => {
    setConfig((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [key]: value,
      },
    }))
  }

  const saveDraft = async () => {
    if (!title.trim()) {
      toast.error('Enter a name for this design.')
      return
    }

    if (!user?.id) {
      toast.error('You must be signed in.')
      return
    }

    setBusy(true)

    try {
      if (selectedDraftId) {
        const existing = drafts.find(
          (draft) => draft.id === selectedDraftId,
        )

        if (existing?.status === 'published') {
          toast.error(
            'Published designs cannot be edited directly. Create a new draft instead.',
          )
          return
        }

        const { error } = await supabase
          .from('frontend_studio_drafts')
          .update({
            title: title.trim(),
            config,
            status: 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedDraftId)

        if (error) throw error

        await logAudit('frontend_draft_updated', selectedDraftId)
        toast.success('Draft updated.')
      } else {
        const { data, error } = await supabase
          .from('frontend_studio_drafts')
          .insert({
            title: title.trim(),
            config,
            author_id: user.id,
            status: 'draft',
          })
          .select('id')
          .single()

        if (error) throw error

        if (data?.id) {
          setSelectedDraftId(data.id)
          await logAudit('frontend_draft_created', data.id)
        }

        toast.success('Draft saved.')
      }

      await load()
    } catch (error: any) {
      console.error('Unable to save frontend draft:', error)
      toast.error(error?.message || 'Unable to save draft.')
    } finally {
      setBusy(false)
    }
  }

  const logAudit = async (action: string, target: string) => {
    if (!user?.id) return

    const { error } = await supabase.rpc('log_employee_audit', {
      p_actor: user.id,
      p_action: action,
      p_target: target,
      p_department: 'frontend_studio',
    })

    if (error) {
      console.warn('Unable to write frontend audit log:', error)
    }
  }

  const setStatus = async (
    id: string,
    status: 'approved' | 'published' | 'rolled_back',
  ) => {
    if (!user?.id) return

    const actionLabels = {
      approved: 'approve',
      published: 'publish',
      rolled_back: 'roll back',
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabels[status]} this design?`,
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status === 'approved') {
        updateData.approved_by = user.id
        updateData.approved_at = new Date().toISOString()
      }

      if (status === 'published') {
        updateData.published_at = new Date().toISOString()
        updateData.published_by = user.id
      }

      if (status === 'rolled_back') {
        updateData.rolled_back_at = new Date().toISOString()
        updateData.rolled_back_by = user.id
      }

      const { error } = await supabase
        .from('frontend_studio_drafts')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      await logAudit(`frontend_${status}`, id)
      await load()

      toast.success(
        status === 'approved'
          ? 'Design approved.'
          : status === 'published'
            ? 'Design published.'
            : 'Design rolled back.',
      )
    } catch (error: any) {
      console.error('Unable to update frontend design:', error)
      toast.error(error?.message || 'Unable to update design.')
    } finally {
      setBusy(false)
    }
  }

  const duplicateDraft = (draft: FrontendDraft) => {
    setSelectedDraftId(null)
    setTitle(`${draft.title} Copy`)
    setConfig(normalizeConfig(draft.config))
    toast.success('A copy is ready to edit.')
  }

  const deleteDraft = async (draft: FrontendDraft) => {
    if (draft.status === 'published') {
      toast.error('Published designs cannot be deleted.')
      return
    }

    const confirmed = window.confirm(
      `Delete "${draft.title}"? This cannot be undone.`,
    )

    if (!confirmed) return

    setBusy(true)

    try {
      const { error } = await supabase
        .from('frontend_studio_drafts')
        .delete()
        .eq('id', draft.id)

      if (error) throw error

      await logAudit('frontend_draft_deleted', draft.id)

      if (selectedDraftId === draft.id) {
        resetForm()
      }

      await load()
      toast.success('Draft deleted.')
    } catch (error: any) {
      console.error('Unable to delete draft:', error)
      toast.error(error?.message || 'Unable to delete draft.')
    } finally {
      setBusy(false)
    }
  }

  const moveSection = (
    section: HomepageSection,
    direction: 'up' | 'down',
  ) => {
    const currentOrder = [...config.homepage.sectionOrder]
    const currentIndex = currentOrder.indexOf(section)

    if (currentIndex < 0) return

    const nextIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (nextIndex < 0 || nextIndex >= currentOrder.length) return

    const nextOrder = [...currentOrder]
    ;[nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ]

    updateHomepage('sectionOrder', nextOrder)
  }

  const isSectionVisible = (section: HomepageSection) => {
    const visibilityMap: Record<HomepageSection, boolean> = {
      troll_wall: config.homepage.showTrollWall,
      broadcasters: config.homepage.showBroadcasters,
      podcasts: config.homepage.showPodcasts,
      auctions: config.homepage.showAuctions,
      games: config.homepage.showGames,
      families: config.homepage.showFamilies,
      promo_slots: config.homepage.showPromoSlots,
    }

    return visibilityMap[section]
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/10 bg-black/30">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Frontend Studio…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-black/40 to-fuchsia-500/10 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-cyan-300" />

              <h1 className="text-xl font-black text-white">
                Frontend Studio
              </h1>
            </div>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Create and manage Mai Troll page layouts using simple
              controls. No coding, SQL, terminal, or system access is
              required.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-black text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              New design
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="font-black text-white">Saved designs</h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Select a design to review or update it.
            </p>

            <div className="mt-4 space-y-2">
              {drafts.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-sm text-slate-500">
                  No designs have been created.
                </p>
              )}

              {drafts.map((draft) => (
                <button
                  type="button"
                  key={draft.id}
                  onClick={() => editDraft(draft)}
                  className={[
                    'w-full rounded-xl border p-3 text-left transition',
                    selectedDraftId === draft.id
                      ? 'border-cyan-400/40 bg-cyan-500/10'
                      : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold text-white">
                      {draft.title}
                    </p>

                    <StatusBadge status={draft.status} />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {draft.created_at
                      ? new Date(draft.created_at).toLocaleDateString()
                      : 'Saved design'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-black text-white">
                  Design information
                </h2>

                <p className="text-sm text-slate-500">
                  Give this layout a clear name staff can recognize.
                </p>
              </div>

              {selectedDraft && (
                <StatusBadge status={selectedDraft.status} />
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Design name
              </span>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Homepage Troll Wall Layout"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-fuchsia-300" />

              <h2 className="text-lg font-black text-white">
                Appearance
              </h2>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Main theme
                </span>

                <select
                  value={config.theme}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      theme: event.target
                        .value as FrontendConfig['theme'],
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="dark">Mai Troll Dark</option>
                  <option value="midnight">Midnight</option>
                  <option value="purple">Purple City</option>
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Accent color
                </span>

                <select
                  value={config.accentStyle}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      accentStyle: event.target
                        .value as FrontendConfig['accentStyle'],
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                >
                  <option value="purple">Purple</option>
                  <option value="cyan">Cyan</option>
                  <option value="pink">Pink</option>
                  <option value="gold">Gold</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-cyan-300" />

              <h2 className="text-lg font-black text-white">
                Homepage sections
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Choose which sections appear on the Mai Troll homepage.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Toggle
                checked={config.homepage.showTrollWall}
                onChange={(value) =>
                  updateHomepage('showTrollWall', value)
                }
                label="Show Troll Wall"
                description="Displays the shared Troll Wall feed on the homepage."
              />

              <Toggle
                checked={config.homepage.showPostComposer}
                onChange={(value) =>
                  updateHomepage('showPostComposer', value)
                }
                label="Allow homepage posts"
                description="Shows the post box above the Troll Wall feed."
              />

              <Toggle
                checked={config.homepage.showBroadcasters}
                onChange={(value) =>
                  updateHomepage('showBroadcasters', value)
                }
                label="Show broadcasters"
              />

              <Toggle
                checked={config.homepage.showPodcasts}
                onChange={(value) =>
                  updateHomepage('showPodcasts', value)
                }
                label="Show podcasts"
              />

              <Toggle
                checked={config.homepage.showAuctions}
                onChange={(value) =>
                  updateHomepage('showAuctions', value)
                }
                label="Show auctions"
              />

              <Toggle
                checked={config.homepage.showGames}
                onChange={(value) =>
                  updateHomepage('showGames', value)
                }
                label="Show games"
              />

              <Toggle
                checked={config.homepage.showFamilies}
                onChange={(value) =>
                  updateHomepage('showFamilies', value)
                }
                label="Show families"
              />

              <Toggle
                checked={config.homepage.showPromoSlots}
                onChange={(value) =>
                  updateHomepage('showPromoSlots', value)
                }
                label="Show promotional slots"
              />
            </div>
          </section>

          {config.homepage.showTrollWall && (
            <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <h2 className="text-lg font-black text-white">
                Troll Wall settings
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Control how the homepage Troll Wall appears.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Section title
                  </span>

                  <input
                    value={config.homepage.trollWallTitle}
                    onChange={(event) =>
                      updateHomepage(
                        'trollWallTitle',
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Feed width
                  </span>

                  <select
                    value={config.homepage.trollWallWidth}
                    onChange={(event) =>
                      updateHomepage(
                        'trollWallWidth',
                        event.target
                          .value as FrontendConfig['homepage']['trollWallWidth'],
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Posts shown
                  </span>

                  <input
                    type="number"
                    min={3}
                    max={50}
                    value={config.homepage.trollWallPostLimit}
                    onChange={(event) =>
                      updateHomepage(
                        'trollWallPostLimit',
                        Math.max(
                          3,
                          Math.min(
                            50,
                            Number(event.target.value || 10),
                          ),
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                  />
                </label>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-black text-white">
              Section order
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Move sections up or down to control their homepage order.
            </p>

            <div className="mt-4 space-y-2">
              {config.homepage.sectionOrder.map((section, index) => (
                <div
                  key={section}
                  className={[
                    'flex items-center justify-between rounded-xl border px-4 py-3',
                    isSectionVisible(section)
                      ? 'border-white/10 bg-white/[0.03]'
                      : 'border-white/5 bg-black/20 opacity-50',
                  ].join(' ')}
                >
                  <div>
                    <p className="text-sm font-bold text-white">
                      {index + 1}. {SECTION_LABELS[section]}
                    </p>

                    {!isSectionVisible(section) && (
                      <p className="text-xs text-slate-600">
                        Currently hidden
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveSection(section, 'up')}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 disabled:opacity-30"
                    >
                      Up
                    </button>

                    <button
                      type="button"
                      disabled={
                        index ===
                        config.homepage.sectionOrder.length - 1
                      }
                      onClick={() => moveSection(section, 'down')}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 disabled:opacity-30"
                    >
                      Down
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <h2 className="text-lg font-black text-white">
              Navigation
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Toggle
                checked={config.navigation.showDesktopSidebar}
                onChange={(value) =>
                  updateNavigation('showDesktopSidebar', value)
                }
                label="Desktop sidebar"
              />

              <Toggle
                checked={config.navigation.showBottomNavigation}
                onChange={(value) =>
                  updateNavigation('showBottomNavigation', value)
                }
                label="Bottom navigation bar"
              />

              <Toggle
                checked={config.navigation.stickyBottomNavigation}
                onChange={(value) =>
                  updateNavigation('stickyBottomNavigation', value)
                }
                label="Keep bottom navigation visible"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-fuchsia-300" />

              <h2 className="text-lg font-black text-white">
                Visual effects
              </h2>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Toggle
                checked={config.cards.roundedCorners}
                onChange={(value) =>
                  updateCards('roundedCorners', value)
                }
                label="Rounded cards"
              />

              <Toggle
                checked={config.cards.glowEffects}
                onChange={(value) =>
                  updateCards('glowEffects', value)
                }
                label="Neon glow effects"
              />

              <Toggle
                checked={config.cards.animations}
                onChange={(value) =>
                  updateCards('animations', value)
                }
                label="Page animations"
              />

              <Toggle
                checked={config.cards.compactSpacing}
                onChange={(value) =>
                  updateCards('compactSpacing', value)
                }
                label="Compact spacing"
                description="Fits more homepage content on the screen."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-cyan-300" />

                  <h2 className="text-lg font-black text-white">
                    Layout preview
                  </h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Simple preview of the selected layout.
                </p>
              </div>

              <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={[
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold',
                    previewMode === 'desktop'
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400',
                  ].join(' ')}
                >
                  <Monitor className="h-4 w-4" />
                  Desktop
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={[
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold',
                    previewMode === 'mobile'
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400',
                  ].join(' ')}
                >
                  <Smartphone className="h-4 w-4" />
                  Mobile
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-4">
              <div
                className={[
                  'mx-auto overflow-hidden rounded-xl border border-white/10 bg-[#070412] p-3 transition-all',
                  previewMode === 'desktop'
                    ? 'max-w-full'
                    : 'max-w-[360px]',
                ].join(' ')}
              >
                <div className="mb-3 h-10 rounded-lg bg-purple-950/70" />

                <div
                  className={[
                    'grid gap-3',
                    previewMode === 'desktop'
                      ? config.navigation.showDesktopSidebar
                        ? 'grid-cols-[110px_1fr]'
                        : 'grid-cols-1'
                      : 'grid-cols-1',
                  ].join(' ')}
                >
                  {previewMode === 'desktop' &&
                    config.navigation.showDesktopSidebar && (
                      <div className="space-y-2 rounded-lg bg-white/5 p-2">
                        {[1, 2, 3, 4, 5].map((item) => (
                          <div
                            key={item}
                            className="h-6 rounded bg-white/5"
                          />
                        ))}
                      </div>
                    )}

                  <div className="space-y-3">
                    {config.homepage.sectionOrder.map((section) => {
                      if (!isSectionVisible(section)) return null

                      return (
                        <div
                          key={section}
                          className={[
                            'rounded-lg border border-purple-400/15 bg-purple-500/5 p-3',
                            section === 'troll_wall' &&
                            config.homepage.trollWallWidth === 'small'
                              ? 'max-w-[360px]'
                              : '',
                            section === 'troll_wall' &&
                            config.homepage.trollWallWidth === 'medium'
                              ? 'max-w-[520px]'
                              : '',
                          ].join(' ')}
                        >
                          <p className="text-[10px] font-black uppercase text-purple-300">
                            {SECTION_LABELS[section]}
                          </p>

                          <div className="mt-2 space-y-1.5">
                            <div className="h-3 rounded bg-white/10" />
                            <div className="h-3 w-3/4 rounded bg-white/5" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {config.navigation.showBottomNavigation && (
                  <div className="mt-3 flex justify-around rounded-lg border border-white/10 bg-purple-950/60 p-2">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div
                        key={item}
                        className="h-5 w-5 rounded-full bg-purple-400/20"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-black text-white">
                Save and submit design
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Saving creates a safe draft. It does not immediately
                change the live website.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Clear
              </button>

              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={busy || !title.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </button>
            </div>
          </section>

          {selectedDraft && (
            <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <h2 className="text-lg font-black text-white">
                Design actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Authorized staff can approve, publish, copy, roll back,
                or remove this design.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => duplicateDraft(selectedDraft)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Make a copy
                </button>

                <PermissionGate
                  profile={realProfile}
                  action="publish_frontend"
                >
                  {selectedDraft.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() =>
                        void setStatus(selectedDraft.id, 'approved')
                      }
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                  )}

                  {selectedDraft.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() =>
                        void setStatus(selectedDraft.id, 'published')
                      }
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-black text-black hover:bg-cyan-400 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Publish
                    </button>
                  )}

                  {selectedDraft.status === 'published' && (
                    <button
                      type="button"
                      onClick={() =>
                        void setStatus(
                          selectedDraft.id,
                          'rolled_back',
                        )
                      }
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Roll back
                    </button>
                  )}
                </PermissionGate>

                {selectedDraft.status !== 'published' && (
                  <button
                    type="button"
                    onClick={() => void deleteDraft(selectedDraft)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>

              {!canPublish && (
                <p className="mt-3 text-xs text-amber-300">
                  You may create and update drafts, but only authorized
                  design, development, secretary, or management staff
                  can approve and publish changes.
                </p>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}