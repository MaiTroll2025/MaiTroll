import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, UserPlus, Link2, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

/**
 * Mobile battle Share & Invite sheet.
 * - Share: native share / other platforms (like ViewerPage).
 * - Invite Followers: notifies the user's followers to watch the broadcast.
 * - Copy Link: copies the broadcast URL.
 */
export default function MobileBattleShareSheet({
  streamId,
  broadcasterUsername,
  title,
  currentUserId,
  onClose,
}: {
  streamId?: string;
  broadcasterUsername?: string | null;
  title: string;
  currentUserId?: string | null;
  onClose: () => void;
}) {
  const shareUrl = broadcasterUsername
    ? `${window.location.origin}/live/${encodeURIComponent(broadcasterUsername)}`
    : window.location.origin;
  const shareTitle = title || "Watch this Mai Troll battle";

  const shareToPlatforms = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: "Join this Mai Troll battle",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Battle link copied");
      }
    } catch {
      /* user cancelled */
    }
    onClose();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
    onClose();
  };

  const inviteFollowers = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const inviterId = userData.user?.id || currentUserId;
      if (!inviterId || !streamId) return;
      const { data, error } = await supabase.rpc("invite_followers_to_broadcast", {
        p_stream_id: streamId,
        p_inviter_id: inviterId,
      });
      if (error) throw error;
      toast.success(`Invited ${data?.invited_count || 0} followers`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to invite followers");
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[61] max-h-[80vh] overflow-y-auto rounded-t-3xl bg-zinc-900 p-4"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Share &amp; Invite</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={shareToPlatforms}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-left active:scale-[0.99]"
          >
            <Share2 size={18} className="text-purple-300" />
            <div>
              <div className="text-sm font-bold text-white">Share</div>
              <div className="text-[11px] text-white/50">Share to other platforms</div>
            </div>
          </button>
          <button
            onClick={inviteFollowers}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-left active:scale-[0.99]"
          >
            <UserPlus size={18} className="text-emerald-300" />
            <div>
              <div className="text-sm font-bold text-white">Invite Followers</div>
              <div className="text-[11px] text-white/50">Notify your followers to watch</div>
            </div>
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-left active:scale-[0.99]"
          >
            <Link2 size={18} className="text-blue-300" />
            <div>
              <div className="text-sm font-bold text-white">Copy Link</div>
              <div className="text-[11px] text-white/50">Copy the battle link</div>
            </div>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
