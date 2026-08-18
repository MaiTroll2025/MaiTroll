import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import {
  Users,
  UserPlus,
  Wallet,
  TrendingUp,
  Loader2,
  ArrowLeft,
  Settings,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ArtistStaffMembershipResult, ArtistStaffDashboardResult } from '@/services/maiRecordLabel'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  suspended: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-300 border-red-500/30',
  declined: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  expired: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

export default function ArtistStaffDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<ArtistStaffMembershipResult[]>([])
  const [dashboard, setDashboard] = useState<ArtistStaffDashboardResult | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const artistResult = await recordLabelService.getArtistProfileByUserId(user.id)
      const artist = artistResult.data

      if (!artist) {
        toast.error('You must be an approved MAI artist to view this page.')
        navigate('/mai-record-label', { replace: true })
        return
      }

      const artistIdValue = artist.id

      const [staffResult, dashboardResult] = await Promise.all([
        recordLabelService.getArtistStaff({ artistId: artistIdValue }),
        recordLabelService.getArtistStaffDashboard({ artistId: artistIdValue }),
      ])

      if (staffResult.error) throw staffResult.error
      if (dashboardResult.error) throw dashboardResult.error

      setStaff(staffResult.data || [])
      setDashboard(dashboardResult.data || null)
    } catch (error: any) {
      console.error('[ArtistStaffDashboard] Failed to load:', error)
      toast.error(error?.message || 'Failed to load staff data.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, navigate])

  useEffect(() => {
    load()
  }, [load])

  const activeStaff = useMemo(() => staff.filter((s) => s.status === 'active'), [staff])
  const pendingStaff = useMemo(() => staff.filter((s) => s.status === 'pending'), [staff])
  const suspendedStaff = useMemo(() => staff.filter((s) => s.status === 'suspended'), [staff])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-cyan-400" />
          <p className="text-lg text-slate-300">Loading your team...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => navigate('/artist/dashboard')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="mb-8 text-center">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
            MAI Entertainment
          </span>
          <h1 className="text-3xl font-black md:text-4xl">Artist Team</h1>
          <p className={`mt-2 ${MaiTrollTheme.text.muted}`}>
            Manage your staff, permissions, and payroll
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20 text-green-300">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Team Members</p>
                <p className="text-2xl font-bold text-white">{dashboard?.active_count || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-300">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pending Offers</p>
                <p className="text-2xl font-bold text-white">{dashboard?.pending_count || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-300">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Monthly Staff Cost</p>
                <p className="text-2xl font-bold text-white">{(dashboard?.monthly_cost || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20 text-purple-300">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Roles</p>
                <p className="text-2xl font-bold text-white">
                  {dashboard?.active_positions?.length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mb-6">
          <Button
            onClick={() => navigate('/artist/dashboard/staff/hire')}
            className={MaiTrollTheme.components.buttonPrimary}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Hire Staff
          </Button>
        </div>

        {activeStaff.length === 0 && pendingStaff.length === 0 && suspendedStaff.length === 0 ? (
          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardContent className="py-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-lg">Your team is empty.</p>
              <p className="text-sm mt-2">
                Build your team by hiring trusted MaiTroll users to help grow your music career.
              </p>
              <Button
                onClick={() => navigate('/artist/dashboard/staff/hire')}
                className={`${MaiTrollTheme.components.buttonPrimary} mt-4`}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Hire Your First Team Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {pendingStaff.length > 0 && (
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle className="text-yellow-400">Pending Offers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingStaff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-[#2C2C2C]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-300">
                            {(member.employee_display_name || member.employee_username || '?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{member.employee_display_name || member.employee_username}</p>
                            <p className="text-sm text-gray-400">@{member.employee_username} · {member.position}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={STATUS_COLORS[member.status] || 'border-gray-500 text-gray-300'}>
                            {member.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/artist/dashboard/staff/${member.id}`)}
                            className="text-gray-300 hover:text-white"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeStaff.length > 0 && (
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle className="text-green-400">Active Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeStaff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-[#2C2C2C]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-300">
                            {(member.employee_display_name || member.employee_username || '?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{member.employee_display_name || member.employee_username}</p>
                            <p className="text-sm text-gray-400">
                              @{member.employee_username} · {member.position} · {member.pay_amount.toLocaleString()} {member.pay_currency} / {member.pay_frequency}
                            </p>
                            <p className="text-xs text-gray-500">
                              Started {formatDate(member.accepted_at || member.start_date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={STATUS_COLORS[member.status] || 'border-gray-500 text-gray-300'}>
                            {member.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/artist/dashboard/staff/${member.id}`)}
                            className="text-gray-300 hover:text-white"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {suspendedStaff.length > 0 && (
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle className="text-orange-400">Suspended Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {suspendedStaff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-[#2C2C2C]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-300">
                            {(member.employee_display_name || member.employee_username || '?')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{member.employee_display_name || member.employee_username}</p>
                            <p className="text-sm text-gray-400">@{member.employee_username} · {member.position}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={STATUS_COLORS[member.status] || 'border-gray-500 text-gray-300'}>
                            {member.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/artist/dashboard/staff/${member.id}`)}
                            className="text-gray-300 hover:text-white"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
