import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, TrendingUp, Users } from 'lucide-react'

interface Contribution {
  id: string
  student_id: string
  amount: number
  created_at: string
  student_profiles: {
    user_profiles: {
      username: string
      avatar_url: string | null
    }
  }
}

export default function InstitutionPool() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [poolTotal, setPoolTotal] = useState(0)
  const [contributorCount, setContributorCount] = useState(0)

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

        // Fetch contributions with student info
        const { data, error } = await supabase
          .from('school_pool_contributions')
          .select(
            `
            id,
            student_id,
            amount,
            created_at,
            student_profiles!inner(
              user_profiles(username, avatar_url)
            )
          `
          )
          .eq('institution_id', instId)
          .order('created_at', { ascending: false })

        if (error) throw error
        const contribData = (data as Contribution[]) || []
        setContributions(contribData)

        // Get pool total
        const { data: poolData } = await supabase.rpc('get_school_pool_total', {
          p_institution_id: instId
        })

        setPoolTotal(poolData || 0)

        // Get unique contributors
        setContributorCount(new Set(contribData.map((c) => c.student_id)).size)
      } catch (err) {
        console.error('Error fetching pool data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const progressPercent = Math.min((poolTotal / 100000) * 100, 100)

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
            title="Institution School Pool"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-6xl mx-auto p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Pool Overview Card */}
                <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-lg p-6 border border-white/10">
                  <h2 className="text-2xl font-bold text-white mb-4">School Pool Overview</h2>
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <p className="text-white/80 text-sm mb-2">Total Contributions</p>
                      <p className="text-3xl font-bold text-white">${poolTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-white/80 text-sm mb-2">Contributors</p>
                      <p className="text-3xl font-bold text-white">{contributorCount}</p>
                    </div>
                    <div>
                      <p className="text-white/80 text-sm mb-2">Goal Progress</p>
                      <p className="text-3xl font-bold text-white">${poolTotal.toLocaleString()} / $100,000</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-white/80 text-sm mt-2">{progressPercent.toFixed(1)}% of goal reached</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="size-5 text-[#6366f1]" />
                      <div>
                        <p className="text-white/60 text-sm">Average Contribution</p>
                        <p className="text-2xl font-bold text-white">
                          ${contributions.length > 0 ? Math.round(poolTotal / contributions.length) : 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Users className="size-5 text-[#6366f1]" />
                      <div>
                        <p className="text-white/60 text-sm">Participation Rate</p>
                        <p className="text-2xl font-bold text-white">
                          {contributorCount > 0 ? Math.round((contributorCount / 100) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Contributions */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Recent Contributions</h3>

                  {contributions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-white/60">No contributions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contributions.slice(0, 10).map((contrib) => (
                        <div
                          key={contrib.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                              {contrib.student_profiles?.user_profiles?.avatar_url ? (
                                <img
                                  src={contrib.student_profiles.user_profiles.avatar_url}
                                  alt={contrib.student_profiles.user_profiles.username}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {contrib.student_profiles?.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">
                                @{contrib.student_profiles?.user_profiles?.username}
                              </p>
                              <p className="text-white/60 text-xs">
                                {new Date(contrib.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <p className="text-white font-semibold">${contrib.amount.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Impact Statement */}
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-white text-sm">
                    💡 <strong>School Pool Impact:</strong> This pool represents the collective institutional
                    commitment to educational growth and opportunities. Contributions support scholarships,
                    facilities, and programs for all students.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
