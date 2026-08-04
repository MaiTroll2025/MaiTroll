import React from "react";
import { ExternalLink, DollarSign, Shield } from "lucide-react";
import { useAuthStore } from "../../../lib/store";

export default function AdminPayoutDashboard() {
  const { profile } = useAuthStore();

  const isAdmin =
    (profile?.role && ['admin', 'secretary'].includes(profile.role)) ||
    (profile?.troll_role && ['admin', 'secretary'].includes(profile.troll_role)) ||
    profile?.is_admin;

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const handleRedirectToMAIAdmin = () => {
    window.open('https://maicorp.online/admin/payouts', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-cyan-950/50 to-purple-950/50 border border-cyan-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10">
            <Shield className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">MAI Pay Integration</h2>
            <p className="text-sm text-slate-400">Centralized payout processing</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-2">Payout Processing Migrated</h3>
            <p className="text-sm text-slate-300 mb-3">
              All payout processing has been moved to MAI Pay on MAICorp.online.
              Mai Troll no longer handles direct payout approvals or PayPal processing.
            </p>
            <div className="flex items-center gap-2 text-sm text-cyan-400">
              <DollarSign className="h-4 w-4" />
              <span>Powered by PayPal through MAI Pay</span>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-2">Admin Access</h3>
            <p className="text-sm text-slate-300 mb-4">
              Access the centralized MAI Pay admin dashboard to manage payouts,
              view payout statuses, and handle reconciliation.
            </p>
            <button
              onClick={handleRedirectToMAIAdmin}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
            >
              Open MAI Pay Admin
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-lg font-bold text-white mb-2">Payout Statuses</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-center">
                <div className="text-cyan-400 font-bold">Pending</div>
                <div className="text-slate-400">Awaiting review</div>
              </div>
              <div className="text-center">
                <div className="text-yellow-400 font-bold">Reviewing</div>
                <div className="text-slate-400">Under review</div>
              </div>
              <div className="text-center">
                <div className="text-blue-400 font-bold">Processing</div>
                <div className="text-slate-400">Being processed</div>
              </div>
              <div className="text-center">
                <div className="text-green-400 font-bold">Completed</div>
                <div className="text-slate-400">Paid out</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}