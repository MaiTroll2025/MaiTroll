import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

interface PayoutRequest {
  id: string;
  user_id: string;
  username: string;
  coin_amount: number;
  cash_amount: number;
  net_amount: number;
  status: string;
  provider_type: string;
  provider_username: string;
  user_tag: string | null;
  id_verification_url: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejection_reason: string | null;
}

const AdminPayoutMobile: React.FC = () => {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*")
      .in("status", ["pending", "reviewed", "approved"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load payout requests");
      return;
    }

    setRequests((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();

    const interval = window.setInterval(() => {
      void loadRequests();
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadRequests]);

  const handleApprove = async (req: PayoutRequest) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'approve_payout', requestId: req.id },
      })
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Approved payout for ${req.username}`);
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Error approving payout');
    }
  };

  const handlePay = async (req: PayoutRequest) => {
    const ref = window.prompt('Enter payment reference (optional)') || null;
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'update_payout_status', payoutId: req.id, newStatus: 'paid', paymentReference: ref },
      })
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Marked as paid for ${req.username}`);
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Error marking as paid');
    }
  };

  const handleReject = async (req: PayoutRequest) => {
    const reason = window.prompt('Enter rejection reason:') || 'Rejected by admin';
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'reject_payout', requestId: req.id, reason },
      })
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Rejected payout for ${req.username} - coins returned`);
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Error rejecting payout');
    }
  };

  if (loading) return <p className="text-center mt-10 text-white">Loading...</p>;

  return (
    <div className="p-4 max-w-md mx-auto text-white">
      <h2 className="text-xl font-semibold mb-4">Fast Pay Payout Requests</h2>
      <p className="text-xs text-gray-400 mb-4">
        Unified cashout system — Fast Pay / MAI Pay only
      </p>

      {requests.length === 0 && (
        <p className="text-gray-500 text-center py-8">No pending requests</p>
      )}

      {requests.map((req) => (
        <div
          key={req.id}
          className="bg-gray-800 rounded-lg p-4 mb-3 shadow border border-gray-700"
        >
          <p className="text-sm">
            <strong>{req.username}</strong> requested{" "}
            <span className="text-green-400">${req.cash_amount?.toFixed(2) || "0.00"}</span>
          </p>
          <p className="text-xs text-gray-400">
            Coins: {req.coin_amount?.toLocaleString() || 0} ($0.25 fee applies)
          </p>
          <p className="text-xs text-gray-400">
            Method: {req.provider_type?.replace("_", " ") || "N/A"} → {req.provider_username || "N/A"}
          </p>
          {req.user_tag && (
            <p className="text-xs text-gray-400">Tag: {req.user_tag}</p>
          )}
          {req.id_verification_url && (
            <a
              href={req.id_verification_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-xs block mt-1"
            >
              View ID Verification
            </a>
          )}
          <p
            className={`text-xs font-medium mt-1 ${
              req.status === "pending"
                ? "text-yellow-400"
                : req.status === "reviewed"
                ? "text-blue-400"
                : req.status === "approved"
                ? "text-green-400"
                : "text-gray-400"
            }`}
          >
            Status: {req.status.toUpperCase()}
          </p>
          {req.rejection_reason && (
            <p className="text-xs text-red-400 mt-1">Reason: {req.rejection_reason}</p>
          )}

          {req.status === "pending" || req.status === "reviewed" ? (
            <div className="flex justify-between mt-3 gap-2">
              <button
                type="button"
                onClick={() => handleApprove(req)}
                className="bg-green-500 hover:bg-green-600 text-xs px-3 py-1 rounded flex-1"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReject(req)}
                className="bg-red-500 hover:bg-red-600 text-xs px-3 py-1 rounded flex-1"
              >
                Reject
              </button>
            </div>
          ) : req.status === "approved" ? (
            <div className="flex justify-between mt-3 gap-2">
              <button
                type="button"
                onClick={() => handlePay(req)}
                className="bg-purple-500 hover:bg-purple-600 text-xs px-3 py-1 rounded flex-1"
              >
                Mark Paid
              </button>
              <button
                type="button"
                onClick={() => handleReject(req)}
                className="bg-red-500 hover:bg-red-600 text-xs px-3 py-1 rounded flex-1"
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default AdminPayoutMobile;
