import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase, UserRole, hasRole } from '@/lib/supabase'
import { validateFile, FILE_VALIDATION } from '@/lib/fileValidation'
import { Music, Play, Pause, Trash2, Coins, Upload, AlertCircle, FileText, CheckCircle } from 'lucide-react'

interface Track {
  id: string
  title: string
  artist: string
  user_id: string
  username: string
  audio_url: string
  duration: number
  tip_amount: number
  created_at: string
  status: 'active' | 'disabled' | 'suspended'
}

export default function MusicTab() {
  const user = useAuthStore((state) => state.profile)
  
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [showContract, setShowContract] = useState(false)
  const [contractAccepted, setContractAccepted] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [tipAmount, setTipAmount] = useState(10)
  const [tippingTrackId, setTippingTrackId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const isTroller = user?.role === UserRole.TROLLER || user?.troll_role === 'troller'
  const isAdminOrOfficer = hasRole(user, [UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER, UserRole.SECRETARY, UserRole.PRESIDENT, UserRole.VICE_PRESIDENT, UserRole.TEMP_ADMIN])
  const canUpload = !isTroller && user?.terms_accepted && user?.music_contract_accepted
  const canManageTracks = isAdminOrOfficer && !isTroller

  useEffect(() => {
    fetchTracks()
    if (user?.music_contract_accepted) {
      setShowContract(false)
      setContractAccepted(true)
    } else {
      setShowContract(true)
      setContractAccepted(false)
    }
  }, [])

  const fetchTracks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('music_tracks')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setTracks(data)
    }
    setLoading(false)
  }

  const getAudioUrl = (audioUrl: string) => {
    if (audioUrl.startsWith('http')) return audioUrl
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/music_tracks/${audioUrl}`
  }

  const handlePlay = async (track: Track) => {
    if (audioRef.current) {
      audioRef.current.src = getAudioUrl(track.audio_url)
      try {
        await audioRef.current.play()
        setCurrentTrack(track)
        setIsPlaying(true)
      } catch (e) {
        console.error('Failed to play audio:', e)
      }
    }
  }

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const handleUpload = async (file: File, title: string) => {
    if (!user || !canUpload || !file) return

    const validation = validateFile(file, FILE_VALIDATION.audio.types, FILE_VALIDATION.audio.maxSize, 'Audio file')
    if (!validation.valid) {
      setError(validation.error!)
      return
    }

    setUploading(true)
    setError(null)
    
    try {
      const fileName = `${user}_${Date.now()}_${file.name}`
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('music_tracks')
        .upload(fileName, file)
      
      if (uploadError) {
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('404')) {
          throw new Error('Music storage is not configured. Please contact an admin to set up the music_tracks storage bucket.')
        }
        throw uploadError
      }
      
      const { data: insertData, error: insertError } = await supabase
        .from('music_tracks')
        .insert({
          title,
          artist: user?.display_name || user?.username || 'Unknown',
          user_id: user,
          username: user?.display_name || user?.username || 'Unknown',
          audio_url: uploadData.path,
          duration: 0,
          tip_amount: 0,
          status: 'active'
        })
        .select()
        .single()
      
      if (insertError) throw insertError
      
      setTracks([insertData as Track, ...tracks])
      setShowUploadForm(false)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (trackId: string) => {
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    
    if (user?.id !== track.user_id && !canManageTracks) return
    
    const { error } = await supabase
      .from('music_tracks')
      .update({ status: 'disabled' })
      .eq('id', trackId)
    
    if (!error) {
      setTracks(tracks.filter(t => t.id !== trackId))
    }
  }

  const handleTip = async (trackId: string) => {
    if (!user || (user?.troll_coins || 0) < tipAmount) return
    
    setTippingTrackId(trackId)
    
    try {
      const { error: tipError } = await supabase
        .from('music_tips')
        .insert({
          track_id: trackId,
          user_id: user,
          amount: tipAmount
        })
      
      if (!tipError) {
        const track = tracks.find(t => t.id === trackId)
        if (track) {
          await supabase.rpc('add_user_coins', { 
            user_id: track.user_id, 
            amount: tipAmount 
          })
        }
        
        await supabase
          .from('user_profiles')
          .update({ troll_coins: Math.max(0, (user.troll_coins || 0) - tipAmount) })
          .eq('id', user)
        
        fetchTracks()
      }
    } finally {
      setTippingTrackId(null)
    }
  }

  const acceptContract = async () => {
    if (!user || !contractAccepted) return
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        music_contract_accepted: true,
        music_contract_accepted_at: new Date().toISOString()
      })
      .eq('id', user)
    
    if (!error) {
      setShowContract(false)
    }
  }

  if (showContract) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Music className="h-5 w-5 text-purple-300" />
          Trusic Radio
        </h2>
        
        <div className="rounded-2xl border border-purple-400/20 bg-slate-950/80 p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-cyan-300" />
            <h3 className="text-lg font-black text-white">Music Submission Agreement</h3>
          </div>
          
          <div className="space-y-3 text-sm text-slate-300">
            <p>By uploading music to Trusic, you agree:</p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-lime-300 mt-0.5" />
                <span>You retain copyright to your music</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-lime-300 mt-0.5" />
                <span>Mai Troll LLC has non-exclusive rights to share and publish your tracks</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-lime-300 mt-0.5" />
                <span>Mai Troll LLC will NEVER sell your music or make you an offer</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-lime-300 mt-0.5" />
                <span>You are NOT signed to Mai Troll LLC as a record label artist</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-pink-300 mt-0.5" />
                <span>NO AI-generated music is allowed. All uploads are manually reviewed</span>
              </li>
            </ul>
          </div>
          
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="contract-accept"
              checked={contractAccepted}
              onChange={(e) => setContractAccepted(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-slate-800"
            />
            <label htmlFor="contract-accept" className="text-sm font-black text-white">
              I accept these terms and want to upload music
            </label>
          </div>
          
          <div className="mt-4">
            <button
              onClick={acceptContract}
              disabled={!contractAccepted}
              className="rounded-xl bg-gradient-to-r from-lime-400 to-purple-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              Accept Agreement
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Music className="h-5 w-5 text-purple-300" />
          Trusic Radio
        </h2>
        {canUpload && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 px-3 py-1.5 text-xs font-black text-white flex items-center gap-1"
          >
            <Upload className="h-3 w-3" />
            Upload Track
          </button>
        )}
      </div>

      <div className="text-xs text-slate-400 flex items-center gap-2">
        <AlertCircle className="h-3 w-3" />
        <span>NO AI-generated music allowed. Mai Troll LLC is NOT a record label.</span>
      </div>

      {!canUpload && user && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-sm text-yellow-300">
          You must accept the music contract and have a verified profile to upload music.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {showUploadForm && (
        <UploadForm 
          onUpload={handleUpload} 
          onCancel={() => setShowUploadForm(false)}
          uploading={uploading}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-white/5 rounded-xl mb-2"></div>
              <div className="h-4 bg-white/10 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-white/5 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-12">
          <Music className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-black">No tracks uploaded yet</p>
          <p className="text-slate-500 text-xs mt-1">Be the first to share your music!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isPlaying={isPlaying}
              onPlay={() => handlePlay(track)}
              onPause={handlePause}
              onTip={handleTip}
              onDelete={handleDelete}
              tippingTrackId={tippingTrackId}
              currentUser={user}
              tipAmount={tipAmount}
              onTipAmountChange={setTipAmount}
            />
          ))}
        </div>
      )}

      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setCurrentTrack(null) }} />
    </div>
  )
}

interface UploadFormProps {
  onUpload: (file: File, title: string) => void
  onCancel: () => void
  uploading: boolean
}

function UploadForm({ onUpload, onCancel, uploading }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (file && title) {
      onUpload(file, title)
    }
  }

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-slate-950/80 p-4">
      <h3 className="text-sm font-black text-white mb-3">Upload New Track</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-xs text-slate-300 file:rounded-xl file:border file:border-purple-400/20 file:bg-purple-500/10 file:px-3 file:py-2"
        />
        <input
          type="text"
          placeholder="Track title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!file || !title || uploading}
            className="rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-slate-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

interface TrackCardProps {
  track: Track
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onTip: (trackId: string) => void
  onDelete: (trackId: string) => void
  tippingTrackId: string | null
  currentUser: any
  tipAmount: number
  onTipAmountChange: (amount: number) => void
}

function TrackCard({ track, isPlaying, onPlay, onPause, onTip, onDelete, tippingTrackId, currentUser, tipAmount, onTipAmountChange }: TrackCardProps) {
  const isOwner = currentUser?.id === track.user_id
  const canDelete = currentUser && (isOwner || hasRole(currentUser, [UserRole.ADMIN, UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER]))

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
          <Music className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white truncate">{track.title}</p>
          <p className="text-xs text-slate-400 truncate">{track.artist}</p>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(track.id)}
            className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/20"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={isPlaying ? onPause : onPlay}
          className="h-6 w-6 rounded bg-gradient-to-r from-purple-500 to-cyan-400 flex items-center justify-center"
        >
          {isPlaying ? (
            <Pause className="h-3 w-3 text-white" />
          ) : (
            <Play className="h-3 w-3 text-white" />
          )}
        </button>

        <div className="flex-1 text-xs">
          <p className="text-slate-300 font-medium">{track.username}</p>
        </div>

        <div className="flex items-center gap-1 text-xs">
          <Coins className="h-3 w-3 text-yellow-300" />
          <span className="text-slate-300">{track.tip_amount}</span>
        </div>
      </div>

      <div className="mt-2 flex gap-1">
        <input
          type="number"
          min="1"
          max={currentUser?.troll_coins || 0}
          value={tipAmount}
          onChange={(e) => onTipAmountChange(Number(e.target.value))}
          className="flex-1 rounded bg-black/30 border border-white/10 px-2 py-1 text-xs text-white w-16"
          placeholder="Tip"
        />
        <button
          onClick={() => onTip(track.id)}
          disabled={!currentUser || (currentUser?.troll_coins || 0) < tipAmount || tippingTrackId === track.id}
          className="rounded bg-gradient-to-r from-yellow-500 to-orange-400 px-2 py-1 text-xs font-black text-white disabled:opacity-50"
        >
          Tip
        </button>
      </div>
    </div>
  )
}