import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldX,
  Car,
  Home,
  Star,
  Zap,
  Crown,
  MessageSquare,
  UserPlus,
  Gift,
  Hammer,
  AlertTriangle,
  Check,
  Badge as BadgeIcon,
  Key,
} from 'lucide-react';
import { CityStatusOrbData, CityStatusOrbOptions } from '../../lib/hooks/useCityStatusOrb';
import { TLeagueTier } from '../../config/T_LEAGUE_CONFIG';
import { getUserKeysPublic, getUserKeysPrivate } from '../../services/keyService';
import type { KeyInstance } from '../../types/keys';

interface CityStatusOrbProps {
  data: CityStatusOrbData;
  permissions: {
    isSelf: boolean;
    canCheckLicense: boolean;
    canRaid: boolean;
    canRepair: boolean;
    canEnforce: boolean;
    canRemoveFromSeat: boolean;
    canAccessAll: boolean;
  };
  /** Callback when user clicks the house icon */
  onHouseClick?: () => void;
  /** Callback for raid action */
  onRaid?: () => void;
  /** Callback for follow action */
  onFollow?: () => void;
  /** Callback for gift action */
  onGift?: () => void;
  /** Callback for message action */
  onMessage?: () => void;
  /** Compact mode for inline display */
  compact?: boolean;
}

function getLicenseStatusDisplay(status: string | null, expiry: string | null) {
  if (!status || status === 'none') {
    return { label: 'No License', color: 'text-gray-400', icon: ShieldX };
  }
  if (status === 'suspended') {
    return { label: 'Suspended', color: 'text-red-400', icon: ShieldX };
  }
  if (status === 'active') {
    if (expiry && new Date(expiry) <= new Date()) {
      return { label: 'Expired', color: 'text-yellow-400', icon: AlertTriangle };
    }
    return { label: 'Active', color: 'text-green-400', icon: ShieldCheck };
  }
  return { label: status, color: 'text-gray-400', icon: ShieldX };
}

