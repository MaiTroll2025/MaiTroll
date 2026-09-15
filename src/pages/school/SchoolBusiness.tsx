import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Briefcase, TrendingUp, Users, DollarSign } from 'lucide-react'

interface BusinessStats {
  studentTeamsCount: number
  activeContributors: number
  poolTotal: number
  averageContribution: number
}

export default function SchoolBusiness() {
  const { user } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<BusinessStats>({
    studentTeamsCount: 0,
    activeContributors: 0,
    poolTotal: 0,
    averageContribution: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBusinessData = async () => {
      if (!user) return

      try {
        // Get student profile to find institution
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('institution_id')
          .eq('user_id', user.id)
          .single()

        if (!studentProfile) {
          setLoading(false)
          return
        }

        const institutionId = studentProfile.institution_id

        // Get teams count
        const { count: teamsCount } = await supabase
          .from('student_teams')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)

        // Get unique contributors to pool
        const { data: contributions } = await supabase
          .from('school_pool_contributions')
          .select('student_id, amount')
          .eq('institution_id', institutionId)

        const uniqueContributors = new Set(
          (contributions || []).map((c) => c.student_id),
        ).size
        const poolTotal = (contributions || []).reduce(
          (sum, c) => sum + c.amount,
          0,
        )
        const avgContribution =
          uniqueContributors > 0
            ? Math.round(poolTotal / uniqueContributors)
            : 0

        setStats({
          studentTeamsCount: teamsCount || 0,
          activeContributors: uniqueContributors,
          poolTotal,
          averageContribution: avgContribution,
        })
      } catch (err) {
        console.error('Error fetching business data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBusinessData()
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
            title="MAi Business"
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
                {/* Header */}
                <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-lg p-6 border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <Briefcase className="size-8 text-white" />
                    <h2 className="text-3xl font-bold text-white">MAi Business</h2>
                  </div>
                  <p className="text-white/80">
                    Manage your educational business initiatives and team operations
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    {
                      icon: Users,
                      label: 'Student Teams',
                      value: stats.studentTeamsCount,
                    },
                    {
                      icon: DollarSign,
                      label: 'Active Contributors',
                      value: stats.activeContributors,
                    },
                    {
                      icon: TrendingUp,
                      label: 'Pool Total',
                      value: `$${stats.poolTotal.toLocaleString()}`,
                    },
                    {
                      icon: DollarSign,
                      label: 'Avg Contribution',
                      value: `$${stats.averageContribution.toLocaleString()}`,
                    },
                  ].map((stat, idx) => {
                    const Icon = stat.icon
                    return (
                      <div
                        key={idx}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className="size-5 text-[#6366f1]" />
                          <p className="text-white/60 text-sm">{stat.label}</p>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {stat.value}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Features Overview */}
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    {
                      title: 'Student Teams',
                      description:
                        'Create and manage student teams for collaborative educational projects and competitions.',
                      icon: Users,
                      path: '/school/team',
                      color: 'from-blue-500/20 to-blue-600/20',
                    },
                    {
                      title: 'School Pool',
                      description:
                        'Track institutional contributions and participate in the school pool to support educational initiatives.',
                      icon: TrendingUp,
                      path: '/school/pool',
                      color: 'from-green-500/20 to-green-600/20',
                    },
                    {
                      title: 'Network & Collaborate',
                      description:
                        'Connect with other students through the educational social network and build professional relationships.',
                      icon: Users,
                      path: '/school/connections',
                      color: 'from-purple-500/20 to-purple-600/20',
                    },
                    {
                      title: 'Educational Social',
                      description:
                        'Share knowledge, opportunities, and insights with your educational community through topic-based discussions.',
                      icon: Briefcase,
                      path: '/school/social',
                      color: 'from-orange-500/20 to-orange-600/20',
                    },
                  ].map((feature, idx) => {
                    const Icon = feature.icon
                    return (
                      <button
                        key={idx}
                        onClick={() => (window.location.href = feature.path)}
                        className={`bg-gradient-to-br ${feature.color} border border-white/10 rounded-lg p-6 hover:border-white/20 transition text-left`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <Icon className="size-6 text-[#6366f1] flex-shrink-0 mt-1" />
                          <h3 className="text-lg font-bold text-white">
                            {feature.title}
                          </h3>
                        </div>
                        <p className="text-white/70 text-sm">
                          {feature.description}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Info Card */}
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-white text-sm">
                    💡 <strong>MAi Business Hub:</strong> Coordinate your
                    educational initiatives, build teams, and contribute to your
                    school's collective growth through the school pool system.
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
