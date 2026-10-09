import React from 'react';
import { useBroadcastEffects } from '../hooks/useBroadcastEffects';

interface CityHeatBarProps {
  className?: string;
}

export function CityHeatBar({ className = '' }: CityHeatBarProps) {
  const { state } = useBroadcastEffects();
  const { cityHeatValue } = state;

  const getStatus = () => {
    if (cityHeatValue >= 70) return 'hype';
    if (cityHeatValue >= 30) return 'normal';
    return 'unstable';
  };

  const status = getStatus();
  const isGlitching = status === 'unstable';
  const isGlowing = status === 'hype';

  return (
    <div className={`relative w-full h-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-700 ${className}`}>
      <div
        className={`absolute top-0 left-0 h-full transition-all duration-300 ease-out ${
          status === 'hype' 
            ? 'bg-gradient-to-r from-purple-600 to-green-500 shadow-lg shadow-green-400/50' 
            : status === 'normal'
            ? 'bg-gradient-to-r from-green-600 to-purple-500'
            : 'bg-gradient-to-r from-red-600 to-orange-500 animate-pulse'
        } ${isGlowing ? 'shadow-[0_0_20px_rgba(34,197,94,0.6)]' : ''}`}
        style={{ width: `${cityHeatValue}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xs font-bold ${
          status === 'hype' ? 'text-white drop-shadow-lg' : 
          status === 'normal' ? 'text-white' : 'text-red-200'
        }`}>
          {cityHeatValue}%
        </span>
      </div>
      {isGlitching && (
        <div className="absolute inset-0 bg-red-500/20 animate-ping" />
      )}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className={`absolute inset-0 ${
          status === 'hype' ? 'animate-pulse' : ''
        }`}>
          <div className="w-full h-full opacity-30 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}