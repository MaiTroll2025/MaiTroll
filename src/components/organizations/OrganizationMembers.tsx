import React, { useEffect, useState } from 'react'
import { UserPlus, GraduationCap } from 'lucide-react'
import { API_ENDPOINTS, post } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { OrganizationRecord } from '@/hooks/useOrganizations'

interface MemberRow {
  id: string
  org_id: string
  user_id: string
  role: string
  status: string
  created_at: string
}

interface StudentRow {
  id: string
  user_id: string
  student_email?: string | null
  student_name?: string | null
  date_of_birth?: string | null
  status: string
  is_verified_18_plus: boolean
}

export default function OrganizationMembers({ organization, canManage = false }: { organization: OrganizationRecord; canManage?: boolean }) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentName, setStudentName] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [studentDob, setStudentDob] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [{ data: memberData }, { data: studentData }] = await Promise.all([
      supabase.from('organization_members').select('*').eq('org_id', organization.id).order('created_at', { ascending: false }),
      supabase.from('organization_students').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    ])
    setMembers((memberData || []) as MemberRow[])
    setStudents((studentData || []) as StudentRow[])
  }

  useEffect(() => {
    void load()
  }, [organization.id])

  const inviteMember = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      const { data: profile } = await supabase.from('user_profiles').select('id,email').eq('email', email.trim()).maybeSingle()
      if (!profile?.id) {
        toast.error('That user must create a Mai Troll account first')
        return
      }
      const { error } = await supabase.from('organization_members').upsert({
        org_id: organization.id,
        user_id: profile.id,
        role,
        status: 'active',
        joined_at: new Date().toISOString(),
      }, { onConflict: 'org_id,user_id' })
      if (error) throw error
      await supabase.rpc('record_organization_audit', {
        p_org_id: organization.id,
        p_action: 'member_invited',
        p_target_type: 'organization_member',
        p_target_id: profile.id,
        p_metadata: { email, role },
      })
      toast.success('Member added')
      setEmail('')
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const updateMemberStatus = async (member: MemberRow, status: string) => {
    const { error } = await supabase.from('organization_members').update({ status }).eq('id', member.id)
    if (error) {
      toast.error(error.message)
      return
    }
    await supabase.rpc('record_organization_audit', {
      p_org_id: organization.id,
      p_action: status === 'removed' ? 'member_removed' : 'member_updated',
      p_target_type: 'organization_member',
      p_target_id: member.user_id,
      p_metadata: { status },
    })
    await load()
  }

  const createStudent = async () => {
    if (!studentEmail.trim() || !studentName.trim() || !studentPassword || !studentDob) {
      toast.error('Student name, email, password, and date of birth are required')
      return
    }
    setLoading(true)
    try {
      const result = await post(API_ENDPOINTS.auth.createOrgStudent, {
        org_id: organization.id,
        email: studentEmail.trim(),
        password: studentPassword,
        student_name: studentName.trim(),
        date_of_birth: studentDob,
      })
      if (!result.success) {
        toast.error(result.error || 'Failed to create student account')
        return
      }
      toast.success('Student account created')
      setStudentEmail('')
      setStudentName('')
      setStudentPassword('')
      setStudentDob('')
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-2">
      <section className="min-h-0 overflow-y-auto rounded-lg border border-purple-500/20 bg-[#14101f] p-4">
        <h2 className="mb-1 text-sm font-semibold text-white">Staff Members</h2>
        <p className="mb-4 text-xs text-zinc-400">Invite staff into this organization scope.</p>
        {canManage && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@email.com" className="min-w-0 flex-1 rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white" />
            <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white sm:w-36">
              <option value="org_admin">Org admin</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </select>
            <button onClick={inviteMember} disabled={loading} className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white">
              <UserPlus className="h-4 w-4" />
              Add
            </button>
          </div>
        )}
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 p-3 text-sm">
              <div>
                <div className="text-white">{member.user_id}</div>
                <div className="text-xs text-zinc-500">{member.role} • {member.status}</div>
              </div>
              {canManage && member.status !== 'removed' && (
                <button onClick={() => updateMemberStatus(member, 'removed')} className="rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-300">Remove</button>
              )}
            </div>
          ))}
          {members.length === 0 && <div className="text-sm text-zinc-500">No staff members yet.</div>}
        </div>
      </section>

      <section className="min-h-0 overflow-y-auto rounded-lg border border-purple-500/20 bg-[#14101f] p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
          <GraduationCap className="h-4 w-4 text-purple-300" />
          Student Accounts
        </h2>
        <p className="mb-4 text-xs text-zinc-400">Students can only access MAI Class when created by their organization.</p>
        {canManage && (
          <div className="mb-4 grid gap-2">
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Student name" className="rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white" />
            <input value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} placeholder="student@email.com" className="rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={studentPassword} onChange={(event) => setStudentPassword(event.target.value)} placeholder="Temporary password" type="password" className="rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white" />
              <input value={studentDob} onChange={(event) => setStudentDob(event.target.value)} type="date" className="rounded-md border border-purple-500/20 bg-black/30 px-3 py-2 text-sm text-white" />
            </div>
            <button onClick={createStudent} disabled={loading} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Create Student Account</button>
          </div>
        )}
        <div className="space-y-2">
          {students.map((student) => (
            <div key={student.id} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">
              <div className="text-white">{student.student_name || student.user_id}</div>
              <div className="text-xs text-zinc-500">{student.student_email || 'No email'} • {student.status}</div>
              {student.date_of_birth && (
                <div className="mt-1 text-xs text-amber-300">
                  Cashout lock: {student.is_verified_18_plus ? '18+ verified' : 'saved until age 18'}
                </div>
              )}
            </div>
          ))}
          {students.length === 0 && <div className="text-sm text-zinc-500">No students yet.</div>}
        </div>
      </section>
    </div>
  )
}
