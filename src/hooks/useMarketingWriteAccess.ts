import { useAuthStore } from '../lib/store'
import { canWrite, isMarketingAgent } from '../lib/supabase'

export function useCanWrite() {
  const profile = useAuthStore((state) => state.profile)
  return canWrite(profile) ?? true
}

export function useIsMarketingAgent() {
  const profile = useAuthStore((state) => state.profile)
  return isMarketingAgent(profile)
}
