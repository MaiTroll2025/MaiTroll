import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import { Loader2, Briefcase, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  suspended: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-300 border-red-500/30',
  declined: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  expired: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

export default function ArtistStaffJobsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { data, error } = await recordLabelService.getMyArtistStaffJobs()
      if (error) throw error
      setJobs(data || [])
    } catch (error: any) {
      console.error('[StaffJobs] Failed:', error)
      toast.error(error?.message || 'Failed to load staff jobs.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const handleRespond = async (membershipId: string, accept: boolean) => {
    try {
      const { error } = await recordLabelService.respondToArtistStaffOffer({ membershipId, accept })
      if (error) throw error
      toast.success(accept ? 'Offer accepted!' : 'Offer declined.')
      load()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to respond to offer.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
          <p className="text-lg text-slate-300">Loading your jobs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="mb-8 text-center">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
            MAI Entertainment
          </span>
          <h1 className="text-3xl font-black md:text-4xl">Artist Jobs</h1>
          <p className={`mt-2 ${MaiTrollTheme.text.muted}`}>
            View and manage your artist staff positions
          </p>
        </div>

        {jobs.length === 0 ? (
          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardContent className="py-12 text-center text-gray-400">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-lg">You don&apos;t have any artist staff positions yet.</p>
              <p className="text-sm mt-2">
                When an artist offers you a position, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="bg-[#141414] border-[#2C2C2C]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-lg text-purple-300 font-bold">
                        {(job.artist_stage_name || 'A')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{job.artist_stage_name}</p>
                        <p className="text-sm text-gray-400">{job.position}</p>
                        <p className="text-sm text-gray-400">
                          {job.pay_amount.toLocaleString()} {job.pay_currency} / {job.pay_frequency}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_COLORS[job.status] || 'border-gray-500 text-gray-300'}>
                        {job.status}
                      </Badge>
                      {job.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleRespond(job.id, true)}
                            className="bg-green-600 hover:bg-green-500"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRespond(job.id, false)}
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                      {job.status === 'active' && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/artist/staff/workspace/${job.artist_id}`)}
                          className={MaiTrollTheme.components.buttonPrimary}
                        >
                          Open Workspace
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
