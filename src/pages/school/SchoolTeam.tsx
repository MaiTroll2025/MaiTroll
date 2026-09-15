import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Plus, X } from 'lucide-react'

interface TeamMember {
  id: string
  username: string
  avatar_url: string
  role: 'leader' | 'member'
}

interface StudentTeam {
  id: string
  team_name: string
  description?: string
  created_by_student_id: string
  members: TeamMember[]
}

export default function SchoolTeam() {
  const { user, profile } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [teams, setTeams] = useState<StudentTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetchTeams = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Fetch teams user is member of
        const { data: teamData, error } = await supabase
          .from('student_team_members')
          .select(`
            team:team_id (
              id,
              team_name,
              description,
              created_by_student_id,
              members:student_team_members (
                id,
                student_id,
                role,
                profile:student_id (
                  username,
                  avatar_url
                )
              )
            )
          `)
          .eq('student_id', user.id)

        if (error) throw error

        const formattedTeams = (teamData || [])
          .filter(t => t.team)
          .map((t: any) => ({
            id: t.team.id,
            team_name: t.team.team_name,
            description: t.team.description,
            created_by_student_id: t.team.created_by_student_id,
            members: (t.team.members || []).map((m: any) => ({
              id: m.id,
              username: m.profile?.username || 'Unknown',
              avatar_url: m.profile?.avatar_url || '/default-avatar.png',
              role: m.role,
            })),
          }))

        setTeams(formattedTeams)
      } catch (err) {
        console.error('Error fetching teams:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [user])

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return

    try {
      setCreating(true)

      const { error } = await supabase.rpc('create_student_team', {
        p_team_name: newTeamName,
        p_description: newTeamDesc,
      })

      if (error) throw error

      setNewTeamName('')
      setNewTeamDesc('')
      setShowCreateForm(false)

      // Refresh teams
      window.location.reload()
    } catch (err) {
      console.error('Error creating team:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleRemoveMember = async (teamId: string, memberId: string) => {
    try {
      const { error } = await supabase.rpc('remove_student_from_team', {
        p_team_id: teamId,
        p_student_id: memberId,
      })

      if (error) throw error

      // Refresh teams
      window.location.reload()
    } catch (err) {
      console.error('Error removing member:', err)
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
            title="My Team"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-3xl mx-auto p-4 md:p-6">
            {/* Create Team Button */}
            <div className="mb-6">
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg font-medium transition"
                >
                  <Plus className="size-5" />
                  Create Team
                </button>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-bold text-white mb-4">Create New Team</h3>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Team Name"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/50 focus:outline-none focus:border-[#6366f1] mb-3"
                  />
                  <textarea
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                    placeholder="Team Description (optional)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/50 focus:outline-none focus:border-[#6366f1] mb-3"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateTeam}
                      disabled={creating || !newTeamName.trim()}
                      className="flex-1 px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white rounded-lg font-medium transition"
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Teams List */}
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="animate-spin text-white size-8" />
                </div>
              ) : teams.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/60">No teams yet. Create one to get started!</p>
                </div>
              ) : (
                teams.map((team) => (
                  <div key={team.id} className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-white mb-1">{team.team_name}</h3>
                      {team.description && (
                        <p className="text-white/60 text-sm">{team.description}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white/80 mb-3">Team Members ({team.members.length})</h4>
                      <div className="space-y-2">
                        {team.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <div className="flex items-center gap-3">
                              <img
                                src={member.avatar_url}
                                alt={member.username}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                              <div>
                                <p className="text-white text-sm">@{member.username}</p>
                                <p className="text-white/50 text-xs capitalize">{member.role}</p>
                              </div>
                            </div>
                            {team.created_by_student_id === user?.id && member.username !== profile?.username && (
                              <button
                                onClick={() => handleRemoveMember(team.id, member.username)}
                                className="p-1 hover:bg-red-600/20 rounded transition text-red-400"
                              >
                                <X className="size-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {team.created_by_student_id === user?.id && (
                      <button className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition text-sm">
                        Add Members
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
