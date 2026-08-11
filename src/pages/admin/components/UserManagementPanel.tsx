import React, { useState, useEffect, useCallback } from 'react'
import { supabase, UserProfile } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import { toast } from 'sonner'
import { User, Coins, Award, Shield, Save, X, Search, Plus, Trash2, Eye } from 'lucide-react'
import UserNameWithAge from '../../../components/UserNameWithAge'
import UserDetailsModal from '../../../components/admin/UserDetailsModal'

interface UserManagementPanelProps {
  title?: string
  description?: string
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
  const [editingCoins, setEditingCoins] = useState({ paid: 0, free: 0 })
  const [editingLevel, setEditingLevel] = useState(1)
  const [editingRole, setEditingRole] = useState('user')
  const [editingBypassBroadcast, setEditingBypassBroadcast] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewingUser, setViewingUser] = useState<{ id: string; username: string } | null>(null)
  const [notifying, setNotifying] = useState(false)

  // Marketing Users Management - Always loaded for admins
  const [marketingUsers, setMarketingUsers] = useState<UserProfile[]>([])
  const [newMarketingEmail, setNewMarketingEmail] = useState('')
  const [newMarketingUsername, setNewMarketingUsername] = useState('')
  const [newMarketingPassword, setNewMarketingPassword] = useState('')
  const [creatingMarketing, setCreatingMarketing] = useState(false)
  const [searchResults, setSearchResults] = useState<{id: string, username: string}[]>([])
  const [searching, setSearching] = useState(false)

  const canViewEmails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true
  const canViewDetails = adminProfile?.role === 'admin' || adminProfile?.is_admin === true || adminProfile?.role === 'secretary'

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
      
      setUsers((data.data as UserProfile[]) || [])
    } catch (error: unknown) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    loadMarketingUsers()

    // Polling every 30s instead of global subscription
    const interval = setInterval(() => {
      loadUsers()
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [loadUsers])

  // Load marketing users
  const loadMarketingUsers = useCallback(async () => {
    try {
      // Direct SQL query - no edge function needed
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, bio, role, created_at')
        .eq('role', 'marketing_readonly')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setMarketingUsers((data as UserProfile[]) || [])
    } catch (error) {
      console.error('Error loading marketing users:', error)
    }
  }, [])

  // Create NEW marketing account via edge function (creates auth + profile)
  const handleCreateNewMarketing = async () => {
    if (!newMarketingEmail || !newMarketingUsername) {
      toast.error('Username and email required')
      return
    }
    if (!newMarketingEmail.includes('@')) {
      toast.error('Invalid email format')
      return
    }

    setCreatingMarketing(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'create_marketing_user',
          email: newMarketingEmail,
          username: newMarketingUsername,
          password: newMarketingPassword || undefined
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      const pwd = newMarketingPassword || (data as any)?.password
      toast.success(`Marketing account created: ${newMarketingUsername}${pwd ? ` (password: ${pwd})` : ''}`)
      if (pwd) {
        toast.info(`Share credentials: ${newMarketingEmail} / ${pwd}`)
      }
      setNewMarketingEmail('')
      setNewMarketingUsername('')
      setNewMarketingPassword('')
      loadMarketingUsers()
    } catch (error) {
      console.error('Error creating marketing:', error)
      toast.error((error as Error)?.message || 'Failed to create account')
    } finally {
      setCreatingMarketing(false)
    }
  }

  // Search for existing users to grant marketing access
  const handleSearchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username')
        .ilike('username', `%${query}%`)
        .eq('role', 'user')
        .limit(10)
      
      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  // Grant marketing access to existing user
  const handleGrantMarketingAccess = async (userId: string, username: string) => {
    setCreatingMarketing(true)
    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role: 'marketing_readonly', bio: 'Marketing Agency Read-Only Account' })
        .eq('id', userId)
        .eq('role', 'user')
      
      if (updateError) throw updateError

      toast.success(`Marketing access granted to ${username}`)
      setSearchResults([])
      setNewMarketingEmail('')
      loadMarketingUsers()
    } catch (error) {
      console.error('Error creating marketing user:', error)
      toast.error((error as Error)?.message || 'Failed to grant marketing access')
    } finally {
      setCreatingMarketing(false)
    }
  }

  // Delete marketing user
  const handleDeleteMarketingUser = async (userId: string) => {
    if (!confirm('Remove marketing access? This will reset user role to user.')) return

    try {
      // Direct SQL update to remove marketing role
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role: 'user', bio: null })
        .eq('id', userId)
        .eq('role', 'marketing_readonly')
      
      if (updateError) throw updateError

      toast.success('Marketing access removed')
      loadMarketingUsers()
    } catch (error) {
      console.error('Error deleting marketing user:', error)
      toast.error((error as Error)?.message || 'Failed to remove marketing access')
    }
  }

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user)
    setEditingCoins({ paid: user.troll_coins || 0 })
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
      const currentPaidCoins = selectedUser.troll_coins || 0
      const newPaidCoins = editingCoins.paid
      const delta = newPaidCoins - currentPaidCoins

      const updates: any = {
        troll_coins: editingCoins.paid,
        level: editingLevel,
        bypass_broadcast_restriction: editingBypassBroadcast
      }

      const roleUpdate = editingRole !== selectedUser.role ? {
        newRole: editingRole,
        reason: `Admin panel update by ${adminProfile.username}`
      } : undefined

      const coinAdjustment = delta !== 0 ? {
        amount: delta,
        reason: 'Manual Adjustment'
      } : undefined

      // 2. Call Edge Function
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update_user_profile',
          userId: selectedUser.id,
          updates,
          roleUpdate,
          coinAdjustment
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

      {/* Marketing User Management Section - Always visible for admins */}
      <div className="bg-zinc-900 border border-amber-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Marketing Read-Only Access
          </h3>
        </div>

        <div className="space-y-4">
            {/* Create NEW Marketing Account */}
            <div className="p-3 bg-zinc-800/50 rounded-lg border border-amber-700/50">
              <h4 className="text-sm font-medium text-amber-400 mb-2">Create New Marketing Account</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Username"
                  value={newMarketingUsername}
                  onChange={(e) => setNewMarketingUsername(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newMarketingEmail}
                  onChange={(e) => setNewMarketingEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newMarketingPassword || ''}
                  onChange={(e) => setNewMarketingPassword(e.target.value)}
                  className="w-24 px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm"
                />
                <button
                  onClick={handleCreateNewMarketing}
                  disabled={creatingMarketing || !newMarketingEmail || !newMarketingUsername}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg text-white text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Creates full account with email/password for login</p>
            </div>

            {/* Grant access to EXISTING user */}
            <div className="relative">
              <input
                type="text"
                placeholder="Or search existing users to grant access..."
                value={searchResults.length === 0 ? newMarketingEmail : ''}
                onChange={(e) => {
                  setNewMarketingEmail(e.target.value)
                  handleSearchUsers(e.target.value)
                }}
                onFocus={() => newMarketingEmail && handleSearchUsers(newMarketingEmail)}
                className="w-full px-3 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white text-sm"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleGrantMarketingAccess(user.id, user.username)}
                      disabled={creatingMarketing}
                      className="w-full px-3 py-2 text-left text-white hover:bg-amber-900/50 text-sm flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      {user.username}
                      <span className="text-xs text-gray-500 ml-auto">Grant Access</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Marketing Users List */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {marketingUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-zinc-800 rounded text-sm">
                  <div>
                    <span className="text-white font-medium">{u.username}</span>
                    <span className="text-gray-400 ml-2">{u.email}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteMarketingUser(u.id)}
                    className="p-1 text-red-400 hover:text-red-300"
                    title="Remove access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {marketingUsers.length === 0 && (
                <p className="text-gray-500 text-sm py-2">No marketing accounts</p>
              )}
            </div>
        </div>
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
                <th className="pb-3 text-gray-400 font-semibold">Paid Coins</th>
                <th className="pb-3 text-gray-400 font-semibold">Free Coins</th>
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
                  <td className="py-3">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  Paid Coins
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCoins.paid}
                  onChange={(e) => setEditingCoins({ ...editingCoins, paid: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <Coins className="w-4 h-4 inline mr-1" />
                  Free Coins
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingCoins.free}
                  onChange={(e) => setEditingCoins({ ...editingCoins, free: parseInt(e.target.value) || 0 })}
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
                  <option value="marketing_readonly">Marketing Read-Only</option>
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

