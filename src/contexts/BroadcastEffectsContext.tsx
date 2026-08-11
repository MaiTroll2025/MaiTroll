import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { ActiveEffect, EffectType, EffectTarget, GIFT_EFFECT_MAPPING, GiftEffectConfig } from '../types/broadcastEffects';

interface EffectsState {
  activeEffects: ActiveEffect[];
  cityHeatValue: number;
  seatHeatValues: Record<string, number>;
  lastEffectId: number;
}

type EffectsAction =
  | { type: 'ADD_EFFECT'; payload: ActiveEffect }
  | { type: 'REMOVE_EFFECT'; payload: string }
  | { type: 'SET_CITY_HEAT'; payload: number }
  | { type: 'BOOST_CITY_HEAT'; payload: number }
  | { type: 'SET_SEAT_HEAT'; payload: { seatId: string; value: number } }
  | { type: 'BOOST_SEAT_HEAT'; payload: { seatId: string; value: number } }
  | { type: 'DECAY_HEAT' };

const initialState: EffectsState = {
  activeEffects: [],
  cityHeatValue: 0,
  seatHeatValues: {},
  lastEffectId: 0,
};

function effectsReducer(state: EffectsState, action: EffectsAction): EffectsState {
  switch (action.type) {
    case 'ADD_EFFECT':
      return {
        ...state,
        activeEffects: [...state.activeEffects, action.payload],
        lastEffectId: state.lastEffectId + 1,
      };
    case 'REMOVE_EFFECT':
      return {
        ...state,
        activeEffects: state.activeEffects.filter(e => e.id !== action.payload),
      };
    case 'SET_CITY_HEAT':
      return { ...state, cityHeatValue: Math.max(0, Math.min(100, action.payload)) };
    case 'BOOST_CITY_HEAT':
      return {
        ...state,
        cityHeatValue: Math.max(0, Math.min(100, state.cityHeatValue + action.payload)),
      };
    case 'SET_SEAT_HEAT':
      return {
        ...state,
        seatHeatValues: {
          ...state.seatHeatValues,
          [action.payload.seatId]: Math.max(0, Math.min(100, action.payload.value)),
        },
      };
    case 'BOOST_SEAT_HEAT':
      const currentValue = state.seatHeatValues[action.payload.seatId] || 0;
      return {
        ...state,
        seatHeatValues: {
          ...state.seatHeatValues,
          [action.payload.seatId]: Math.max(0, Math.min(100, currentValue + action.payload.value)),
        },
      };
    case 'DECAY_HEAT':
      return {
        ...state,
        cityHeatValue: Math.max(0, state.cityHeatValue - 2),
        seatHeatValues: Object.fromEntries(
          Object.entries(state.seatHeatValues).map(([id, val]) => [id, Math.max(0, val - 2)])
        ),
      };
    default:
      return state;
  }
}

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

const EffectsContext = createContext<EffectsContextValue | null>(null);

export function EffectsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(effectsReducer, initialState);
  const decayIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    decayIntervalRef.current = window.setInterval(() => {
      dispatch({ type: 'DECAY_HEAT' });
    }, 2500);
    return () => {
      if (decayIntervalRef.current) clearInterval(decayIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const timers: number[] = [];
    state.activeEffects.forEach(effect => {
      const remaining = effect.startedAt + effect.durationMs - Date.now();
      if (remaining > 0) {
        const timer = window.setTimeout(() => {
          dispatch({ type: 'REMOVE_EFFECT', payload: effect.id });
        }, remaining);
        timers.push(timer);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [state.activeEffects]);

  const triggerEffect = useCallback((type: EffectType, target: EffectTarget, durationMs: number, seatId?: string) => {
    const effect: ActiveEffect = {
      id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      target,
      durationMs,
      startedAt: Date.now(),
      seatId,
      intensity: 1,
    };
    dispatch({ type: 'ADD_EFFECT', payload: effect });
  }, []);

  const triggerGiftEffect = useCallback((giftId: string, targetSeatId?: string) => {
    const config = GIFT_EFFECT_MAPPING[giftId];
    if (config) {
      triggerEffect(config.effect, config.target, config.durationMs, targetSeatId);
      if (config.barBoost > 0) {
        dispatch({ type: 'BOOST_CITY_HEAT', payload: config.barBoost });
        if (targetSeatId) {
          dispatch({ type: 'BOOST_SEAT_HEAT', payload: { seatId: targetSeatId, value: config.barBoost } });
        }
      }
    }
  }, [triggerEffect]);

  const setCityHeat = useCallback((value: number) => {
    dispatch({ type: 'SET_CITY_HEAT', payload: value });
  }, []);

  const boostCityHeat = useCallback((amount: number) => {
    dispatch({ type: 'BOOST_CITY_HEAT', payload: amount });
  }, []);

  const setSeatHeat = useCallback((seatId: string, value: number) => {
    dispatch({ type: 'SET_SEAT_HEAT', payload: { seatId, value } });
  }, []);

  const boostSeatHeat = useCallback((seatId: string, amount: number) => {
    dispatch({ type: 'BOOST_SEAT_HEAT', payload: { seatId, value: amount } });
  }, []);

  const clearEffects = useCallback(() => {
    state.activeEffects.forEach(e => {
      dispatch({ type: 'REMOVE_EFFECT', payload: e.id });
    });
  }, [state.activeEffects]);

  return (
    <EffectsContext.Provider value={{
      state,
      triggerEffect,
      triggerGiftEffect,
      setCityHeat,
      boostCityHeat,
      setSeatHeat,
      boostSeatHeat,
      clearEffects,
    }}>
      {children}
    </EffectsContext.Provider>
  );
}

export function useBroadcastEffects() {
  const context = useContext(EffectsContext);
  if (!context) {
    throw new Error('useBroadcastEffects must be used within EffectsProvider');
  }
  return context;
}