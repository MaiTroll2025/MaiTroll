import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  Music,
  Upload,
  Disc3,
  ImageIcon,
  Mic2,
  CheckCircle2,
  X,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

type TrackFormData = {
  title: string
  description: string
  audio_url: string
  cover_url: string
  genre: string
  duration_seconds: string
  explicit: boolean
  album_id: string
}

type UploadState = {
  file: File | null
  uploading: boolean
  progress: number
  error: string | null
}

const EMPTY_FORM: TrackFormData = {
  title: '',
  description: '',
  audio_url: '',
  cover_url: '',
  genre: '',
  duration_seconds: '',
  explicit: false,
  album_id: '',
}

const EMPTY_UPLOAD: UploadState = {
  file: null,
  uploading: false,
  progress: 0,
  error: null,
}

export default function UploadTrackPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [artist, setArtist] = useState<recordLabelService.RecordLabelArtistProfile | null>(null)
  const [albums, setAlbums] = useState<recordLabelService.RecordLabelAlbum[]>([])
  const [form, setForm] = useState<TrackFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof TrackFormData, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [upload, setUpload] = useState<UploadState>(EMPTY_UPLOAD)

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

        const [artistResult] = await Promise.all([
          recordLabelService.getArtistProfileByUserId(user.id),
        ])

        if (!active) return

        const artistData = artistResult.data
        if (!artistData) {
          toast.error('You must be an approved MAI artist to upload tracks.')
          navigate('/mai-record-label', { replace: true })
          return
        }

        setArtist(artistData)

        const [albumsResult] = await Promise.all([
          recordLabelService.getArtistAlbums(artistData.id),
        ])

        if (!active) return

        if (albumsResult.error) {
          console.error('[UploadTrackPage] Failed to load albums:', albumsResult.error)
        }

        setAlbums(albumsResult.data || [])
      } catch (error) {
        console.error('[UploadTrackPage] Unexpected error:', error)
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

  const updateField = <K extends keyof TrackFormData>(field: K, value: TrackFormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setUpload(prev => ({ ...prev, file, error: null }))
    if (file) {
      setForm(prev => ({ ...prev, audio_url: '' }))
    }
  }

  const removeFile = () => {
    setUpload(EMPTY_UPLOAD)
  }

  const uploadAudioFile = async (): Promise<string | null> => {
    if (!upload.file || !user?.id) return null

    setUpload(prev => ({ ...prev, uploading: true, progress: 0, error: null }))

    try {
      const fileExt = upload.file.name.split('.').pop() || 'mp3'
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('record-label-tracks')
        .upload(fileName, upload.file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message || 'Failed to upload audio file')
      }

      const { data: publicData } = supabase.storage
        .from('record-label-tracks')
        .getPublicUrl(uploadData.path)

      return publicData.publicUrl
    } catch (err: any) {
      const message = err?.message || 'Failed to upload audio file'
      setUpload(prev => ({ ...prev, error: message, uploading: false }))
      toast.error(message)
      return null
    } finally {
      setUpload(prev => ({ ...prev, uploading: false }))
    }
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof TrackFormData, string>> = {}

    if (!form.title.trim()) {
      next.title = 'Track title is required.'
    }

    if (!upload.file) {
      next.audio_url = 'Upload an MP3 file from your computer.'
    }

    if (form.duration_seconds && Number(form.duration_seconds) < 0) {
      next.duration_seconds = 'Duration must be a positive number.'
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
      let audioUrl = form.audio_url.trim() || undefined

      if (upload.file) {
        const uploadedUrl = await uploadAudioFile()
        if (!uploadedUrl) {
          toast.error('Failed to upload audio file.')
          setSubmitting(false)
          return
        }
        audioUrl = uploadedUrl
      }

      const status = audioUrl ? 'published' : 'draft'

      const { error } = await recordLabelService.createTrack({
        artist_id: artist.id,
        album_id: form.album_id || null,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        audio_url: audioUrl,
        cover_url: form.cover_url.trim() || undefined,
        genre: form.genre.trim() || undefined,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : undefined,
        explicit: form.explicit,
        status,
      })

      if (error) throw error

      toast.success('Track uploaded successfully!')
      navigate('/artist/dashboard')
    } catch (error: any) {
      console.error('[UploadTrackPage] Submit failed:', error)
      const message = error?.message || 'Failed to upload track. Please try again.'
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
                <Mic2 className="h-8 w-8 text-purple-300" />
              </div>
              <CardTitle className="mb-3 text-white">
                Artist Access Required
              </CardTitle>
              <p className={MaiTrollTheme.text.muted}>
                This page is only available to approved MAI Record Label artists.
                Apply to join the label to upload tracks.
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
              <span className="ml-3 text-slate-300">Loading upload form...</span>
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
              <Upload size={24} className="text-purple-300" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                MAI Record Label
              </span>
              <h1 className="text-3xl font-black md:text-4xl text-white">
                Upload Track
              </h1>
            </div>
          </div>
          <p className={`mt-2 text-sm ${MaiTrollTheme.text.muted}`}>
            Add a new track to your catalog. Upload an MP3 file from your computer to start processing automatically.
          </p>
        </div>

        <Card className={`${MaiTrollTheme.components.card}`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Music size={20} className="text-purple-300" />
              Track Details
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
                  placeholder="Enter track title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className={errors.title ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15' : ''}
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
                  placeholder="Describe this track (optional)"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className={`${MaiTrollTheme.components.input} min-h-[100px]`}
                />
              </div>

              {/* Audio File Upload */}
              <div className="space-y-2">
                <Label htmlFor="audio_file" className="text-slate-200">
                  Audio File (MP3)
                </Label>
                <Input
                  id="audio_file"
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/aac,audio/flac,audio/m4a"
                  onChange={handleFileChange}
                  disabled={upload.uploading}
                  className={MaiTrollTheme.components.input}
                />
                {upload.file && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <Music size={16} className="text-purple-300 shrink-0" />
                    <p className="flex-1 truncate text-xs text-slate-300">{upload.file.name}</p>
                    <button
                      type="button"
                      onClick={removeFile}
                      disabled={upload.uploading}
                      className="shrink-0 rounded-full p-1 text-slate-400 hover:text-red-400 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {upload.error && (
                  <p className="text-xs text-red-400">{upload.error}</p>
                )}
                {upload.uploading && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
                    <span className="text-xs text-slate-400">Uploading audio...</span>
                  </div>
                )}
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  Upload an MP3 file from your computer. Providing audio will set the track status to &quot;processing&quot; automatically.
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
                  className={MaiTrollTheme.components.input}
                />
              </div>

              {/* Genre + Duration */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="genre" className="text-slate-200">
                    Genre
                  </Label>
                  <Input
                    id="genre"
                    type="text"
                    placeholder="e.g. Hip-Hop, EDM, Rock"
                    value={form.genre}
                    onChange={(e) => updateField('genre', e.target.value)}
                    className={MaiTrollTheme.components.input}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration_seconds" className="text-slate-200">
                    Duration (seconds)
                  </Label>
                  <Input
                    id="duration_seconds"
                    type="number"
                    min="0"
                    placeholder="e.g. 215"
                    value={form.duration_seconds}
                    onChange={(e) => updateField('duration_seconds', e.target.value)}
                    className={errors.duration_seconds ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15' : MaiTrollTheme.components.input}
                  />
                  {errors.duration_seconds && (
                    <p className="text-xs text-red-400">{errors.duration_seconds}</p>
                  )}
                </div>
              </div>

              {/* Explicit */}
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <Checkbox
                  id="explicit"
                  checked={form.explicit}
                  onChange={(e) => updateField('explicit', e.target.checked)}
                  label=""
                />
                <div>
                  <Label htmlFor="explicit" className="text-slate-200 cursor-pointer">
                    Explicit Content
                  </Label>
                  <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                    Mark this track as containing explicit language or content.
                  </p>
                </div>
              </div>

              {/* Album */}
              <div className="space-y-2">
                <Label htmlFor="album_id" className="text-slate-200">
                  Album (optional)
                </Label>
                <Select value={form.album_id} onValueChange={(value) => updateField('album_id', value)}>
                  <SelectTrigger id="album_id" className={MaiTrollTheme.components.input}>
                    <SelectValue placeholder="Select an album" />
                  </SelectTrigger>
                  <SelectContent>
                    {albums.map(album => (
                      <SelectItem key={album.id} value={album.id}>
                        {album.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {albums.length === 0 && (
                  <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                    You don&apos;t have any albums yet. Leave this blank to upload as a standalone track.
                  </p>
                )}
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
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Track
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
                <h3 className="text-sm font-bold text-white mb-1">Tips for a Great Upload</h3>
                <ul className={`space-y-1 text-xs ${MaiTrollTheme.text.muted}`}>
                  <li>• Use high-quality cover art (minimum 1400x1400px recommended).</li>
                  <li>• Upload an MP3 file to automatically start processing and publishing.</li>
                  <li>• Mark as explicit if the track contains explicit language or content.</li>
                  <li>• Assign the track to an album to keep your catalog organized.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
