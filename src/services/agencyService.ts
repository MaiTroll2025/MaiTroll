import { supabase } from '../lib/supabase';
import type { AgencyApplication, AgencyMember, AgencyPointTransaction, AgencyWeeklyStats, AgencyReward, AgencyAuditLog, LeaderboardEntry, AddPointsResult, AdjustPointsResult, NextTierThreshold, AgencyTier, AgencyRewardType, AgencyMemberRole } from '../types/agency';

const getWeekStart = (date: Date = new Date()): string => {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

export const agencyService = {
  async submitApplication(data: {
    display_name: string;
    primary_platform: string;
    channel_url?: string;
    avg_weekly_hours?: number;
    avg_weekly_viewers?: number;
    content_category?: string[];
    motivation?: string;
    experience?: string;
    referral_code?: string;
  }): Promise<AgencyApplication> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from('agency_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status === 'pending') {
      throw new Error('You already have a pending application');
    }

    const { data: application, error } = await supabase
      .from('agency_applications')
      .insert({
        user_id: user.id,
        display_name: data.display_name,
        primary_platform: data.primary_platform,
        channel_url: data.channel_url || null,
        avg_weekly_hours: data.avg_weekly_hours || 0,
        avg_weekly_viewers: data.avg_weekly_viewers || 0,
        content_category: data.content_category || [],
        motivation: data.motivation || null,
        experience: data.experience || null,
        referral_code: data.referral_code || null,
      })
      .select()
      .single();

    if (error) throw error;
    return application as AgencyApplication;
  },

  async getMyApplication(): Promise<AgencyApplication | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agency_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as AgencyApplication | null;
  },

  async getPendingApplications(): Promise<(AgencyApplication & { username?: string; avatar_url?: string })[]> {
    const { data, error } = await supabase
      .from('agency_applications')
      .select(`
        *,
        user_profiles:user_id (username, avatar_url)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((item: any) => ({
      ...item,
      username: item.user_profiles?.username,
      avatar_url: item.user_profiles?.avatar_url,
    }));
  },

  async reviewApplication(
    applicationId: string,
    status: 'approved' | 'rejected',
    reviewNotes?: string,
    rejectionReason?: string
  ): Promise<AgencyApplication> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('agency_applications')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
        rejection_reason: rejectionReason || null,
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;
    return data as AgencyApplication;
  },

  async getMyMemberRecord(): Promise<AgencyMember | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('agency_members')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data as AgencyMember | null;
  },

  async getAllMembers(): Promise<(AgencyMember & { username?: string; avatar_url?: string; display_name?: string })[]> {
    const { data, error } = await supabase
      .from('agency_members')
      .select(`
        *,
        user_profiles:user_id (username, avatar_url, display_name)
      `)
      .eq('is_active', true)
      .order('total_points', { ascending: false });

    if (error) throw error;
    return (data || []).map((item: any) => ({
      ...item,
      username: item.user_profiles?.username,
      avatar_url: item.user_profiles?.avatar_url,
      display_name: item.user_profiles?.display_name,
    }));
  },

  async updateMemberRole(memberId: string, role: AgencyMemberRole): Promise<AgencyMember> {
    const { data, error } = await supabase
      .from('agency_members')
      .update({ role, promoted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data as AgencyMember;
  },

  async deactivateMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('agency_members')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', memberId);

    if (error) throw error;
  },

  async addPoints(
    userId: string,
    activityType: 'stream_hours' | 'platform_share' | 'verified_viewer' | 'user_registration',
    quantity: number = 1,
    sourceId?: string,
    sourceTable?: string,
    verified: boolean = true
  ): Promise<AddPointsResult> {
    const { data, error } = await supabase.rpc('add_agency_points', {
      p_user_id: userId,
      p_activity_type: activityType,
      p_quantity: quantity,
      p_source_id: sourceId || null,
      p_source_table: sourceTable || null,
      p_verified: verified,
    });

    if (error) throw error;
    return data as AddPointsResult;
  },

  async adjustPoints(userId: string, points: number, reason: string): Promise<AdjustPointsResult> {
    const { data, error } = await supabase.rpc('adjust_agency_points', {
      p_user_id: userId,
      p_points: points,
      p_reason: reason,
    });

    if (error) throw error;
    return data as AdjustPointsResult;
  },

  async getMyTransactions(limit: number = 50): Promise<AgencyPointTransaction[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('agency_point_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AgencyPointTransaction[];
  },

  async getUserTransactions(userId: string, limit: number = 50): Promise<AgencyPointTransaction[]> {
    const { data, error } = await supabase
      .from('agency_point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AgencyPointTransaction[];
  },

  async getMyWeeklyStats(limit: number = 12): Promise<AgencyWeeklyStats[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('agency_weekly_stats')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AgencyWeeklyStats[];
  },

  async getCurrentWeekStats(): Promise<AgencyWeeklyStats | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const weekStart = getWeekStart();

    const { data, error } = await supabase
      .from('agency_weekly_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (error) throw error;
    return data as AgencyWeeklyStats | null;
  },

  async getLeaderboard(weekStart?: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_agency_leaderboard', {
      p_week_start: weekStart || null,
    });

    if (error) throw error;
    return (data || []) as LeaderboardEntry[];
  },

  async getMyRewards(): Promise<AgencyReward[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('agency_rewards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as AgencyReward[];
  },

  async claimReward(rewardId: string): Promise<AgencyReward> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('agency_rewards')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rewardId)
      .eq('user_id', user.id)
      .eq('status', 'available')
      .select()
      .single();

    if (error) throw error;
    return data as AgencyReward;
  },

  async createReward(data: {
    userId: string;
    rewardType: AgencyRewardType;
    title: string;
    description?: string;
    pointsCost?: number;
    tierRequirement?: AgencyTier;
    coinValue?: number;
    expiresAt?: string;
  }): Promise<AgencyReward> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: reward, error } = await supabase
      .from('agency_rewards')
      .insert({
        user_id: data.userId,
        reward_type: data.rewardType,
        title: data.title,
        description: data.description || null,
        points_cost: data.pointsCost || 0,
        tier_requirement: data.tierRequirement || 'none',
        coin_value: data.coinValue || 0,
        status: 'available',
        available_at: new Date().toISOString(),
        expires_at: data.expiresAt || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return reward as AgencyReward;
  },

  async revokeReward(rewardId: string, reason: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('agency_rewards')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoke_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rewardId);

    if (error) throw error;
  },

  async getAuditLog(limit: number = 100): Promise<AgencyAuditLog[]> {
    const { data, error } = await supabase
      .from('agency_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as AgencyAuditLog[];
  },

  async getSettings(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('agency_settings')
      .select('*');

    if (error) throw error;

    const settings: Record<string, any> = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }
    return settings;
  },

  async updateSetting(key: string, value: any): Promise<void> {
    const { error } = await supabase
      .from('agency_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) throw error;
  },

  async calculateTier(points: number): Promise<AgencyTier> {
    const { data, error } = await supabase.rpc('calculate_agency_tier', {
      p_points: points,
    });

    if (error) throw error;
    return data as AgencyTier;
  },

  async getNextTierThreshold(points: number): Promise<NextTierThreshold> {
    const { data, error } = await supabase.rpc('get_next_tier_threshold', {
      p_points: points,
    });

    if (error) throw error;
    return data as NextTierThreshold;
  },

  async runWeeklyEvaluation(): Promise<any[]> {
    const { data, error } = await supabase.rpc('run_weekly_agency_evaluation');
    if (error) throw error;
    return data || [];
  },

  getWeekStart,
};
