import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { Link } from 'react-router-dom';

export default function OfficerAlertBanner() {
  const { profile } = useAuthStore();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [visible, setVisible] = useState(() => {
    const dismissed = localStorage.getItem('officerAlertDismissed');
    return dismissed !== 'true';
  });

  // Check if user is officer or admin
  const isOfficer = profile?.role === 'troll_officer' || profile?.role === 'admin' || profile?.is_troll_officer || profile?.is_admin;

  useEffect(() => {
    if (!isOfficer) return;

    const checkAlerts = async () => {
      // Check for stalled payouts (> 30 mins pending)
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: stalledPayouts } = await supabase
        .from('payout_requests')
        .select('id, created_at')
        .eq('status', 'pending')
        .lt('created_at', thirtyMinsAgo);

      // Check for failed payouts
      const { data: failedPayouts } = await supabase
        .from('payout_requests')
        .select('id')
        .eq('status', 'rejected');

      const newAlerts = [];
      
      if (stalledPayouts && stalledPayouts.length > 0) {
        newAlerts.push({
          type: 'delay',
          message: `${stalledPayouts.length} payout(s) pending > 30 mins! Action required.`,
          link: '/admin/cashout-manager'
        });
      }

      if (failedPayouts && failedPayouts.length > 0) {
        newAlerts.push({
          type: 'error',
          message: `${failedPayouts.length} payout(s) failed delivery! Check ASAP.`,
          link: '/admin/cashout-manager'
        });
      }

      setAlerts(newAlerts);
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isOfficer]);

  if (!isOfficer || !visible || alerts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col gap-1 pointer-events-none">
      {alerts.map((alert, i) => (
        <div key={i} className="pointer-events-auto bg-red-600 text-white px-4 py-3 shadow-lg flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <span className="font-bold">{alert.message}</span>
            <Link to={alert.link} className="underline text-sm hover:text-red-200">
              View Details
            </Link>
          </div>
          <button onClick={() => { setVisible(false); localStorage.setItem('officerAlertDismissed', 'true'); }} className="p-1 hover:bg-red-700 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
