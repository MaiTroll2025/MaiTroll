import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Music2,
  Loader2,
  User,
  Mic2,
  Globe,
  Link2,
  FileText,
  Shield,
  CheckCircle2,
} from 'lucide-react'

const GENRE_OPTIONS = [
  'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'Country',
  'Jazz', 'Classical', 'Metal', 'Folk', 'Reggae', 'Blues',
  'Latin', 'Indie', 'Alternative', 'Punk', 'Soul', 'Funk',
  'Gospel', 'Ambient', 'Experimental', 'Other',
]

const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20'

const sectionCls = 'rounded-2xl border border-white/10 bg-white/[0.03] p-5'

export default function MaiRecordLabelApplyPage() {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [hasExisting, setHasExisting] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')

  const [form, setForm] = useState({
    legal_name: '',
    stage_name: '',
    artist_bio: '',
    primary_genre: '',
    additional_genres: [] as string[],
    years_making_music: '' as string,
    location: '',
    website_url: '',
    spotify_url: '',
    apple_music_url: '',
    soundcloud_url: '',
    youtube_url: '',
    other_links: '' as string,
    sample_track_urls: '' as string,
    why_join: '',
    confirms_original_music: false,
    confirms_rights_control: false,
    agreed_to_application_terms: false,
  })

  useEffect(() => {
    if (!user) return
    let active = true
    const checkExisting = async () => {
      try {
        const { data } = await recordLabelService.getMyApplication(user.id)
        if (active) {
          setHasExisting(Boolean(data && (data.status === 'pending' || data.status === 'approved')))
          setCheckingExisting(false)
        }
      } catch {
        if (active) setCheckingExisting(false)
      }
    }
    checkExisting()
    return () => { active = false }
  }, [user])

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))

  const toggleGenre = (genre: string) => {
    setForm((prev) => ({
      ...prev,
      additional_genres: prev.additional_genres.includes(genre)
        ? prev.additional_genres.filter((g) => g !== genre)
        : [...prev.additional_genres, genre],
    }))
  }

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean)
  }

  const validate = (): string | null => {
    if (!form.legal_name.trim()) return 'Legal name is required.'
    if (!form.stage_name.trim()) return 'Stage name is required.'
    if (!form.primary_genre) return 'Primary genre is required.'
    if (!form.confirms_original_music) return 'You must confirm your music is original.'
    if (!form.confirms_rights_control) return 'You must confirm you control the rights to your music.'
    if (!form.agreed_to_application_terms) return 'You must agree to the application terms.'
    return null
  }

  const handleSubmit = async () => {
    if (!user) return
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }

    setLoading(true)
    try {
      const otherLinks = parseUrls(form.other_links).map((url) => ({ url, label: '' }))
      const sampleTracks = parseUrls(form.sample_track_urls)

      const { error } = await recordLabelService.submitApplication({
        legal_name: form.legal_name,
        stage_name: form.stage_name,
        artist_bio: form.artist_bio || undefined,
        primary_genre: form.primary_genre,
        additional_genres: form.additional_genres,
        years_making_music: form.years_making_music ? Number(form.years_making_music) : undefined,
        location: form.location || undefined,
        website_url: form.website_url || undefined,
        spotify_url: form.spotify_url || undefined,
        apple_music_url: form.apple_music_url || undefined,
        soundcloud_url: form.soundcloud_url || undefined,
        youtube_url: form.youtube_url || undefined,
        other_links: otherLinks,
        sample_track_urls: sampleTracks,
        why_join: form.why_join || undefined,
        confirms_original_music: form.confirms_original_music,
        confirms_rights_control: form.confirms_rights_control,
        agreed_to_application_terms: form.agreed_to_application_terms,
      })

      if (error) throw error

      toast.success('Application submitted! We will review it soon.')
      navigate('/mai-record-label')
    } catch (err: any) {
      console.error('MAI application error:', err)
      toast.error(err.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || checkingExisting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-400" size={32} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="mx-auto max-w-2xl text-center">
          <Music2 className="mx-auto mb-4 text-purple-400" size={48} />
          <h1 className="text-3xl font-black mb-2">Apply to MAI Record Label</h1>
          <p className="text-slate-400 mb-6">You need to be signed in to apply.</p>
          <Button onClick={() => navigate('/login', { state: { from: '/mai-record-label/apply' } })} className="rounded-xl bg-purple-600 hover:bg-purple-500">
            Sign In to Apply
          </Button>
        </div>
      </div>
    )
  }

  if (hasExisting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6">
        <div className="mx-auto max-w-2xl text-center">
          <CheckCircle2 className="mx-auto mb-4 text-cyan-400" size={48} />
          <h1 className="text-3xl font-black mb-2">Application Already Submitted</h1>
          <p className="text-slate-400 mb-6">You already have a pending or approved application with MAI Record Label.</p>
          <Button onClick={() => navigate('/mai-record-label')} className="rounded-xl bg-purple-600 hover:bg-purple-500">
            Back to MAI Record Label
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 lg:px-8">
        <button
          onClick={() => navigate('/mai-record-label')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to MAI Record Label
        </button>

        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
            <Music2 size={24} className="text-purple-300" />
          </div>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">Apply to MAI Record Label</h1>
            <p className="text-sm text-slate-400">Submit your artist application for review</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
            {[
              { value: 'personal', label: 'Personal', icon: User },
              { value: 'music', label: 'Music & Links', icon: Mic2 },
              { value: 'terms', label: 'Terms', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.value
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'personal' && (
            <div className="space-y-5">
              <Card className={sectionCls}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <User size={20} className="text-purple-300" />
                  Personal Information
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label required>Legal Name</Label>
                    <Input
                      className={inputCls}
                      placeholder="Your full legal name"
                      value={form.legal_name}
                      onChange={(e) => update({ legal_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label required>Stage Name</Label>
                    <Input
                      className={inputCls}
                      placeholder="Your artist / stage name"
                      value={form.stage_name}
                      onChange={(e) => update({ stage_name: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Artist Bio</Label>
                    <Textarea
                      className={inputCls}
                      rows={4}
                      placeholder="Tell us about yourself, your background, and your artistic journey..."
                      value={form.artist_bio}
                      onChange={(e) => update({ artist_bio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label required>Primary Genre</Label>
                    <select
                      className={inputCls}
                      value={form.primary_genre}
                      onChange={(e) => update({ primary_genre: e.target.value })}
                    >
                      <option value="">Select primary genre</option>
                      {GENRE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Years Making Music</Label>
                    <Input
                      className={inputCls}
                      type="number"
                      placeholder="e.g. 5"
                      value={form.years_making_music}
                      onChange={(e) => update({ years_making_music: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Location</Label>
                    <Input
                      className={inputCls}
                      placeholder="City, State / Country"
                      value={form.location}
                      onChange={(e) => update({ location: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <Card className={sectionCls}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <Globe size={20} className="text-cyan-300" />
                  Additional Genres
                </h2>
                <p className="mb-3 text-sm text-slate-400">Select any additional genres that describe your music.</p>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.filter((g) => g !== form.primary_genre).map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        form.additional_genres.includes(genre)
                          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                          : 'border-white/10 bg-black/30 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'music' && (
            <div className="space-y-5">
              <Card className={sectionCls}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <Link2 size={20} className="text-purple-300" />
                  Online Presence
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Website URL</Label>
                    <Input
                      className={inputCls}
                      placeholder="https://yourwebsite.com"
                      value={form.website_url}
                      onChange={(e) => update({ website_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Spotify URL</Label>
                    <Input
                      className={inputCls}
                      placeholder="https://open.spotify.com/artist/..."
                      value={form.spotify_url}
                      onChange={(e) => update({ spotify_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Apple Music URL</Label>
                    <Input
                      className={inputCls}
                      placeholder="https://music.apple.com/..."
                      value={form.apple_music_url}
                      onChange={(e) => update({ apple_music_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>SoundCloud URL</Label>
                    <Input
                      className={inputCls}
                      placeholder="https://soundcloud.com/..."
                      value={form.soundcloud_url}
                      onChange={(e) => update({ soundcloud_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>YouTube URL</Label>
                    <Input
                      className={inputCls}
                      placeholder="https://youtube.com/..."
                      value={form.youtube_url}
                      onChange={(e) => update({ youtube_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Other Links</Label>
                    <Textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Paste other links (one per line)"
                      value={form.other_links}
                      onChange={(e) => update({ other_links: e.target.value })}
                    />
                  </div>
                </div>
              </Card>

              <Card className={sectionCls}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <Mic2 size={20} className="text-cyan-300" />
                  Sample Tracks
                </h2>
                <p className="mb-3 text-sm text-slate-400">Provide links to your best work. One URL per line.</p>
                <Textarea
                  className={inputCls}
                  rows={4}
                  placeholder="https://soundcloud.com/...&#10;https://youtube.com/..."
                  value={form.sample_track_urls}
                  onChange={(e) => update({ sample_track_urls: e.target.value })}
                />
              </Card>

              <Card className={sectionCls}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <FileText size={20} className="text-purple-300" />
                  Why Join MAI?
                </h2>
                <Textarea
                  className={inputCls}
                  rows={4}
                  placeholder="Tell us why you want to join MAI Record Label and what you hope to achieve..."
                  value={form.why_join}
                  onChange={(e) => update({ why_join: e.target.value })}
                />
              </Card>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-5">
              <Card className={sectionCls}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                  <Shield size={20} className="text-purple-300" />
                  Agreements & Confirmations
                </h2>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-white/20">
                    <Checkbox
                      checked={form.confirms_original_music}
                      onCheckedChange={(checked) => update({ confirms_original_music: checked as boolean })}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Original Music</p>
                      <p className="text-xs text-slate-400">I confirm that all music I submit is original and created by me.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-white/20">
                    <Checkbox
                      checked={form.confirms_rights_control}
                      onCheckedChange={(checked) => update({ confirms_rights_control: checked as boolean })}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Rights Control</p>
                      <p className="text-xs text-slate-400">I confirm that I have full rights and control over all music I submit for this application.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 transition hover:border-white/20">
                    <Checkbox
                      checked={form.agreed_to_application_terms}
                      onCheckedChange={(checked) => update({ agreed_to_application_terms: checked as boolean })}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Application Terms</p>
                      <p className="text-xs text-slate-400">I have read and agree to the MAI Record Label application terms and conditions.</p>
                    </div>
                  </label>
                </div>
              </Card>

              <Card className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="mb-2 text-sm font-bold text-white">Application Summary</h3>
                <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                  <div><span className="font-semibold text-slate-300">Legal Name:</span> {form.legal_name || '—'}</div>
                  <div><span className="font-semibold text-slate-300">Stage Name:</span> {form.stage_name || '—'}</div>
                  <div><span className="font-semibold text-slate-300">Primary Genre:</span> {form.primary_genre || '—'}</div>
                  <div><span className="font-semibold text-slate-300">Additional Genres:</span> {form.additional_genres.length ? form.additional_genres.join(', ') : '—'}</div>
                  <div><span className="font-semibold text-slate-300">Years Making Music:</span> {form.years_making_music || '—'}</div>
                  <div><span className="font-semibold text-slate-300">Location:</span> {form.location || '—'}</div>
                </div>
              </Card>
            </div>
          )}
        </Tabs>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/mai-record-label')}
            className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10"
          >
            Cancel
          </Button>
          <div className="flex gap-3">
            {activeTab !== 'personal' && (
              <Button
                variant="outline"
                onClick={() => setActiveTab(activeTab === 'music' ? 'personal' : 'music')}
                className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10"
              >
                Previous
              </Button>
            )}
            {activeTab !== 'terms' ? (
              <Button
                onClick={() => setActiveTab(activeTab === 'personal' ? 'music' : 'terms')}
                className="rounded-xl bg-purple-600 hover:bg-purple-500"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
