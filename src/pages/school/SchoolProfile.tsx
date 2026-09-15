import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, UserPlus, UserMinus } from 'lucide-react'

interface StudentProfileData {
  id: string
  user_id: string
  username: string
  avatar_url: string
  institution: string
  program_field?: string
  verification_status: string
  followersCount: number
  followingCount: number
  isFollowing: boolean
}

export default function SchoolProfile() {
  const { userId } = useParams()
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [studentData, setStudentData] = useState<StudentProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)

  const isOwnProfile = !userId || userId === user?.id

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return

      try {
        setLoading(true)
        const targetUserId = userId || user.id

        // Fetch student profile
        const { data: studentProfile, error } = await supabase
          .from('student_profiles')
          .select(`
            *,
            institutions(name)
          `)
          .eq('user_id', targetUserId)
          .single()

        if (error || !studentProfile) {
          console.error('Student profile not found')
          setLoading(false)
          return
        }

        // Fetch user profile
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('username, avatar_url')
          .eq('id', targetUserId)
          .single()

        // Fetch follower/following counts
        const followers = await supabase.rpc('get_student_followers_count', {
          p_student_id: targetUserId
        })

        const following = await supabase.rpc('get_student_following_count', {
          p_student_id: targetUserId
        })

        // Check if current user is following this student
        let followingStatus = false
        if (!isOwnProfile) {
          const { data: connectionData } = await supabase
            .from('student_connections')
            .select('id')
            .eq('follower_student_id', user.id)
            .eq('following_student_id', targetUserId)
            .single()

          followingStatus = !!connectionData
        }

        setStudentData({
          id: studentProfile.id,
          user_id: targetUserId,
          username: userProfile?.username || 'Unknown',
          avatar_url: userProfile?.avatar_url || '/default-avatar.png',
          institution: studentProfile.institutions?.name || 'Unknown Institution',
          program_field: studentProfile.program_field,
          verification_status: studentProfile.verification_status,
          followersCount: followers.data || 0,
          followingCount: following.data || 0,
          isFollowing: followingStatus,
        })

        setIsFollowing(followingStatus)
      } catch (err) {
        console.error('Error fetching profile:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [user, userId, isOwnProfile])

  const handleFollowToggle = async () => {
    if (!user || !studentData) return

    try {
      if (isFollowing) {
        await supabase.rpc('unfollow_student', {
          p_following_student_id: studentData.user_id
        })
        setIsFollowing(false)
        setStudentData({ ...studentData, followersCount: studentData.followersCount - 1 })
      } else {
        await supabase.rpc('follow_student', {
          p_following_student_id: studentData.user_id
        })
        setIsFollowing(true)
        setStudentData({ ...studentData, followersCount: studentData.followersCount + 1 })
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
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
            title="Student Profile"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-2xl mx-auto p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : studentData ? (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <img
                      src={studentData.avatar_url}
                      alt={studentData.username}
                      className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold text-white">@{studentData.username}</h1>
                        <span className="bg-blue-600/50 text-white text-xs px-3 py-1 rounded-full font-medium">
                          STUDENT
                        </span>
                      </div>
                      <p className="text-white/70 mb-1">{studentData.institution}</p>
                      {studentData.program_field && (
                        <p className="text-white/60 text-sm mb-4">{studentData.program_field}</p>
                      )}

                      {!isOwnProfile && (
                        <button
                          onClick={handleFollowToggle}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                            isFollowing
                              ? 'bg-white/10 text-white hover:bg-red-600/20 hover:text-red-400'
                              : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                          }`}
                        >
                          {isFollowing ? (
                            <>
                              <UserMinus className="size-4" />
                              Unfollow
                            </>
                          ) : (
                            <>
                              <UserPlus className="size-4" />
                              Follow
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { label: 'Followers', value: studentData.followersCount },
                    { label: 'Following', value: studentData.followingCount },
                    { label: 'Status', value: studentData.verification_status.toUpperCase() },
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <p className="text-white/60 text-sm mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Activity Section */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                  <div className="text-center py-8">
                    <p className="text-white/60">No activity yet</p>
                  </div>
                </div>

                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/school/profile/edit')}
                    className="w-full px-4 py-3 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg font-medium transition"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-white/60">Profile not found</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
