import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Crown, Play, Users, Loader2 } from 'lucide-react'

interface CelebStream {
  stream_id: string
  title: string
  broadcaster_id: string
  room_name: string
  current_viewers: number
  started_at: string
  thumbnail_url: string | null
  is_paid: boolean
  pricing_value: number
  category: string
  paid_chat_enabled: boolean
}

export default function CelebStreamDiscovery() {
  const navigate = useNavigate()
  const [streams, setStreams] = useState<CelebStream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStreams = async () => {
      try {
        const { data, error } = await supabase.rpc('get_celeb_streams')
        if (error) throw error
        setStreams(data?.streams || [])
      } catch (err: any) {
        console.error('Failed to load celeb streams:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStreams()

    const interval = setInterval(loadStreams, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleJoin = (stream: CelebStream) => {
    navigate(`/broadcast/${stream.stream_id}/${stream.room_name}`, {
      state: { streamType: 'celeb_stream' },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
          Loading Celeb Streams...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Crown className="w-8 h-8 text-yellow-400" />
          <h1 className="text-3xl font-bold">Celeb Streams</h1>
        </div>

        {streams.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Crown className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-bold mb-2">No Celeb Streams Live</h2>
            <p className="text-sm">Check back later for live celebrity streams!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams.map((stream) => (
              <div
                key={stream.stream_id}
                className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden hover:border-yellow-500/30 transition-all cursor-pointer group"
                onClick={() => handleJoin(stream)}
              >
                <div className="relative aspect-video bg-slate-800">
                  {stream.thumbnail_url ? (
                    <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-12 h-12 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-red-500/90 text-white text-xs font-bold px-2 py-0.5 rounded">
                    LIVE
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg truncate">{stream.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                    <Users className="w-4 h-4" />
                    {stream.current_viewers} viewers
                  </div>
                  {stream.is_paid && (
                    <div className="mt-2 text-xs text-yellow-400">
                      Paid entry: {stream.pricing_value} coins
                    </div>
                  )}
                  {stream.paid_chat_enabled && (
                    <div className="mt-1 text-xs text-purple-400">
                      Paid chat enabled
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
