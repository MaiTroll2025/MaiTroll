import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, UserMinus } from 'lucide-react'

interface StudentConnection {
  id: string
  username: string
  avatar_url: string
  institution: string
  program?: string
}

export default function SchoolConnections() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [followers, setFollowers] = useState<StudentConnection[]>([])
  const [following, setFollowing] = useState<StudentConnection[]>([])
  const [tab, setTab] = useState<'followers' | 'following'>('followers')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConnections = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Fetch followers
        const { data: followerData, error: followerError } = await supabase
          .from('student_connections')
          .select(`
            id,
            follower:follower_student_id (
              username,
              avatar_url
            ),
            follower_profiles:follower_student_id (
              student_profiles (
                institutions (name),
                program_field
              )
            )
          `)
          .eq('following_student_id', user.id)

        if (!followerError && followerData) {
          const followersList = followerData.map((conn: any) => ({
            id: conn.id,
            username: conn.follower?.username || 'Unknown',
            avatar_url: conn.follower?.avatar_url || '/default-avatar.png',
            institution: conn.follower_profiles?.student_profiles?.institutions?.name || 'Unknown',
            program: conn.follower_profiles?.student_profiles?.program_field,
          }))
          setFollowers(followersList)
        }

        // Fetch following
        const { data: followingData, error: followingError } = await supabase
          .from('student_connections')
          .select(`
            id,
            following:following_student_id (
              username,
              avatar_url
            ),
            following_profiles:following_student_id (
              student_profiles (
                institutions (name),
                program_field
              )
            )
          `)
          .eq('follower_student_id', user.id)

        if (!followingError && followingData) {
          const followingList = followingData.map((conn: any) => ({
            id: conn.id,
            username: conn.following?.username || 'Unknown',
            avatar_url: conn.following?.avatar_url || '/default-avatar.png',
            institution: conn.following_profiles?.student_profiles?.institutions?.name || 'Unknown',
            program: conn.following_profiles?.student_profiles?.program_field,
          }))
          setFollowing(followingList)
        }
      } catch (err) {
        console.error('Error fetching connections:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchConnections()
  }, [user])

  const handleUnfollow = async (connectionId: string) => {
    try {
      await supabase
        .from('student_connections')
        .delete()
        .eq('id', connectionId)

      setFollowing(following.filter(f => f.id !== connectionId))
    } catch (err) {
      console.error('Error unfollowing:', err)
    }
  }

  const displayList = tab === 'followers' ? followers : following

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
            title="My Connections"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-2xl mx-auto p-4 md:p-6">
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-white/10">
              <button
                onClick={() => setTab('followers')}
                className={`px-4 py-3 font-medium transition border-b-2 ${
                  tab === 'followers'
                    ? 'border-[#6366f1] text-white'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                Followers ({followers.length})
              </button>
              <button
                onClick={() => setTab('following')}
                className={`px-4 py-3 font-medium transition border-b-2 ${
                  tab === 'following'
                    ? 'border-[#6366f1] text-white'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                Following ({following.length})
              </button>
            </div>

            {/* Connections List */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-white size-8" />
                </div>
              ) : displayList.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/60">
                    {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                  </p>
                </div>
              ) : (
                displayList.map((connection) => (
                  <div key={connection.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <img
                        src={connection.avatar_url}
                        alt={connection.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-white font-medium">@{connection.username}</p>
                        <p className="text-white/60 text-sm">
                          {connection.institution}
                          {connection.program && ` • ${connection.program}`}
                        </p>
                      </div>
                    </div>
                    {tab === 'following' && (
                      <button
                        onClick={() => handleUnfollow(connection.id)}
                        className="p-2 hover:bg-red-600/20 rounded-lg transition text-red-400 hover:text-red-300"
                      >
                        <UserMinus className="size-5" />
                      </button>
                    )}
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
