import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const WALL_LAST_SEEN_KEY = 'troll_wall_last_seen'

/**
 * Tracks the number of new wall posts since the user last viewed the Wall tab.
 * Uses localStorage to persist the "last seen" timestamp.
 * Returns the count of new posts and a function to mark as read.
 */
export function useWallNotifications(isWallActive: boolean, enabled = true) {
  const [newPostCount, setNewPostCount] = useState(0)

  // Get the last seen timestamp from localStorage
  const getLastSeen = useCallback((): string | null => {
    try {
      return localStorage.getItem(WALL_LAST_SEEN_KEY)
    } catch {
      return null
    }
  }, [])

  // Save current time as last seen
  const markAsRead = useCallback(() => {
    try {
      localStorage.setItem(WALL_LAST_SEEN_KEY, new Date().toISOString())
      setNewPostCount(0)
    } catch {
      // ignore storage errors
    }
  }, [])

  // Count new posts since last seen
  const fetchNewPostCount = useCallback(async () => {
    if (!enabled) return

    const lastSeen = getLastSeen()
    if (!lastSeen) {
      // First time user — just mark as seen, don't show count
      markAsRead()
      return
    }

    try {
      const { count, error } = await supabase
        .from('troll_wall_posts_public')
        .select('id', { count: 'exact', head: true })
        .is('reply_to_post_id', null)
        .gt('created_at', lastSeen)

      if (error) {
        console.error('[useWallNotifications] Failed to count new posts:', error.message, error.code, error.details, error.hint)
        return
      }

      setNewPostCount(count || 0)
    } catch (err) {
      console.error('[useWallNotifications] Error:', err)
    }
  }, [enabled, getLastSeen, markAsRead])

  // When wall tab becomes active, mark as read
  useEffect(() => {
    if (isWallActive) {
      markAsRead()
    }
  }, [isWallActive, markAsRead])

  // Poll for new posts every 30 seconds when wall is NOT active
  useEffect(() => {
    if (isWallActive || !enabled) return

    fetchNewPostCount() // initial check

    const interval = setInterval(fetchNewPostCount, 30000)
    return () => clearInterval(interval)
  }, [enabled, isWallActive, fetchNewPostCount])

  // Subscribe to real-time new posts
  useEffect(() => {
    if (isWallActive || !enabled) return

    const channel = supabase
      .channel('wall-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'troll_wall_posts',
        },
        () => {
          setNewPostCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, isWallActive])

  return { newPostCount, markAsRead }
}
