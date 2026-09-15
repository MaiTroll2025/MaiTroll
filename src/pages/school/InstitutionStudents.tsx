import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Users, Mail, CheckCircle, Clock } from 'lucide-react'
import { StudentProfile } from '@/types/database'

interface StudentWithProfile extends StudentProfile {
  user_profiles: {
    username: string
    avatar_url: string | null
  }
}

export default function InstitutionStudents() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [students, setStudents] = useState<StudentWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')
  const [institutionId, setInstitutionId] = useState<string | null>(null)

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
        setInstitutionId(instId)

        // Fetch students
        let query = supabase
          .from('student_profiles')
          .select('*, user_profiles(username, avatar_url)')
          .eq('institution_id', instId)
          .order('created_at', { ascending: false })

        if (filter !== 'all') {
          query = query.eq('verification_status', filter)
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

    fetchData()
  }, [user, filter])

  const verifiedCount = students.filter((s) => s.verification_status === 'verified').length
  const pendingCount = students.filter((s) => s.verification_status === 'pending').length

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
            title="Institutional Students"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-7xl mx-auto p-4 md:p-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Students', value: students.length, icon: Users },
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
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">No students found</p>
                <p className="text-white/40 text-sm">Students will appear here once they enroll</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Program</th>
                      <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Joined</th>
                      <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                              {student.user_profiles?.avatar_url ? (
                                <img
                                  src={student.user_profiles.avatar_url}
                                  alt={student.user_profiles.username}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {student.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                            <span className="text-white font-medium">@{student.user_profiles?.username}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/70">{student.program_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            student.verification_status === 'verified'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {student.verification_status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/70 text-sm">
                          {new Date(student.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-[#6366f1] hover:text-[#8b5cf6] transition text-sm">
                            <Mail className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
