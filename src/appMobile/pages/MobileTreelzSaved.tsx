import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bookmark, Play, Eye, Gift } from 'lucide-react';
import { fetchSavedTreelz } from '@/services/treelzService'
import { useAuthStore } from '@/lib/store'
import type { TreelzPost } from '@/types/treelz'

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function MobileTreelzSavedPage() {
  const { user } = useAuthStore()
  const [posts, setPosts] = useState<TreelzPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      setLoading(true)
      fetchSavedTreelz(user.id)
        .then(setPosts)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [user])

  return (
    <div className="min-h-screen bg-[#050715] text-white">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#050715]/90 px-4 py-3 backdrop-blur-xl">
        <Link to="/treelz/settings" className="text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="flex items-center gap-2 text-sm font-black">
          <Bookmark className="h-4 w-4 text-yellow-400" />
          Saved Treelz
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <Bookmark className="mb-4 h-12 w-12 text-slate-600" />
          <h2 className="mb-2 text-lg font-black text-white">No Saved Treelz</h2>
          <p className="text-center text-sm text-slate-500">Videos you bookmark will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-4">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/treelz?post=${post.id}`}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
            >
              <div className="relative aspect-[9/16] overflow-hidden bg-black/40">
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900/60 to-cyan-900/60">
                    <Play className="h-6 w-6 text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="line-clamp-2 text-[10px] font-bold text-white drop-shadow">{post.caption || 'Untitled'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5 text-[9px] font-bold text-slate-400">
                <span className="flex items-center gap-0.5">
                  <Eye className="h-2.5 w-2.5" />
                  {formatCount(post.views_count || 0)}
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="text-[10px]">🤡</span>
                  {formatCount(post.likes_count || 0)}
                </span>
                <span className="flex items-center gap-0.5">
                  <Gift className="h-2.5 w-2.5 text-yellow-400" />
                  {formatCount(post.gifts_received || 0)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
