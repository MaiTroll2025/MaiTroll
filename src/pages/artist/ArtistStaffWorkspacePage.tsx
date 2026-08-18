import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { supabase } from '@/lib/supabase'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ArtistStaffWorkspacePage() {
  const { artistId } = useParams<{ artistId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState<any>(null)
  const [artist, setArtist] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id || !artistId) return

    try {
      setLoading(true)
      setError(null)

      const artistResult = await supabase
        .from('record_label_artist_profiles')
        .select('*')
        .eq('id', artistId)
        .single()

      if (artistResult.error || !artistResult.data) {
        setError('Artist not found.')
        return
      }

      setArtist(artistResult.data)

      const staffResult = await recordLabelService.getArtistStaff({ artistId })
      if (staffResult.error) throw staffResult.error

      const myMembership = (staffResult.data || []).find(
        (s) => s.employee_user_id === user.id && s.status === 'active'
      )

      if (!myMembership) {
        setError('You do not have active staff access to this artist workspace.')
        return
      }

      setMembership(myMembership)
    } catch (err: any) {
      console.error('[Workspace] Failed:', err)
      setError(err?.message || 'Failed to load workspace.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, artistId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
          <p className="text-lg text-slate-300">Loading workspace...</p>
        </div>
      </div>
    )
  }

  if (error || !membership || !artist) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-lg text-slate-300">{error || 'Access denied.'}</p>
          <Button onClick={() => navigate('/artist/staff')} className={`${MaiTrollTheme.components.buttonPrimary} mt-4`}>
            Back to My Jobs
          </Button>
        </div>
      </div>
    )
  }

  const permissions = membership.permissions || {}
  const hasPermission = (perm: string) => !!permissions[perm]

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => navigate('/artist/staff')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to My Jobs
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
            <span className="text-2xl font-bold text-purple-300">
              {(artist.stage_name || 'A')[0]?.toUpperCase()}
            </span>
          </div>
          <h1 className="text-3xl font-black md:text-4xl">{artist.stage_name} Workspace</h1>
          <p className={`mt-2 ${MaiTrollTheme.text.muted}`}>
            Your position: {membership.position}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hasPermission('view_artist_profile') && (
            <Card className="bg-[#141414] border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
              onClick={() => navigate(`/artist/profile`)}>
              <CardContent className="p-4">
                <p className="font-semibold text-white">Artist Profile</p>
                <p className="text-sm text-gray-400">View and manage artist profile</p>
              </CardContent>
            </Card>
          )}

          {hasPermission('view_artist_analytics') && (
            <Card className="bg-[#141414] border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
              onClick={() => navigate(`/artist/earnings`)}>
              <CardContent className="p-4">
                <p className="font-semibold text-white">Analytics</p>
                <p className="text-sm text-gray-400">View artist analytics and earnings</p>
              </CardContent>
            </Card>
          )}

          {hasPermission('view_music') && (
            <Card className="bg-[#141414] border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
              onClick={() => navigate(`/music/artist/${artistId}`)}>
              <CardContent className="p-4">
                <p className="font-semibold text-white">Music</p>
                <p className="text-sm text-gray-400">View tracks and albums</p>
              </CardContent>
            </Card>
          )}

          {hasPermission('manage_tracks') && (
            <Card className="bg-[#141414] border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
              onClick={() => navigate(`/artist/upload-track`)}>
              <CardContent className="p-4">
                <p className="font-semibold text-white">Manage Tracks</p>
                <p className="text-sm text-gray-400">Upload and manage tracks</p>
              </CardContent>
            </Card>
          )}

          {hasPermission('create_posts') && (
            <Card className="bg-[#141414] border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
              onClick={() => navigate('/')}>
              <CardContent className="p-4">
                <p className="font-semibold text-white">Create Posts</p>
                <p className="text-sm text-gray-400">Create and schedule posts</p>
              </CardContent>
            </Card>
          )}

          {hasPermission('promote_music') && (
            <Card className="bg-[#141414] border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
              onClick={() => navigate('/')}>
              <CardContent className="p-4">
                <p className="font-semibold text-white">Promote Music</p>
                <p className="text-sm text-gray-400">Promote tracks and albums</p>
              </CardContent>
            </Card>
          )}
        </div>

        {Object.keys(permissions).length === 0 && (
          <Card className="bg-[#141414] border-[#2C2C2C] mt-6">
            <CardContent className="py-8 text-center text-gray-400">
              <p>No permissions have been granted for this workspace.</p>
              <p className="text-sm mt-2">Contact the artist to request additional permissions.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
