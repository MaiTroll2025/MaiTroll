import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  Check,
  X,
  Search,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

type Status = 'pending' | 'approved' | 'rejected'

interface UserProfile {
  username: string
  email?: string
}

interface Application {
  id: string
  user_id: string
  type: string
  status: Status
  created_at: string
  user_profiles?: UserProfile
}

interface SimpleApplication {
  id: string
  user_id: string
  status: string
  created_at: string
  user_profiles?: UserProfile
}

type Tab =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'attorney'
  | 'prosecutor'
  | 'auctioneer'
  | 'fastpay'
  | 'jobs'
  | 'careers'

export default function PhoneAdminApplications() {
  const { user } = useAuthStore()

  const [applications, setApplications] = useState<Application[]>([])
  const [attorneyApps, setAttorneyApps] = useState<SimpleApplication[]>([])
  const [prosecutorApps, setProsecutorApps] = useState<SimpleApplication[]>([])
  const [auctioneerApps, setAuctioneerApps] = useState<SimpleApplication[]>([])
  const [fastPayApps, setFastPayApps] = useState<SimpleApplication[]>([])
  const [jobApps, setJobApps] = useState<SimpleApplication[]>([])
  const [careerApps, setCareerApps] = useState<SimpleApplication[]>([])

  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const normalizeProfile = (profile: any): UserProfile | undefined => {
    if (Array.isArray(profile)) {
      return profile[0] || undefined
    }

    return profile || undefined
  }

  const loadApplications = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      const [
        appRes,
        attorneyRes,
        prosecutorRes,
        auctioneerRes,
        fastPayRes,
        jobRes,
        careerRes,
      ] = await Promise.all([
        supabase.functions.invoke('admin-actions', {
          body: {
            action: 'get_applications',
          },
        }),

        supabase
          .from('attorney_applications')
          .select('*, user_profiles!user_id(username,email)')
          .order('created_at', { ascending: false }),

        supabase
          .from('prosecutor_applications')
          .select('*, user_profiles!user_id(username,email)')
          .order('created_at', { ascending: false }),

        supabase
          .from('auctioneer_applications')
          .select('*, user_profiles!user_id(username,email)')
          .order('created_at', { ascending: false }),

        supabase
          .from('fast_pay_applications')
          .select('*, user_profiles!user_id(username,email)')
          .order('created_at', { ascending: false }),

        supabase
          .from('job_applications')
          .select(
            'id,user_id,status,created_at,user_profiles!user_id(username,email)'
          )
          .order('created_at', { ascending: false }),

        supabase
          .from('career_applications')
          .select(
            'id,user_id,status,created_at,user_profiles!user_id(username,email)'
          )
          .order('created_at', { ascending: false }),
      ])

      if (appRes.error) {
        throw appRes.error
      }

      if (appRes.data?.error) {
        throw new Error(appRes.data.error)
      }

      setApplications(
        (appRes.data?.applications || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )

      setAttorneyApps(
        (attorneyRes.data || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )

      setProsecutorApps(
        (prosecutorRes.data || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )

      setAuctioneerApps(
        (auctioneerRes.data || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )

      setFastPayApps(
        (fastPayRes.data || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )

      setJobApps(
        (jobRes.data || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )

      setCareerApps(
        (careerRes.data || []).map((app: any) => ({
          ...app,
          user_profiles: normalizeProfile(app.user_profiles),
        }))
      )
    } catch (error) {
      console.error(error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  const approveRegular = async (app: Application) => {
    if (!user) return

    try {
      setLoading(true)

      const { error, data } = await supabase.functions.invoke(
        'admin-actions',
        {
          body: {
            action: 'approve_application',
            applicationId: app.id,
            type: app.type,
            userId: app.user_id,
          },
        }
      )

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Application approved')
      await loadApplications()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to approve application'
      )
    } finally {
      setLoading(false)
    }
  }

  const rejectRegular = async (app: Application) => {
    if (!user) return

    try {
      setLoading(true)

      const { error } = await supabase.functions.invoke(
        'admin-actions',
        {
          body: {
            action: 'deny_application',
            applicationId: app.id,
            reason: null,
          },
        }
      )

      if (error) throw error

      toast.success('Application rejected')
      await loadApplications()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to reject application'
      )
    } finally {
      setLoading(false)
    }
  }

  const approveAttorney = async (app: SimpleApplication) => {
    if (!user) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('attorney_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', app.id)

      if (error) throw error

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ is_attorney: true })
        .eq('id', app.user_id)

      if (profileError) throw profileError

      toast.success('Attorney application approved')
      await loadApplications()
    } catch (error) {
      console.error(error)
      toast.error('Failed to approve attorney application')
    } finally {
      setLoading(false)
    }
  }

  const rejectAttorney = async (app: SimpleApplication) => {
    if (!user) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('attorney_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', app.id)

      if (error) throw error

      toast.success('Attorney application rejected')
      await loadApplications()
    } catch (error) {
      console.error(error)
      toast.error('Failed to reject attorney application')
    } finally {
      setLoading(false)
    }
  }

  const approveProsecutor = async (app: SimpleApplication) => {
    if (!user) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('prosecutor_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', app.id)

      if (error) throw error

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ is_prosecutor: true })
        .eq('id', app.user_id)

      if (profileError) throw profileError

      toast.success('Prosecutor application approved')
      await loadApplications()
    } catch (error) {
      console.error(error)
      toast.error('Failed to approve prosecutor application')
    } finally {
      setLoading(false)
    }
  }

  const rejectProsecutor = async (app: SimpleApplication) => {
    if (!user) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('prosecutor_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', app.id)

      if (error) throw error

      toast.success('Prosecutor application rejected')
      await loadApplications()
    } catch (error) {
      console.error(error)
      toast.error('Failed to reject prosecutor application')
    } finally {
      setLoading(false)
    }
  }

  const approveAuctioneer = async (app: SimpleApplication) => {
    try {
      setLoading(true)

      const { data, error } = await supabase.rpc(
        'review_auctioneer_application',
        {
          p_application_id: app.id,
          p_approve: true,
          p_admin_notes: 'Approved via phone admin',
        }
      )

      if (error) throw error

      const result =
        typeof data === 'string' ? JSON.parse(data) : data

      if (!result?.success) {
        throw new Error(result?.error || 'Approval failed')
      }

      toast.success('Auctioneer application approved')
      await loadApplications()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to approve auctioneer application'
      )
    } finally {
      setLoading(false)
    }
  }

  const rejectAuctioneer = async (app: SimpleApplication) => {
    try {
      setLoading(true)

      const { data, error } = await supabase.rpc(
        'review_auctioneer_application',
        {
          p_application_id: app.id,
          p_approve: false,
          p_admin_notes: 'Rejected via phone admin',
        }
      )

      if (error) throw error

      const result =
        typeof data === 'string' ? JSON.parse(data) : data

      if (!result?.success) {
        throw new Error(result?.error || 'Rejection failed')
      }

      toast.success('Auctioneer application rejected')
      await loadApplications()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to reject auctioneer application'
      )
    } finally {
      setLoading(false)
    }
  }

  const getVisibleApplications = (): SimpleApplication[] => {
    let list: SimpleApplication[] = []

    if (tab === 'attorney') {
      list = attorneyApps
    } else if (tab === 'prosecutor') {
      list = prosecutorApps
    } else if (tab === 'auctioneer') {
      list = auctioneerApps
    } else if (tab === 'fastpay') {
      list = fastPayApps
    } else if (tab === 'jobs') {
      list = jobApps
    } else if (tab === 'careers') {
      list = careerApps
    } else {
      list = applications.filter((app) => app.status === tab)
    }

    if (!search.trim()) {
      return list
    }

    const query = search.toLowerCase()

    return list.filter((app) => {
      return (
        app.user_profiles?.username
          ?.toLowerCase()
          .includes(query) ||
        app.user_profiles?.email
          ?.toLowerCase()
          .includes(query) ||
        app.id.toLowerCase().includes(query)
      )
    })
  }

  const visible = getVisibleApplications()

  const renderActions = (app: SimpleApplication) => {
    if (tab === 'attorney') {
      return (
        <>
          <button
            disabled={loading}
            onClick={() => approveAttorney(app)}
            className="flex-1 rounded-xl bg-green-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" />
            Approve
          </button>

          <button
            disabled={loading}
            onClick={() => rejectAttorney(app)}
            className="flex-1 rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <X className="mr-1 inline h-4 w-4" />
            Reject
          </button>
        </>
      )
    }

    if (tab === 'prosecutor') {
      return (
        <>
          <button
            disabled={loading}
            onClick={() => approveProsecutor(app)}
            className="flex-1 rounded-xl bg-green-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" />
            Approve
          </button>

          <button
            disabled={loading}
            onClick={() => rejectProsecutor(app)}
            className="flex-1 rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <X className="mr-1 inline h-4 w-4" />
            Reject
          </button>
        </>
      )
    }

    if (tab === 'auctioneer') {
      return (
        <>
          <button
            disabled={loading}
            onClick={() => approveAuctioneer(app)}
            className="flex-1 rounded-xl bg-green-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" />
            Approve
          </button>

          <button
            disabled={loading}
            onClick={() => rejectAuctioneer(app)}
            className="flex-1 rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <X className="mr-1 inline h-4 w-4" />
            Reject
          </button>
        </>
      )
    }

    if (tab === 'pending' && 'type' in app) {
      const regular = app as Application

      return (
        <>
          <button
            disabled={loading}
            onClick={() => approveRegular(regular)}
            className="flex-1 rounded-xl bg-green-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" />
            Approve
          </button>

          <button
            disabled={loading}
            onClick={() => rejectRegular(regular)}
            className="flex-1 rounded-xl bg-red-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <X className="mr-1 inline h-4 w-4" />
            Reject
          </button>
        </>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-black px-4 pb-24 pt-4 text-white">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-sm text-gray-400">Phone Admin</p>
        </div>

        <button
          onClick={loadApplications}
          disabled={loading}
          className="rounded-xl bg-white/10 p-3 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-5 w-5 ${
              loading ? 'animate-spin' : ''
            }`}
          />
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search applications..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white outline-none"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {(
          [
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['attorney', 'Attorney'],
            ['prosecutor', 'Prosecutor'],
            ['auctioneer', 'Auctioneer'],
            ['fastpay', 'FastPay'],
            ['jobs', 'Jobs'],
            ['careers', 'Careers'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              tab === value
                ? 'bg-[#00BFFF] text-black'
                : 'bg-white/10 text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && visible.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-6 text-center text-gray-400">
            Loading applications...
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-8 text-center text-gray-400">
            No applications found.
          </div>
        ) : (
          visible.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">
                    {app.user_profiles?.username ||
                      'Unknown User'}
                  </h2>

                  <p className="text-xs text-gray-400">
                    {app.user_profiles?.email || 'No email'}
                  </p>
                </div>

                <ChevronRight className="h-5 w-5 text-gray-500" />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {app.id.slice(0, 8)}
                </span>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {app.status}
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                {new Date(app.created_at).toLocaleString()}
              </p>

              <div className="mt-4 flex gap-2">
                {renderActions(app)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}