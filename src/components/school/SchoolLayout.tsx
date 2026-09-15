import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'

export interface StudentProfile {
  id: string
  user_id: string
  institution_id: string
  program_field?: string
  verification_status: 'unverified' | 'verified' | 'pending' | 'rejected'
  verified_at?: string
  enrollment_year?: number
  is_active: boolean
}

interface SchoolLayoutProps {
  children: React.ReactNode
  requiredRole?: 'student' | 'instructor' | 'institution_staff' | 'admin'
}

export function SchoolLayout({ children, requiredRole }: SchoolLayoutProps) {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        navigate('/auth')
        return
      }

      try {
        // Check if user is admin (has unrestricted access)
        if (profile?.is_admin) {
          setLoading(false)
          return
        }

        if (requiredRole === 'student') {
          // Check if user is verified student
          const { data: studentData, error } = await supabase
            .from('student_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (error || !studentData) {
            setAccessDenied(true)
            setLoading(false)
            return
          }

          if (studentData.verification_status !== 'verified') {
            setAccessDenied(true)
            setLoading(false)
            return
          }

          setStudentProfile(studentData)
        } else if (requiredRole === 'instructor') {
          // Check if user is verified instructor
          const { data: instructorData, error } = await supabase
            .from('instructor_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (error || !instructorData || instructorData.verification_status !== 'verified') {
            setAccessDenied(true)
            setLoading(false)
            return
          }
        } else if (requiredRole === 'institution_staff') {
          // Check if user is institution staff
          const { data: staffData, error } = await supabase
            .from('institution_staff')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (error || !staffData) {
            setAccessDenied(true)
            setLoading(false)
            return
          }
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking access:', err)
        setAccessDenied(true)
        setLoading(false)
      }
    }

    checkAccess()
  }, [user, profile, requiredRole, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f1419]">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin text-white size-8" />
          <p className="text-white/70">Loading MAi School...</p>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f1419]">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-white/70 mb-6">
              You don't have access to MAi School. {requiredRole && `This area requires ${requiredRole} status.`}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-[#6366f1] hover:bg-[#4f46e5] rounded-lg text-white font-medium transition"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1419]">
      {children}
    </div>
  )
}
