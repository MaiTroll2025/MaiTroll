import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, RefreshCw, CheckCircle, XCircle, PauseCircle, PlayCircle, Clock, Users, Bell, Timer } from 'lucide-react';

interface PayoutRun {
  id: string;
  run_date: string;
  status: 'processing' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  total_payouts: number;
  total_coins: number;
  total_usd: number;
  paypal_batch_id: string | null;
  logs: any;
}

interface PayoutItem {
  id: string
  user_id: string
  paypal_email: string
  amount_coins: number
  amount_usd: number
  status: string
  paypal_payout_item_id: string | null
  failure_reason: string | null
  user_profiles?: { username: string }
}

interface PayoutWindowStatus {
  enabled: boolean;
  min_coins: number;
  special_tier_enabled?: boolean;
  special_tier_coins?: number;
  special_tier_usd?: number;
  duration_minutes?: number;
  enabled_at?: string;
  expires_at?: string;
  message?: string;
  notified_users?: boolean;
}

export default function AutomatedPayouts() {
  const [runs, setRuns] = useState<PayoutRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, PayoutItem[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  
  // Payout Window State
  const [payoutWindow, setPayoutWindow] = useState<PayoutWindowStatus | null>(null);
  const [windowLoading, setWindowLoading] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<number>(0);
  const [sendingNotification, setSendingNotification] = useState(false);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_app_settings')
        .select('setting_value')
        .eq('setting_key', 'automated_payouts_enabled')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPayoutsEnabled(data.setting_value?.enabled || false);
      } else {
        // Default to disabled if setting doesn't exist
        setPayoutsEnabled(false);
      }
    } catch (err) {
      console.error('Error loading payout config:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const loadPayoutWindow = async () => {
    setWindowLoading(true);
    try {
      // Payout window is now determined by user level in the backend
      setPayoutWindow({ enabled: true, min_coins: 7500 });

      // Load eligible users count (those with cashout_approved and enough escrow coins)
      const { count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('cashout_approved', true)
        .gte('cashout_coins', 7500);
      setEligibleUsers(count || 0);
    } catch (err) {
      console.error('Error loading payout window:', err);
    } finally {
      setWindowLoading(false);
    }
  };

  const togglePayouts = async () => {
    setConfigLoading(true);
    const newValue = !payoutsEnabled;
    try {
      const { error } = await supabase
        .from('admin_app_settings')
        .upsert({
          setting_key: 'automated_payouts_enabled',
          setting_value: { enabled: newValue },
          description: 'Master switch for automated payout runs'
        });

      if (error) throw error;
      setPayoutsEnabled(newValue);
      toast.success(newValue ? 'Automated payouts ENABLED' : 'Automated payouts PAUSED');
    } catch (err: any) {
      toast.error('Failed to update settings');
      console.error(err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleEnablePayoutWindow = async () => {
    setWindowLoading(true);
    try {
      const { data, error } = await supabase.rpc('enable_payout_window', {
        p_duration_minutes: 20,
        p_min_coins: 5000,
        p_special_tier_usd: 1
      });
      if (error) throw error;
      
      toast.success('Payout window enabled for 20 minutes!');
      setPayoutWindow(data);
      
      // Auto-send notification
      await handleSendPayoutNotification();
    } catch (err: any) {
      toast.error(err.message || 'Failed to enable payout window');
    } finally {
      setWindowLoading(false);
    }
  };

  const handleDisablePayoutWindow = async () => {
    setWindowLoading(true);
    try {
      const { data, error } = await supabase.rpc('disable_payout_window');
      if (error) throw error;
      
      toast.success('Payout window disabled');
      setPayoutWindow(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable payout window');
    } finally {
      setWindowLoading(false);
    }
  };

  const handleSendPayoutNotification = async () => {
    if (!payoutWindow) return;
    setSendingNotification(true);
    try {
      const minCoins = payoutWindow.min_coins || 5000;
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .gte('troll_coins', minCoins);

      if (usersError) throw usersError;
      if (!users || users.length === 0) {
        toast.error('No users found with sufficient coins');
        return;
      }

      const notifications = users.map(user => ({
        user_id: user.id,
        type: 'system_announcement',
        title: '💰 Payout Window OPEN!',
        message: `Special cashout tier available! Get $1 for 5,000 coins. This offer is available for 20 minutes only!`,
        metadata: { payout_window: true, special_tier: true, coins: 5000, usd: 1 },
        is_read: false
      }));

      const batchSize = 500;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        await supabase.from('notifications').insert(batch);
      }

      await supabase.rpc('mark_payout_window_notified');
      toast.success(`Notifications sent to ${users.length} users!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send notifications');
    } finally {
      setSendingNotification(false);
    }
  };

  const loadRuns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payout_runs')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) throw error;
      setRuns(data || []);
    } catch (err: any) {
      toast.error('Failed to load payout runs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRunDetails = async (runId: string) => {
    if (runDetails[runId]) return;
    setLoadingDetails(runId);
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select('*, user_profiles(username)')
        .eq('run_id', runId);

      if (error) throw error;
      setRunDetails(prev => ({ ...prev, [runId]: data || [] }));
    } catch {
      toast.error('Failed to load run details');
    } finally {
      setLoadingDetails(null);
    }
  };

  const toggleExpand = (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
    } else {
      setExpandedRunId(runId);
      loadRunDetails(runId);
    }
  };

  const handleRefundRun = async (runId: string) => {
    if (!window.confirm('Are you sure you want to refund this ENTIRE run? This will return coins to all users in this run.')) return;
    
    const toastId = toast.loading('Refunding run...');
    try {
      const { error } = await supabase.rpc('refund_payout_run', { p_run_id: runId });
      if (error) throw error;
      toast.success('Run refunded successfully', { id: toastId });
      loadRuns();
      setRunDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[runId]; // Force reload
        return newDetails;
      });
      if (expandedRunId === runId) loadRunDetails(runId);
    } catch (err: any) {
      toast.error(`Refund failed: ${err.message}`, { id: toastId });
    }
  };

  const handleRetryRun = async (_runId: string) => {
      // Logic to retry logic (e.g. call edge function manually if needed, or just re-run the process)
      // Since edge function is scheduled, maybe just a "Trigger Now" button for the general process?
      // Or if a run is failed but not refunded, maybe we want to retry submission?
      // For now, let's just allow triggering the generic payout process which picks up queued items.
      
      const toastId = toast.loading('Triggering payout process...');
      try {
          const { error } = await supabase.functions.invoke('payouts', { method: 'POST' });
          if (error) throw error;
          toast.success('Process triggered', { id: toastId });
          loadRuns();
      } catch (err: any) {
          toast.error(`Trigger failed: ${err.message}`, { id: toastId });
      }
  };

  useEffect(() => {
    loadRuns();
    loadConfig();
    loadPayoutWindow();
    
    const channel = supabase.channel('payout_runs_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_runs' }, () => loadRuns())
      .subscribe();
      
    return () => { if (channel) supabase.removeChannel(channel) };
  }, []);

  if (loading && runs.length === 0) return <div className="p-4 text-gray-400">Loading runs...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-black/20 p-4 rounded-lg border border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Automated Payout Runs
            {configLoading ? (
               <span className="text-xs text-gray-500 animate-pulse">(Loading status...)</span>
            ) : payoutsEnabled ? (
               <span className="px-2 py-0.5 rounded-full bg-green-900/50 border border-green-500/50 text-green-400 text-xs flex items-center gap-1">
                 <PlayCircle className="w-3 h-3" /> Active
               </span>
            ) : (
               <span className="px-2 py-0.5 rounded-full bg-red-900/50 border border-red-500/50 text-red-400 text-xs flex items-center gap-1">
                 <PauseCircle className="w-3 h-3" /> Paused
               </span>
            )}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {payoutsEnabled 
              ? "System is running normally. Payouts are processed on request." 
              : "System is on hold. No new payout runs will be generated."}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <button
                onClick={togglePayouts}
                disabled={configLoading}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                    payoutsEnabled 
                    ? 'bg-red-900/30 text-red-400 border border-red-500/30 hover:bg-red-900/50' 
                    : 'bg-green-900/30 text-green-400 border border-green-500/30 hover:bg-green-900/50'
                }`}
            >
                {payoutsEnabled ? (
                    <>
                        <PauseCircle className="w-4 h-4" /> Hold Payouts
                    </>
                ) : (
                    <>
                        <PlayCircle className="w-4 h-4" /> Release Payouts
                    </>
                )}
            </button>

            <button 
                onClick={() => handleRetryRun('')}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!payoutsEnabled}
                title={!payoutsEnabled ? "Enable payouts to trigger manually" : "Trigger manual check"}
            >
                <RefreshCw className="w-4 h-4" /> Trigger Now
            </button>
        </div>
      </div>

      {/* Payout Window Control Section */}
      <div className="mb-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg border border-green-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-bold text-white">Special Payout Window</h3>
            {payoutWindow?.enabled && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/50 text-green-400 text-xs animate-pulse">
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!payoutWindow?.enabled ? (
              <button
                onClick={handleEnablePayoutWindow}
                disabled={windowLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4" /> Enable Window
              </button>
            ) : (
              <button
                onClick={handleDisablePayoutWindow}
                disabled={windowLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <PauseCircle className="w-4 h-4" /> Close Window
              </button>
            )}
          </div>
        </div>
        
        {payoutWindow?.enabled ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-black/30 rounded p-3">
              <div className="text-gray-400 text-xs">Rate</div>
              <div className="text-green-400 font-bold">$1 per 5,000 coins</div>
            </div>
            <div className="bg-black/30 rounded p-3">
              <div className="text-gray-400 text-xs">Min Required</div>
              <div className="text-white font-bold">{payoutWindow.min_coins?.toLocaleString() || '5,000'} coins</div>
            </div>
            <div className="bg-black/30 rounded p-3">
              <div className="text-gray-400 text-xs">Eligible Users</div>
              <div className="text-white font-bold flex items-center gap-1">
                <Users className="w-3 h-3" /> {eligibleUsers}
              </div>
            </div>
            <div className="bg-black/30 rounded p-3">
              <div className="text-gray-400 text-xs">Time Remaining</div>
              <div className="text-yellow-400 font-bold font-mono">
                {payoutWindow.expires_at ? 
                  Math.max(0, Math.floor((new Date(payoutWindow.expires_at).getTime() - Date.now()) / 60000)) + ' min' 
                  : '20 min'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            Enable a special payout window to allow users to cash out at $1 per 5,000 coins (instead of $25). 
            Users with 5,000+ coins will be notified.
          </div>
        )}
        
        {payoutWindow?.enabled && (
          <div className="mt-3 pt-3 border-t border-green-500/20">
            <button
              onClick={handleSendPayoutNotification}
              disabled={sendingNotification}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Bell className="w-3 h-3" />
              {sendingNotification ? 'Sending...' : 'Notify Eligible Users'}
            </button>
          </div>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="p-8 border border-gray-800 rounded-lg text-center text-gray-500 bg-black/20">
          No automated payout runs found.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <div key={run.id} className="border border-gray-700 rounded-lg bg-[#111] overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleExpand(run.id)}
              >
                <div className="flex items-center gap-4">
                    {run.status === 'completed' ? <CheckCircle className="text-green-500" /> : 
                     run.status === 'failed' ? <XCircle className="text-red-500" /> : 
                     <RefreshCw className="text-yellow-500 animate-spin" />}
                    
                    <div>
                        <div className="font-mono text-sm text-gray-400">{run.id.slice(0, 8)}...</div>
                        <div className="font-semibold text-white">{new Date(run.started_at).toLocaleString()}</div>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-gray-400">Total</div>
                        <div className="font-bold text-green-400">${run.total_usd.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-400">Payouts</div>
                        <div className="font-bold text-white">{run.total_payouts}</div>
                    </div>
                    {expandedRunId === run.id ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>
              
              {expandedRunId === run.id && (
                <div className="border-t border-gray-800 bg-black/40 p-4">
                    <div className="flex justify-end gap-2 mb-4">
                        {run.status === 'failed' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRefundRun(run.id); }}
                                className="px-3 py-1 bg-red-900/50 border border-red-700 text-red-200 rounded text-sm hover:bg-red-900"
                            >
                                Refund Run
                            </button>
                        )}
                        <div className="text-xs text-gray-500 font-mono self-center">
                            Batch: {run.paypal_batch_id || 'N/A'}
                        </div>
                    </div>
                    
                    {loadingDetails === run.id ? (
                        <div className="text-center py-4 text-gray-500">Loading details...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-black/20">
                                    <tr>
                                        <th className="px-3 py-2">User</th>
                                        <th className="px-3 py-2">PayPal Email</th>
                                        <th className="px-3 py-2 text-right">Amount</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {runDetails[run.id]?.map(item => (
                                        <tr key={item.id} className="hover:bg-white/5">
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-white">{item.user_profiles?.username || 'Unknown'}</div>
                                                <div className="text-xs text-gray-500">{item.user_id.slice(0, 8)}...</div>
                                            </td>
                                            <td className="px-3 py-2 text-gray-300">{item.paypal_email}</td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="text-green-400 font-bold">${item.amount_usd}</div>
                                                <div className="text-xs text-gray-500">{item.amount_coins.toLocaleString()} coins</div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    item.status === 'success' ? 'bg-green-900 text-green-200' :
                                                    item.status === 'failed' ? 'bg-red-900 text-red-200' :
                                                    item.status === 'returned' ? 'bg-orange-900 text-orange-200' :
                                                    'bg-blue-900 text-blue-200'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-500">
                                                {item.failure_reason && <div className="text-red-400">{item.failure_reason}</div>}
                                                <div>{item.paypal_payout_item_id || '-'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
