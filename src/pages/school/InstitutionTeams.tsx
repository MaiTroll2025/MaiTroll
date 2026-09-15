import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Users, Users2 } from 'lucide-react'

interface TeamWithMembers {
  id: string
  institution_id: string
  team_name: string
  description: string | null
  created_by_student_id: string
  created_at: string
  student_team_members: any[]
}

export default function InstitutionTeams() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)

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

        // Fetch teams with member counts
        const { data, error } = await supabase
          .from('student_teams')
          .select('*, student_team_members(*)')
          .eq('institution_id', instId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setTeams((data as TeamWithMembers[]) || [])
      } catch (err) {
        console.error('Error fetching teams:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

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
            title="Institution Teams"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-7xl mx-auto p-4 md:p-6">
            {/* Stats */}
            <div className="mb-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Users2 className="size-5 text-[#6366f1]" />
                  <div>
                    <p className="text-white/60 text-sm">Total Teams</p>
                    <p className="text-2xl font-bold text-white">{teams.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Teams List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-12">
                <Users className="size-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-lg">No teams created yet</p>
                <p className="text-white/40 text-sm">Student teams will appear here once they are created</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{team.team_name}</h3>
                        {team.description && (
                          <p className="text-white/70 text-sm mt-1 line-clamp-2">{team.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Members */}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="size-4 text-[#6366f1]" />
                        <span className="text-white/60 text-sm">
                          {team.student_team_members?.length || 0} members
                        </span>
                      </div>

                      {team.student_team_members && team.student_team_members.length > 0 && (
                        <div className="text-xs text-white/40">
                          {team.student_team_members.map((m) => m.student_id).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-white/40 mt-2">
                      Created: {new Date(team.created_at).toLocaleDateString()}
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
