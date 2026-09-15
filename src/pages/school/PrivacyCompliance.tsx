import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { SchoolLayout } from '@/components/school/SchoolLayout'
import { SchoolHeader, SchoolSidebar } from '@/components/school/SchoolHeader'
import PrivacyDashboard from '@/components/school/PrivacyDashboard'
import { Loader } from 'lucide-react'

export default function PrivacyCompliance() {
  const { user, profile } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [institutionName, setInstitutionName] = useState<string>('')
  const [userType, setUserType] = useState<'instructor' | 'staff' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContext = async () => {
      if (!user) return
      try {
        // Check instructor profile
        const { data: inst } = await supabase
          .from('instructor_profiles')
          .select('*, institutions(name, id)')
          .eq('user_id', user.id)
          .single()

        if (inst) {
          setInstitutionId(inst.institutions.id)
          setInstitutionName(inst.institutions.name)
          setUserType('instructor')
          setLoading(false)
          return
        }

        // Check staff record
        const { data: staff } = await supabase
          .from('institution_staff')
          .select('*, institutions(name, id)')
          .eq('user_id', user.id)
          .single()

        if (staff) {
          setInstitutionId(staff.institutions.id)
          setInstitutionName(staff.institutions.name)
          setUserType('staff')
          setLoading(false)
          return
        }

        setLoading(false)
      } catch (err) {
        console.error('Error fetching privacy context:', err)
        setLoading(false)
      }
    }
    fetchContext()
  }, [user])

  if (loading) {
    return (
      <SchoolLayout requiredRole="instructor">
        <div className="flex h-screen bg-[#0f1419]">
          <div className="flex-1 flex items-center justify-center">
            <Loader className="animate-spin text-white size-8" />
          </div>
        </div>
      </SchoolLayout>
    )
  }

  if (!institutionId || !userType) {
    return (
      <SchoolLayout requiredRole="instructor">
        <div className="flex h-screen bg-[#0f1419]">
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/60">Unable to load institution context.</p>
          </div>
        </div>
      </SchoolLayout>
    )
  }

  return (
    <SchoolLayout requiredRole={userType === 'staff' ? 'institution_staff' : 'instructor'}>
      <div className="flex h-screen bg-[#0f1419]">
        <SchoolSidebar
          isOpen={sidebarOpen}
          userType={userType === 'staff' ? 'institution_staff' : 'instructor'}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 overflow-auto">
          <SchoolHeader
            title="Privacy & FERPA Compliance"
            showSidebar
            isSidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <main className="max-w-7xl mx-auto p-4 md:p-6">
            <PrivacyDashboard
              institutionId={institutionId}
              institutionName={institutionName}
              isInstructor={userType === 'instructor'}
              isStaff={userType === 'staff'}
            />
          </main>
        </div>
      </div>
    </SchoolLayout>
  )
}
