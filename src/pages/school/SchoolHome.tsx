import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import TrustBadges from '@/components/school/TrustBadges'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'

interface StudentHomeData {
  studentName?: string
  institution?: string
  institutionId?: string
  program?: string
  followersCount: number
  followingCount: number
  schoolPoolContribution: number
  schoolPoolTotal: number
  studentRank?: number
}

export default function SchoolHome() {
  const { user, profile } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState<StudentHomeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHomeData = async () => {
      if (!user) return

      try {
        // Fetch student profile
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('*, institutions(name)')
          .eq('user_id', user.id)
          .single()

        // Fetch follower/following counts
        const followersResponse = await supabase.rpc('get_student_followers_count', {
          p_student_id: user.id
        })

        const followingResponse = await supabase.rpc('get_student_following_count', {
          p_student_id: user.id
        })

        // Fetch school pool data
        const poolResponse = await supabase.rpc('get_student_pool_contribution', {
          p_student_id: user.id,
          p_institution_id: studentProfile?.institution_id
        })

        const poolTotalResponse = await supabase.rpc('get_school_pool_total', {
          p_institution_id: studentProfile?.institution_id
        })

        setData({
          studentName: profile?.display_name || profile?.username,
          institution: studentProfile?.institutions?.name,
          institutionId: studentProfile?.institution_id,
          program: studentProfile?.program_field,
          followersCount: followersResponse.data || 0,
          followingCount: followingResponse.data || 0,
          schoolPoolContribution: poolResponse.data || 0,
          schoolPoolTotal: poolTotalResponse.data || 0,
          studentRank: 1, // TODO: Calculate based on pool contributions
        })
      } catch (err) {
        console.error('Error fetching home data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHomeData()
  }, [user])

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
            title="School Home"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-7xl mx-auto p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Welcome Section */}
<div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-lg p-6 border border-white/10">
                   <div className="flex items-center justify-between flex-wrap gap-3">
                     <div>
                       <h2 className="text-3xl font-bold text-white mb-2">Welcome back, {data?.studentName}!</h2>
                       <p className="text-white/80">
                         {data?.institution} {data?.program && `• ${data.program}`}
                       </p>
                     </div>
                     {data?.institutionId && (
                       <TrustBadges institutionId={data.institutionId} size="sm" />
                     )}
                   </div>
                 </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    { label: 'Followers', value: data?.followersCount || 0 },
                    { label: 'Following', value: data?.followingCount || 0 },
                    { label: 'Your Contribution', value: `${data?.schoolPoolContribution || 0}` },
                    { label: 'School Rank', value: `#${data?.studentRank || 0}` },
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <p className="text-white/60 text-sm mb-2">{stat.label}</p>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* School Pool Section */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">School Pool</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-white/70">Pool Progress</span>
                        <span className="text-white font-semibold">{data?.schoolPoolTotal || 0} total</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] h-2 rounded-full"
                          style={{
                            width: `${Math.min(((data?.schoolPoolTotal || 0) / 100000) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-white/60">
                      Your school is working toward institutional goals. Keep contributing to the pool!
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-4">
                  <button className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                    <h4 className="text-white font-semibold mb-2">View Social Feed</h4>
                    <p className="text-white/60 text-sm">Connect with other students</p>
                  </button>
                  <button className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                    <h4 className="text-white font-semibold mb-2">Browse Opportunities</h4>
                    <p className="text-white/60 text-sm">Explore MAi Business programs</p>
                  </button>
                </div>

                {/* Recent Activity Placeholder */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {[1, 2, 3].map((_, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                        <div className="w-10 h-10 bg-white/10 rounded-full" />
                        <div className="flex-1">
                          <p className="text-white/70 text-sm">Activity placeholder {idx + 1}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
