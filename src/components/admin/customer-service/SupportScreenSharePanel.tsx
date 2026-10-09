import React, { useState } from "react";
import {
  Monitor,
  MonitorOff,
  Check,
  X,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { useAuthStore } from "../../../lib/store";
import { toast } from "sonner";
import { CSUser } from "../../../hooks/useCustomerServiceUsers";
import { useSupportScreenSession } from "../../../hooks/useSupportScreenSession";

interface SupportScreenSharePanelProps {
  user: CSUser;
}

export default function SupportScreenSharePanel({
  user,
}: SupportScreenSharePanelProps) {
  const { profile: _profile } = useAuthStore();
  const {
    activeSession,
    incomingRequest,
    loading,
    isAdmin,
    requestScreenShare,
    acceptScreenShare,
    declineScreenShare,
    endScreenShare,
  } = useSupportScreenSession();

  const [reason, setReason] = useState("");

  const handleRequest = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the screen share request");
      return;
    }
    await requestScreenShare(user.id, reason);
    setReason("");
  };

  const handleEnd = async () => {
    if (activeSession) {
      await endScreenShare(activeSession.id);
    }
  };

  // Show incoming request UI for the target user
  if (incomingRequest && !isAdmin) {
    return (
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-cyan-400 animate-pulse" />
          <h4 className="text-sm font-bold text-cyan-200">
            Screen Share Request
          </h4>
        </div>
        <p className="mb-3 text-xs text-slate-300">
          Customer Service is requesting to view your screen to help fix your
          issue.
        </p>
        {incomingRequest.reason && (
          <p className="mb-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
            <strong className="text-slate-300">Reason:</strong>{" "}
            {incomingRequest.reason}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => acceptScreenShare(incomingRequest.id)}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
          <button
            onClick={() => declineScreenShare(incomingRequest.id)}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
        </div>
      </div>
    );
  }

  // Show active session status
  if (activeSession && activeSession.status === "active") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Radio className="h-4 w-4 text-green-400 animate-pulse" />
            <h4 className="text-sm font-bold text-green-300">
              Screen Share Active
            </h4>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Room: {activeSession.livekit_room_name}
          </p>

          {/* LiveKit player placeholder */}
          <div className="mb-3 flex h-32 items-center justify-center rounded-lg border border-dashed border-green-500/20 bg-black/30">
            <div className="text-center">
              <Monitor className="mx-auto mb-1 h-6 w-6 text-green-400/50" />
              <p className="text-[10px] text-slate-500">
                LiveKit screen share player
              </p>
              <p className="text-[10px] text-slate-600">
                Room: {activeSession.livekit_room_name}
              </p>
            </div>
          </div>

          <button
            onClick={handleEnd}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <MonitorOff className="h-3.5 w-3.5" />
            {loading ? "Ending..." : "End Screen Share"}
          </button>
        </div>
      </div>
    );
  }

  // Show pending request status
  if (activeSession && activeSession.status === "requested" && isAdmin) {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400 animate-pulse" />
          <h4 className="text-sm font-bold text-yellow-300">
            Request Pending
          </h4>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Waiting for {user.username} to accept or decline...
        </p>
        <button
          onClick={handleEnd}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
        >
          Cancel Request
        </button>
      </div>
    );
  }

  // Default: show request form (CEO only)
  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
        <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-slate-600" />
        <p className="text-xs text-slate-500">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <Monitor className="h-4 w-4 text-cyan-400" />
        Request Screen Share
      </h4>

      <p className="mb-3 text-[11px] text-slate-400">
        {user.username} will receive a prompt to accept or decline. Screen
        sharing will only begin after they accept.
      </p>

      <div className="mb-3">
        <label className="mb-1 block text-[11px] text-slate-400">
          Reason (required)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you need to view their screen?"
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/50"
        />
      </div>

      <button
        onClick={handleRequest}
        disabled={loading || !reason.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Monitor className="h-3.5 w-3.5" />
        {loading ? "Sending..." : "Request Screen Share"}
      </button>
    </div>
  );
}
