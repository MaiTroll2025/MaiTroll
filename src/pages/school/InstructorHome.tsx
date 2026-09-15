import { useEffect, useState } from 'react'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import PrivacyDashboard from '@/components/school/PrivacyDashboard'
import IncidentsPanel from '@/components/school/IncidentsPanel'
import FinancialTransparency from '@/components/school/FinancialTransparency'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader, Shield, Lock, DollarSign, FileCheck, Users, AlertCircle } from 'lucide-react'

interface InstructorData {
  instructorName?: string
  institution?: string
  department?: string
  studentCount: number
  verificationStatus: string
  institutionId?: string
}

export default function InstructorHome() {
  const { user, profile } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState<InstructorData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInstructorData = async () => {
      if (!user) return

      try {
        // Fetch instructor profile
        const { data: instructorProfile } = await supabase
          .from('instructor_profiles')
          .select('*, institutions(name, id)')
          .eq('user_id', user.id)
          .single()

        if (!instructorProfile) {
          setLoading(false)
          return
        }

        // Fetch student count for this instructor's institution
        const { count: studentCount } = await supabase
          .from('student_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', instructorProfile.institution_id)
          .eq('verification_status', 'verified')

        setData({
          instructorName: profile?.display_name || profile?.username,
          institution: instructorProfile.institutions?.name,
          department: instructorProfile.department,
          studentCount: studentCount || 0,
          verificationStatus: instructorProfile.verification_status,
          institutionId: instructorProfile.institutions?.id,
        })
      } catch (err) {
        console.error('Error fetching instructor data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInstructorData()
  }, [user])

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
            title="Instructor Home"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
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
                  <h2 className="text-3xl font-bold text-white mb-2">Welcome, {data?.instructorName}!</h2>
                  <div className="flex items-center gap-4 text-white/80">
                    <span>{data?.institution}</span>
                    {data?.department && <span>•</span>}
                    {data?.department && <span>{data.department}</span>}
                  </div>
                </div>

                {/* Status Badge */}
                {data?.verificationStatus !== 'verified' && (
                  <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-4">
                    <p className="text-white text-sm">
                      ⚠️ <strong>Verification Pending:</strong> Your instructor account is pending verification by your institution.
                    </p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    { label: 'Students', value: data?.studentCount || 0, icon: Users },
                    { label: 'Status', value: data?.verificationStatus?.toUpperCase() || 'PENDING', icon: FileCheck },
                    { label: 'Role', value: 'INSTRUCTOR', icon: Shield },
                    { label: 'Privacy Level', value: 'FERPA', icon: Lock },
                  ].map((stat, idx) => {
                    const Icon = stat.icon
                    return (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="size-4 text-[#6366f1]" />
                          <p className="text-white/60 text-sm">{stat.label}</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{stat.value}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Privacy & FERPA Compliance - Dynamic */}
                <div className="bg-green-600/10 border border-green-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="size-6 text-green-400" />
                    <h3 className="text-xl font-bold text-white">Privacy & FERPA Compliance</h3>
                  </div>
                  {data?.institutionId ? (
                    <PrivacyDashboard
                      institutionId={data.institutionId}
                      institutionName={data.institution || ''}
                      isInstructor={true}
                      isStaff={false}
                    />
                  ) : (
                    <p className="text-white/60 text-sm">Unable to load institution.</p>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <button className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                      <h4 className="text-white font-semibold mb-2">My Students</h4>
                      <p className="text-white/60 text-sm">View and connect with your students</p>
                    </button>
                    <button className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                      <h4 className="text-white font-semibold mb-2">Network</h4>
                      <p className="text-white/60 text-sm">Connect with other instructors</p>
                    </button>
                    <button className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                      <h4 className="text-white font-semibold mb-2">Moderation</h4>
                      <p className="text-white/60 text-sm">Approve student broadcasts</p>
                    </button>
                  </div>
                </div>

                {/* Incidents & Rule Violations - Dynamic */}
                <div className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="size-6 text-purple-400" />
                    <h3 className="text-xl font-bold text-white">Content Moderation & Brand Protection</h3>
                  </div>
                  {data?.institutionId ? (
                    <IncidentsPanel
                      institutionId={data.institutionId}
                      institutionName={data.institution || ''}
                      isStaff={false}
                    />
                  ) : (
                    <p className="text-white/60 text-sm">Unable to load institution.</p>
                  )}
                </div>

                {/* Financial Transparency - Dynamic */}
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <DollarSign className="size-6 text-blue-400" />
                    <h3 className="text-xl font-bold text-white">Financial Transparency & Liability Protection</h3>
                  </div>
                  {data?.institutionId ? (
                    <FinancialTransparency
                      institutionId={data.institutionId}
                      institutionName={data.institution || ''}
                      isStaff={false}
                    />
                  ) : (
                    <p className="text-white/60 text-sm">Unable to load institution.</p>
                  )}
                </div>

                {/* Trust & Compliance Info Card */}
                <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-3">Why Schools Can Trust MAi School</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-white/80">
                    <div>
                      <p className="font-semibold text-white mb-2">🔐 Privacy First</p>
                      <p>Full FERPA compliance with encrypted student data and institutional-level access controls</p>
                    </div>
                    <div>
                      <p className="font-semibold text-white mb-2">💼 Financial Clarity</p>
                      <p>Students own their earnings; schools have zero tax liability for student payouts</p>
                    </div>
                    <div>
                      <p className="font-semibold text-white mb-2">🛡️ Brand Protection</p>
                      <p>Institutional staff can instantly moderate, approve, or mute any student broadcast</p>
                    </div>
                    <div>
                      <p className="font-semibold text-white mb-2">📋 Full Audit Trail</p>
                      <p>Complete logs of data access and actions for regulatory compliance reviews</p>
                    </div>
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
