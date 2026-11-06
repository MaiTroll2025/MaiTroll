import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

interface TemporaryReviewSessionGuardProps {
  children: ReactNode;
  enabled: boolean;
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function TemporaryReviewSessionGuard({
  children,
  enabled,
}: TemporaryReviewSessionGuardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const [now, setNow] = useState(Date.now());
  const [ended, setEnded] = useState(false);
  const [verifiedExpiresAt, setVerifiedExpiresAt] = useState<number | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const endingRef = useRef(false);
  const verificationRef = useRef<string | null>(null);
  const isReviewCandidate = user?.app_metadata?.temporary_review_created === true;
  const isReviewAccount = profile?.is_temporary_review_account === true || verifiedExpiresAt !== null;
  const expiresAt = profile?.temporary_review_expires_at
    ? new Date(profile.temporary_review_expires_at).getTime()
    : verifiedExpiresAt;

  useEffect(() => {
    if (!enabled || !user?.id || !isReviewCandidate) {
      verificationRef.current = null;
      setVerifiedExpiresAt(null);
      setVerificationFailed(false);
      return;
    }
    if (profile?.is_temporary_review_account === true && profile.temporary_review_expires_at) {
      verificationRef.current = user.id;
      return;
    }
    if (verificationRef.current === user.id) return;
    setVerifiedExpiresAt(null);
    setVerificationFailed(false);
    verificationRef.current = user.id;

    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("is_temporary_review_account, temporary_review_expires_at")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) return;
        const expiration = data?.temporary_review_expires_at
          ? new Date(data.temporary_review_expires_at).getTime()
          : null;
        if (
          error ||
          data?.is_temporary_review_account !== true ||
          expiration === null ||
          !Number.isFinite(expiration)
        ) {
          if (error) console.error("[temporary-review-session] Could not verify review access", error);
          setVerificationFailed(true);
          return;
        }
        setVerifiedExpiresAt(expiration);
      } catch (error) {
        if (!active) return;
        console.error("[temporary-review-session] Could not verify review access", error);
        setVerificationFailed(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    enabled,
    isReviewCandidate,
    profile?.is_temporary_review_account,
    profile?.temporary_review_expires_at,
    user?.id,
  ]);

  useEffect(() => {
    if (!enabled || !user || !isReviewAccount) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled, isReviewAccount, user]);

  const remaining = expiresAt === null ? 0 : Math.max(0, expiresAt - now);
  const sessionEnded = enabled && !!user && (
    verificationFailed || (isReviewAccount && remaining <= 0)
  );

  useEffect(() => {
    if (!sessionEnded || endingRef.current) return;
    endingRef.current = true;
    setEnded(true);

    const finishSession = async () => {
      try {
        await supabase.removeAllChannels();
      } catch (error) {
        console.error("[temporary-review-session] Failed to disconnect realtime channels", error);
      }

      try {
        const { error } = await supabase.auth.signOut({ scope: "global" });
        if (error && !/expired|invalid jwt|session missing/i.test(error.message)) {
          console.error("[temporary-review-session] Failed to revoke the session", error);
        }
      } catch (error) {
        console.error("[temporary-review-session] Failed to end the auth session", error);
      } finally {
        useAuthStore.setState({
          user: null,
          session: null,
          sessionId: null,
          profile: null,
          isLoading: false,
          isAdmin: null,
          isRefreshing: false,
        });
        window.setTimeout(() => {
          navigate("/", { replace: true });
          setEnded(false);
          endingRef.current = false;
        }, 2500);
      }
    };

    void finishSession();
  }, [navigate, sessionEnded]);

  return (
    <>
      {children}
      {enabled && user && isReviewAccount && !sessionEnded && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[120] rounded-full border border-amber-400/50 bg-black/90 px-4 py-2 text-sm font-semibold text-amber-200 shadow-lg"
        >
          Review access ends in {formatCountdown(remaining)}
        </div>
      )}
      {ended && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="review-session-ended-title"
            className="w-full max-w-lg rounded-2xl border border-purple-400/50 bg-zinc-950 p-8 text-center shadow-2xl"
          >
            <h1 id="review-session-ended-title" className="mb-4 text-2xl font-bold text-white">
              Your MaiTroll Review Session Has Ended
            </h1>
            <p className="text-gray-300">
              Your 60-minute temporary access has expired. Your review account is being permanently removed. Thank you for exploring MaiTroll.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
