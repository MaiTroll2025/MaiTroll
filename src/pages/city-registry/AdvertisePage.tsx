import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Check,
  Clock,
  Eye,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, UserRole } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

interface UserAdvertisement {
  id: string
  user_id: string
  title: string
  subtitle: string
  description: string
  image_url: string
  link_url: string
  status: string
  cost_paid: number
  submitted_at: string
  approved_at: string
  expires_at: string
  queue_position: number
  is_active_slot: boolean
  slot_start_time: string
  clicks_count: number
  impressions_count: number
  user_profiles: { username: string }
}

type AdTab = 'pending' | 'queued' | 'active' | 'all'

const AD_COST = 1000
const MAX_IMAGE_MB = 5

function statusBadge(status: string) {
  if (status === 'pending') return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
  if (status === 'queued') return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
  if (status === 'active') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
  if (status === 'denied') return 'border-rose-300/30 bg-rose-300/10 text-rose-200'
  return 'border-slate-400/30 bg-slate-400/10 text-slate-300'
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return date.toLocaleDateString()
}

function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString()
}

export default function AdvertisePage() {
  const { profile } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    link_url: ''
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [ads, setAds] = useState<UserAdvertisement[]>([])
  const [adminLoading, setAdminLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<AdTab>('pending')

  const isAdmin =
    profile?.role === UserRole.ADMIN ||
    profile?.role === UserRole.SECRETARY ||
    profile?.is_admin

  const balance = Number(profile?.troll_coins || 0)
  const canSubmit = Boolean(
    profile?.id &&
      balance >= AD_COST &&
      formData.title.trim() &&
      selectedImage &&
      !loading &&
      !uploadingImage
  )

  const adCounts = useMemo(() => {
    return {
      pending: ads.filter((ad) => ad.status === 'pending').length,
      queued: ads.filter((ad) => ad.status === 'queued').length,
      active: ads.filter((ad) => ad.status === 'active').length,
      all: ads.length
    }
  }, [ads])

  const filteredAds = useMemo(() => {
    if (activeTab === 'all') return ads
    return ads.filter((ad) => ad.status === activeTab)
  }, [ads, activeTab])

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(selectedImage)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [selectedImage])

  useEffect(() => {
    if (isAdmin) fetchAds()
     
  }, [isAdmin])

  const fetchAds = async () => {
    setAdminLoading(true)

    try {
      const { data, error } = await supabase
        .from('user_advertisements')
        .select(`
          *,
          user_profiles!user_advertisements_user_id_fkey (username)
        `)
        .order('submitted_at', { ascending: false })

      if (error) throw error
      setAds(data || [])
    } catch (err) {
      console.error('Failed to fetch ads:', err)
      toast.error('Failed to load advertisements')
    } finally {
      setAdminLoading(false)
    }
  }

  const approveAd = async (adId: string) => {
    try {
      const { data, error } = await supabase.rpc('approve_advertisement', {
        p_ad_id: adId
      })

      if (error) throw error

      if (data?.success) {
        const { error: queueError } = await supabase.rpc('add_ad_to_queue', {
          p_ad_id: adId
        })

        if (queueError) throw queueError

        toast.success('Ad approved and added to queue')
        fetchAds()
      } else {
        toast.error(data?.message || 'Ad approval failed')
      }
    } catch (err) {
      console.error('Failed to approve ad:', err)
      toast.error('Failed to approve advertisement')
    }
  }

  const denyAd = async (adId: string) => {
    const reason = prompt('Enter reason for denial:')
    if (!reason?.trim()) return

    try {
      const { data, error } = await supabase.rpc('deny_advertisement', {
        p_ad_id: adId,
        p_reason: reason.trim()
      })

      if (error) throw error

      if (data?.success) {
        toast.success('Ad denied')
        fetchAds()
      } else {
        toast.error(data?.message || 'Failed to deny ad')
      }
    } catch (err) {
      console.error('Failed to deny ad:', err)
      toast.error('Failed to deny advertisement')
    }
  }

  const rotateQueue = async () => {
    try {
      const { data, error } = await supabase.rpc('rotate_ad_queue', { p_force: true })
      if (error) throw error

      toast.success(`Queue rotated: ${data?.rotations_performed || 0} changes`)
      fetchAds()
    } catch (err) {
      console.error('Failed to rotate queue:', err)
      toast.error('Failed to rotate queue')
    }
  }

  const handleImageSelect = (file?: File) => {
    if (!file) {
      setSelectedImage(null)
      return
    }

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Image must be less than ${MAX_IMAGE_MB}MB`)
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setSelectedImage(file)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.title.trim() || !selectedImage) {
      toast.error('Title and image are required')
      return
    }

    if (!profile?.id || balance < AD_COST) {
      toast.error(`You need at least ${AD_COST} Troll Coins to submit an ad`)
      return
    }

    setLoading(true)
    setUploadingImage(true)

    try {
      const fileExt = selectedImage.name.split('.').pop() || 'png'
      const fileName = `${profile.id}_${Date.now()}.${fileExt}`
      const filePath = `advertisements/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('ad-assets')
        .upload(filePath, selectedImage, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('ad-assets')
        .getPublicUrl(filePath)

      const imageUrl = urlData.publicUrl

      const { data, error } = await supabase.rpc('submit_advertisement', {
        p_title: formData.title.trim(),
        p_subtitle: formData.subtitle.trim() || null,
        p_description: formData.description.trim() || null,
        p_image_url: imageUrl,
        p_link_url: formData.link_url.trim() || null
      })

      if (error) throw error

      if (data?.success) {
        toast.success(data.message || 'Advertisement submitted for review')
        setFormData({
          title: '',
          subtitle: '',
          description: '',
          link_url: ''
        })
        setSelectedImage(null)
        setPreviewUrl(null)
      } else {
        toast.error(data?.message || 'Failed to submit advertisement')
      }
    } catch (err) {
      console.error('Failed to submit ad:', err)
      toast.error('Failed to submit advertisement')
    } finally {
      setLoading(false)
      setUploadingImage(false)
    }
  }

  if (isAdmin) {
    return (
      <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,#020617_0%,#07111f_48%,#020617_100%)]" />
        <div className="absolute inset-0 opacity-[0.14] bg-[linear-gradient(rgba(34,211,238,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.2)_1px,transparent_1px)] bg-[size:44px_44px]" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 sm:p-6">
          <header className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_0_55px_rgba(34,211,238,0.14)] backdrop-blur-2xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.32)]">
                  <ShieldCheck className="h-9 w-9 text-cyan-100" />
                  <Megaphone className="absolute -right-2 -top-2 h-6 w-6 rotate-12 text-fuchsia-300" />
                </div>

                <div>
                  <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                    Mai Troll Ad Command
                  </div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                    Advertisement Management
                  </h1>
                  <p className="mt-1 text-sm text-cyan-100/70">
                    Approve, deny, queue, and rotate user-submitted ads.
                  </p>
                </div>
              </div>

              <button
                onClick={rotateQueue}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/10 px-5 py-3 font-black text-fuchsia-100 transition hover:bg-fuchsia-300/20"
              >
                <RefreshCw className="h-5 w-5" />
                Rotate Queue Now
              </button>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              ['pending', 'Pending Review', adCounts.pending, Clock, 'text-yellow-200 border-yellow-300/25 bg-yellow-300/10'],
              ['queued', 'Queued Ads', adCounts.queued, Timer, 'text-cyan-100 border-cyan-300/25 bg-cyan-300/10'],
              ['active', 'Active Slots', adCounts.active, BadgeCheck, 'text-emerald-200 border-emerald-300/25 bg-emerald-300/10'],
              ['all', 'Total Ads', adCounts.all, BarChart3, 'text-fuchsia-100 border-fuchsia-300/25 bg-fuchsia-300/10']
            ] as const).map(([key, label, count, Icon, theme]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`rounded-3xl border p-4 text-left backdrop-blur-2xl transition ${theme} ${
                  activeTab === key
                    ? 'shadow-[0_0_35px_rgba(34,211,238,0.16)]'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Icon className="h-6 w-6" />
                  <span className="font-mono text-3xl font-black">{count}</span>
                </div>
                <p className="text-sm font-black">{label}</p>
              </button>
            ))}
          </section>

          <main className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/72 shadow-[0_0_45px_rgba(34,211,238,0.1)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-cyan-300/15 p-4">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <Megaphone className="h-5 w-5 text-cyan-100" />
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Advertisements
              </h2>

              <button
                onClick={fetchAds}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-300/20"
              >
                Refresh
              </button>
            </div>

            <div className="p-4">
              {adminLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-9 w-9 animate-spin text-cyan-100" />
                </div>
              ) : filteredAds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10">
                    <Megaphone className="h-10 w-10 text-cyan-100/70" />
                  </div>
                  <p className="text-xl font-black">No {activeTab} advertisements</p>
                  <p className="mt-2 text-sm text-slate-400">Nothing needs action in this queue.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {filteredAds.map((ad) => (
                    <article
                      key={ad.id}
                      className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-900/72 transition hover:border-cyan-300/35 hover:bg-slate-900/95"
                    >
                      <div className="flex flex-col sm:flex-row">
                        <div className="relative h-52 w-full bg-slate-950 sm:h-auto sm:w-48">
                          <img
                            src={ad.image_url}
                            alt={ad.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute left-3 top-3 rounded-full border border-black/20 bg-black/60 px-3 py-1 text-xs font-black text-white backdrop-blur-md">
                            {ad.cost_paid || AD_COST} TC
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col p-4">
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-black text-white">{ad.title}</h3>
                              {ad.subtitle && (
                                <p className="mt-1 line-clamp-1 text-sm text-cyan-100/70">{ad.subtitle}</p>
                              )}
                              <p className="mt-2 text-xs text-slate-500">
                                Submitted by @{ad.user_profiles?.username || 'Unknown'} • {formatDate(ad.submitted_at)}
                              </p>
                            </div>

                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusBadge(ad.status)}`}>
                              {ad.status.toUpperCase()}
                            </span>
                          </div>

                          {ad.description && (
                            <p className="mb-3 line-clamp-2 text-sm text-slate-300">{ad.description}</p>
                          )}

                          <div className="mt-auto grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-2xl border border-cyan-300/10 bg-slate-950/70 px-3 py-2">
                              <Eye className="mb-1 h-4 w-4 text-cyan-100" />
                              <p className="font-mono font-black">{formatNumber(ad.impressions_count)}</p>
                              <p className="text-slate-500">Views</p>
                            </div>

                            <div className="rounded-2xl border border-fuchsia-300/10 bg-slate-950/70 px-3 py-2">
                              <MousePointerClick className="mb-1 h-4 w-4 text-fuchsia-100" />
                              <p className="font-mono font-black">{formatNumber(ad.clicks_count)}</p>
                              <p className="text-slate-500">Clicks</p>
                            </div>

                            <div className="rounded-2xl border border-yellow-300/10 bg-slate-950/70 px-3 py-2">
                              <Clock className="mb-1 h-4 w-4 text-yellow-100" />
                              <p className="font-mono font-black">
                                {ad.queue_position != null ? `#${ad.queue_position}` : '—'}
                              </p>
                              <p className="text-slate-500">Queue</p>
                            </div>
                          </div>

                          {ad.link_url && (
                            <a
                              href={ad.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-2 truncate text-xs font-bold text-cyan-100 hover:text-cyan-50"
                            >
                              <LinkIcon className="h-3 w-3" />
                              {ad.link_url}
                            </a>
                          )}

                          {ad.status === 'pending' && (
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => approveAd(ad.id)}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-300/20"
                              >
                                <Check className="h-4 w-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => denyAd(ad.id)}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-100 hover:bg-rose-300/20"
                              >
                                <X className="h-4 w-4" />
                                Deny
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,#020617_0%,#07111f_48%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.14] bg-[linear-gradient(rgba(34,211,238,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.2)_1px,transparent_1px)] bg-[size:44px_44px]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_420px]">
        <main className="flex flex-col gap-6">
          <header className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_0_55px_rgba(34,211,238,0.14)] backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.32)]">
                <Megaphone className="h-9 w-9 text-cyan-100" />
                <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-fuchsia-300" />
              </div>

              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                  Mai Troll Promotion
                </div>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Advertise on Mai Troll
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-cyan-100/70">
                  Submit a premium ad for review. Approved ads enter the public rotation queue.
                </p>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-yellow-300/25 bg-yellow-300/10 p-5 backdrop-blur-2xl">
              <Wallet className="mb-3 h-6 w-6 text-yellow-200" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-100/60">Cost</p>
              <p className="font-mono text-3xl font-black text-yellow-200">{AD_COST.toLocaleString()} TC</p>
            </div>

            <div className="rounded-3xl border border-cyan-300/25 bg-cyan-300/10 p-5 backdrop-blur-2xl">
              <Timer className="mb-3 h-6 w-6 text-cyan-100" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/60">Run Time</p>
              <p className="text-2xl font-black text-cyan-100">7 Days</p>
            </div>

            <div className="rounded-3xl border border-fuchsia-300/25 bg-fuchsia-300/10 p-5 backdrop-blur-2xl">
              <ShieldCheck className="mb-3 h-6 w-6 text-fuchsia-100" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100/60">Review</p>
              <p className="text-2xl font-black text-fuchsia-100">Admin Approved</p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_0_45px_rgba(34,211,238,0.1)] backdrop-blur-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">Create Advertisement</h2>
                <p className="text-sm text-slate-400">
                  Required: title and image. Optional: subtitle, description, link.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-100/65">
                  Ad Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                  className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/80 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                  placeholder="Enter ad title"
                  maxLength={50}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-100/65">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(event) => setFormData({ ...formData, subtitle: event.target.value })}
                  className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/80 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                  placeholder="Short subtitle"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-100/65">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="h-28 w-full resize-none rounded-2xl border border-cyan-300/20 bg-slate-950/80 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                  placeholder="Describe your ad"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-100/65">
                  Upload Image *
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-300/30 bg-cyan-300/[0.04] p-6 text-center transition hover:border-cyan-200 hover:bg-cyan-300/[0.08]">
                  <ImagePlus className="mb-3 h-8 w-8 text-cyan-100" />
                  <p className="font-black text-white">Choose advertisement image</p>
                  <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP under {MAX_IMAGE_MB}MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageSelect(event.target.files?.[0])}
                    className="hidden"
                    required
                  />
                </label>

                {selectedImage && (
                  <p className="mt-2 text-xs text-slate-400">
                    Selected: {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-100/65">
                  Link URL
                </label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-100/60" />
                  <input
                    type="url"
                    value={formData.link_url}
                    onChange={(event) => setFormData({ ...formData, link_url: event.target.value })}
                    className="w-full rounded-2xl border border-cyan-300/20 bg-slate-950/80 px-12 py-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                    placeholder="https://your-website.com"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-slate-300">Submission Cost</span>
                  <span className="font-mono text-xl font-black text-yellow-200">{AD_COST.toLocaleString()} TC</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-slate-300">Your Balance</span>
                  <span className={`font-mono text-xl font-black ${balance >= AD_COST ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {balance.toLocaleString()} TC
                  </span>
                </div>

                {balance < AD_COST && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm font-bold text-rose-100">
                    <AlertTriangle className="h-4 w-4" />
                    You need more Troll Coins to submit this ad.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 px-5 py-4 font-black text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading || uploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {loading || uploadingImage ? 'Submitting Advertisement...' : 'Submit Advertisement'}
              </button>
            </form>
          </section>
        </main>

        <aside className="flex flex-col gap-6">
          <section className="sticky top-6 rounded-[2rem] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_0_45px_rgba(168,85,247,0.12)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10">
                <Eye className="h-6 w-6 text-fuchsia-100" />
              </div>
              <div>
                <h2 className="text-xl font-black">Live Preview</h2>
                <p className="text-xs text-slate-400">How your ad card may appear</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-slate-900/80">
              <div className="relative h-56 bg-slate-950">
                {previewUrl ? (
                  <img src={previewUrl} alt="Ad preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-500">
                    <ImagePlus className="mb-3 h-10 w-10" />
                    <p className="text-sm font-bold">Image preview</p>
                  </div>
                )}

                <div className="absolute left-3 top-3 rounded-full border border-cyan-300/25 bg-black/60 px-3 py-1 text-xs font-black text-cyan-100 backdrop-blur-md">
                  Sponsored
                </div>
              </div>

              <div className="p-4">
                <h3 className="line-clamp-1 text-xl font-black text-white">
                  {formData.title || 'Your Ad Title'}
                </h3>
                <p className="mt-1 line-clamp-1 text-sm text-cyan-100/70">
                  {formData.subtitle || 'Optional subtitle appears here'}
                </p>
                <p className="mt-3 line-clamp-3 text-sm text-slate-400">
                  {formData.description || 'Optional description explains what users should know before they click.'}
                </p>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-cyan-300/10 bg-cyan-300/10 px-4 py-3">
                  <span className="text-sm font-black text-cyan-100">Ad Slot</span>
                  <span className="text-xs font-bold text-slate-400">Pending Approval</span>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}