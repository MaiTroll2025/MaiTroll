import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import PrivacyDashboard from '@/components/school/PrivacyDashboard'
import IncidentsPanel from '@/components/school/IncidentsPanel'
import FinancialTransparency from '@/components/school/FinancialTransparency'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Users, Book, BarChart3, Settings, Shield, AlertCircle, DollarSign } from 'lucide-react'

interface InstitutionData {
  institutionName: string
  studentCount: number
  instructorCount: number
  totalPoolContributions: number
  staffRole: string
}

export default function InstitutionDashboard() {
  const { user, profile } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState<InstitutionData | null>(null)
  const [staffInstitutionId, setStaffInstitutionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInstitutionData = async () => {
      if (!user) return

      try {
        // Get user's institution from staff record
        const { data: staffData } = await supabase
          .from('institution_staff')
          .select('*, institutions(name, id)')
          .eq('user_id', user.id)
          .single()

        if (!staffData) {
          setLoading(false)
          return
        }

        const institutionId = staffData.institutions.id
        const institutionName = staffData.institutions.name
        setStaffInstitutionId(institutionId)

        // Get student count
        const { count: studentCount } = await supabase
          .from('student_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)

        // Get instructor count
        const { count: instructorCount } = await supabase
          .from('instructor_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institutionId)

        // Get pool total
        const { data: poolData } = await supabase.rpc('get_school_pool_total', {
          p_institution_id: institutionId
        })

        setData({
          institutionName,
          studentCount: studentCount || 0,
          instructorCount: instructorCount || 0,
          totalPoolContributions: poolData || 0,
          staffRole: staffData.role.toUpperCase(),
        })
      } catch (err) {
        console.error('Error fetching institution data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInstitutionData()
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
            title="Institution Dashboard"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={setSidebarOpen}
          />

          <main className="max-w-7xl mx-auto p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-white size-8" />
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-lg p-6 border border-white/10">
                  <h2 className="text-3xl font-bold text-white mb-2">{data.institutionName}</h2>
                  <div className="flex items-center gap-4 text-white/80">
                    <span>Role: {data.staffRole}</span>
                    <span>•</span>
                    <span>Institutional Administrator</span>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    { icon: Users, label: 'Students', value: data.studentCount },
                    { icon: Book, label: 'Instructors', value: data.instructorCount },
                    { icon: BarChart3, label: 'Pool Total', value: `${data.totalPoolContributions.toLocaleString()}` },
                    { icon: Settings, label: 'Status', value: 'ACTIVE' },
                  ].map((metric, idx) => {
                    const Icon = metric.icon
                    return (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className="size-5 text-[#6366f1]" />
                          <p className="text-white/60 text-sm">{metric.label}</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{metric.value}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Dashboard Sections */}
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    {
                      title: 'Students',
                      description: 'Manage verified students and memberships',
                      icon: Users,
                      path: '/school/institution/students',
                    },
                    {
                      title: 'Instructors',
                      description: 'Manage verified instructors and assignments',
                      icon: Book,
                      path: '/school/institution/instructors',
                    },
                    {
                      title: 'Programs',
                      description: 'Manage courses and educational programs',
                      icon: BarChart3,
                      path: '/school/institution/programs',
                    },
                    {
                      title: 'School Pool',
                      description: 'View institutional contribution pool',
                      icon: BarChart3,
                      path: '/school/institution/pool',
                    },
                  ].map((section, idx) => {
                    const Icon = section.icon
                    return (
                      <button
                        key={idx}
                        className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition text-left"
                      >
                        <div className="flex items-start gap-4 mb-3">
                          <Icon className="size-6 text-[#6366f1] flex-shrink-0 mt-1" />
                          <div>
                            <h3 className="text-lg font-bold text-white">{section.title}</h3>
                            <p className="text-white/60 text-sm">{section.description}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Info Card */}
                <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
                  <p className="text-white text-sm">
                    💡 <strong>Institutional Dashboard:</strong> This area allows you to manage your institution's students, instructors, programs, and overall educational ecosystem.
                  </p>
                </div>

                {/* Privacy & FERPA Compliance - Staff View */}
                <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="size-6 text-green-400" />
                    <h3 className="text-xl font-bold text-white">Privacy & FERPA Compliance</h3>
                  </div>
                  <PrivacyDashboard
                    institutionId={staffInstitutionId || ''}
                    institutionName={data?.institutionName || ''}
                    isInstructor={false}
                    isStaff={true}
                  />
                </div>

                {/* Incidents & Rule Violations - Staff View */}
                <div className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="size-6 text-purple-400" />
                    <h3 className="text-xl font-bold text-white">Content Moderation & Brand Protection</h3>
                  </div>
                  <IncidentsPanel
                    institutionId={staffInstitutionId || ''}
                    institutionName={data?.institutionName || ''}
                    isStaff={true}
                  />
                </div>

                {/* Financial Transparency - Staff View */}
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <DollarSign className="size-6 text-blue-400" />
                    <h3 className="text-xl font-bold text-white">Financial Transparency & Liability Protection</h3>
                  </div>
                  <FinancialTransparency
                    institutionId={staffInstitutionId || ''}
                    institutionName={data?.institutionName || ''}
                    isStaff={true}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-white/60">Unable to load institution data</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
