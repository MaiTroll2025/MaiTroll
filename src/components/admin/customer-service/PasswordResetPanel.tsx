import React, { useState } from "react";
import { KeyRound, Send, AlertTriangle, FileText } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuthStore } from "../../../lib/store";
import { toast } from "sonner";
import { CSUser } from "../../../hooks/useCustomerServiceUsers";

interface PasswordResetPanelProps {
  user: CSUser;
}

export default function PasswordResetPanel({ user }: PasswordResetPanelProps) {
  const { profile } = useAuthStore();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentResets, setRecentResets] = useState<any[]>([]);

  const isAdmin = profile?.is_admin === true || profile?.role === "admin" || profile?.role === "ceo";

  const fetchRecentResets = React.useCallback(async () => {
    const { data } = await supabase
      .from("admin_password_resets")
      .select("id, reset_method, reason, created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentResets(data || []);
  }, [user.id]);

  React.useEffect(() => {
    void fetchRecentResets();
  }, [fetchRecentResets]);

  const handlePasswordReset = async (method: "send" | "force") => {
if (!isAdmin) {
        toast.error("Only admins can perform password resets");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "customer-service-admin",
        {
          body: {
            action: method === "send" ? "send_password_reset" : "force_password_reset",
            target_user_id: user.id,
            reason: reason || null,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Password reset initiated");
      setReason("");
      fetchRecentResets();
    } catch (err: any) {
      toast.error(err.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Admin-only notice */}
      {!isAdmin && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-400" />
          <p className="text-xs text-red-300">Admin access required</p>
        </div>
      )}

      {/* Password reset controls */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-cyan-400" />
          Password Reset
        </h4>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-slate-400">
            Reason / Note (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this reset needed?"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handlePasswordReset("send")}
            disabled={loading || !isAdmin}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
          <button
            onClick={() => handlePasswordReset("force")}
            disabled={loading || !isAdmin}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {loading ? "Processing..." : "Force Reset"}
          </button>
        </div>

        <p className="mt-2 text-[10px] text-slate-600">
          Reset link is sent to user&apos;s email via secure edge function. No password is ever shown or stored.
        </p>
      </div>

      {/* Recent resets */}
      {recentResets.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <FileText className="h-4 w-4 text-purple-400" />
            Recent Resets
          </h4>
          <div className="space-y-1.5">
            {recentResets.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[11px]"
              >
                <div>
                  <span className="text-slate-300">{r.reset_method}</span>
                  {r.reason && (
                    <span className="ml-2 text-slate-500">— {r.reason}</span>
                  )}
                </div>
                <span className="text-slate-600">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
