import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Heart, MessageCircle, Share2 } from 'lucide-react'

interface StudentPost {
  id: string
  student_id: string
  institution_id: string
  content: string
  topic: 'general' | 'study' | 'business' | 'entrepreneurship' | 'tech' | 'careers' | 'campus' | 'teams'
  created_at: string
  student_username?: string
  student_avatar?: string
}

const TOPICS = [
  'ALL',
  'STUDY',
  'BUSINESS',
  'ENTREPRENEURSHIP',
  'TECH',
  'CAREERS',
  'CAMPUS',
  'TEAMS',
  'GENERAL'
]

export default function SchoolSocial() {
  const { user, profile } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState('ALL')
  const [posts, setPosts] = useState<StudentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) return

      try {
        setLoading(true)
        
        // Get user's institution
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('institution_id')
          .eq('user_id', user.id)
          .single()

        if (!studentProfile) {
          setLoading(false)
          return
        }

        // Fetch posts based on topic filter
        let query = supabase
          .from('student_social_posts')
          .select(`
            *,
            user:student_id (username, avatar_url)
          `)
          .eq('institution_id', studentProfile.institution_id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (selectedTopic !== 'ALL') {
          query = query.eq('topic', selectedTopic.toLowerCase())
        }

        const { data, error } = await query

        if (error) throw error

        setPosts(data || [])
      } catch (err) {
        console.error('Error fetching posts:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [user, selectedTopic])

  const handlePostCreate = async () => {
    if (!user || !newPostContent.trim()) return

    try {
      setPosting(true)

      // Get user's institution
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('institution_id')
        .eq('user_id', user.id)
        .single()

      if (!studentProfile) {
        console.error('Student profile not found')
        return
      }

      const topicValue = selectedTopic === 'ALL' ? 'general' : selectedTopic.toLowerCase()

      const { error } = await supabase
        .from('student_social_posts')
        .insert({
          student_id: user.id,
          institution_id: studentProfile.institution_id,
          content: newPostContent,
          topic: topicValue
        })

      if (error) throw error

      setNewPostContent('')
      // Refresh posts
      window.location.reload()
    } catch (err) {
      console.error('Error creating post:', err)
    } finally {
      setPosting(false)
    }
  }

  return (
    <SchoolLayout requiredRole="student">
      <div className="flex h-screen bg-[#0f1419]">
        <SchoolSidebar
          isOpen={sidebarOpen}
          userType="student"
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-auto">
          <SchoolHeader
            title="Social Network"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-3xl mx-auto p-4 md:p-6">
            {/* Topic Navigation */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full font-medium transition ${
                    selectedTopic === topic
                      ? 'bg-[#6366f1] text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Create Post Section */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <div className="flex gap-4">
                <img
                  src={profile?.avatar_url || '/default-avatar.png'}
                  alt={profile?.username}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share your thoughts with the student community..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/50 focus:outline-none focus:border-[#6366f1]"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      className="px-4 py-2 text-white/70 hover:text-white transition"
                      onClick={() => setNewPostContent('')}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePostCreate}
                      disabled={posting || !newPostContent.trim()}
                      className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
                    >
                      {posting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-white size-8" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/60">No posts yet. Be the first to share!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex gap-3 mb-3">
                      <img
                        src={post.student_avatar || '/default-avatar.png'}
                        alt={post.student_username}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                      <div>
                        <p className="text-white font-medium">{post.student_username || 'Unknown'}</p>
                        <p className="text-white/50 text-xs">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <span className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded">
                          {post.topic?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-white/90 mb-4">{post.content}</p>
                    <div className="flex gap-4 text-white/50">
                      <button className="flex items-center gap-2 hover:text-[#6366f1] transition">
                        <Heart className="size-4" />
                        <span className="text-xs">Like</span>
                      </button>
                      <button className="flex items-center gap-2 hover:text-[#6366f1] transition">
                        <MessageCircle className="size-4" />
                        <span className="text-xs">Reply</span>
                      </button>
                      <button className="flex items-center gap-2 hover:text-[#6366f1] transition">
                        <Share2 className="size-4" />
                        <span className="text-xs">Share</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
