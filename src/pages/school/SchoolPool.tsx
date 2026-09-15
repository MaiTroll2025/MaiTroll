import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, TrendingUp } from 'lucide-react'

interface PoolContribution {
  id: string
  student_username: string
  amount: number
  source: string
  created_at: string
}

interface PoolData {
  studentContribution: number
  schoolTotal: number
  studentRank?: number
  recentContributions: PoolContribution[]
}

export default function SchoolPool() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPoolData = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Get student's institution
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('institution_id')
          .eq('user_id', user.id)
          .single()

        if (!studentProfile) {
          setLoading(false)
          return
        }

        // Get student contribution
        const studentContrib = await supabase.rpc('get_student_pool_contribution', {
          p_student_id: user.id,
          p_institution_id: studentProfile.institution_id,
        })

        // Get school total
        const schoolTotal = await supabase.rpc('get_school_pool_total', {
          p_institution_id: studentProfile.institution_id,
        })

        // Get recent contributions
        const { data: recentContribs } = await supabase
          .from('school_pool_contributions')
          .select(`
            id,
            amount,
            source,
            created_at,
            student:student_id (username)
          `)
          .eq('institution_id', studentProfile.institution_id)
          .order('created_at', { ascending: false })
          .limit(10)

        const formattedContributions = (recentContribs || []).map((contrib: any) => ({
          id: contrib.id,
          student_username: contrib.student?.username || 'Unknown',
          amount: contrib.amount,
          source: contrib.source,
          created_at: contrib.created_at,
        }))

        setData({
          studentContribution: studentContrib.data || 0,
          schoolTotal: schoolTotal.data || 0,
          recentContributions: formattedContributions,
        })
      } catch (err) {
        console.error('Error fetching pool data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPoolData()
  }, [user])

  const progressPercentage = data ? Math.min((data.schoolTotal / 100000) * 100, 100) : 0

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
            title="School Pool"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-3xl mx-auto p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Main Stats */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-lg p-6 border border-white/10">
                    <p className="text-white/80 text-sm mb-2">Your Contribution</p>
                    <p className="text-4xl font-bold text-white">{data.studentContribution.toLocaleString()}</p>
                    <p className="text-white/60 text-xs mt-2">Troll Coins</p>
                  </div>
                  <div className="bg-gradient-to-br from-[#8b5cf6] to-[#a855f7] rounded-lg p-6 border border-white/10">
                    <p className="text-white/80 text-sm mb-2">School Total</p>
                    <p className="text-4xl font-bold text-white">{data.schoolTotal.toLocaleString()}</p>
                    <p className="text-white/60 text-xs mt-2">Combined Contributions</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <TrendingUp className="size-5" />
                      School Progress
                    </h3>
                    <span className="text-sm text-white/60">{progressPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#a855f7] h-3 rounded-full transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-4 text-xs text-white/50">
                    <span>Current</span>
                    <span>100,000 Goal</span>
                  </div>
                </div>

                {/* Pool Impact */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">What Does This Support?</h3>
                  <div className="space-y-3">
                    {[
                      'Institution programs and scholarships',
                      'Student development initiatives',
                      'Campus infrastructure improvements',
                      'Educational resources and materials',
                      'Student entrepreneur support funds',
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-[#6366f1] rounded-full mt-2 flex-shrink-0" />
                        <p className="text-white/70">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Contributions */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Recent Contributions</h3>
                  <div className="space-y-2">
                    {data.recentContributions.length === 0 ? (
                      <p className="text-white/60 text-sm">No contributions yet</p>
                    ) : (
                      data.recentContributions.map((contrib) => (
                        <div key={contrib.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                          <div>
                            <p className="text-white text-sm">@{contrib.student_username}</p>
                            <p className="text-white/50 text-xs">{contrib.source}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-semibold">+{contrib.amount.toLocaleString()}</p>
                            <p className="text-white/50 text-xs">
                              {new Date(contrib.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Info Card */}
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-white text-sm">
                    💡 <strong>Tip:</strong> School pool contributions are tracked from various activities. Contribute to your school pool through eligible programs and opportunities.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-white/60">Unable to load pool data</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
