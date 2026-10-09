import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface TrendingPost {
  id: string
  username?: string
  avatar_url?: string | null
  content: string
  likes: number
  commentCount: number
  shareCount: number
  created_at: string
  thumbnail?: string | null
}

export function useTrendingPosts(limit = 10) {
  const [posts, setPosts] = useState<TrendingPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('troll_wall_posts')
          .select('id, username, avatar_url, content, likes, replies, metadata, created_at')
          .gte('created_at', since)
          .order('likes', { ascending: false })
          .limit(limit)
        if (!mounted) return
        if (error) throw error
        const mapped: TrendingPost[] = (data || []).map((p: any) => ({
          id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          content: p.content,
          likes: p.likes || 0,
          commentCount: p.replies?.length || 0,
          shareCount: p.metadata?.share_count || 0,
          created_at: p.created_at,
          thumbnail: p.metadata?.thumbnail_url || p.metadata?.image_url || null,
        }))
        setPosts(mapped)
      } catch {
        // Silently fail
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [limit])

  return { posts, loading }
}
