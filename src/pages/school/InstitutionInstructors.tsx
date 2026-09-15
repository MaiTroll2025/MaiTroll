import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Book, CheckCircle, Clock } from 'lucide-react'
import { InstructorProfile } from '@/types/database'

interface InstructorWithProfile extends InstructorProfile {
  user_profiles: {
    username: string
    avatar_url: string | null
  }
}

export default function InstitutionInstructors() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [instructors, setInstructors] = useState<InstructorWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Get institution from staff record
        const { data: staffData } = await supabase
          .from('institution_staff')
          .select('institutions(id)')
          .eq('user_id', user.id)
          .single()

        if (!staffData) {
          setLoading(false)
          return
        }

        const instId = staffData.institutions.id

        // Fetch instructors
        let query = supabase
          .from('instructor_profiles')
          .select('*, user_profiles(username, avatar_url)')
          .eq('institution_id', instId)
          .order('created_at', { ascending: false })

        if (filter !== 'all') {
          query = query.eq('verification_status', filter)
        }

        const { data, error } = await query

        if (error) throw error
        setInstructors((data as InstructorWithProfile[]) || [])
      } catch (err) {
        console.error('Error fetching instructors:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, filter])

  const verifiedCount = instructors.filter((i) => i.verification_status === 'verified').length
  const pendingCount = instructors.filter((i) => i.verification_status === 'pending').length

  return (
    <SchoolLayout requiredRole="institution_staff">
      <div className="flex h-screen bg-[#0f1419]">
        <SchoolSidebar
          isOpen={sidebarOpen}
          userType="institution_staff"
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-auto">
          <SchoolHeader
            title="Institutional Instructors"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-7xl mx-auto p-4 md:p-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Instructors', value: instructors.length, icon: Book },
                { label: 'Verified', value: verifiedCount, icon: CheckCircle },
                { label: 'Pending', value: pendingCount, icon: Clock },
              ].map((stat, idx) => {
                const Icon = stat.icon
                return (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Icon className="size-5 text-[#6366f1]" />
                      <div>
                        <p className="text-white/60 text-sm">{stat.label}</p>
                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
              {(['all', 'verified', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 font-medium transition ${
                    filter === f
                      ? 'text-[#6366f1] border-b-2 border-[#6366f1]'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : instructors.length === 0 ? (
              <div className="text-center py-12">
                <Book className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">No instructors found</p>
                <p className="text-white/40 text-sm">Instructors will appear here once they join</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {instructors.map((instructor) => (
                  <div
                    key={instructor.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                          {instructor.user_profiles?.avatar_url ? (
                            <img
                              src={instructor.user_profiles.avatar_url}
                              alt={instructor.user_profiles.username}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-sm">
                              {instructor.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>

                        <div className="flex-1">
                          <h3 className="text-white font-semibold">@{instructor.user_profiles?.username}</h3>
                          <p className="text-white/60 text-sm">{instructor.department || 'No department'}</p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                        instructor.verification_status === 'verified'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {instructor.verification_status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>

                    {/* Bio/Specialization */}
                    {instructor.bio && (
                      <p className="text-white/70 text-sm line-clamp-2 mb-3">{instructor.bio}</p>
                    )}

                    {/* Info */}
                    <div className="pt-3 border-t border-white/5 text-xs text-white/40 space-y-1">
                      <div>Joined: {new Date(instructor.created_at).toLocaleDateString()}</div>
                      <div>
                        Last active:{' '}
                        {instructor.updated_at ? new Date(instructor.updated_at).toLocaleDateString() : 'Never'}
                      </div>
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
