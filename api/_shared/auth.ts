import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const PURCHASE_REQUIRED_MESSAGE = 'Purchase required to use this feature'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for server-side Supabase access')
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export const OFFICER_ROLES = new Set(['admin', 'lead_troll_officer', 'troll_officer', 'officer'])
export const MARKETING_AGENT_ROLE = 'marketing_agent'

export function isMarketingAgentProfile(profile: AuthorizedProfile | null): boolean {
  if (!profile) return false
  return profile.role === MARKETING_AGENT_ROLE
}

export function assertMarketingAgentScope(profile: AuthorizedProfile | null): void {
  if (isMarketingAgentProfile(profile)) {
    const err = new Error('Marketing agents may only publish through approved marketing workflows')
    ;(err as any).status = 403
    throw err
  }
}

export function enforceReadOnly(req: any, profile: AuthorizedProfile): void {
  if (isMarketingAgentProfile(profile)) {
    const method = req.method?.toUpperCase() || 'GET'
    if (method !== 'GET') {
      const err = new Error(`Marketing agents may not use ${method} on this endpoint`)
      ;(err as any).status = 403
      throw err
    }
  }
}

export interface AuthorizedProfile {
  id: string
  username: string
  role: string
  avatar_url?: string | null
  is_admin?: boolean
  is_lead_officer?: boolean
  is_troll_officer?: boolean
  is_broadcaster?: boolean
  has_paid?: boolean
}

function extractToken(req: any): string {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header || !header.startsWith('Bearer ')) {
    throw new Error('Missing auth token')
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new Error('Missing auth token')
  }

  return token
}

async function lookupProfile(userId: string): Promise<AuthorizedProfile> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, username, role, avatar_url, is_admin, is_lead_officer, is_troll_officer, is_broadcaster, has_paid')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error('[broadcast-auth] Profile lookup failed', profileError?.message)
    throw new Error('Profile not found')
  }

  return profile as AuthorizedProfile
}

export async function authorizeUser(req: any): Promise<AuthorizedProfile> {
  const token = extractToken(req)

  // Improved logging for debugging
  console.log('[authorizeUser] Attempting to authorize with token of length:', token.length)

  const { data, error: userError } = await supabaseAdmin.auth.getUser(token)

  if (userError || !data?.user) {
    console.error('[authorizeUser] Auth lookup failed:', {
      errorMessage: userError?.message,
      errorCode: userError?.code,
      hasUser: !!data?.user,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...',
    })

    // Provide specific error messages based on the error
    if (userError?.message?.includes('expired') || userError?.message?.includes('invalid')) {
      throw new Error('No active session. Please sign in again.')
    } else if (userError?.code === 'session_not_found') {
      throw new Error('No active session. Please sign in again.')
    } else {
      throw new Error('Unable to verify user session')
    }
  }

  const profile = await lookupProfile(data.user.id)
  const hasElevatedAccess = Boolean(profile.is_admin || profile.is_lead_officer)

  if (!hasElevatedAccess && !profile.has_paid) {
    const err = new Error(PURCHASE_REQUIRED_MESSAGE)
    ;(err as any).status = 403
    throw err
  }

  return profile
}

export async function authorizeOfficer(req: any): Promise<AuthorizedProfile> {
  const profile = await authorizeUser(req)
  const role = (profile.role || '').toLowerCase()
  const isOfficerRole =
    OFFICER_ROLES.has(role) ||
    Boolean(profile.is_admin) ||
    Boolean(profile.is_lead_officer) ||
    Boolean(profile.is_troll_officer)

  if (!isOfficerRole) {
    throw new Error('Unauthorized role')
  }

  return profile
}
