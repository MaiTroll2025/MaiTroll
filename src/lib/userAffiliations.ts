import { supabase } from './supabase'

export type UserAffiliationType = 'none'

export interface UserAffiliation {
  type: UserAffiliationType
  id: string
  name: string
  slug?: string
  publicSlug?: string
  role?: string | null
}

export async function getUserAffiliation(userId: string): Promise<UserAffiliation | null> {
  if (!userId) return null

  return {
    type: 'none',
    id: '',
    name: '',
    role: null,
  }
}
