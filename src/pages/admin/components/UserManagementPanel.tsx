import React, { useState, useEffect, useCallback } from 'react'
import { supabase, UserProfile } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { User, Coins, Award, Shield, Save, X, Search } from 'lucide-react'
import UserNameWithAge from '../../../components/UserNameWithAge'
import UserDetailsModal from '../../../components/admin/UserDetailsModal'

interface UserManagementPanelProps {
  title?: string
  description?: string
}

interface ReviewAccountAuditRow {
  user_id: string
  status: 'active' | 'deletion_pending' | 'deleted'
  activated_at: string
  expires_at: string
  deleted_at: string | null
  deletion_attempts: number
}

export default function UserManagementPanel({
  title = 'User Management',
  description
}: UserManagementPanelProps) {
  const { profile: adminProfile, user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [editingCoins, setEditingCoins] = useState({ trollCoins: 0, trollmonds: 0 })
  const [editingLevel, setEditingLevel] = useState(1)
  const [editingRole, setEditingRole] = useState('user')
  const [editingBypassBroadcast, setEditingBypassBroadcast] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewingUser, setViewingUser] = useState<{ id: string; username: string } | null>(null)
  const [notifying, setNotifying] = useState(false)
  const [reviewAudit, setReviewAudit] = useState<ReviewAccountAuditRow[]>([])
  const [now, setNow] = useState(Date.now())
  const [showCreateReviewAccount, setShowCreateReviewAccount] = useState(false)
  const [reviewAccountForm, setReviewAccountForm] = useState({ email: '', username: '', password: '' })
  const [creatingReviewAccount, setCreatingReviewAccount] = useState(false)

  const canViewEmails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true
  const canViewDetails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true || adminProfile?.role === 'secretary'
  const canCreateReviewAccount = adminProfile?.role === 'admin' || adminProfile?.is_admin === true

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'get_users',
          limit: 200
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      const { data: auditData, error: auditError } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_temporary_review_account_audit' }
      })
      if (auditError) throw auditError
      if (auditData?.error) throw new Error(auditData.error)

      setUsers((data.data as UserProfile[]) || [])
      setReviewAudit((auditData.data as ReviewAccountAuditRow[]) || [])
    } catch (error: unknown) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    loadUsers()

    // Polling every 30s instead of global subscription
    const interval = setInterval(() => {
      loadUsers()
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [loadUsers])

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user)
    setEditingCoins({ trollCoins: user.troll_coins || 0, trollmonds: user.trollmonds || 0 })
    setEditingLevel(user.level || 1)
    setEditingRole(user.role || 'user')
    setEditingBypassBroadcast(user.bypass_broadcast_restriction || false)
  }

  const handleSaveChanges = async () => {
    if (!selectedUser || !adminProfile) {
      toast.error('No user selected')
      return
    }

    // Verify admin
    if (adminProfile.role !== 'admin' && !adminProfile.is_admin) {
      toast.error('Admin access required')
      return
    }

    // PROTECT OWNER ADMIN ACCOUNT
    const OWNER_EMAIL = 'trollcity2025@gmail.com'
    const isTargetOwner = selectedUser.email?.toLowerCase() === OWNER_EMAIL
    const isCurrentOwner = currentUser?.email?.toLowerCase() === OWNER_EMAIL

    if (isTargetOwner && !isCurrentOwner) {
      // Prevent removing admin role from owner
      if (editingRole !== 'admin') {
        toast.error('CRITICAL: You cannot remove Admin privileges from the Owner account.')
        return
      }
    }

    setSaving(true)
    try {
      // 1. Prepare data
      const currentTrollCoins = selectedUser.troll_coins || 0
      const delta = editingCoins.trollCoins - currentTrollCoins
      if (!Number.isSafeInteger(editingCoins.trollCoins)
        || editingCoins.trollCoins < 0
        || !Number.isSafeInteger(editingCoins.trollmonds)
        || editingCoins.trollmonds < 0) {
        toast.error('Balances must be whole numbers within the supported range')
        return
      }

      const updates: any = {
        level: editingLevel,
        bypass_broadcast_restriction: editingBypassBroadcast
      }

      const roleUpdate = editingRole !== selectedUser.role ? {
        newRole: editingRole,
        reason: `Admin panel update by ${adminProfile.username}`
      } : undefined

      const coinAdjustment = delta !== 0 ? {
        amount: delta,
        reason: 'Manual Troll Coins Adjustment'
      } : undefined

      // 2. Call Edge Function
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update_user_profile',
          userId: selectedUser.id,
          updates,
          roleUpdate,
          coinAdjustment,
          trollmonds: editingCoins.trollmonds !== (selectedUser.trollmonds || 0)
            ? editingCoins.trollmonds
            : undefined
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('User updated successfully')
      setSelectedUser(null)
      loadUsers()
    } catch (error: unknown) {
      console.error('Error updating user:', error)
      toast.error((error as Error)?.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateReviewAccount = async () => {
    if (!canCreateReviewAccount) {
      toast.error('Admin access required')
      return
    }

    setCreatingReviewAccount(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'create_temporary_review_account',
          ...reviewAccountForm
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success(`Temporary review access created; expires at ${new Date(data.expiresAt).toLocaleTimeString()}`)
      setShowCreateReviewAccount(false)
      setReviewAccountForm({ email: '', username: '', password: '' })
      await loadUsers()
    } catch (error: unknown) {
      console.error('Error creating temporary review account:', error)
      toast.error((error as Error)?.message || 'Failed to create temporary review account')
    } finally {
      setCreatingReviewAccount(false)
    }
  }

  const getReviewStatus = (user: UserProfile) => {
    if (!user.is_temporary_review_account) return null
    if (user.temporary_review_status === 'deletion_pending') return 'deletion_pending'
    if (!user.temporary_review_expires_at || new Date(user.temporary_review_expires_at).getTime() <= now) {
      return 'expired'
    }
    return 'active'
  }

  const formatCountdown = (expiresAt: string) => {
    const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000))
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':')
  }

  const reviewStatusLabel = (status: ReviewAccountAuditRow['status'] | 'expired') => ({
    active: 'Active',
    expired: 'Expired',
    deletion_pending: 'Deletion Pending',
    deleted: 'Deleted'
  })[status]

  const filteredUsers = users.filter(user => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        user.username?.toLowerCase().includes(search) ||
        (canViewEmails && user.email?.toLowerCase().includes(search)) ||
        user.id.toLowerCase().includes(search)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
  <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          {title}
        </h2>
        {description && (
          <p className="text-sm text-gray-400">{description}</p>
        )}
      </div>

      {canViewDetails && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              if (!adminProfile) {
                toast.error('Profile required')
                return
              }
              if (!(adminProfile.role === 'admin' || adminProfile.is_admin || adminProfile.role === 'secretary')) {
                toast.error('Admin or secretary access required')
                return
              }

              setNotifying(true)
              try {
                const buildMissing = (u: UserProfile) => {
                  const items: string[] = []
                  if (!u.full_name) items.push('Full name')
                  if (!u.phone) items.push('Phone number')
                  if (!u.onboarding_completed) items.push('Onboarding')
                  if (!u.terms_accepted) items.push('Terms acceptance')
                  if (u.id_verification_status !== 'approved') items.push('ID verification')
                  return items
                }

                const targets = users
                  .map(u => ({ user: u, missing: buildMissing(u) }))
                  .filter(({ missing }) => missing.length > 0)

                if (targets.length === 0) {
                  toast.info('All users are complete—no notifications sent')
                  return
                }

                let sent = 0
                for (const { user: u, missing } of targets) {
                  const { error } = await supabase.functions.invoke('admin-actions', {
                    body: {
                      action: 'notify_user',
                      targetUserId: u.id,
                      title: 'Complete your account',
                      message: `Please complete the following: ${missing.join(', ')}.`
                    }
                  })
                  if (!error) {
                    sent += 1
                  } else {
                    console.warn('Notify user failed', { userId: u.id, error })
                  }
                }

                toast.success(`Notified ${sent} user(s) with missing items`)
              } catch (err) {
                console.error('Notify incomplete users failed', err)
                toast.error('Failed to send notifications')
              } finally {
                setNotifying(false)
              }
            }}
            disabled={notifying}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {notifying ? 'Sending...' : 'Notify users with missing items'}
          </button>
        </div>
      )}

      {canCreateReviewAccount && (
        <button
          onClick={() => setShowCreateReviewAccount(true)}
          className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg text-sm font-semibold"
        >
          Create 60-minute review account
        </button>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={canViewEmails ? "Search by username, email, or ID..." : "Search by username or ID..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No users found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-semibold">Username</th>
                {canViewEmails && (
                  <th className="pb-3 text-gray-400 font-semibold">Email</th>
                )}
                <th className="pb-3 text-gray-400 font-semibold">Role</th>
                <th className="pb-3 text-gray-400 font-semibold">Level</th>
                <th className="pb-3 text-gray-400 font-semibold">Troll Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Trollmonds</th>
                <th className="pb-3 text-gray-400 font-semibold">Review Access</th>
                <th className="pb-3 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-800 last:border-0"
                >
                  <td className="py-3">
                    {canViewDetails ? (
                      <UserNameWithAge
                        user={user}
                        className="text-white hover:text-purple-400 font-medium underline transition-colors"
                        onClick={() => setViewingUser({ id: user.id, username: user.username })}
                        showBadges={false}
                      />
                    ) : (
                      <UserNameWithAge
                        user={user}
                        className="text-white hover:text-purple-400"
                        showBadges={false}
                      />
                    )}
                  </td>
                  {canViewEmails && (
                    <td className="py-3 text-gray-400 text-sm">{user.email}</td>
                  )}
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      (user.is_lead_officer || user.role === 'lead_troll_officer')
                        ? 'bg-amber-900 text-amber-300'
                        : user.role === 'admin'
                        ? 'bg-red-900 text-red-300'
                        : user.role === 'troll_officer'
                        ? 'bg-purple-900 text-purple-300'
                        : user.role === 'troller'
                        ? 'bg-blue-900 text-blue-300'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {(user.is_lead_officer || user.role === 'lead_troll_officer') ? 'lead_troll_officer' : (user.role === 'admin' ? 'CEO' : (user.role || 'user'))}
                    </span>
                  </td>
                  <td className="py-3 text-white">{user.level || 1}</td>
                  <td className="py-3 text-purple-300">{user.troll_coins?.toLocaleString() || 0}</td>
                  <td className="py-3 text-amber-200">{user.trollmonds?.toLocaleString() || 0}</td>
                  <td className="py-3">
                    {(() => {
                      const status = getReviewStatus(user)
                      if (!status) return <span className="text-gray-500">—</span>
                      return (
                        <span className={`text-xs ${status === 'active' ? 'text-emerald-300' : status === 'deletion_pending' ? 'text-amber-300' : 'text-red-300'}`}>
                          {reviewStatusLabel(status)}
                          {status === 'active' && user.temporary_review_expires_at
                            ? ` · ${formatCountdown(user.temporary_review_expires_at)}`
                            : ''}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="py-3">
                    {!user.is_temporary_review_account && (
                      <button
                        onClick={() => handleEditUser(user)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewAudit.length > 0 && (
        <section className="space-y-3 rounded-xl border border-gray-800 bg-zinc-900/60 p-4">
          <h3 className="text-lg font-semibold text-white">Temporary Review Account Audit</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Expires</th>
                  <th className="py-2">Deletion Attempts</th>
                </tr>
              </thead>
              <tbody>
                {reviewAudit.map((audit) => {
                  const status = audit.status === 'active' && new Date(audit.expires_at).getTime() <= now
                    ? 'expired'
                    : audit.status
                  return (
                    <tr key={audit.user_id} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 font-mono text-gray-300">{audit.user_id.slice(0, 8)}…</td>
                      <td className="py-2 pr-4 text-gray-200">{reviewStatusLabel(status)}</td>
                      <td className="py-2 pr-4 text-gray-400">{new Date(audit.expires_at).toLocaleString()}</td>
                      <td className="py-2 text-gray-400">{audit.deletion_attempts}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showCreateReviewAccount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <section className="w-full max-w-lg space-y-4 rounded-xl border border-amber-500/40 bg-zinc-950 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Create Temporary Review Account</h3>
              <button
                onClick={() => setShowCreateReviewAccount(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400">
              This creates a new, read-only account with exactly 60 minutes of access. Existing accounts cannot be converted.
            </p>
            <input
              type="email"
              autoComplete="off"
              placeholder="Email"
              value={reviewAccountForm.email}
              onChange={(event) => setReviewAccountForm({ ...reviewAccountForm, email: event.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-zinc-900 px-4 py-2 text-white"
            />
            <input
              type="text"
              autoComplete="off"
              placeholder="Username"
              value={reviewAccountForm.username}
              onChange={(event) => setReviewAccountForm({ ...reviewAccountForm, username: event.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-zinc-900 px-4 py-2 text-white"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Temporary password (12 characters minimum)"
              value={reviewAccountForm.password}
              onChange={(event) => setReviewAccountForm({ ...reviewAccountForm, password: event.target.value })}
              className="w-full rounded-lg border border-gray-700 bg-zinc-900 px-4 py-2 text-white"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreateReviewAccount}
                disabled={creatingReviewAccount || !reviewAccountForm.email || !reviewAccountForm.username || reviewAccountForm.password.length < 12}
                className="flex-1 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {creatingReviewAccount ? 'Creating…' : 'Create and activate'}
              </button>
              <button
                onClick={() => setShowCreateReviewAccount(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 font-semibold text-white"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Edit User: {selectedUser.username}</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Coins */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Coins className="w-4 h-4 inline mr-1" />
                  Troll Coins
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCoins.trollCoins}
                  onChange={(e) => setEditingCoins({ ...editingCoins, trollCoins: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Coins className="w-4 h-4 inline mr-1" />
                  Trollmonds
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCoins.trollmonds}
                  onChange={(e) => setEditingCoins({ ...editingCoins, trollmonds: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Award className="w-4 h-4 inline mr-1" />
                  Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingLevel}
                  onChange={(e) => setEditingLevel(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Role
                </label>
                <select
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    <option value="user">User</option>
                  <option value="guest">Guest</option>
                  <option value="member">Member</option>
                  <option value="broadcaster">Broadcaster</option>
                  <option value="family_leader">Family Leader</option>
                  <option value="troll_family">Troll Family</option>
                  <option value="secretary">Secretary</option>
                  <option value="moderator">Moderator</option>
                  <option value="troll_officer">Troll Officer</option>
                  <option value="lead_troll_officer">Lead Troll Officer</option>
                  <option value="troller">Troller</option>
                  <option value="admin">CEO</option>
                  <option value="empire_partner">Empire Partner</option>
                  <option value="hr_admin">HR Admin</option>
                </select>
              </div>

              {/* Broadcast Bypass */}
              <div className="flex items-center gap-3 bg-zinc-800 p-3 rounded-lg border border-gray-700">
                <input
                  type="checkbox"
                  id="bypassBroadcast"
                  checked={editingBypassBroadcast}
                  onChange={(e) => setEditingBypassBroadcast(e.target.checked)}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 bg-gray-700 border-gray-600"
                />
                <label htmlFor="bypassBroadcast" className="text-sm font-semibold text-gray-300 cursor-pointer select-none">
                  Bypass 24h Broadcast Restriction
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {viewingUser && (
        <UserDetailsModal
          userId={viewingUser.id}
          username={viewingUser.username}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  )
}
