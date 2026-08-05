import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

export const runtime = 'edge'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = getBearerToken(req)
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const userId = authData.user.id

    // Check if user is admin/owner
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    const isAdmin = profile.role === 'admin' || profile.is_admin || profile.role === 'ceo' || profile.role === 'owner'
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can create Mai Class' })
    }

    const { name, description, max_students_per_org } = req.body || {}

    // Create the class
    const { data: newClass, error: createError } = await supabaseAdmin
      .from('mai_classes')
      .insert({
        name: name || 'Mai Class',
        description: description || 'Real World Prep: Money & Credit',
        instructor_id: userId,
        status: 'active',
        max_students_per_org: max_students_per_org || 20,
        session_status: 'scheduled',
      })
      .select()
      .single()

    if (createError) {
      console.error('[create mai class error]', createError)
      return res.status(500).json({ error: 'Failed to create class: ' + createError.message })
    }

    return res.status(200).json({ success: true, class: newClass })
  } catch (err: any) {
    console.error('[create mai class]', err)
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}

function getBearerToken(req: VercelRequest): string {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
    throw new Error('Missing auth token')
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) throw new Error('Missing auth token')
  return token
}
