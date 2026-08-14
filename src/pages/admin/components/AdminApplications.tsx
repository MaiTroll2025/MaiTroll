 import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { jobPositions } from '../../../lib/trollJobsData'
import { toast } from 'sonner'
import { Check, X, Shield, RefreshCw, AlertTriangle, FileText, DollarSign } from 'lucide-react'

import UserNameWithAge from '../../../components/UserNameWithAge'

interface Application {
  id: string
  user_id: string
  type: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  lead_officer_approved: boolean | null
  lead_officer_reviewed_by: string | null
  lead_officer_reviewed_at: string | null
  store_name?: string
  store_description?: string
  product_types?: string
  contact_email?: string
  user_profiles?: {
    username: string
    email?: string
    created_at?: string
    rgb_username_expires_at?: string
  }
}

interface SellerAppeal {
  id: string
  user_id: string
  type: string
  status: 'denied'
  updated_at?: string
  appeal_requested: boolean
  appeal_reason: string
  appeal_requested_at: string
  appeal_status: 'pending' | 'approved' | 'denied'
  appeal_notes?: string
  store_name?: string
  store_description?: string
  contact_email?: string
  user_profiles?: {
    username: string
    email?: string
  }
}

interface JobApplication {
  id: string
  user_id: string
  position_id: string
  status: string
  created_at: string
  updated_at?: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  user_profiles?: {
    username: string
    email?: string
  }
}

interface CareerApplication {
  id: string
  user_id: string
  position_id: string | null
  status: string
  created_at: string
  updated_at?: string
  lead_officer_approved: boolean | null
  lead_officer_reviewed_by?: string | null
  lead_officer_reviewed_at?: string | null
  application_data?: any
  user_profiles?: {
    username: string
    email?: string
  }
}

interface AttorneyApplication {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  attorney_fee: number
  is_pro_bono: boolean
  created_at: string
  user_profiles?: {
    username: string
    email?: string
  }
}

interface ProsecutorApplication {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  user_profiles?: {
    username: string
    email?: string
  }
}

interface AuctioneerApplication {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  display_name: string
  application_text: string
  selling_plan: string | null
  experience: string | null
  agreement_accepted: boolean
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  user_profiles?: {
    username: string
    email?: string
  }
}

interface FastPayApplication {
  id: string
  user_id: string
  payout_method: string
  payout_username: string
  payout_email?: string | null
  cashtag?: string | null
  venmo_handle?: string | null
  user_level: number
  account_age_days: number
  has_verified_identity: boolean
  has_violations: boolean
  has_fraud_history: boolean
  id_verification_url?: string | null
  id_verification_uploaded_at?: string | null
  status: 'pending' | 'under_review' | 'approved' | 'rejected'
  admin_notes?: string | null
  rejection_reason?: string | null
  created_at: string
  updated_at: string
  user_profiles?: {
    username: string
    email?: string
  }
}

