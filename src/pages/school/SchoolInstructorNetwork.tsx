import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Users, MessageCircle, UserPlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { InstructorProfile } from '@/types/database'

interface InstructorWithProfile extends InstructorProfile {
  user_profiles: {
    username: string
    avatar_url: string | null
  }
  institutions: {
    name: string
  }
}

export default function SchoolInstructorNetwork() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [instructors, setInstructors] = useState<InstructorWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'network' | 'following'>('network')

  useEffect(() => {
    const fetchInstructors = async () => {
      if (!user) return

      try {
        // Get current instructor's institution
        const { data: currentInstructor } = await supabase
          .from('instructor_profiles')
          .select('institution_id, id')
          .eq('user_id', user.id)
          .single()

        if (!currentInstructor) {
          setLoading(false)
          return
        }

        if (tab === 'network') {
          // Get all instructors in same institution
          const { data, error } = await supabase
            .from('instructor_profiles')
            .select('*, user_profiles(username, avatar_url), institutions(name)')
            .eq('institution_id', currentInstructor.institution_id)
            .neq('id', currentInstructor.id) // Exclude self

          if (error) throw error
          setInstructors((data as InstructorWithProfile[]) || [])
        } else {
          // Get instructors being followed
          const { data, error } = await supabase
            .from('instructor_connections')
            .select('following:instructor_profiles!fk_instructor_id(*, user_profiles(username, avatar_url), institutions(name))')
            .eq('follower_id', currentInstructor.id)

          if (error) throw error
          // Flatten the nested structure
          const following = data?.map((conn: any) => conn.following).filter(Boolean) || []
          setInstructors(following)
        }
      } catch (err) {
        console.error('Error fetching instructors:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInstructors()
  }, [user, tab])

  return (
    <SchoolLayout requiredRole="instructor">
      <div className="flex h-screen bg-[#0f1419]">
        <SchoolSidebar
          isOpen={sidebarOpen}
          userType="instructor"
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-auto">
          <SchoolHeader
            title="Instructor Network"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-6xl mx-auto p-4 md:p-6">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
              {(['network', 'following'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 font-medium transition ${
                    tab === t
                      ? 'text-[#6366f1] border-b-2 border-[#6366f1]'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {t === 'network' ? 'Network' : 'Following'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : instructors.length === 0 ? (
              <div className="text-center py-12">
                <Users className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">
                  {tab === 'network' ? 'No other instructors' : 'Not following any instructors'}
                </p>
                <p className="text-white/40 text-sm">
                  {tab === 'network'
                    ? 'You are the only instructor in your institution'
                    : 'Start following instructors to stay connected'}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {instructors.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                          {instructor.user_profiles?.avatar_url ? (
                            <img
                              src={instructor.user_profiles.avatar_url}
                              alt={instructor.user_profiles.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-xs">
                              {instructor.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-white font-semibold">@{instructor.user_profiles?.username}</h3>
                          <p className="text-white/60 text-sm">{instructor.institutions?.name}</p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        instructor.verification_status === 'verified'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {instructor.verification_status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>

                    {/* Department/Specialization */}
                    <div className="text-sm text-white/60 mb-4">
                      <p>{instructor.department || 'No department assigned'}</p>
                      {instructor.bio && <p className="line-clamp-2 mt-2">{instructor.bio}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#6366f1]/20 hover:bg-[#6366f1]/30 rounded text-[#6366f1] font-medium text-sm transition"
                        title="Message instructor"
                      >
                        <MessageCircle className="size-4" />
                        Message
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded text-white font-medium text-sm transition"
                        title="View profile"
                        onClick={() => navigate(`/school/profile/${instructor.user_id}`)}
                      >
                        <UserPlus className="size-4" />
                        Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
