import React from 'react';
import { X } from 'lucide-react';
import CityStatusOrb from './CityStatusOrb';
import { useCityStatusOrb } from '../../lib/hooks/useCityStatusOrb';

interface CityStatusPanelProps {
  userId: string;
  onClose: () => void;
  /** Context: is the current user a broadcaster? */
  isBroadcaster?: boolean;
  /** Context: is the current user a BroadOfficer? */
  isBroadOfficer?: boolean;
  /** Context: is the target user a seat holder? */
  isSeatHolder?: boolean;
  /** Context: broadcaster ID for raid permission */
  broadcasterId?: string;
  /** Callback when house icon is clicked */
  onHouseClick?: () => void;
  /** Callback when raid is triggered */
  onRaid?: () => void;
}

export default function CityStatusPanel({
  userId,
  onClose,
  isBroadcaster = false,
  isBroadOfficer = false,
  isSeatHolder = false,
  broadcasterId,
  onHouseClick,
  onRaid,
}: CityStatusPanelProps) {
  const { data, loading, permissions } = useCityStatusOrb({
    userId,
    broadcasterId,
    isSeatHolder,
    isBroadcaster,
    isBroadOfficer,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" />
          </div>
        ) : data ? (
          <CityStatusOrb
            data={data}
            permissions={permissions}
            onHouseClick={() => {
              onHouseClick?.();
              onClose();
            }}
            onRaid={() => {
              onRaid?.();
              onClose();
            }}
          />
        ) : (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/95 p-8 text-center">
            <p className="text-slate-400">User not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
