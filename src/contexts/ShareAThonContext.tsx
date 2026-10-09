import React, { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { ShareAThonContext } from '../hooks/useShareAThon';

export interface ShareAThonEvent {
  id: string;
  title: string;
  description: string | null;
  status: 'inactive' | 'waiting' | 'active' | 'completed';
  goal_live_broadcasters: number;
  current_live_broadcasters: number;
  event_start_at: string | null;
  event_end_at: string | null;
  restrict_new_broadcasters: boolean;
  bonus_amount: number;
  cashout_fee_waived: boolean;
  badge_slug: string;
  peak_simultaneous_broadcasters: number;
  total_battles_during_event: number;
  total_shares_submitted: number;
  new_user_registrations: number;
  tips_earned_during_event: number;
  bonus_payout_total: number;
  cashout_fees_waived_total: number;
  created_at: string;
  updated_at: string;
}

export interface EligibleBroadcaster {
  id: string;
  event_id: string;
  user_id: string;
  registered_at: string;
  is_qualified: boolean;
  qualified_at: string | null;
  stream_duration_minutes: number;
  battles_participated: number;
  shares_submitted: number;
  shares_approved: number;
  bonus_paid: boolean;
  bonus_paid_at: string | null;
  cashout_fee_waived: boolean;
  disqualified: boolean;
  disqualification_reason: string | null;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export interface ShareSubmission {
  id: string;
  event_id: string;
  user_id: string;
  platform: 'tiktok' | 'facebook' | 'instagram' | 'x' | 'youtube' | 'discord' | 'reddit';
  share_url: string | null;
  screenshot_url: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'more_info_requested';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
  username?: string;
  display_name?: string;
}

export interface ShareAThonContextType {
  event: ShareAThonEvent | null;
  eligibleBroadcasters: EligibleBroadcaster[];
  myEligibility: EligibleBroadcaster | null;
  mySubmissions: ShareSubmission[];
  allSubmissions: ShareSubmission[];
  loading: boolean;
  isAdmin: boolean;
  isEligible: boolean;
  refreshEvent: () => Promise<void>;
  refreshEligibility: () => Promise<void>;
  refreshSubmissions: () => Promise<void>;
  startEvent: () => Promise<boolean>;
  endEvent: () => Promise<boolean>;
  toggleRestrictNewBroadcasters: (restrict: boolean) => Promise<boolean>;
  submitShare: (platform: string, shareUrl: string | null, screenshotUrl: string | null, notes: string | null) => Promise<boolean>;
  reviewSubmission: (submissionId: string, action: 'approved' | 'rejected' | 'more_info_requested', adminNotes: string | null) => Promise<boolean>;
  disqualifyBroadcaster: (broadcasterId: string, reason: string) => Promise<boolean>;
  qualifyBroadcaster: (broadcasterId: string) => Promise<boolean>;
  updateLiveBroadcasterCount: (count: number) => Promise<void>;
}

interface ShareAThonProviderProps {
  children: ReactNode;
}

export const ShareAThonProvider: React.FC<ShareAThonProviderProps> = ({ children }) => {
  const { user, profile } = useAuthStore();
  const [event, setEvent] = useState<ShareAThonEvent | null>(null);
  const [eligibleBroadcasters, setEligibleBroadcasters] = useState<EligibleBroadcaster[]>([]);
  const [myEligibility, setMyEligibility] = useState<EligibleBroadcaster | null>(null);
  const [mySubmissions, setMySubmissions] = useState<ShareSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<ShareSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isEligible = myEligibility !== null && !myEligibility.disqualified;

  const fetchEvent = useCallback(async () => {
    const { data, error } = await supabase
      .from('shareathon_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching Share-A-Thon event:', error);
      return;
    }
    setEvent(data as ShareAThonEvent | null);
  }, []);

  const enrichWithProfiles = async <T extends { user_id: string }>(items: T[]): Promise<T[]> => {
    if (items.length === 0) return items;
    const userIds = [...new Set(items.map(i => i.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    return items.map(item => {
      const p = profileMap.get(item.user_id);
      return {
        ...item,
        username: p?.username || 'unknown',
        display_name: p?.display_name || p?.username || 'Unknown',
        avatar_url: p?.avatar_url || null
      };
    });
  };

  const fetchEligibility = useCallback(async () => {
    if (!event) return;

    const { data, error } = await supabase
      .from('shareathon_eligible_broadcasters')
      .select('*')
      .eq('event_id', event.id);

    if (error) {
      console.error('Error fetching eligible broadcasters:', error);
      return;
    }

    const broadcasters = await enrichWithProfiles(data as EligibleBroadcaster[]);
    setEligibleBroadcasters(broadcasters);

    if (user) {
      const mine = broadcasters.find(b => b.user_id === user.id);
      setMyEligibility(mine || null);
    }
  }, [event, user]);

  const fetchSubmissions = useCallback(async () => {
    if (!event) return;

    if (isAdmin) {
      const { data, error } = await supabase
        .from('shareathon_submissions')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all submissions:', error);
        return;
      }
      setAllSubmissions(await enrichWithProfiles(data as ShareSubmission[]));
    }

    if (user) {
      const { data, error } = await supabase
        .from('shareathon_submissions')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching my submissions:', error);
        return;
      }
      setMySubmissions(await enrichWithProfiles(data as ShareSubmission[]));
    }
  }, [event, user, isAdmin]);

  const refreshEvent = useCallback(async () => {
    await fetchEvent();
  }, [fetchEvent]);

  const refreshEligibility = useCallback(async () => {
    await fetchEligibility();
  }, [fetchEligibility]);

  const refreshSubmissions = useCallback(async () => {
    await fetchSubmissions();
  }, [fetchSubmissions]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await fetchEvent();
    setLoading(false);
  }, [fetchEvent]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (event) {
      fetchEligibility();
      fetchSubmissions();
    }
  }, [event, fetchEligibility, fetchSubmissions]);

  useEffect(() => {
    const channel = supabase
      .channel('shareathon_events_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shareathon_events'
      }, () => {
        fetchEvent();
      })
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchEvent]);

  const startEvent = useCallback(async (): Promise<boolean> => {
    if (!event) return false;
    try {
      const { error } = await supabase
        .from('shareathon_events')
        .update({
          status: 'waiting',
          event_start_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);

      if (error) throw error;
      toast.success('Share-A-Thon Weekend started! Waiting for 10 live broadcasters...');
      await fetchEvent();
      return true;
    } catch (err: any) {
      console.error('Error starting event:', err);
      toast.error('Failed to start event');
      return false;
    }
  }, [event, fetchEvent]);

  const endEvent = useCallback(async (): Promise<boolean> => {
    if (!event) return false;
    try {
      const { error } = await supabase
        .from('shareathon_events')
        .update({
          status: 'completed',
          event_end_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);

      if (error) throw error;
      toast.success('Share-A-Thon Weekend has ended!');
      await fetchEvent();
      return true;
    } catch (err: any) {
      console.error('Error ending event:', err);
      toast.error('Failed to end event');
      return false;
    }
  }, [event, fetchEvent]);

  const toggleRestrictNewBroadcasters = useCallback(async (restrict: boolean): Promise<boolean> => {
    if (!event) return false;
    try {
      const { error } = await supabase
        .from('shareathon_events')
        .update({
          restrict_new_broadcasters: restrict,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);

      if (error) throw error;
      toast.success(restrict ? 'New broadcaster restrictions enabled' : 'New broadcaster restrictions disabled');
      await fetchEvent();
      return true;
    } catch (err: any) {
      console.error('Error toggling restrictions:', err);
      toast.error('Failed to update restrictions');
      return false;
    }
  }, [event, fetchEvent]);

  const submitShare = useCallback(async (
    platform: string,
    shareUrl: string | null,
    screenshotUrl: string | null,
    notes: string | null
  ): Promise<boolean> => {
    if (!event || !user) return false;
    try {
      const { error } = await supabase
        .from('shareathon_submissions')
        .insert({
          event_id: event.id,
          user_id: user.id,
          platform,
          share_url: shareUrl,
          screenshot_url: screenshotUrl,
          notes
        });

      if (error) throw error;

      await supabase
        .from('shareathon_events')
        .update({
          total_shares_submitted: (event.total_shares_submitted || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);

      toast.success('Share proof submitted for review!');
      await fetchSubmissions();
      await fetchEvent();
      return true;
    } catch (err: any) {
      console.error('Error submitting share:', err);
      toast.error('Failed to submit share proof');
      return false;
    }
  }, [event, user, fetchSubmissions, fetchEvent]);

  const reviewSubmission = useCallback(async (
    submissionId: string,
    action: 'approved' | 'rejected' | 'more_info_requested',
    adminNotes: string | null
  ): Promise<boolean> => {
    if (!event || !user) return false;
    try {
      const { error: updateError } = await supabase
        .from('shareathon_submissions')
        .update({
          status: action,
          admin_notes: adminNotes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('shareathon_verification_log')
        .insert({
          event_id: event.id,
          submission_id: submissionId,
          admin_id: user.id,
          action,
          notes: adminNotes
        });

      if (logError) throw logError;

      if (action === 'approved') {
        const { data: sub } = await supabase
          .from('shareathon_submissions')
          .select('user_id')
          .eq('id', submissionId)
          .single();

        if (sub) {
          await supabase
            .from('shareathon_eligible_broadcasters')
            .update({
              shares_approved: supabase.rpc('increment', { x: 1 })
            })
            .eq('event_id', event.id)
            .eq('user_id', sub.user_id);
        }
      }

      toast.success(`Submission ${action.replace(/_/g, ' ')}`);
      await fetchSubmissions();
      return true;
    } catch (err: any) {
      console.error('Error reviewing submission:', err);
      toast.error('Failed to review submission');
      return false;
    }
  }, [event, user, fetchSubmissions]);

  const disqualifyBroadcaster = useCallback(async (broadcasterId: string, reason: string): Promise<boolean> => {
    if (!event) return false;
    try {
      const { error } = await supabase
        .from('shareathon_eligible_broadcasters')
        .update({
          disqualified: true,
          disqualification_reason: reason
        })
        .eq('id', broadcasterId);

      if (error) throw error;
      toast.success('Broadcaster disqualified');
      await fetchEligibility();
      return true;
    } catch (err: any) {
      console.error('Error disqualifying broadcaster:', err);
      toast.error('Failed to disqualify broadcaster');
      return false;
    }
  }, [event, fetchEligibility]);

  const qualifyBroadcaster = useCallback(async (broadcasterId: string): Promise<boolean> => {
    if (!event) return false;
    try {
      const { error } = await supabase
        .from('shareathon_eligible_broadcasters')
        .update({
          is_qualified: true,
          qualified_at: new Date().toISOString()
        })
        .eq('id', broadcasterId);

      if (error) throw error;
      toast.success('Broadcaster qualified for rewards!');
      await fetchEligibility();
      return true;
    } catch (err: any) {
      console.error('Error qualifying broadcaster:', err);
      toast.error('Failed to qualify broadcaster');
      return false;
    }
  }, [event, fetchEligibility]);

  const updateLiveBroadcasterCount = useCallback(async (count: number) => {
    if (!event) return;
    try {
      const updates: any = {
        current_live_broadcasters: count,
        updated_at: new Date().toISOString()
      };

      if (count > (event.peak_simultaneous_broadcasters || 0)) {
        updates.peak_simultaneous_broadcasters = count;
      }

      if (count >= event.goal_live_broadcasters && event.status === 'waiting') {
        updates.status = 'active';
      }

      const { error } = await supabase
        .from('shareathon_events')
        .update(updates)
        .eq('id', event.id);

      if (error) throw error;
      await fetchEvent();
    } catch (err: any) {
      console.error('Error updating live broadcaster count:', err);
    }
  }, [event, fetchEvent]);

  const value = useMemo<ShareAThonContextType>(() => ({
    event,
    eligibleBroadcasters,
    myEligibility,
    mySubmissions,
    allSubmissions,
    loading,
    isAdmin,
    isEligible,
    refreshEvent,
    refreshEligibility,
    refreshSubmissions,
    startEvent,
    endEvent,
    toggleRestrictNewBroadcasters,
    submitShare,
    reviewSubmission,
    disqualifyBroadcaster,
    qualifyBroadcaster,
    updateLiveBroadcasterCount
  }), [
    event, eligibleBroadcasters, myEligibility, mySubmissions, allSubmissions,
    loading, isAdmin, isEligible, refreshEvent, refreshEligibility, refreshSubmissions,
    startEvent, endEvent, toggleRestrictNewBroadcasters, submitShare,
    reviewSubmission, disqualifyBroadcaster, qualifyBroadcaster, updateLiveBroadcasterCount
  ]);

  return (
    <ShareAThonContext.Provider value={value}>
      {children}
    </ShareAThonContext.Provider>
  );
};

export default ShareAThonContext;
