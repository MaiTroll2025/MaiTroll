import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Mail, MessageCircle, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StudentProfile } from '@/types/database'

interface StudentWithProfile extends StudentProfile {
  username: string
  user_profiles: {
    username: string
    avatar_url: string | null
  }
}

export default function SchoolInstructorStudents() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [students, setStudents] = useState<StudentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('verified')

  useEffect(() => {
    const fetchStudents = async () => {
      if (!user) return

      try {
        // Get instructor's institution
        const { data: instructorData } = await supabase
          .from('instructor_profiles')
          .select('institution_id')
          .eq('user_id', user.id)
          .single()

        if (!instructorData) {
          setLoading(false)
          return
        }

        // Get all students in this institution
        let query = supabase
          .from('student_profiles')
          .select('*, user_profiles(username, avatar_url)')
          .eq('institution_id', instructorData.institution_id)

        if (filter === 'verified') {
          query = query.eq('verification_status', 'verified')
        } else if (filter === 'pending') {
          query = query.eq('verification_status', 'pending')
        }

        const { data, error } = await query

        if (error) throw error
        setStudents((data as StudentWithProfile[]) || [])
      } catch (err) {
        console.error('Error fetching students:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [user, filter])

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
            title="My Students"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-6xl mx-auto p-4 md:p-6">
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
                  {f === 'all' && ` (${students.length})`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">No students found</p>
                <p className="text-white/40 text-sm">Students will appear here once they join your institution</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                          {student.user_profiles?.avatar_url ? (
                            <img
                              src={student.user_profiles.avatar_url}
                              alt={student.user_profiles.username}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-sm">
                              {student.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                            </span>
                          )}
                        </div>

                        {/* Student Info */}
                        <div className="flex-1">
                          <h3 className="text-white font-semibold">@{student.user_profiles?.username}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-white/60">
                            <span>{student.program_name || 'No program'}</span>
                            <span>•</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              student.verification_status === 'verified'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {student.verification_status?.toUpperCase() || 'PENDING'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg transition"
                          title="Message student"
                        >
                          <MessageCircle className="size-5 text-[#6366f1]" />
                        </button>
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg transition"
                          title="View profile"
                          onClick={() => navigate(`/school/profile/${student.user_id}`)}
                        >
                          <Mail className="size-5 text-white/40" />
                        </button>
                      </div>
                    </div>

                    {/* Extended Info */}
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/40 space-y-1">
                      <div>Joined: {new Date(student.created_at).toLocaleDateString()}</div>
                      <div>Last active: {student.updated_at ? new Date(student.updated_at).toLocaleDateString() : 'Never'}</div>
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
