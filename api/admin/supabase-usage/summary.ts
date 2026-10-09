import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication is required.' })
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(authorization.slice(7))
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Your session is invalid or expired.' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (profileError) {
      console.error('[admin supabase usage] Permission lookup failed:', profileError.message)
      return res.status(500).json({ error: 'Unable to verify administrator permissions.' })
    }

    const role = String(profile?.role || '').toLowerCase()
    if (profile?.is_admin !== true && !['admin', 'superadmin', 'ceo'].includes(role)) {
      return res.status(403).json({ error: 'Administrator permission is required.' })
    }

    return res.status(503).json({
      code: 'USAGE_SOURCE_UNAVAILABLE',
      error: 'Live Supabase usage metrics are not configured for this deployment. No usage figures or historical snapshots are being fabricated.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    console.error('[admin supabase usage] Request failed:', message)
    return res.status(500).json({ error: 'Unable to load the Supabase usage dashboard.' })
  }
}
