import { createContext, useContext } from 'react'
import type { StaffWalkieTalkieContextValue } from '../components/StaffWalkieTalkieProvider'

export const StaffWalkieTalkieContext = createContext<StaffWalkieTalkieContextValue | null>(null)

export function useStaffWalkieTalkieContext() {
  const context = useContext(StaffWalkieTalkieContext)
  if (!context) {
    throw new Error('useStaffWalkieTalkieContext must be used within StaffWalkieTalkieProvider')
  }
  return context
}
