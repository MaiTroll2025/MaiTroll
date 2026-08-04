import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../lib/store';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Clock, 
  Users, 
  Bell, 
  PlayCircle, 
  StopCircle, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Timer,
  ClipboardList
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface PayoutWindowStatus {
  enabled: boolean;
  min_coins: number;
  special_tier_enabled: boolean;
  special_tier_coins: number;
  special_tier_usd: number;
  duration_minutes: number;
  enabled_at?: string;
  expires_at?: string;
  message: string;
  notified_users?: boolean;
}

export default function SecretaryPayoutControl() {
  const { profile } = useAuthStore();
  const [status, setStatus] = useState<PayoutWindowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duration, setDuration] = useState(20);
  const [minCoins, setMinCoins] = useState(5000);
  const [specialUsd, setSpecialUsd] = useState(1);
  const [eligibleUsers, setEligibleUsers] = useState<number>(0);
  const [sendingNotification, setSendingNotification] = useState(false);

  const isAuthorized = profile?.role === 'admin' || profile?.troll_role === 'admin' || 
                       profile?.role === 'secretary' || profile?.troll_role === 'secretary';

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      // Payout window is now determined by user level in the backend RPC
      setStatus({ enabled: true, duration_minutes: 20, min_coins: 7500, special_tier_usd: 1 });
      setDuration(20);
      setMinCoins(7500);
      setSpecialUsd(1);
    } catch (err) {
      console.error('Error loading payout window status:', err);
      toast.error('Failed to load payout window status');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEligibleUsers = useCallback(async () => {
    try {
      // Count users with at least minCoins in their balance
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('troll_coins', minCoins);

      if (error) throw error;
      setEligibleUsers(count || 0);
    } catch (err) {
      console.error('Error loading eligible users:', err);
    }
  }, [minCoins]);

  useEffect(() => {
    if (isAuthorized) {
      loadStatus();
      loadEligibleUsers();
    }
  }, [isAuthorized, loadStatus, loadEligibleUsers]);

  const handleEnableWindow = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('enable_payout_window', {
        p_duration_minutes: duration,
        p_min_coins: minCoins,
        p_special_tier_usd: specialUsd
      });

      if (error) throw error;
      
      toast.success(`Payout window enabled for ${duration} minutes!`);
      setStatus(data);
      
      // Automatically send notification to all eligible users
      await handleSendNotification();
    } catch (err: any) {
      console.error('Error enabling payout window:', err);
      toast.error(err.message || 'Failed to enable payout window');
    } finally {
      setSaving(false);
    }
  };

  const handleDisableWindow = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('disable_payout_window');
      if (error) throw error;
      
      toast.success('Payout window disabled');
      setStatus(data);
    } catch (err: any) {
      console.error('Error disabling payout window:', err);
      toast.error(err.message || 'Failed to disable payout window');
    } finally {
      setSaving(false);
    }
  };

  const handleSendNotification = async () => {
    setSendingNotification(true);
    try {
      // Get all users with enough coins
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .gte('troll_coins', minCoins);

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        toast.error('No users found with sufficient coins');
        return;
      }

      // Create notifications for all eligible users
      const notifications = users.map(user => ({
        user_id: user.id,
        type: 'system_announcement',
        title: '💰 Payout Window OPEN!',
        message: `Special cashout tier available! Get $${specialUsd} for ${minCoins.toLocaleString()} coins. This offer is available for ${duration} minutes only!`,
        metadata: { 
          payout_window: true,
          special_tier: true,
          coins: minCoins,
          usd: specialUsd
        },
        is_read: false
      }));

      // Insert in batches
      const batchSize = 500;
      let inserted = 0;
      
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(batch);

        if (insertError) throw insertError;
        inserted += batch.length;
      }

      // Mark as notified in settings
      await supabase.rpc('mark_payout_window_notified');

      toast.success(`Notifications sent to ${inserted} users!`);
    } catch (err: any) {
      console.error('Error sending notifications:', err);
      toast.error(err.message || 'Failed to send notifications');
    } finally {
      setSendingNotification(false);
    }
  };

  const getTimeRemaining = () => {
    if (!status?.enabled || !status?.expires_at) return null;
    
    const expires = new Date(status.expires_at);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isAuthorized) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-red-400 mb-2">Access Restricted</h3>
        <p className="text-slate-400">Only Secretaries and Admins can access payout controls.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const isWindowActive = status?.enabled && status?.expires_at && new Date(status.expires_at) > new Date();
  const timeRemaining = getTimeRemaining();

  return (
    <div className="space-y-6">
      {/* Header Status Card */}
      <div className={`rounded-xl p-6 border ${
        isWindowActive 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-slate-800/50 border-slate-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isWindowActive ? (
              <div className="bg-green-500/20 p-3 rounded-full">
                <Timer className="w-8 h-8 text-green-400" />
              </div>
            ) : (
              <div className="bg-slate-700 p-3 rounded-full">
                <DollarSign className="w-8 h-8 text-slate-400" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-white">
                {isWindowActive ? 'Payout Window ACTIVE' : 'Payout Window Closed'}
              </h3>
              <p className="text-slate-400">
                {status?.message || 'No active payout window'}
              </p>
            </div>
          </div>
          
          {isWindowActive && timeRemaining && (
            <div className="text-right">
              <div className="text-3xl font-bold text-green-400">{timeRemaining}</div>
              <div className="text-sm text-slate-400">remaining</div>
            </div>
          )}
        </div>

        {isWindowActive && (
          <div className="mt-4 pt-4 border-t border-green-500/20">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{status?.special_tier_coins?.toLocaleString()}</div>
                <div className="text-sm text-slate-400">Coins Required</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">${status?.special_tier_usd}</div>
                <div className="text-sm text-slate-400">Cash Value</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{eligibleUsers}</div>
                <div className="text-sm text-slate-400">Eligible Users</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-purple-400" />
          Payout Window Controls
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Window Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Math.min(120, parseInt(e.target.value) || 20)))}
              disabled={isWindowActive}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">1-120 minutes</p>
          </div>

          {/* Min Coins */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Minimum Coins Required
            </label>
            <input
              type="number"
              value={minCoins}
              onChange={(e) => setMinCoins(Math.max(1000, parseInt(e.target.value) || 5000))}
              disabled={isWindowActive}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">Users need this many coins to cash out</p>
          </div>

          {/* Special USD */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Special Tier Cash Value ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={specialUsd}
              onChange={(e) => setSpecialUsd(Math.max(0.01, parseFloat(e.target.value) || 1))}
              disabled={isWindowActive}
              className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1">$1 = 5000 coins (special rate)</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {!isWindowActive ? (
            <button
              onClick={handleEnableWindow}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white font-bold rounded-lg transition-colors"
            >
              {saving ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              Enable Payout Window
            </button>
          ) : (
            <button
              onClick={handleDisableWindow}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-bold rounded-lg transition-colors"
            >
              {saving ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <StopCircle className="w-5 h-5" />
              )}
              Close Payout Window
            </button>
          )}

          <button
            onClick={handleSendNotification}
            disabled={sendingNotification || !isWindowActive}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-bold rounded-lg transition-colors"
          >
            {sendingNotification ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            Notify Eligible Users
          </button>

          <button
            onClick={loadStatus}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Link to Cashout Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-purple-400" />
            <div>
              <h4 className="font-bold text-white">Cashout Management</h4>
              <p className="text-xs text-slate-400">Review and process user payout requests</p>
            </div>
          </div>
          <Link
            to="/admin/cashout-manager"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors text-sm"
          >
            Open Cashout Manager →
          </Link>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-400">How It Works</h4>
            <ul className="text-sm text-slate-300 mt-1 space-y-1">
              <li>• When enabled, all users with {minCoins.toLocaleString()}+ coins can cash out at the special rate</li>
              <li>• The 5000 coin tier will pay ${specialUsd} instead of the normal rate</li>
              <li>• Users will receive in-app notifications about the payout window</li>
              <li>• The window automatically closes after {duration} minutes</li>
              <li>• Since all coins are purchased, all cashouts are pure profit!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Eligible Users Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Eligible Users Preview
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-white">{eligibleUsers}</div>
            <div className="text-sm text-slate-400">users with {minCoins.toLocaleString()}+ coins</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">${(eligibleUsers * specialUsd).toLocaleString()}</div>
            <div className="text-sm text-slate-400">potential payout at special rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}