import { createContext, useContext } from 'react';
import type { ActiveEffect, EffectType } from '../types/broadcastEffects';

export interface EffectsState {
  activeEffects: ActiveEffect[];
  cityHeatValue: number;
  seatHeatValues: Record<string, number>;
  lastEffectId: number;
}

export type EffectsAction =
  | { type: 'ADD_EFFECT'; payload: ActiveEffect }
  | { type: 'REMOVE_EFFECT'; payload: string }
  | { type: 'SET_CITY_HEAT'; payload: number }
  | { type: 'BOOST_CITY_HEAT'; payload: number }
  | { type: 'SET_SEAT_HEAT'; payload: { seatId: string; value: number } }
  | { type: 'BOOST_SEAT_HEAT'; payload: { seatId: string; value: number } }
  | { type: 'DECAY_HEAT' };

interface EffectsContextValue {
  state: EffectsState;
  triggerEffect: (type: EffectType, target: 'page' | 'broadcast' | 'seat', durationMs: number, seatId?: string) => void;
  triggerGiftEffect: (giftId: string, targetSeatId?: string) => void;
  setCityHeat: (value: number) => void;
  boostCityHeat: (amount: number) => void;
  setSeatHeat: (seatId: string, value: number) => void;
  boostSeatHeat: (seatId: string, amount: number) => void;
  clearEffects: () => void;
}

export const EffectsContext = createContext<EffectsContextValue | null>(null);

export function useBroadcastEffects() {
  const context = useContext(EffectsContext);
  if (!context) {
    throw new Error('useBroadcastEffects must be used within EffectsProvider');
  }
  return context;
}
