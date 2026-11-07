import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { Shield, Users, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import ClickableUsername from '../components/ClickableUsername'

export default function RolesManager() {
  const { profile, refreshProfile } = useAuthStore()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const isAdmin = !!profile && (profile.role === 'admin' || profile.is_admin)
  const [roleBonuses, setRoleBonuses] = useState<Record<string, boolean>>({})

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, role, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // Empty useEffect since we moved the logic to the combined useEffect below

  const updateUserRole = async (id: string, role: string) => {
    setUpdating(id)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role })
        .eq('id', id)

      if (error) throw error
      toast.success('Role updated successfully')
      if (profile?.id === id) {
        try {
          await refreshProfile()
        } catch (refreshError) {
          console.warn('Unable to refresh current profile after role update', refreshError)
        }
      }
      await loadUsers()
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdating(null)
    }
  }

  const roles = [
    { id: 'admin', label: 'Admin' },
    { id: 'troll_officer', label: 'Troll Officer' },
    { id: 'broadcaster', label: 'Broadcaster' },
    { id: 'member', label: 'Member' }
  ]

  const roleBonusesConfig = {
    'troll_officer': 10,
    'broadcaster': 5,
    'member': 0
  }

  const toggleRoleBonus = async (roleId: string, isActive: boolean) => {
    try {
      // Update the role bonus status in the database
      const { error } = await supabase
        .from('role_bonuses')
        .upsert({
          role: roleId,
          is_active: isActive,
          bonus_percentage: roleBonusesConfig[roleId as keyof typeof roleBonusesConfig]
        })

      if (error) throw error

      // Update local state
      setRoleBonuses(prev => ({ ...prev, [roleId]: isActive }))
      
      toast.success(`Role bonus ${isActive ? 'activated' : 'deactivated'} for ${roleId}`)
    } catch (err) {
      console.error('Error updating role bonus:', err)
      toast.error('Failed to update role bonus')
    }
  }

  const loadRoleBonuses = async () => {
    try {
      const { data, error } = await supabase
        .from('role_bonuses')
        .select('role, is_active')

      if (error) throw error

      const bonusesMap = data?.reduce((acc, item) => {
        acc[item.role] = item.is_active
        return acc
      }, {} as Record<string, boolean>) || {}

      setRoleBonuses(bonusesMap)
    } catch (err) {
      console.error('Error loading role bonuses:', err)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
      loadRoleBonuses()
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center text-white">
        <p>Access Restricted: Admins Only</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Role Management</h1>
            <p className="text-gray-400">Assign roles and manage permissions</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="px-4 py-2 flex items-center gap-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C]">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-purple-400 w-6 h-6" />
            <h2 className="text-xl font-bold">Users & Roles</h2>
          </div>

          {loading ? (
            <p className="text-gray-400">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-400">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-[#2C2C2C]">
                    <th className="px-3 py-3">Username</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Current Role</th>
                    <th className="px-3 py-3">Change Role</th>
                    <th className="px-3 py-3">Role Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[#2C2C2C] hover:bg-[#2C2C2C] transition">
                      <td className="px-3 py-3 text-white">
                        <ClickableUsername username={u.username} className="text-white" />
                      </td>
                      <td className="px-3 py-3 text-gray-300">{u.email || 'N/A'}</td>
                      <td className="px-3 py-3">
                        <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs">
                          {u.role || 'member'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          {roles.map((r) => (
                            <button
                              key={r.id}
                              disabled={updating === u.id}
                              onClick={() => updateUserRole(u.id, r.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                u.role === r.id
                                  ? 'bg-green-600 text-white'
                                  : 'bg-[#2C2C2C] text-gray-300 hover:bg-purple-700 hover:text-white'
                              }`}
                            >
                              {updating === u.id ? 'Updating...' : r.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {u.role && roleBonusesConfig[u.role as keyof typeof roleBonusesConfig] > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {roleBonuses[u.role] ? 'Active' : 'Inactive'} ({roleBonusesConfig[u.role as keyof typeof roleBonusesConfig]}%)
                            </span>
                            <button
                              onClick={() => toggleRoleBonus(u.role, !roleBonuses[u.role])}
                              className={`px-2 py-1 rounded text-xs ${
                                roleBonuses[u.role]
                                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                  : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                              }`}
                            >
                              {roleBonuses[u.role] ? (
                                <>
                                  <XCircle className="w-3 h-3 inline" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3 h-3 inline" /> Activate
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