export default function AdminApplications() {
  const { user, refreshProfile } = useAuthStore()
  const [applications, setApplications] = useState<Application[]>([])
  const [sellerAppeals, setSellerAppeals] = useState<SellerAppeal[]>([])
  const [attorneyApps, setAttorneyApps] = useState<AttorneyApplication[]>([])
  const [prosecutorApps, setProsecutorApps] = useState<ProsecutorApplication[]>([])
  const [auctioneerApps, setAuctioneerApps] = useState<AuctioneerApplication[]>([])
  const [fastPayApplications, setFastPayApplications] = useState<FastPayApplication[]>([])
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([])
  const [careerApplications, setCareerApplications] = useState<CareerApplication[]>([])
  const [loading, setLoading] = useState(false)
  const [positionFilled, setPositionFilled] = useState(false)
  const loadingRef = useRef(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const jobApplicationReviewStatuses = ['submitted', 'pending', 'under_review', 'interview_scheduled'] as const
  const isJobApplicationAwaitingReview = (status: string) => jobApplicationReviewStatuses.includes(status as any)

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'attorney' | 'prosecutor' | 'auctioneer'>('pending')



  const loadApplications = useCallback(async (skipLoadingState = false) => {
    if (loadingRef.current) return
    loadingRef.current = true

    if (!skipLoadingState) setLoading(true)

    try {
      const [appRes, appealRes, attorneyRes, prosecutorRes, auctioneerRes, fastPayRes, jobAppRes, careerAppRes] = await Promise.all([
        supabase.functions.invoke('admin-actions', { body: { action: 'get_applications' } }),
        supabase.functions.invoke('admin-actions', { body: { action: 'get_seller_appeals' } }),
        supabase.from('attorney_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('prosecutor_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('auctioneer_applications').select('*').order('created_at', { ascending: false }),
        supabase.from('fast_pay_applications').select('*, user_profiles!user_id(username, email)').order('created_at', { ascending: false }),
        supabase.from('job_applications').select('id, user_id, position_id, status, created_at, updated_at, reviewed_by, reviewed_at, user_profiles!user_id(username, email)').order('created_at', { ascending: false }),
        supabase.from('career_applications').select('*, user_profiles!user_id(username, email)').order('created_at', { ascending: false })
      ])

      const { data: appData, error: appError } = appRes
      const { data: appealData, error: appealError } = appealRes
      const { data: attorneyData, error: attorneyError } = attorneyRes
      const { data: prosecutorData, error: prosecutorError } = prosecutorRes
      const { data: auctioneerData, error: auctioneerError } = auctioneerRes
      const { data: fastPayData, error: fastPayError } = fastPayRes
      const { data: careerAppData, error: careerAppError } = careerAppRes

      if (appError) throw appError
      if (appData?.error) throw new Error(appData.error)

      setPositionFilled(appData.positionFilled || false)
      setApplications(appData.applications || [])

      if (!appealError && !appealData?.error) {
        setSellerAppeals(appealData.appeals || [])
      }

      // Fetch user profiles for attorney applications
      if (!attorneyError && attorneyData && attorneyData.length > 0) {
        const userIds = attorneyData.map((a: any) => a.user_id).filter(Boolean)
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .in('id', userIds)
          
          const mapped = attorneyData.map((app: any) => ({
            ...app,
            user_profiles: users?.find((u: any) => u.id === app.user_id) || null
          }))
          setAttorneyApps(mapped as any)
        } else {
          setAttorneyApps([])
        }
      } else {
        setAttorneyApps([])
      }

      // Fetch user profiles for prosecutor applications
      if (!prosecutorError && prosecutorData && prosecutorData.length > 0) {
        const userIds = prosecutorData.map((p: any) => p.user_id).filter(Boolean)
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .in('id', userIds)
          
          const mapped = prosecutorData.map((app: any) => ({
            ...app,
            user_profiles: users?.find((u: any) => u.id === app.user_id) || null
          }))
          setProsecutorApps(mapped as any)
        } else {
          setProsecutorApps([])
        }
      } else {
        setProsecutorApps([])
      }

      // Fetch user profiles for auctioneer applications
      if (!auctioneerError && auctioneerData && auctioneerData.length > 0) {
        const userIds = auctioneerData.map((a: any) => a.user_id).filter(Boolean)
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .in('id', userIds)
          
          const mapped = auctioneerData.map((app: any) => ({
            ...app,
            user_profiles: users?.find((u: any) => u.id === app.user_id) || null
          }))
          setAuctioneerApps(mapped as any)
        } else {
          setAuctioneerApps([])
        }
      } else {
        setAuctioneerApps([])
      }

      if (!fastPayError && fastPayData) {
        setFastPayApplications(fastPayData)
      } else {
        setFastPayApplications([])
      }

      const { data: jobAppData, error: jobAppError } = jobAppRes
      if (!jobAppError && jobAppData) {
        setJobApplications(jobAppData)
      } else {
        setJobApplications([])
      }

      if (!careerAppError && careerAppData) {
        setCareerApplications(careerAppData as any)
      } else {
        setCareerApplications([])
      }
    } catch (err: unknown) {
      toast.error("Failed to load applications")
      console.error(err)
    } finally {
      loadingRef.current = false
      if (!skipLoadingState) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApplications()

    const handleRealtimeUpdate = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        loadApplications(true)
      }, 500)
    }

    const channel1 = supabase
      .channel('applications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attorney_applications' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prosecutor_applications' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'career_applications' }, handleRealtimeUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fast_pay_applications' }, handleRealtimeUpdate)
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (channel1) {
        supabase.removeChannel(channel1)
      }
    }
  }, [loadApplications])


  // APPROVE REGULAR USER APPLICATIONS
  const handleApprove = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'approve_application',
            applicationId: app.id,
            type: app.type,
            userId: app.user_id
        }
      });

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      // Handle specific success messages based on type
      if (app.type === "seller") {
        toast.success("Seller application approved! Store created and user can now manage their shop.")
      } else if (app.type === "lead_officer") {
        toast.success("Lead Officer application approved!")
      } else if (app.type === "troll_officer") {
        toast.success("Troll Officer application approved!")
      } else {
        toast.success("Application approved!")
      }

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // APPROVE ATTORNEY APPLICATIONS
  const handleApproveAttorney = useCallback(async (app: AttorneyApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      // Update attorney application status
      const { error } = await supabase
        .from('attorney_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', app.id)

      if (error) throw error

      // Update user profile with attorney status and fee
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          is_attorney: true,
          attorney_fee: app.attorney_fee,
          is_pro_bono: app.is_pro_bono
        })
        .eq('id', app.user_id)

      if (profileError) throw profileError

      toast.success("Attorney application approved!")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve attorney application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // REJECT ATTORNEY APPLICATIONS
  const handleRejectAttorney = useCallback(async (app: AttorneyApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { error } = await supabase
        .from('attorney_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', app.id)

      if (error) throw error

      toast.success("Attorney application rejected")
      const scrollY = window.scrollY
      await loadApplications()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject attorney application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])

  const handleApproveJobApplication = useCallback(async (app: JobApplication) => {
    if (!user) return toast.error('You must be logged in')

    try {
      setLoading(true)
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', app.id)

       if (error) throw error

       const { error: profileError } = await supabase
         .from('user_profiles')
         .update({
           role: app.position_id,
         })
         .eq('id', app.user_id)

       if (profileError) throw profileError

       toast.success('Job application approved and user profile updated')
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve job application'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])

  const handleBypassHireJobApplication = useCallback(async (app: JobApplication) => {
    if (!user) return toast.error('You must be logged in')

    try {
      setLoading(true)
      const { error } = await supabase
        .from('job_applications')
        .update({
          status: 'hired',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          interview_notes: 'Application bypassed by authorized admin.',
        })
        .eq('id', app.id)

       if (error) throw error

       const { error: profileError } = await supabase
         .from('user_profiles')
         .update({
           role: app.position_id,
         })
         .eq('id', app.user_id)

       if (profileError) throw profileError

       toast.success('Applicant bypass-hired. Refreshing profile...')
      await loadApplications()
      if (refreshProfile) await refreshProfile()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to bypass hire job application'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])

  const handleRejectJobApplication = useCallback(async (app: JobApplication) => {
    if (!user) return toast.error('You must be logged in')

    try {
      setLoading(true)
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', app.id)

      if (error) throw error

      toast.success('Job application rejected')
      await loadApplications()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject job application'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])

  const handleMarkJobApplicationUnderReview = useCallback(async (app: JobApplication) => {
    if (!user) return toast.error('You must be logged in')

    try {
      setLoading(true)
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'under_review', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', app.id)

      if (error) throw error

      toast.success('Job application marked under review')
      await loadApplications()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark application under review'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])

  const handleScheduleJobInterview = useCallback(async (app: JobApplication) => {
    if (!user) return toast.error('You must be logged in')
    try {
      setLoading(true)
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', app.id)

      if (error) throw error

      toast.success('Job application approved!')
      await loadApplications()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve application'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])


  // APPROVE PROSECUTOR APPLICATIONS
  const handleApproveProsecutor = useCallback(async (app: ProsecutorApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      // Update prosecutor application status
      const { error } = await supabase
        .from('prosecutor_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', app.id)

      if (error) throw error

      // Update user profile with prosecutor status
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          is_prosecutor: true
        })
        .eq('id', app.user_id)

      if (profileError) throw profileError

      toast.success("Prosecutor application approved!")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve prosecutor application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // APPROVE AUCTIONEER APPLICATIONS
  const handleApproveAuctioneer = useCallback(async (app: AuctioneerApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('review_auctioneer_application', {
        p_application_id: app.id,
        p_approve: true,
        p_admin_notes: 'Approved via admin dashboard'
      })

      if (error) throw error

      const result = typeof data === 'string' ? JSON.parse(data) : data
      if (!result.success) throw new Error(result.error)

      toast.success("Auctioneer application approved!")
      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve auctioneer application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // REJECT AUCTIONEER APPLICATIONS
  const handleRejectAuctioneer = useCallback(async (app: AuctioneerApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('review_auctioneer_application', {
        p_application_id: app.id,
        p_approve: false,
        p_admin_notes: 'Rejected via admin dashboard'
      })

      if (error) throw error

      const result = typeof data === 'string' ? JSON.parse(data) : data
      if (!result.success) throw new Error(result.error)

      toast.success("Auctioneer application rejected")
      const scrollY = window.scrollY
      await loadApplications()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject auctioneer application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])


  // REJECT PROSECUTOR APPLICATIONS
  const handleRejectProsecutor = useCallback(async (app: ProsecutorApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { error } = await supabase
        .from('prosecutor_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', app.id)

      if (error) throw error

      toast.success("Prosecutor application rejected")
      const scrollY = window.scrollY
      await loadApplications()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject prosecutor application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])


  // REJECT REGULAR APPLICATIONS
  const handleReject = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'deny_application',
            applicationId: app.id,
            reason: null // Or prompt for reason if needed, current code passed null
        }
      });

      if (error) throw error

      toast.error("Application denied.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to deny application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])

  const handleApproveFastPayApplication = useCallback(async (app: FastPayApplication) => {
    if (!user) return toast.error("You must be logged in")

    try {
      setLoading(true)

      const { error } = await supabase.rpc('review_fast_pay_application', {
        p_application_id: app.id,
        p_new_status: 'approved',
        p_admin_notes: 'Approved from admin applications dashboard',
      })

      if (error) throw error

      toast.success("Fast Pay application approved. User can now request cashouts.")
      const scrollY = window.scrollY
      await loadApplications()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve Fast Pay application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])

  const handleRejectFastPayApplication = useCallback(async (app: FastPayApplication) => {
    if (!user) return toast.error("You must be logged in")

    const reason = window.prompt('Rejection reason')
    if (reason === null) return

    try {
      setLoading(true)

      const { error } = await supabase.rpc('review_fast_pay_application', {
        p_application_id: app.id,
        p_new_status: 'rejected',
        p_rejection_reason: reason || 'Rejected from admin applications dashboard',
      })

      if (error) throw error

      toast.error("Fast Pay application denied.")
      const scrollY = window.scrollY
      await loadApplications()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to deny Fast Pay application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications])

  const handleApproveOverride = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    const confirmed = window.confirm('Approve this application even though it was previously rejected?')
    if (!confirmed) return

    await handleApprove(app)
  }, [user, handleApprove])

  const handleDelete = useCallback(async (app: Application) => {
    if (!user) return toast.error("You must be logged in")

    const confirmed = window.confirm('Permanently delete this application? This cannot be undone.')
    if (!confirmed) return

    try {
      setLoading(true)

      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'delete_application',
            applicationId: app.id
        }
      });

      if (error) throw error

      toast.success("Application deleted.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete application"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])



// APPROVE SELLER APPEAL
  const handleApproveAppeal = useCallback(async (appeal: SellerAppeal) => {
    if (!user) return toast.error("You must be logged in")

    const notes = prompt("Optional approval notes:")

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'review_seller_appeal',
            applicationId: appeal.id,
            reviewAction: 'approve',
            notes: notes || undefined
        }
      });

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success("Seller appeal approved! Store access restored.")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve appeal"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  // REJECT SELLER APPEAL
  const handleRejectAppeal = useCallback(async (appeal: SellerAppeal) => {
    if (!user) return toast.error("You must be logged in")

    const notes = prompt("Rejection reason (required):")
    if (!notes) return

    try {
      setLoading(true)

      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'review_seller_appeal',
            applicationId: appeal.id,
            reviewAction: 'deny',
            notes: notes
        }
      });

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.error("Seller appeal denied")

      const scrollY = window.scrollY
      await loadApplications()
      if (refreshProfile) await refreshProfile()
      requestAnimationFrame(() => window.scrollTo(0, scrollY))

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to deny appeal"
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [user, loadApplications, refreshProfile])


  const counts = {
    pending: applications.filter(a => a.status === 'pending').length + sellerAppeals.length + careerApplications.filter(a => a.status === 'pending' || a.status === 'applied').length,
    approved: applications.filter(a => a.status === 'approved').length + careerApplications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length + careerApplications.filter(a => a.status === 'rejected').length,
  }

  const visibleApplications = applications.filter((a) => a.status === activeTab)

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
        <h3 className="text-blue-300 font-semibold mb-2">📋 Applications</h3>
        <p className="text-blue-200 text-sm">
          View all applications and triage them by status. Pending items are those not approved yet.
        </p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['pending', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})
          </button>
        ))}
        <button
          onClick={() => setActiveTab('attorney')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'attorney'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Attorney ({attorneyApps.length})
        </button>
        <button
          onClick={() => setActiveTab('prosecutor')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'prosecutor'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Prosecutor ({prosecutorApps.length})
        </button>
        <button
          onClick={() => setActiveTab('auctioneer')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'auctioneer'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Auctioneer ({auctioneerApps.length})
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          Applications Admin
        </h2>

        <button
          onClick={() => loadApplications()}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 text-white rounded-lg flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading applications...</div>
      ) : (
        <>

          {/* USER APPLICATIONS */}
          <div className="space-y-3">
            {visibleApplications.map(app => {
              const isLead = app.type === "lead_officer"
              const isSeller = app.type === "seller"
              const disable = isLead && positionFilled

              return (
                <div key={app.id} className="bg-[#1A1A1A] border border-purple-500/30 rounded-lg p-4">

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserNameWithAge
                          user={{
                            username: app.user_profiles?.username || "Unknown User",
                            created_at: app.user_profiles?.created_at,
                            rgb_username_expires_at: app.user_profiles?.rgb_username_expires_at
                          }}
                          className="text-white font-semibold"
                        />
                        <span className={`text-xs px-2 py-1 rounded ${
                          isSeller
                            ? 'bg-orange-900 text-orange-300'
                            : 'bg-purple-900 text-purple-300'
                        }`}>
                          {app.type.toUpperCase().replace("_", " ")}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-2">
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </div>

                      {/* Seller Application Details */}
                      {isSeller && (
                        <div className="space-y-2 text-sm">
                          {app.store_name && (
                            <div>
                              <span className="text-gray-400">Store:</span>
                              <span className="text-white ml-2">{app.store_name}</span>
                            </div>
                          )}
                          {app.store_description && (
                            <div>
                              <span className="text-gray-400">Description:</span>
                              <span className="text-white ml-2">{app.store_description}</span>
                            </div>
                          )}
                          {app.product_types && (
                            <div>
                              <span className="text-gray-400">Products:</span>
                              <span className="text-white ml-2">{app.product_types}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2">
                      {app.status === "pending" && activeTab === 'pending' && !disable && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(app)} className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg">APPROVE</button>
                          <button onClick={() => handleReject(app)} className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg">DENY</button>
                        </div>
                      )}
                      {app.status === "approved" && (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Approved
                        </div>
                      )}
                      {app.status === "rejected" && (
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-red-400 text-sm flex items-center gap-1">
                            <X className="w-4" /> Denied
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveOverride(app)}
                              className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                            >
                              APPROVE ANYWAY
                            </button>
                            <button
                              onClick={() => handleDelete(app)}
                              className="px-3 py-2 bg-gray-700 text-white text-xs rounded-lg"
                            >
                              DELETE
                            </button>
                          </div>
                        </div>
                      )}
                      {app.status !== "rejected" && (
                        <button
                          onClick={() => handleDelete(app)}
                          className="px-3 py-1 bg-gray-800 text-gray-200 text-[11px] rounded-lg mt-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>

          {/* FAST PAY APPLICATIONS */}
          {activeTab === 'pending' && (
            <div className="space-y-3 mt-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                MAI Pay Cashout Applications Waiting for Review ({fastPayApplications.filter((app) => app.status === 'pending' || app.status === 'under_review').length})
              </h3>

              {fastPayApplications.filter((app) => app.status === 'pending' || app.status === 'under_review').map((app) => (
                <div key={app.id} className="bg-[#1A1A1A] border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserNameWithAge
                          user={{
                            username: app.user_profiles?.username || 'Unknown User',
                            email: app.user_profiles?.email,
                          }}
                          className="text-white font-semibold"
                        />
                        <span className={`text-xs px-2 py-1 rounded ${
                          app.status === 'under_review' ? 'bg-blue-900 text-blue-300' : 'bg-emerald-900 text-emerald-300'
                        }`}>
                          {app.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-3">
                        Applied: {new Date(app.created_at).toLocaleDateString()} • Level {app.user_level} • Account age {app.account_age_days} days
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400">Payout method</p>
                          <p className="text-white capitalize">{app.payout_method.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Payout details</p>
                          <p className="text-white break-all">{app.cashtag || app.venmo_handle || app.payout_email || app.payout_username || 'Not provided'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400 mt-3">
                        <p>ID verified snapshot: {app.has_verified_identity ? 'Yes' : 'No'}</p>
                        <p>Violations snapshot: {app.has_violations ? 'Yes' : 'No'}</p>
                        <p>Fraud snapshot: {app.has_fraud_history ? 'Yes' : 'No'}</p>
                      </div>

                      {app.id_verification_uploaded_at && (
                        <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                          ID uploaded: {new Date(app.id_verification_uploaded_at).toLocaleString()}
                        </div>
                      )}
                      {app.admin_notes && (
                        <div className="mt-3 text-xs text-gray-400">
                          <span className="text-gray-500">Admin notes:</span> {app.admin_notes}
                        </div>
                      )}
                      {app.rejection_reason && (
                        <div className="mt-3 text-xs text-red-300">
                          <span className="text-red-400">Rejection reason:</span> {app.rejection_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 md:flex-col">
                      {(app.status === 'pending' || app.status === 'under_review') && (
                        <>
                          <button
                            onClick={() => handleApproveFastPayApplication(app)}
                            className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                          >
                            APPROVE CASHOUTS
                          </button>
                          <button
                            onClick={() => handleRejectFastPayApplication(app)}
                            className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg"
                          >
                            DENY
                          </button>
                        </>
                      )}
                      {app.status === 'approved' && (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4" /> Approved
                        </div>
                      )}
                      {app.status === 'rejected' && (
                        <div className="text-red-400 text-sm flex items-center gap-1">
                          <X className="w-4" /> Denied
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {fastPayApplications.filter((app) => app.status === 'pending' || app.status === 'under_review').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-2 opacity-20 text-emerald-400">💵</div>
                  <p>No pending MAI Pay cashout applications</p>
                </div>
              )}
            </div>
          )}

          {/* SELLER APPEALS */}
          {activeTab === 'pending' && (
          <div className="space-y-3 mt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Seller Appeals {sellerAppeals.length > 0 && `(${sellerAppeals.length})`}
            </h3>

            {sellerAppeals.map(appeal => (
              <div key={appeal.id} className="bg-[#1A1A1A] border border-orange-500/30 rounded-lg p-4">

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white font-semibold">
                        {appeal.user_profiles?.username || "Unknown User"}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-orange-900 text-orange-300">
                        APPEAL PENDING
                      </span>
                    </div>

                      <div className="text-xs text-gray-500 mb-2">
                        Originally denied: {appeal.updated_at ? new Date(appeal.updated_at).toLocaleDateString() : '-'}
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        Appeal submitted: {appeal.appeal_requested_at ? new Date(appeal.appeal_requested_at).toLocaleDateString() : '-'}
                      </div>

                    {/* Appeal Reason */}
                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-1">Appeal Reason:</div>
                      <div className="text-white text-sm bg-gray-900/50 p-2 rounded">
                        {appeal.appeal_reason}
                      </div>
                    </div>

                    {/* Original Application Details */}
                    <div className="space-y-2 text-sm">
                      {appeal.store_name && (
                        <div>
                          <span className="text-gray-400">Store:</span>
                          <span className="text-white ml-2">{appeal.store_name}</span>
                        </div>
                      )}
                      {appeal.store_description && (
                        <div>
                          <span className="text-gray-400">Description:</span>
                          <span className="text-white ml-2">{appeal.store_description}</span>
                        </div>
                      )}
                      {appeal.contact_email && (
                        <div>
                          <span className="text-gray-400">Email:</span>
                          <span className="text-white ml-2">{appeal.contact_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveAppeal(appeal)}
                        className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg flex items-center gap-1"
                      >
                        <Check className="w-4" /> Approve Appeal
                      </button>
                      <button
                        onClick={() => handleRejectAppeal(appeal)}
                        className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg flex items-center gap-1"
                      >
                        <X className="w-4" /> Deny Appeal
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
          )}

          {activeTab === 'pending' && jobApplications.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Job Applications Waiting for Review ({jobApplications.filter((app) => isJobApplicationAwaitingReview(app.status)).length})
              </h3>

              {jobApplications.filter((app) => isJobApplicationAwaitingReview(app.status)).map((jobApp) => (
                <div key={jobApp.id} className="bg-[#1A1A1A] border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-white font-semibold">{jobPositions.find((job) => job.id === jobApp.position_id)?.title || jobApp.position_id}</p>
                      <p className="text-sm text-gray-400">Applicant: {jobApp.user_profiles?.username || 'Unknown'}</p>
                      <p className="text-sm text-gray-400">Email: {jobApp.user_profiles?.email || 'Not provided'}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">Status: {jobApp.status.replace('_', ' ').toUpperCase()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(jobApp.status === 'submitted' || jobApp.status === 'pending' || jobApp.status === 'under_review') && (
                        <>
                          <button
                            onClick={() => handleMarkJobApplicationUnderReview(jobApp)}
                            className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg"
                          >
                            MARK UNDER REVIEW
                          </button>
                           <button
                             onClick={() => handleApproveJobApplication(jobApp)}
                             className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                           >
                             APPROVE
                           </button>
                        </>
                      )}
                       {jobApp.status !== 'approved' && jobApp.status !== 'rejected' && (
                         <>
                           <button
                             onClick={() => handleBypassHireJobApplication(jobApp)}
                             className="px-3 py-2 bg-amber-500 text-black text-xs rounded-lg"
                           >
                             BYPASS HIRE
                           </button>
                           <button
                             onClick={() => handleRejectJobApplication(jobApp)}
                             className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg"
                           >
                             REJECT
                           </button>
                         </>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CAREER APPLICATIONS */}
          {careerApplications.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Career Applications ({careerApplications.filter((app) => app.status === 'pending' || app.status === 'applied').length})
              </h3>

              {careerApplications.filter((app) => app.status === 'pending' || app.status === 'applied').map((careerApp) => (
                <div key={careerApp.id} className="bg-[#1A1A1A] border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-white font-semibold">{careerApp.position_id ? careerApp.position_id.replace(/_/g, ' ').toUpperCase() : 'Career Application'}</p>
                      <p className="text-sm text-gray-400">Applicant: {careerApp.user_profiles?.username || 'Unknown'}</p>
                      <p className="text-sm text-gray-400">Email: {careerApp.user_profiles?.email || 'Not provided'}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">Status: {careerApp.status.toUpperCase()}</p>
                      {careerApp.lead_officer_approved === true && (
                        <p className="text-xs text-emerald-400 mt-1">✓ Lead Officer Approved</p>
                      )}
                      {careerApp.lead_officer_approved === false && (
                        <p className="text-xs text-red-400 mt-1">✗ Lead Officer Rejected</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(careerApp.status === 'pending' || careerApp.status === 'applied') && (
                        <>
                          <button
                            onClick={async () => {
                              setLoading(true)
                              try {
                                const { error } = await supabase
                                  .from('career_applications')
                                  .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
                                  .eq('id', careerApp.id)
                                if (error) throw error
                                toast.success('Career application approved')
                                await loadApplications()
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to approve career application')
                              } finally {
                                setLoading(false)
                              }
                            }}
                            className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                          >
                            APPROVE
                          </button>
                          <button
                            onClick={async () => {
                              setLoading(true)
                              try {
                                const { error } = await supabase
                                  .from('career_applications')
                                  .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
                                  .eq('id', careerApp.id)
                                if (error) throw error
                                toast.success('Career application rejected')
                                await loadApplications()
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to reject career application')
                              } finally {
                                setLoading(false)
                              }
                            }}
                            className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg"
                          >
                            REJECT
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ATTORNEY APPLICATIONS */}
          {activeTab === 'attorney' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                ⚖️ Attorney Applications ({attorneyApps.length})
              </h3>

              {attorneyApps.filter(app => app.status === 'pending').map(app => (
                <div key={app.id} className="bg-[#1A1A1A] border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserNameWithAge user={app.user_profiles} className="text-white font-semibold" />
                        <span className="text-xs px-2 py-1 rounded bg-amber-900 text-amber-300">
                          ATTORNEY APPLICATION
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-3">
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Type:</span>
                          <span className="text-white ml-2">
                            {app.is_pro_bono ? 'Pro Bono (200 TC per case)' : `Private (${app.attorney_fee} TC per case)`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => handleApproveAttorney(app)}
                        className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handleRejectAttorney(app)}
                        className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg"
                      >
                        DENY
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {attorneyApps.filter(app => app.status === 'pending').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-2 opacity-20 text-amber-400">⚖️</div>
                  <p>No pending attorney applications</p>
                </div>
              )}
            </div>
          )}

          {/* PROSECUTOR APPLICATIONS */}
          {activeTab === 'prosecutor' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                🏛️ Prosecutor Applications ({prosecutorApps.length})
              </h3>

              {prosecutorApps.filter(app => app.status === 'pending').map(app => (
                <div key={app.id} className="bg-[#1A1A1A] border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <UserNameWithAge user={app.user_profiles} className="text-white font-semibold" />
                        <span className="text-xs px-2 py-1 rounded bg-red-900 text-red-300">
                          PROSECUTOR APPLICATION
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mb-3">
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => handleApproveProsecutor(app)}
                        className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handleRejectProsecutor(app)}
                        className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg"
                      >
                        DENY
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {prosecutorApps.filter(app => app.status === 'pending').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-2 opacity-20 text-red-400">🏛️</div>
                  <p>No pending prosecutor applications</p>
                </div>
              )}
            </div>
          )}

          {/* AUCTIONEER APPLICATIONS */}
          {activeTab === 'auctioneer' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2">
                🔨 Auctioneer Applications ({auctioneerApps.length})
              </h3>

              {auctioneerApps.filter(app => app.status === 'pending').map(app => (
                <div key={app.id} className="bg-[#1A1A1A] border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-semibold">{app.display_name}</span>
                        <span className="text-xs px-2 py-1 rounded bg-green-900 text-green-300">
                          AUCTIONEER APPLICATION
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-2">
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                        {app.user_profiles && (
                          <span className="ml-2">by {app.user_profiles.username}</span>
                        )}
                      </div>

                      <div className="text-sm text-gray-300 mb-2">
                        <p className="font-medium">Why they want to be an auctioneer:</p>
                        <p className="mt-1">{app.application_text}</p>
                      </div>

                      {app.selling_plan && (
                        <div className="text-sm text-gray-400 mt-2">
                          <p className="font-medium">What they plan to sell:</p>
                          <p className="mt-1">{app.selling_plan}</p>
                        </div>
                      )}

                      {app.experience && (
                        <div className="text-sm text-gray-400 mt-2">
                          <p className="font-medium">Experience:</p>
                          <p className="mt-1">{app.experience}</p>
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex gap-2">
                      <button
                        onClick={() => handleApproveAuctioneer(app)}
                        className="px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-500"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => handleRejectAuctioneer(app)}
                        className="px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-500"
                      >
                        DENY
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {auctioneerApps.filter(app => app.status === 'pending').length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-12 h-12 mx-auto mb-2 opacity-20 text-green-400">🔨</div>
                  <p>No pending auctioneer applications</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
