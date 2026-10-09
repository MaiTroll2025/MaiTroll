import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { WallPost } from '@/types/trollWall'

const PAGE_SIZE = 20

export function useWallPosts(_limit = 20) {
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchPosts = useCallback(async (pageIndex: number, append: boolean) => {
    if (append) {
      // no-op for now — we load all at once for discovery
      return
    }
    setLoading(true)
    try {
      const start = pageIndex * PAGE_SIZE
      const end = start + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from('troll_wall_posts')
        .select(
          'id, user_id, username, avatar_url, is_admin, is_troll_officer, is_og_user, user_created_at, is_pinned, post_type, content, metadata, likes, created_at, reply_to_post_id'
        )
        .order('is_pinned', { ascending: false })
        .order('likes', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, end)

      if (error) throw error
      if (!mountedRef.current) return

      const rows: WallPost[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        username: row.username,
        avatar_url: row.avatar_url,
        is_admin: row.is_admin,
        is_troll_officer: row.is_troll_officer,
        is_og_user: row.is_og_user,
        user_created_at: row.user_created_at,
        is_pinned: row.is_pinned,
        post_type: row.post_type || 'text',
        content: row.content || '',
        metadata: row.metadata || {},
        likes: row.likes || 0,
        created_at: row.created_at,
        reply_to_post_id: row.reply_to_post_id,
        replies: [],
      }))

      setPosts(rows)
      setHasMore((data || []).length >= PAGE_SIZE)
      setPage(pageIndex)
    } catch {
      // Silently fail — section will be empty
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts(0, false)
  }, [fetchPosts])

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    fetchPosts(page + 1, true)
  }, [hasMore, loading, page, fetchPosts])

  return { posts, loading, hasMore, loadMore }
}
