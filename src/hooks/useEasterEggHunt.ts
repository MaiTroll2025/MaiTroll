import { createContext, useContext } from 'react'
import type { EasterEggHuntContextType } from '../contexts/EasterEggHuntContext'

export const EasterEggHuntContext = createContext<EasterEggHuntContextType | undefined>(undefined)

export function useEasterEggHunt() {
  const context = useContext(EasterEggHuntContext)
  if (!context) {
    throw new Error('useEasterEggHunt must be used within EasterEggHuntProvider')
  }
  return context
}
