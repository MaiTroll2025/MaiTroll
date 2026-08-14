import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import {
  Album,
  ArrowLeft,
  CheckCircle2,
  Disc3,
  Loader2,
  Music,
  Save,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

type AlbumFormData = {
  title: string
  description: string
  cover_url: string
  release_date: string
  status: recordLabelService.AlbumStatus
}

const EMPTY_FORM: AlbumFormData = {
  title: '',
  description: '',
  cover_url: '',
  release_date: '',
  status: 'draft',
}

const STATUS_OPTIONS: recordLabelService.AlbumStatus[] = ['draft', 'published', 'archived']

const STATUS_LABELS: Record<recordLabelService.AlbumStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default function CreateAlbumPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [artist, setArtist] = useState<recordLabelService.RecordLabelArtistProfile | null>(null)
  const [form, setForm] = useState<AlbumFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof AlbumFormData, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isArtist = (profile as any)?.is_record_label_artist === true

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!user?.id) {
        navigate('/auth', { replace: true })
        return
      }

      try {
        setLoading(true)
        setSubmitError(null)

        const artistResult = await recordLabelService.getArtistProfileByUserId(user.id)

        if (!active) return

        const artistData = artistResult.data
        if (!artistData) {
          toast.error('You must be an approved MAI artist to create albums.')
          navigate('/mai-record-label', { replace: true })
          return
        }

        setArtist(artistData)
      } catch (error) {
        console.error('[CreateAlbumPage] Failed to load:', error)
        toast.error('Failed to load artist data.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user?.id, navigate])

  const updateField = <K extends keyof AlbumFormData>(field: K, value: AlbumFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof AlbumFormData, string>> = {}

    if (!form.title.trim()) {
      next.title = 'Album title is required.'
    }

    if (form.cover_url.trim() && !isValidUrl(form.cover_url)) {
      next.cover_url = 'Please provide a valid URL (e.g. https://example.com/cover.jpg).'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!artist) {
      toast.error('Artist profile not loaded. Please try again.')
      return
    }

    if (!validate()) {
      toast.error('Please fix the validation errors before submitting.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const { error } = await recordLabelService.createAlbum({
        artist_id: artist.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        cover_url: form.cover_url.trim() || undefined,
        release_date: form.release_date.trim() || undefined,
        status: form.status,
      })

      if (error) throw error

      toast.success('Album created successfully!')
      navigate('/artist/dashboard')
    } catch (error: any) {
      console.error('[CreateAlbumPage] Submit failed:', error)
      const message = error?.message || 'Failed to create album. Please try again.'
      setSubmitError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isArtist) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>

        <div className="relative mx-auto max-w-2xl px-4 py-16">
          <div className="flex justify-center mb-6">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <Card className={`${MaiTrollTheme.components.card} text-center`}>
            <CardContent className="p-10">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <Disc3 className="h-8 w-8 text-purple-300" />
              </div>
              <CardTitle className="mb-3 text-white">
                Artist Access Required
              </CardTitle>
              <p className={MaiTrollTheme.text.muted}>
                This page is only available to approved MAI Record Label artists.
                Apply to join the label to create albums.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => navigate('/mai-record-label')}
                  className={MaiTrollTheme.components.buttonPrimary}
                >
                  <Music className="w-4 h-4 mr-2" />
                  MAI Record Label
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className={`${MaiTrollTheme.components.buttonSecondary} bg-transparent`}
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 py-16">
          <div className="flex justify-center mb-8">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <Card className={`${MaiTrollTheme.components.card}`}>
            <CardContent className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
              <span className="ml-3 text-slate-300">Loading your artist profile...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-8 md:px-6 lg:px-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className={`mb-6 flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-white ${MaiTrollTheme.interactive.hover}`}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
              <Disc3 size={24} className="text-purple-300" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                MAI Record Label
              </span>
              <h1 className="text-3xl font-black md:text-4xl text-white">
                Create Album
              </h1>
            </div>
          </div>
          <p className={`mt-2 text-sm ${MaiTrollTheme.text.muted}`}>
            Add a new album to your catalog. Set it as a draft to finish later, or publish it when you&apos;re ready.
          </p>
        </div>

        <Card className={`${MaiTrollTheme.components.card}`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Album size={20} className="text-purple-300" />
              Album Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {submitError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <p className="text-sm text-red-300">{submitError}</p>
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-200">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Enter album title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className={errors.title ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15' : MaiTrollTheme.components.input}
                />
                {errors.title && (
                  <p className="text-xs text-red-400">{errors.title}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-200">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe this album (optional)"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className={`${MaiTrollTheme.components.input} min-h-[100px]`}
                />
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  A short description helps listeners discover your album.
                </p>
              </div>

              {/* Cover URL */}
              <div className="space-y-2">
                <Label htmlFor="cover_url" className="text-slate-200">
                  Cover Art URL
                </Label>
                <Input
                  id="cover_url"
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  value={form.cover_url}
                  onChange={(e) => updateField('cover_url', e.target.value)}
                  className={errors.cover_url ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15' : MaiTrollTheme.components.input}
                />
                {errors.cover_url && (
                  <p className="text-xs text-red-400">{errors.cover_url}</p>
                )}
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  Provide a direct link to your album cover image (minimum 1400x1400px recommended).
                </p>
              </div>

              {/* Release Date + Status */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="release_date" className="text-slate-200">
                    Release Date
                  </Label>
                  <Input
                    id="release_date"
                    type="date"
                    value={form.release_date}
                    onChange={(e) => updateField('release_date', e.target.value)}
                    className={MaiTrollTheme.components.input}
                  />
                  <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                    Leave blank to keep this album unreleased.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-slate-200">
                    Status
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => updateField('status', value as recordLabelService.AlbumStatus)}
                  >
                    <SelectTrigger id="status" className={MaiTrollTheme.components.input}>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                    Drafts are saved privately until you publish them.
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className={`${MaiTrollTheme.components.buttonPrimary} w-full`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Album...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Album
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className={`${MaiTrollTheme.components.card} mt-6`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <CheckCircle2 className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Tips for Releasing an Album</h3>
                <ul className={`space-y-1 text-xs ${MaiTrollTheme.text.muted}`}>
                  <li>• Use high-quality cover art (minimum 1400x1400px recommended).</li>
                  <li>• Save as a draft first if you want to come back and finalize later.</li>
                  <li>• Set a release date to schedule when your album goes live.</li>
                  <li>• After creating the album, upload tracks and assign them to it.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
