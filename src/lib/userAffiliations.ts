import { supabase } from './supabase'

export type UserAffiliationType = 'family' | 'agency'

export interface UserAffiliation {
  type: UserAffiliationType
  id: string
  name: string
  slug?: string
  publicSlug?: string
  role?: string | null
}

interface _AgencyMemberRow {
  role: string | null
  agency_id: string | null
}

interface _AgencyRow {
  id: string
  name: string
  slug: string
  public_slug: string | null
}

interface _FamilyMemberRow {
  role: string | null
  family_id: string | null
}

interface _FamilyRow {
  id: string
  name: string
  slug: string
}

export async function getUserAffiliation(userId: string): Promise<UserAffiliation | null> {
  if (!userId) return null

  // Agency membership takes precedence over family membership.
  const { data: agencyMember, error: agencyError } = await supabase
    .from('agency_members')
    .select('role, agency_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (agencyError) {
    console.error('Error fetching agency affiliation:', agencyError)
    throw agencyError
  }

  if (agencyMember?.agency_id) {
    const { data: agency, error: agencyDataError } = await supabase
      .from('agencies')
      .select('id, name, slug, public_slug')
      .eq('id', agencyMember.agency_id)
      .maybeSingle()

    if (agencyDataError) {
      console.error('Error fetching agency record:', agencyDataError)
      throw agencyDataError
    }

    if (agency?.id) {
      return {
        type: 'agency',
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        publicSlug: agency.public_slug,
        role: agencyMember.role,
      }
    }
  }

  // Check family_members (canonical family membership table)
  const { data: familyMember, error: familyMemberError } = await supabase
    .from('family_members')
    .select('family_id, role')
    .eq('user_id', userId)
    .eq('approval_status', 'approved')
    .limit(1)
    .maybeSingle()

  if (familyMemberError) {
    console.error('Error fetching family membership:', familyMemberError)
  }

  if (familyMember?.family_id) {
    const { data: family, error: familyDataError } = await supabase
      .from('troll_families')
      .select('id, name, slug')
      .eq('id', familyMember.family_id)
      .maybeSingle()

    if (familyDataError) {
      console.error('Error fetching family record:', familyDataError)
      throw familyDataError
    }

    if (family?.id) {
      return {
        type: 'family',
        id: family.id,
        name: family.name,
        slug: family.slug,
        role: familyMember.role,
      }
    }
  }

  // Check if user is a leader of troll_families
  const { data: leaderData, error: leaderError } = await supabase
    .from('troll_families')
    .select('id, name, slug')
    .eq('leader_id', userId)
    .limit(1)
    .maybeSingle()

  if (leaderError) {
    console.error('Error fetching leader family:', leaderError)
  }

  if (leaderData?.id) {
    return {
      type: 'family',
      id: leaderData.id,
      name: leaderData.name,
      slug: leaderData.slug,
      role: 'leader',
    }
  }

  return null
}
