import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { toast } from 'sonner'
import { ArrowLeft, Search, UserPlus, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ArtistStaffSearchResult } from '@/services/maiRecordLabel'

const POSITIONS: Record<string, string> = {
  manager: 'Manager',
  social_media_manager: 'Social Media Manager',
  promoter: 'Promoter',
  marketing_manager: 'Marketing Manager',
  booking_manager: 'Booking Manager',
  assistant: 'Assistant',
  publicist: 'Publicist',
  road_manager: 'Road Manager',
  content_manager: 'Content Manager',
  custom: 'Custom',
}

export default function ArtistStaffHirePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [artistId, setArtistId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<ArtistStaffSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<ArtistStaffSearchResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [position, setPosition] = useState('')
  const [customPosition, setCustomPosition] = useState('')
  const [payType, setPayType] = useState('fixed')
  const [payAmount, setPayAmount] = useState('')
  const [payFrequency, setPayFrequency] = useState('monthly')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')

  const loadArtist = useCallback(async () => {
    if (!user?.id) return
    const artistResult = await recordLabelService.getArtistProfileByUserId(user.id)
    const artist = artistResult.data
    if (!artist) {
      toast.error('You must be an approved MAI artist to hire staff.')
      navigate('/mai-record-label', { replace: true })
      return
    }
    setArtistId(artist.id)
  }, [user?.id, navigate])

  useEffect(() => {
    loadArtist()
  }, [loadArtist])

  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (!artistId || search.trim().length < 2) {
        setCandidates([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const result = await recordLabelService.searchArtistStaffCandidates({
          artistId,
          search: search.trim(),
          limit: 20,
        })

        if (result.error) throw result.error
        setCandidates(result.data || [])
      } catch (error: any) {
        console.error('[HireStaff] Search failed:', error)
        toast.error(error?.message || 'Failed to search users.')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounce)
  }, [artistId, search])

  const handleSelectUser = (candidate: ArtistStaffSearchResult) => {
    setSelectedUser(candidate)
    setSearch('')
    setCandidates([])
  }

  const handlePositionChange = (value: string) => {
    setPosition(value)
    if (value !== 'custom') {
      setCustomPosition('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!artistId || !selectedUser) return

    const finalPosition = position === 'custom' ? customPosition.trim() : position
    if (!finalPosition) {
      toast.error('Please select or enter a position.')
      return
    }

    const amount = parseInt(payAmount, 10)
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid pay amount.')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await recordLabelService.createArtistStaffOffer({
        artistId,
        employeeUserId: selectedUser.user_id,
        position: finalPosition,
        payType,
        payAmount: amount,
        payFrequency,
        permissions,
        notes: notes || undefined,
      })

      if (error) throw error

      toast.success(`Employment offer sent to ${selectedUser.display_name || selectedUser.username}!`)
      navigate('/artist/dashboard/staff')
    } catch (error: any) {
      console.error('[HireStaff] Failed:', error)
      toast.error(error?.message || 'Failed to send offer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => navigate('/artist/dashboard/staff')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to Team
        </button>

        <div className="mb-8 text-center">
          <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
            MAI Entertainment
          </span>
          <h1 className="text-3xl font-black md:text-4xl">Hire Your Team</h1>
          <p className={`mt-2 ${MaiTrollTheme.text.muted}`}>
            Build your artist team by hiring trusted MaiTroll users.
          </p>
        </div>

        {!selectedUser ? (
          <Card className="bg-[#141414] border-[#2C2C2C]">
            <CardHeader>
              <CardTitle>Search for a Team Member</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username or display name..."
                  className="pl-10 bg-black/30 border-[#2C2C2C] text-white"
                />
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              )}

              {!loading && candidates.length === 0 && search.trim().length >= 2 && (
                <p className="text-center text-gray-400 py-8">No users found.</p>
              )}

              <div className="mt-4 space-y-2">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.user_id}
                    onClick={() => handleSelectUser(candidate)}
                    className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-[#2C2C2C] cursor-pointer hover:border-purple-500/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-300">
                        {(candidate.display_name || candidate.username || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{candidate.display_name || candidate.username}</p>
                        <p className="text-sm text-gray-400">@{candidate.username}</p>
                      </div>
                    </div>
                    <Button size="sm" className={MaiTrollTheme.components.buttonPrimary}>
                      <UserPlus className="w-4 h-4 mr-1" />
                      Hire
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit}>
            <Card className="bg-[#141414] border-[#2C2C2C] mb-6">
              <CardHeader>
                <CardTitle>Hire {selectedUser.display_name || selectedUser.username}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-[#2C2C2C]">
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg text-gray-300">
                    {(selectedUser.display_name || selectedUser.username || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white">{selectedUser.display_name || selectedUser.username}</p>
                    <p className="text-sm text-gray-400">@{selectedUser.username}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <select
                    id="position"
                    value={position}
                    onChange={(e) => handlePositionChange(e.target.value)}
                    className="w-full rounded-lg border border-[#2C2C2C] bg-black/30 px-3 py-2 text-white"
                  >
                    <option value="">Select a position...</option>
                    {Object.entries(POSITIONS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  {position === 'custom' && (
                    <Input
                      value={customPosition}
                      onChange={(e) => setCustomPosition(e.target.value)}
                      placeholder="Enter custom position title..."
                      className="bg-black/30 border-[#2C2C2C] text-white"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payType">Pay Type</Label>
                    <select
                      id="payType"
                      value={payType}
                      onChange={(e) => setPayType(e.target.value)}
                      className="w-full rounded-lg border border-[#2C2C2C] bg-black/30 px-3 py-2 text-white"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="hourly">Hourly</option>
                      <option value="commission">Commission</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payAmount">Pay Amount</Label>
                    <Input
                      id="payAmount"
                      type="number"
                      min="0"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0"
                      className="bg-black/30 border-[#2C2C2C] text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payFrequency">Pay Frequency</Label>
                    <select
                      id="payFrequency"
                      value={payFrequency}
                      onChange={(e) => setPayFrequency(e.target.value)}
                      className="w-full rounded-lg border border-[#2C2C2C] bg-black/30 px-3 py-2 text-white"
                    >
                      <option value="one_time">One Time</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="per_release">Per Release</option>
                      <option value="per_post">Per Post</option>
                      <option value="commission">Commission</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <p className="text-xs text-gray-400 mb-2">
                    Only grant permissions this team member needs. Financial and team-management permissions should be limited to trusted staff.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries({
                      Content: ['create_posts', 'edit_posts', 'delete_posts', 'schedule_posts', 'manage_artist_media'],
                      Music: ['view_music', 'manage_tracks', 'manage_albums', 'promote_music'],
                      Analytics: ['view_artist_analytics'],
                      Events: ['manage_events', 'manage_bookings'],
                      Team: ['view_staff', 'hire_staff', 'edit_staff', 'suspend_staff', 'terminate_staff'],
                      Financial: ['view_artist_earnings'],
                    }).map(([category, perms]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{category}</p>
                        {perms.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!permissions[perm]}
                              onChange={() => togglePermission(perm)}
                              className="rounded border-gray-600 bg-black/30 text-purple-500 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-300">{perm.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-[#2C2C2C] bg-black/30 px-3 py-2 text-white"
                    placeholder="Add any notes about this position..."
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={submitting}
                  className={`${MaiTrollTheme.components.buttonPrimary} w-full`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Offer...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Send Employment Offer
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}
      </div>
    </div>
  )
}
