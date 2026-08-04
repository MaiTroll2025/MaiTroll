import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CityAnnouncement {
  id: string
  title: string
  content: string
  type: 'system' | 'event' | 'election' | 'patch' | 'community'
  icon?: string
  link?: string
  created_at: string
}

export function useCityAnnouncements(limit = 8) {
  const [announcements, setAnnouncements] = useState<CityAnnouncement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('troll_wall_posts')
          .select('id, content, metadata, post_type, created_at')
          .eq('post_type', 'announcement')
          .order('created_at', { ascending: false })
          .limit(limit)
        if (!mounted) return
        if (error) throw error
        const mapped: CityAnnouncement[] = (data || []).map((a: any) => ({
          id: a.id,
          title: a.metadata?.title || 'MaiTroll Announcement',
          content: a.content,
          type: a.metadata?.announcement_type || 'system',
          icon: a.metadata?.icon,
          link: a.metadata?.link,
          created_at: a.created_at,
        }))
        setAnnouncements(mapped)
      } catch {
        // Silently fail
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetch()
    return () => { mounted = false }
  }, [limit])

  return { announcements, loading }
}
