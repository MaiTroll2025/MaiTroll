import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { moderation } from '@/services/maitrollModeration';
import { jailAttorneyService, type JailRequest } from '@/services/jailAttorneyService';
import { toast } from 'sonner';
import {
  Shield,
  Lock,
  DollarSign,
  Scale,
  Building2,
  Send,
  Gavel,
  Ban,
  MessageSquare,
  Timer,
  Phone,
  UserCheck,
  UserX,
  Hash,
  CalendarDays,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

type ContactType = 'attorney' | 'admin';

export default function JailPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [jailState, setJailState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [postingBond, setPostingBond] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const [contactType, setContactType] = useState<ContactType | null>(null);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [requestingAttorney, setRequestingAttorney] = useState(false);
  const [requestingAdmin, setRequestingAdmin] = useState(false);

  const [now, setNow] = useState(Date.now());
  const [attorneyStatus, setAttorneyStatus] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);

  const [attorneyRequest, setAttorneyRequest] = useState<JailRequest | null>(null);
  const [adminRequest, setAdminRequest] = useState<JailRequest | null>(null);
  const [hasAttorneyAccess, setHasAttorneyAccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadJailState = useCallback(async () => {
    if (!user) return;
    try {
      const state = await moderation.getJailState(user.id);
      setJailState(state);
    } catch (err) {
      console.error('Failed to load jail state:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadWalletBalance = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setWalletBalance(data?.troll_coins || 0);
    } catch (err) {
      console.error('Failed to load wallet:', err);
    }
  }, [user]);

  const loadRequestStatus = useCallback(async () => {
    if (!user || !jailState?.jailId) return;

    try {
      const { data, error } = await supabase
        .from('jail_requests')
        .select('request_type, status')
        .eq('jail_id', jailState.jailId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data) return;

      const attorneyReq = data.find(r => r.request_type === 'attorney');
      const adminReq = data.find(r => r.request_type === 'admin');

      if (attorneyReq) setAttorneyStatus(attorneyReq.status);
      if (adminReq) setAdminStatus(adminReq.status);
    } catch (err) {
      console.error('Failed to load request status:', err);
    }
  }, [user, jailState?.jailId]);

  const loadAttorneyRequest = useCallback(async () => {
    if (!user || !jailState?.jailId) return;
    const req = await jailAttorneyService.loadMyRequest(jailState.jailId, 'attorney');
    setAttorneyRequest(req);
    setHasAttorneyAccess(req?.status === 'fulfilled');
  }, [user, jailState?.jailId]);

  const loadAdminRequest = useCallback(async () => {
    if (!user || !jailState?.jailId) return;
    const req = await jailAttorneyService.loadMyRequest(jailState.jailId, 'admin');
    setAdminRequest(req);
  }, [user, jailState?.jailId]);

  /*
   * ============================================================
   * LOAD
   * ============================================================
   */

  useEffect(() => {
    if (!user) return;
    loadJailState();
    loadWalletBalance();
    loadRequestStatus();
  }, [user, loadJailState, loadWalletBalance, loadRequestStatus]);

  /*
   * ============================================================
   * LIVE CLOCK
   * ============================================================
   */

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  /*
   * ============================================================
   * PREVENT NAVIGATION ESCAPE WHILE JAILED
   * ============================================================
   */

  useEffect(() => {
    if (!jailState?.isJailed) return;

    const preventBackNavigation = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', preventBackNavigation);

    return () => {
      window.removeEventListener('popstate', preventBackNavigation);
    };
  }, [jailState?.isJailed]);

  /*
   * ============================================================
   * AUTO RELEASE WHEN SENTENCE EXPIRES
   * ============================================================
   */

  useEffect(() => {
    if (!jailState?.isJailed || !jailState?.scheduledReleaseAt) return;

    const releaseDate = new Date(jailState.scheduledReleaseAt);
    const interval = setInterval(() => {
      const remaining = releaseDate.getTime() - Date.now();
      if (remaining <= 0) {
        setNow(Date.now());
        loadJailState();
        loadWalletBalance();
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [jailState?.isJailed, jailState?.scheduledReleaseAt, loadJailState, loadWalletBalance]);

  /*
   * ============================================================
   * REALTIME UPDATES
   * ============================================================
   */

  useEffect(() => {
    if (!jailState?.jailId || !user) return;

    const unsubJail = jailAttorneyService.subscribeToJailUpdates(jailState.jailId, () => {
      loadJailState();
      loadWalletBalance();
    });

    const unsubRequest = jailAttorneyService.subscribeToRequestUpdates(
      jailState.jailId,
      user.id,
      () => {
        loadRequestStatus();
        loadAttorneyRequest();
        loadAdminRequest();
      }
    );

    return () => {
      unsubJail();
      unsubRequest();
    };
  }, [jailState?.jailId, user, loadJailState, loadWalletBalance, loadRequestStatus, loadAttorneyRequest, loadAdminRequest]);

  /*
   * ============================================================
   * POST BOND
   * ============================================================
   */

  const handlePostBond = async () => {
    if (!jailState?.jailId) return;

    setPostingBond(true);

    try {
      const result = await moderation.postBond(jailState.jailId);

      if (!result.success) {
        toast.error(result.message || 'Failed to post bond');
        return;
      }

      toast.success(
        result.message || 'Bond posted. You have been released.'
      );

      await loadJailState();
      await loadWalletBalance();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post bond');
    } finally {
      setPostingBond(false);
    }
  };

  /*
   * ============================================================
   * REQUEST ATTORNEY
   * ============================================================
   */

  const handleRequestAttorney = async () => {
    if (!user || !jailState?.jailId) return;

    if (attorneyStatus && attorneyStatus !== 'rejected') {
      toast.error('You already have an attorney request pending.');
      return;
    }

    setRequestingAttorney(true);

    try {
      const result = await jailAttorneyService.requestAttorney(jailState.jailId);

      if (!result.success) {
        toast.error(result.error || 'Unable to request an attorney right now.');
        return;
      }

      toast.success(
        'Attorney requested. Your request has been sent to all available attorneys.'
      );
      setAttorneyStatus('pending');
      await loadAttorneyRequest();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message || 'Unable to request an attorney right now.'
      );
    } finally {
      setRequestingAttorney(false);
    }
  };

  /*
   * ============================================================
   * CONTACT ADMIN
   * ============================================================
   */

  const handleContactAdmin = async () => {
    if (!user || !jailState?.jailId) return;

    if (adminStatus && adminStatus !== 'rejected') {
      toast.error('You already have an admin request pending.');
      return;
    }

    setRequestingAdmin(true);

    try {
      const result = await jailAttorneyService.requestAdmin(jailState.jailId);

      if (!result.success) {
        toast.error(result.error || 'Unable to contact administration right now.');
        return;
      }

      toast.success(
        'Administration has been contacted.'
      );
      setAdminStatus('pending');
      await loadAdminRequest();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message || 'Unable to contact administration right now.'
      );
    } finally {
      setRequestingAdmin(false);
    }
  };

  /*
   * ============================================================
   * ATTORNEY QUOTE ACTIONS
   * ============================================================
   */

  const handleAcceptAttorneyQuote = async () => {
    if (!attorneyRequest) return;
    setActionLoading(true);
    try {
      const result = await jailAttorneyService.acceptAttorneyQuote(attorneyRequest.id);
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to accept quote.');
        return;
      }
      toast.success(result.message || 'Attorney quote accepted!');
      await loadAttorneyRequest();
      loadRequestStatus();
      loadWalletBalance();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept quote.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDenyAttorneyQuote = async () => {
    if (!attorneyRequest) return;
    setActionLoading(true);
    try {
      const result = await jailAttorneyService.denyAttorneyQuote(attorneyRequest.id);
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to deny quote.');
        return;
      }
      toast.success(result.message || 'Attorney quote denied.');
      await loadAttorneyRequest();
      loadRequestStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deny quote.');
    } finally {
      setActionLoading(false);
    }
  };

  /*
   * ============================================================
   * ADMIN BOND QUOTE ACTIONS
   * ============================================================
   */

  const handleAcceptAdminBondQuote = async () => {
    if (!adminRequest) return;
    setActionLoading(true);
    try {
      const result = await jailAttorneyService.acceptAdminBondQuote(adminRequest.id);
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to accept bond quote.');
        return;
      }
      toast.success(result.message || 'Bond accepted!');
      await loadAdminRequest();
      loadRequestStatus();
      loadJailState();
      loadWalletBalance();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept bond quote.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDenyAdminBondQuote = async () => {
    if (!adminRequest) return;
    setActionLoading(true);
    try {
      const result = await jailAttorneyService.denyAdminBondQuote(adminRequest.id);
      if (!result.success) {
        toast.error(result.error || result.message || 'Failed to deny bond quote.');
        return;
      }
      toast.success(result.message || 'Bond quote denied.');
      await loadAdminRequest();
      loadRequestStatus();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to deny bond quote.');
    } finally {
      setActionLoading(false);
    }
  };

  /*
   * ============================================================
   * SEND MESSAGE
   * ============================================================
   */

  const handleSendMessage = async () => {
    if (!user || !jailState?.jailId) return;

    if (!contactType) {
      toast.error('Choose Attorney or Administration first.');
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      toast.error('Enter a message first.');
      return;
    }

    if (trimmed.length > 2000) {
      toast.error('Message cannot exceed 2,000 characters.');
      return;
    }

    setSendingMessage(true);

    try {
      const { error } = await supabase
        .from('jail_messages')
        .insert({
          jail_id: jailState.jailId,
          sender_id: user.id,
          recipient_type: contactType,
          message: trimmed,
        });

      if (error) throw error;

      setMessage('');
      toast.success(
        contactType === 'attorney'
          ? 'Message sent to Attorney Services.'
          : 'Message sent to Administration.'
      );
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message || 'Unable to send your message.'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /*
   * ============================================================
   * TIME
   * ============================================================
   */

  const releaseDate = jailState?.scheduledReleaseAt
    ? new Date(jailState.scheduledReleaseAt)
    : null;

  const remainingSeconds = releaseDate
    ? Math.max(0, Math.floor((releaseDate.getTime() - now) / 1000))
    : 0;

  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const countdown = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const canAffordBond =
    walletBalance >= (jailState?.bondAmount || 0);

  const canAffordAttorneyQuote =
    walletBalance >= (attorneyRequest?.quoteAmount || 0);

  const canAffordAdminBondQuote =
    walletBalance >= (adminRequest?.quoteAmount || 0);

  const severityLabel = useMemo(() => {
    const map: Record<string, string> = {
      minor: 'MINOR',
      moderate: 'MODERATE',
      serious: 'SERIOUS',
      severe: 'SEVERE',
    };
    return map[jailState?.severity || 'moderate'] || 'MODERATE';
  }, [jailState?.severity]);

  const severityColor = useMemo(() => {
    const map: Record<string, string> = {
      minor: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
      moderate: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
      serious: 'text-red-400 border-red-500/40 bg-red-500/10',
      severe: 'text-red-300 border-red-600/50 bg-red-600/15',
    };
    return map[jailState?.severity || 'moderate'] || map.moderate;
  }, [jailState?.severity]);

  const displayUsername = user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    'MaiTroll User';

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-white font-semibold">
            Checking detention status...
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Mai Troll Corrections
          </p>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * NOT JAILED
   * ============================================================
   */

  if (!jailState?.isJailed) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-slate-900 border border-green-900/40 rounded-2xl p-10 text-center shadow-2xl">
          <Shield className="w-20 h-20 text-green-400 mx-auto mb-5" />
          <h1 className="text-3xl font-black text-white">
            YOU ARE FREE
          </h1>
          <p className="text-slate-400 mt-3">
            No active detention record was found for your account.
          </p>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * JAILED UI
   * ============================================================
   */

  return (
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-[#060606] text-white">
      {/* ======================================================
          INSTITUTIONAL HEADER
      ====================================================== */}

      <header className="sticky top-0 z-50 border-b border-red-900/40 bg-black/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-950 border border-red-800 flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-black tracking-wide text-sm">
                MAI TROLL
              </p>
              <p className="text-[10px] text-red-400 uppercase tracking-[0.2em] font-bold">
                Department of Corrections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Ban className="w-4 h-4" />
            Account Restricted
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* ====================================================
            ARREST BANNER
        ==================================================== */}

        <div className="border-2 border-red-800 bg-red-950/20 rounded-none p-5 md:p-6 mb-6 md:mb-8">
          <div className="flex gap-4">
            <div className="shrink-0">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-red-600 bg-red-950/60 flex items-center justify-center">
                <Lock className="w-6 h-6 md:w-7 md:h-7 text-red-400" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-red-500 uppercase tracking-[0.25em] font-bold mb-1">
                Case Status
              </p>
              <h1 className="font-black text-xl md:text-2xl text-red-300 uppercase tracking-tight">
                In Custody
              </h1>
              <h2 className="font-black text-2xl md:text-3xl text-white mt-1">
                YOU HAVE BEEN ARRESTED
              </h2>
              <p className="text-red-200/60 text-sm mt-2 max-w-2xl">
                Your MaiTroll account is currently restricted while your sentence is active.
                Normal platform access has been suspended until your scheduled release.
              </p>
            </div>
          </div>
        </div>

        {/* ====================================================
            NEWSPAPER
        ==================================================== */}

        <section className="bg-[#f5f0e8] text-black rounded-sm shadow-2xl border-4 border-[#1a1510] mb-6 md:mb-8">
          <div className="p-5 md:p-8">
            {/* Masthead */}
            <div className="border-b-4 border-black pb-4 mb-6">
              <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-bold text-black/70">
                <span>The MaiTroll Daily</span>
                <span className="text-red-700 font-black">Corrections Edition</span>
                <span>
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl text-center font-black uppercase tracking-tight mt-4 leading-none">
                {displayUsername} Arrested
              </h1>

              <p className="text-center uppercase tracking-[0.3em] text-xs md:text-sm mt-3 font-bold">
                MaiTroll Daily — Breaking Platform News
              </p>
            </div>

            {/* Newspaper body */}
            <div className="grid md:grid-cols-[1fr_260px] gap-6 md:gap-8">
              {/* Main article */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-red-700 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1">
                    Breaking News
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/60">
                    City Court Report
                  </span>
                </div>

                <h2 className="font-black text-xl md:text-2xl uppercase leading-tight mb-4">
                  Platform Authorities Confirm Detention of {displayUsername}
                </h2>

                <div className="w-16 h-1 bg-black mb-4" />

                <p className="font-serif text-base md:text-lg leading-relaxed mb-4">
                  MaiTroll Corrections Department has confirmed that <strong>{displayUsername}</strong> has been
                  arrested and placed into platform detention following a moderation action.
                </p>

                <p className="font-serif text-base md:text-lg leading-relaxed mb-4">
                  According to the detention record, the user was arrested for:
                </p>

                <div className="border-y-2 border-black py-4 my-5">
                  <p className="font-black text-lg md:text-xl uppercase">
                    {jailState?.reason || 'Violation of MaiTroll community rules'}
                  </p>
                </div>

                <p className="font-serif text-base md:text-lg leading-relaxed">
                  The account remains restricted while the sentence is active. The detained user may
                  request legal assistance, contact administration, or post the required bond if
                  eligible. All normal platform interactions remain suspended.
                </p>

                {/* Court info */}
                {(jailState?.courtDate || jailState?.caseId) && (
                  <>
                    <div className="w-16 h-1 bg-black my-6" />
                    <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                      Court Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      {jailState?.courtDate && (
                        <div className="flex justify-between border-b border-black/10 pb-1">
                          <span className="font-bold uppercase text-[10px] tracking-wider text-black/60">Court Date</span>
                          <span className="font-semibold">
                            {new Date(jailState.courtDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      {jailState?.caseId && (
                        <div className="flex justify-between border-b border-black/10 pb-1">
                          <span className="font-bold uppercase text-[10px] tracking-wider text-black/60">Case Number</span>
                          <span className="font-mono font-bold text-xs">
                            {jailState.caseId.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Sidebar */}
              <div className="border-2 border-black p-4 md:p-5 bg-white/50">
                <div className="flex items-center justify-center mb-4">
                  <Gavel className="w-16 h-16 md:w-20 md:h-20 text-black" />
                </div>

                <div className="border-t border-black pt-4 space-y-4 text-sm">
                  <div>
                    <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                      Arrest Status
                    </p>
                    <p className="font-black text-red-700 uppercase text-sm mt-1">
                      In Custody
                    </p>
                  </div>

                  <div>
                    <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                      Severity
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${severityColor}`}>
                      {severityLabel}
                    </span>
                  </div>

                  <div>
                    <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                      Discipline Level
                    </p>
                    <p className="font-bold mt-1">
                      Level {jailState?.disciplineLevel || 1}
                    </p>
                  </div>

                  <div>
                    <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                      Arrest Date
                    </p>
                    <p className="text-xs mt-1">
                      {jailState?.jailedAt
                        ? new Date(jailState.jailedAt).toLocaleString()
                        : 'See detention record'}
                    </p>
                  </div>

                  <div>
                    <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                      Release Date
                    </p>
                    <p className="font-black text-sm mt-1">
                      {releaseDate
                        ? releaseDate.toLocaleString()
                        : 'Upon sentence completion'}
                    </p>
                  </div>

                  <div>
                    <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                      Bond Required
                    </p>
                    <p className="font-black text-lg text-green-700 mt-1">
                      {(jailState?.bondAmount || 0).toLocaleString()} TC
                    </p>
                  </div>

                  {jailState?.arrestedBy && (
                    <div>
                      <p className="uppercase font-bold text-[10px] tracking-wider text-black/60">
                        Arresting Officer
                      </p>
                      <p className="text-xs mt-1">
                        {jailState.arrestedBy}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-4 border-black mt-8 pt-4 text-center text-[10px] uppercase tracking-[0.2em] text-black/50 font-bold">
              This publication is an automated MaiTroll Corrections detention notice.
              <br />
              All information is derived from official platform records.
            </div>
          </div>
        </section>

        {/* ====================================================
            COUNTDOWN PANEL
        ==================================================== */}

        <section className="bg-black border-2 border-red-900/60 rounded-none p-6 md:p-8 mb-6 md:mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Timer className="w-6 h-6 text-red-400" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-red-400 font-bold">
              Time Until Scheduled Release
            </p>
          </div>

          <p className="text-4xl md:text-6xl font-mono font-black tracking-[0.15em] text-white">
            {countdown}
          </p>

          <p className="text-slate-600 text-[10px] mt-3 uppercase tracking-[0.3em] font-bold">
            Days : Hours : Minutes : Seconds
          </p>
        </section>

        {/* ====================================================
            CASE DETAILS GRID
        ==================================================== */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 md:mb-8">
          <div className="bg-[#111] border border-slate-800 rounded-none p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-slate-500" />
              <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">Case</p>
            </div>
            <p className="font-mono text-xs font-bold text-slate-300">
              {jailState?.caseId ? jailState.caseId.slice(0, 8).toUpperCase() : 'DETENTION'}
            </p>
          </div>

          <div className="bg-[#111] border border-slate-800 rounded-none p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">Release</p>
            </div>
            <p className="font-bold text-xs text-slate-300">
              {releaseDate
                ? releaseDate.toLocaleDateString()
                : 'Pending'}
            </p>
          </div>

          <div className="bg-[#111] border border-slate-800 rounded-none p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">Bond</p>
            </div>
            <p className="font-bold text-xs text-slate-300">
              {(jailState?.bondAmount || 0).toLocaleString()} TC
            </p>
          </div>

          <div className="bg-[#111] border border-slate-800 rounded-none p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider">Wallet</p>
            </div>
            <p className="font-bold text-xs text-slate-300">
              {walletBalance.toLocaleString()} TC
            </p>
          </div>
        </div>

        {/* ====================================================
            BOND POSTING
        ==================================================== */}

        {jailState?.bondAllowed && jailState?.bondAmount > 0 && (
          <section className="bg-[#0a0a0a] border-2 border-green-900/50 rounded-none p-5 md:p-6 mb-6 md:mb-8">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-green-700 bg-green-950/40 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">
                  Post Bond
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Pay your required bond to request immediate release from detention.
                </p>

                <div className="flex flex-wrap gap-6 mt-4">
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                      Required
                    </p>
                    <p className="text-2xl md:text-3xl font-black text-green-400">
                      {(jailState.bondAmount).toLocaleString()} TC
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                      Your Balance
                    </p>
                    <p className="text-2xl md:text-3xl font-black">
                      {walletBalance.toLocaleString()} TC
                    </p>
                  </div>
                </div>

                {!canAffordBond && (
                  <div className="mt-4 flex items-center gap-2 text-red-400 text-sm font-bold">
                    <UserX className="w-4 h-4" />
                    Insufficient Troll Coins
                  </div>
                )}

                <button
                  onClick={handlePostBond}
                  disabled={postingBond || !canAffordBond}
                  className="mt-5 px-6 py-3 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-green-600 font-black text-sm uppercase tracking-wider flex items-center gap-2 transition-colors"
                >
                  <DollarSign className="w-5 h-5" />
                  {postingBond
                    ? 'Processing Bond...'
                    : `Post Bond — ${jailState.bondAmount.toLocaleString()} TC`}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            ATTORNEY & ADMIN REQUESTS
        ==================================================== */}

        <div className="grid md:grid-cols-2 gap-4 mb-6 md:mb-8">
          {/* Request Attorney */}
          <div className="bg-[#0a0a0a] border border-slate-800 rounded-none p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-blue-700 bg-blue-950/30 flex items-center justify-center">
                  <Scale className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-lg font-black uppercase tracking-tight">
                  Request an Attorney
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Get legal assistance for your MaiTroll case.
                </p>

                {attorneyStatus && attorneyStatus !== 'rejected' && (
                  <div className="mt-3 flex items-center gap-2 text-blue-300 text-xs font-bold">
                    <UserCheck className="w-4 h-4" />
                    Status: {attorneyStatus}
                  </div>
                )}

                {attorneyRequest && attorneyRequest.status === 'approved' && attorneyRequest.quoteAmount > 0 && (
                  <div className="mt-3 p-3 bg-blue-950/30 border border-blue-800/50 rounded-none">
                    <p className="text-[10px] text-blue-400 uppercase font-black tracking-wider mb-1">
                      Attorney Quote
                    </p>
                    <p className="text-lg font-black text-white">
                      {attorneyRequest.quoteAmount.toLocaleString()} TC
                    </p>
                    {attorneyRequest.quoteMessage && (
                      <p className="text-xs text-slate-400 mt-1">
                        {attorneyRequest.quoteMessage}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleAcceptAttorneyQuote}
                        disabled={actionLoading || !canAffordAttorneyQuote}
                        className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 border-2 border-green-600 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDenyAttorneyQuote}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-2 bg-red-900/50 hover:bg-red-800/50 disabled:opacity-40 border-2 border-red-800 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Deny
                          </>
                        )}
                      </button>
                    </div>
                    {!canAffordAttorneyQuote && (
                      <p className="text-[10px] text-red-400 mt-2 font-bold">
                        Insufficient Troll Coins
                      </p>
                    )}
                  </div>
                )}

                {hasAttorneyAccess && (
                  <div className="mt-3 flex items-center gap-2 text-green-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Attorney hired. You can now message your attorney.
                  </div>
                )}

                {attorneyStatus === 'rejected' && (
                  <div className="mt-3 flex items-center gap-2 text-red-400 text-xs font-bold">
                    <XCircle className="w-4 h-4" />
                    Request was declined.
                  </div>
                )}

                <button
                  onClick={handleRequestAttorney}
                  disabled={requestingAttorney || (attorneyStatus && attorneyStatus !== 'rejected') || hasAttorneyAccess}
                  className="mt-4 w-full py-3 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 border-2 border-blue-600 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  {requestingAttorney ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Requesting...
                    </>
                  ) : hasAttorneyAccess ? (
                    <>
                      <MessageSquare className="w-5 h-5" />
                      Message My Attorney
                    </>
                  ) : attorneyStatus && attorneyStatus !== 'rejected' ? (
                    <>
                      <UserCheck className="w-5 h-5" />
                      Request Pending
                    </>
                  ) : (
                    <>
                      <Scale className="w-5 h-5" />
                      Request Attorney
                    </>
                  )}
                </button>

                {hasAttorneyAccess && (
                  <button
                    onClick={() => navigate('/utromail')}
                    className="mt-2 w-full py-3 bg-green-700 hover:bg-green-600 border-2 border-green-600 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Message My Attorney
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Contact Admin */}
          <div className="bg-[#0a0a0a] border border-slate-800 rounded-none p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-amber-700 bg-amber-950/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-lg font-black uppercase tracking-tight">
                  Contact Admin
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Request administrative assistance or a custom bond quote.
                </p>

                {adminStatus && adminStatus !== 'rejected' && (
                  <div className="mt-3 flex items-center gap-2 text-amber-300 text-xs font-bold">
                    <UserCheck className="w-4 h-4" />
                    Status: {adminStatus}
                  </div>
                )}

                {adminRequest && adminRequest.status === 'approved' && adminRequest.quoteAmount > 0 && (
                  <div className="mt-3 p-3 bg-amber-950/30 border border-amber-800/50 rounded-none">
                    <p className="text-[10px] text-amber-400 uppercase font-black tracking-wider mb-1">
                      Admin Bond Quote
                    </p>
                    <p className="text-lg font-black text-white">
                      {adminRequest.quoteAmount.toLocaleString()} TC
                    </p>
                    {adminRequest.quoteMessage && (
                      <p className="text-xs text-slate-400 mt-1">
                        {adminRequest.quoteMessage}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleAcceptAdminBondQuote}
                        disabled={actionLoading || !canAffordAdminBondQuote}
                        className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 border-2 border-green-600 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDenyAdminBondQuote}
                        disabled={actionLoading}
                        className="flex-1 px-3 py-2 bg-red-900/50 hover:bg-red-800/50 disabled:opacity-40 border-2 border-red-800 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Deny
                          </>
                        )}
                      </button>
                    </div>
                    {!canAffordAdminBondQuote && (
                      <p className="text-[10px] text-red-400 mt-2 font-bold">
                        Insufficient Troll Coins
                      </p>
                    )}
                  </div>
                )}

                {adminStatus === 'rejected' && (
                  <div className="mt-3 flex items-center gap-2 text-red-400 text-xs font-bold">
                    <XCircle className="w-4 h-4" />
                    Request was declined.
                  </div>
                )}

                <button
                  onClick={handleContactAdmin}
                  disabled={requestingAdmin || (adminStatus && adminStatus !== 'rejected')}
                  className="mt-4 w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 border-2 border-amber-600 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  {requestingAdmin ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Contacting...
                    </>
                  ) : adminStatus && adminStatus !== 'rejected' ? (
                    <>
                      <UserCheck className="w-5 h-5" />
                      Request Pending
                    </>
                  ) : (
                    <>
                      <Building2 className="w-5 h-5" />
                      Contact Admin
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            MESSAGING CENTER
        ==================================================== */}

        <section className="bg-[#0a0a0a] border border-slate-800 rounded-none p-5 md:p-6 mb-6 md:mb-8">
          <div className="flex items-center gap-3 mb-5">
            <MessageSquare className="w-6 h-6 text-green-400" />
            <div>
              <h2 className="text-base md:text-lg font-black uppercase tracking-tight">
                Detention Communication
              </h2>
              <p className="text-slate-500 text-xs">
                Attorney and administration messages are free.
              </p>
            </div>
          </div>

          {/* Attorney/Admin toggle */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setContactType('attorney')}
              disabled={!hasAttorneyAccess}
              className={`p-3 rounded-none border-2 font-bold text-sm uppercase tracking-wider transition-all ${
                contactType === 'attorney'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-700 text-slate-500 hover:border-slate-600'
              } ${!hasAttorneyAccess ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Scale className="w-5 h-5 mx-auto mb-1" />
              Attorney
            </button>

            <button
              onClick={() => setContactType('admin')}
              disabled={!adminStatus || adminStatus === 'rejected'}
              className={`p-3 rounded-none border-2 font-bold text-sm uppercase tracking-wider transition-all ${
                contactType === 'admin'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                  : 'border-slate-700 text-slate-500 hover:border-slate-600'
              } ${(!adminStatus || adminStatus === 'rejected') ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Building2 className="w-5 h-5 mx-auto mb-1" />
              Administration
            </button>
          </div>

          {(!hasAttorneyAccess && (!adminStatus || adminStatus === 'rejected')) ? (
            <div className="text-center py-6 border border-dashed border-slate-700 rounded-none">
              <Phone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">
                Request an Attorney or Contact Admin to enable messaging.
              </p>
            </div>
          ) : (
            <>
              {contactType === 'attorney' && hasAttorneyAccess ? (
                <div className="text-center py-6 border border-dashed border-green-700/50 rounded-none">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-green-400 text-sm font-bold mb-2">
                    Attorney access granted
                  </p>
                  <button
                    onClick={() => navigate('/utromail')}
                    className="px-5 py-2.5 bg-green-700 hover:bg-green-600 border-2 border-green-600 font-black text-sm uppercase tracking-wider flex items-center gap-2 transition-colors mx-auto"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Message My Attorney
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!contactType}
                  maxLength={2000}
                  rows={5}
                  placeholder={
                    contactType
                      ? `Write your message to ${
                          contactType === 'attorney'
                            ? 'Attorney Services'
                            : 'Administration'
                        }...`
                      : 'Select Attorney or Administration first...'
                  }
                  className="w-full rounded-none bg-black border-2 border-slate-700 p-4 text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-green-500 disabled:opacity-50 text-sm"
                />
              )}

              {contactType !== 'attorney' && (
                <div className="flex justify-between items-center mt-3">
                  <span className="text-[10px] text-slate-600 font-mono">
                    {message.length}/2000
                  </span>

                  <button
                    onClick={handleSendMessage}
                    disabled={
                      sendingMessage ||
                      !contactType ||
                      !message.trim()
                    }
                    className="px-5 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 border-2 border-green-600 font-black text-sm uppercase tracking-wider flex items-center gap-2 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ====================================================
            ACCESS RESTRICTIONS
        ==================================================== */}

        <section className="bg-black border-2 border-red-900/40 rounded-none p-5 md:p-6">
          <h2 className="font-black text-base uppercase tracking-wider flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-500" />
            Access Restrictions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-sm">
            <Restriction text="Home navigation disabled" />
            <Restriction text="Profile navigation disabled" />
            <Restriction text="Broadcasting disabled" />
            <Restriction text="Chat disabled" />
            <Restriction text="Comments disabled" />
            <Restriction text="MaiPiks participation disabled" />
            <Restriction text="Marketplace actions disabled" />
            <Restriction text="Social interactions disabled" />
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <p className="text-sm text-slate-500">
              While detained, you may only access detention services,
              including your detention record, attorney services,
              administration communication, and eligible bond
              services.
            </p>
          </div>
        </section>

        <footer className="text-center py-10 text-[10px] text-slate-700 uppercase tracking-[0.2em] font-bold">
          MaiTroll Corrections Department
          <br />
          Automated Detention Management System
        </footer>
      </main>
    </div>
  );
}

/*
 * ============================================================
 * RESTRICTION COMPONENT
 * ============================================================
 */

function Restriction({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-none bg-red-950/10 border border-red-900/20 p-3">
      <Lock className="w-4 h-4 text-red-600 shrink-0" />
      <span className="text-slate-500 text-xs">
        {text}
      </span>
    </div>
  );
}