function getInsuranceStatusDisplay(expiry: string | null) {
  if (!expiry) {
    return { label: 'No Insurance', color: 'text-red-400', icon: ShieldX };
  }
  if (new Date(expiry) <= new Date()) {
    return { label: 'Expired', color: 'text-yellow-400', icon: AlertTriangle };
  }
  return { label: 'Active', color: 'text-green-400', icon: ShieldCheck };
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function CityStatusOrb({
  data,
  permissions,
  onHouseClick,
  onRaid,
  onFollow,
  onGift,
  onMessage,
  compact = false,
}: CityStatusOrbProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'keys'>('overview');
  const [publicKeys, setPublicKeys] = useState<KeyInstance[]>([]);
  const [privateKeys, setPrivateKeys] = useState<KeyInstance[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [showSafe, setShowSafe] = useState(false);

  const licenseDisplay = getLicenseStatusDisplay(data.license_status, data.drivers_license_expiry);
  const insuranceDisplay = getInsuranceStatusDisplay(data.homeowners_insurance_expiry);
  const LicenseIcon = licenseDisplay.icon;
  const InsuranceIcon = insuranceDisplay.icon;

  const xpProgress = data.next_level_xp
    ? Math.min(100, Math.max(0, (data.xp / data.next_level_xp) * 100))
    : 0;

  useEffect(() => {
    if (!compact && activeTab === 'keys') {
      setKeysLoading(true);
      getUserKeysPublic(data.id)
        .then(setPublicKeys)
        .catch(() => setPublicKeys([]))
        .finally(() => setKeysLoading(false));
    }
  }, [activeTab, data.id, compact]);

  const openSafe = async () => {
    setShowSafe(true);
    setKeysLoading(true);
    try {
      const keys = await getUserKeysPrivate(data.id);
      setPrivateKeys(keys);
    } catch {
      setPrivateKeys([]);
    } finally {
      setKeysLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onHouseClick}
        className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 hover:border-cyan-400/40 hover:bg-black/70 transition-colors cursor-pointer"
      >
        {data.avatar_url ? (
          <img src={data.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-xs text-gray-300">{(data.username || '?')[0].toUpperCase()}</span>
          </div>
        )}
        <span className="text-xs font-semibold text-white truncate max-w-[80px]">
          {data.username}
        </span>
        <span className={`text-[10px] font-bold ${data.tLeagueTier.textColor} bg-gradient-to-r ${data.subTierColor || data.tLeagueTier.color} px-1.5 py-0.5 rounded-full`}>
          {data.league_tier}{data.league_sub_tier || ''}
        </span>
        <span className="text-[10px] text-gray-400">Lv.{data.level}</span>
      </button>
    );
  }

  return (
    <div className={`rounded-2xl border bg-slate-900/95 shadow-2xl shadow-black/40 overflow-hidden w-full max-w-sm ${data.recentlyRaided ? 'border-red-500/80 animate-pulse shadow-red-500/20' : 'border-slate-700'}`}>
      {/* Header with avatar and basic info */}
      <div className="relative p-4 bg-gradient-to-br from-slate-800 to-slate-900">
        {/* T League badge - top right */}
        <div className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 bg-gradient-to-r ${data.subTierColor || data.tLeagueTier.color} shadow-lg`}>
          <span className="text-sm font-black text-white">{data.league_tier}{data.league_sub_tier || ''}</span>
        </div>

        {/* Raid indicator */}
        {data.recentlyRaided && (
          <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-1 border border-red-500/30">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Raided</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.username}
                className="w-14 h-14 rounded-full object-cover border-2 border-slate-600"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center border-2 border-slate-600">
                <span className="text-xl font-bold text-white">
                  {(data.username || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            {/* Level indicator */}
            <div className="absolute -bottom-1 -right-1 bg-slate-800 border border-slate-600 rounded-full px-1.5 py-0.5">
              <span className="text-[10px] font-bold text-white">Lv.{data.level}</span>
            </div>
          </div>

          {/* Name and title */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white truncate">
              {data.display_name || data.username}
            </h3>
            <p className="text-xs text-slate-400 truncate">@{data.username}</p>
            <p className={`text-xs font-semibold ${data.tLeagueTier.textColor}`}>
              {data.tLeagueTier.icon} {data.tLeagueTier.label}
            </p>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>XP: {formatNumber(data.xp)}</span>
          {data.next_level_xp && <span>Next: {formatNumber(data.next_level_xp)}</span>}
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>

      {/* T League Progress */}
      <div className="px-4 pt-2">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>League: {data.league_tier}{data.league_sub_tier || ''} — {formatNumber(data.league_score)} pts</span>
          <span>{Math.round(data.leagueProgress)}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${data.subTierColor || data.tLeagueTier.color} rounded-full transition-all duration-500`}
            style={{ width: `${data.leagueProgress}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 p-4">
        {/* Hype Coins */}
        <div className="rounded-xl bg-slate-800/80 p-2.5 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Hype</div>
            <div className="text-sm font-bold text-yellow-300 truncate">{formatNumber(data.hype_coins)}</div>
          </div>
        </div>

        {/* License Plate */}
        <div className="rounded-xl bg-slate-800/80 p-2.5 flex items-center gap-2">
          <Car className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Plate</div>
            <div className="text-sm font-bold text-cyan-300 truncate font-mono">
              {data.license_plate || '—'}
            </div>
          </div>
        </div>

        {/* Driver License */}
        {(permissions.canCheckLicense || permissions.isSelf) && (
          <div className="rounded-xl bg-slate-800/80 p-2.5 flex items-center gap-2">
            <LicenseIcon className={`w-4 h-4 shrink-0 ${licenseDisplay.color}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">License</div>
              <div className={`text-sm font-bold truncate ${licenseDisplay.color}`}>
                {licenseDisplay.label}
              </div>
            </div>
          </div>
        )}

        {/* Homeowner Insurance */}
        {(permissions.canCheckLicense || permissions.isSelf) && (
          <div className="rounded-xl bg-slate-800/80 p-2.5 flex items-center gap-2">
            <Home className={`w-4 h-4 shrink-0 ${insuranceDisplay.color}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Home Insurance</div>
              <div className={`text-sm font-bold truncate ${insuranceDisplay.color}`}>
                {insuranceDisplay.label}
              </div>
            </div>
          </div>
        )}

        {/* Car Insurance */}
        {data.vehicle_id && (permissions.canCheckLicense || permissions.isSelf) && (
          <div className="rounded-xl bg-slate-800/80 p-2.5 flex items-center gap-2">
            <Car className={`w-4 h-4 shrink-0 ${getInsuranceStatusDisplay(data.car_insurance_expiry).color}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Car Insurance</div>
              <div className={`text-sm font-bold truncate ${getInsuranceStatusDisplay(data.car_insurance_expiry).color}`}>
                {getInsuranceStatusDisplay(data.car_insurance_expiry).label}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coins to Next League */}
      {data.nextTier && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-800/60 border border-slate-700/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next League</span>
              </div>
              <span className={`text-xs font-black ${data.nextTier.textColor}`}>
                {data.nextTier.icon} {data.nextTier.tier}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>{formatNumber(data.league_score)} pts</span>
              <span>{formatNumber(data.nextTier.minScore)} pts</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${data.tLeagueTier.color} rounded-full transition-all duration-500`}
                style={{ width: `${data.leagueProgress}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              <span className="font-bold text-amber-300">{formatNumber(data.coinsToNextLeague)}</span> coins to {data.nextTier.tier}
            </p>
          </div>
        </div>
      )}

      {/* Active Missions / Goals */}
      {data.activeMissions && data.activeMissions.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Missions</span>
          </div>
          <div className="space-y-2">
            {data.activeMissions.map((mission) => {
              const pct = Math.min(100, Math.max(0, (mission.progress / mission.goal) * 100));
              return (
                <div key={mission.id} className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white truncate mr-2">{mission.title}</span>
                    <span className="text-[10px] font-bold text-emerald-300 shrink-0">+{mission.reward} coins</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500">
                    <span>{formatNumber(mission.progress)}/{formatNumber(mission.goal)}</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* House icon row */}
      {data.house_id && (
        <div className="px-4 pb-3">
          <button
            onClick={() => {
              if (permissions.canRaid && !permissions.isSelf && onRaid) {
                onRaid();
              } else if (onHouseClick) {
                onHouseClick();
              }
            }}
            className="w-full flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2 hover:bg-slate-700/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-300">House #{data.house_id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {permissions.canRaid && !permissions.isSelf && (
                <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                  <Hammer className="w-3 h-3" /> Raid
                </span>
              )}
              {permissions.canRepair && (
                <span className="text-[10px] text-blue-400">Repair</span>
              )}
              <span className="text-[10px] text-slate-500">View →</span>
            </div>
          </button>
        </div>
      )}

      {/* Keys Tab */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 border-b border-white/10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-[11px] font-bold transition ${
              activeTab === 'overview' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-white/50 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3 py-1.5 text-[11px] font-bold transition flex items-center gap-1 ${
              activeTab === 'keys' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-white/50 hover:text-white'
            }`}
          >
            <Key size={12} /> Keys
          </button>
        </div>
      </div>

      {activeTab === 'keys' && (
        <div className="px-4 pb-3">
          {keysLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-violet-500" />
            </div>
          ) : publicKeys.length === 0 ? (
            <p className="text-[11px] text-white/50 text-center py-3">No keys collected yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {publicKeys.map(key => (
                <div key={key.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">{key.key_letter}</span>
                    <span className="text-[10px] font-bold text-white/60">{key.rarity.replace('_', ' ')}</span>
                  </div>
                  {key.is_key_to_city && (
                    <span className="text-[9px] font-black text-yellow-300 bg-yellow-500/20 px-1.5 py-0.5 rounded">KEY TO THE CITY</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {permissions.isSelf && (
            <button
              onClick={openSafe}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 px-3 py-2 text-[11px] font-black text-white hover:from-yellow-500 hover:to-orange-500"
            >
              🔐 OPEN SAFE
            </button>
          )}
        </div>
      )}

      {/* Safe Box Modal for owner */}
      {showSafe && (
        <SafeBoxModal
          keys={privateKeys}
          loading={keysLoading}
          onClose={() => setShowSafe(false)}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-4">
        {!permissions.isSelf && (
          <>
            {onFollow && (
              <button
                onClick={onFollow}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors"
              >
                <UserPlus className="w-3 h-3" /> Follow
              </button>
            )}
            {onGift && (
              <button
                onClick={onGift}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors"
              >
                <Gift className="w-3 h-3" /> Gift
              </button>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors"
              >
                <MessageSquare className="w-3 h-3" /> Message
              </button>
            )}
          </>
        )}
        {permissions.canEnforce && !permissions.isSelf && (
          <button className="flex items-center gap-1 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800/40 px-2.5 py-1.5 text-[11px] text-red-300 transition-colors">
            <ShieldCheck className="w-3 h-3" /> Enforce
          </button>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// SAFE BOX MODAL
// =========================================================================

function SafeBoxModal({
  keys,
  loading,
  onClose,
}: {
  keys: KeyInstance[];
  loading: boolean;
  onClose: () => void;
}) {
  const totalValue = keys.reduce((sum, k) => sum + k.value, 0);
  const activeKeys = keys.filter(k => k.status === 'active');
  const lockedKeys = keys.filter(k => k.status === 'active' && new Date(k.cashout_available_at) > new Date());
  const availableKeys = keys.filter(k => k.status === 'active' && new Date(k.cashout_available_at) <= new Date());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-yellow-500/30 bg-slate-900 shadow-2xl shadow-yellow-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-4 py-3 flex items-center justify-between">
          <h3 className="font-black text-white flex items-center gap-2">🔐 MAITROLL CITY SAFE</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg font-bold">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-yellow-500" />
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">Total Value</p>
                  <p className="text-lg font-black text-yellow-300">{totalValue.toLocaleString()} TC</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider">Total Keys</p>
                  <p className="text-lg font-black text-white">{activeKeys.length}</p>
                </div>
              </div>

              {/* Available for cashout */}
              <div>
                <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">🟢 Cashout Available ({availableKeys.length})</p>
                {availableKeys.length === 0 ? (
                  <p className="text-[11px] text-white/40">None</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {availableKeys.map(key => (
                      <div key={key.id} className="flex items-center justify-between rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{key.key_letter}</span>
                          <span className="text-[10px] text-white/60">{key.rarity.replace('_', ' ')}</span>
                        </div>
                        <span className="text-xs font-bold text-green-300">{key.value.toLocaleString()} TC</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Locked */}
              <div>
                <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-2">🔒 Locked ({lockedKeys.length})</p>
                {lockedKeys.length === 0 ? (
                  <p className="text-[11px] text-white/40">None</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {lockedKeys.map(key => {
                      const daysLeft = Math.max(0, Math.ceil((new Date(key.cashout_available_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return (
                        <div key={key.id} className="flex items-center justify-between rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{key.key_letter}</span>
                            <span className="text-[10px] text-white/60">{key.rarity.replace('_', ' ')}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-yellow-300">{key.value.toLocaleString()} TC</span>
                            <span className="text-[10px] text-white/40 block">{daysLeft}d left</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-[10px] text-white/40 text-center">
            Only you can see these values. MaiTroll is not responsible for private agreements.
          </p>
        </div>
      </div>
    </div>
  );
}
