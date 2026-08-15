import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { getUserAffiliation, UserAffiliation } from '../../lib/userAffiliations';
import { useNavigate } from 'react-router-dom';
import { 
  User, MessageCircle, Gift, Flag, Camera, 
  Crown, Check, X, Heart, Users, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import SubscribeButton from './SubscribeButton';
import ProfileFrame from '@/components/profile/ProfileFrame';
import { useUserFrame } from '@/hooks/useUserFrame';

interface UserMiniProfileProps {
  userId: string;
  username: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  isLive?: boolean;
  liveStreamId?: string;
  onClose: () => void;
}

const UserMiniProfile: React.FC<UserMiniProfileProps> = ({
  userId,
  username,
  avatarUrl,
  coverImageUrl,
  isLive,
  liveStreamId,
  onClose
}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [affiliation, setAffiliation] = useState<UserAffiliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const checkFollowing = async () => {
    if (!user || !userId || isOwnProfile) return;
    try {
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
      setFollowing(!!data);
    } catch (err) {
      console.error('Error checking follow status:', err);
    }
  };

  useEffect(() => {
    if (!loading) {
      checkFollowing();
    }
  }, [loading, user?.id, userId]);

  useEffect(() => {
    if (!userId) return
    let mounted = true
    ;(async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('avatar_url, cover_image_url, is_verified, level, monthly_subscriber_count, troll_coins, crowns, subscriber_badge_color_hex, can_message')
          .eq('id', userId)
          .maybeSingle()
        if (mounted && data) setTargetProfile(data)
      } catch {}
    })()
    return () => { mounted = false }
  }, [userId])

  useEffect(() => {
    if (!user || !userId) return
    checkSubscription()
  }, [user?.id, userId])

  const handleFollow = async () => {
    if (!user || !userId || isOwnProfile) return;
    setFollowLoading(true);
    try {
      if (following) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        setFollowing(false);
        toast.success('Unfollowed');
      } else {
        await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: userId });
        setFollowing(true);
        toast.success('Now following');
      }
    } catch (err: any) {
      toast.error(err.message || 'Follow action failed');
    } finally {
      setFollowLoading(false);
    }
  };

  const fetchAffiliation = async () => {
    try {
      const data = await getUserAffiliation(userId);
      setAffiliation(data);
    } catch (error) {
      console.error('Error fetching affiliation:', error);
    }
  };

  const checkSubscription = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          tier: subscription_tiers(*)
        `)
        .eq('subscriber_id', user.id)
        .eq('broadcaster_id', userId)
        .eq('is_active', true)
        .single();
      setSubscription(data);
    } catch (error) {
      // No subscription
    }
  };

  const handleGift = () => {
    if (liveStreamId) {
      navigate(`/broadcast/${liveStreamId}?gift_to=${userId}`);
    } else {
      toast.error('Cannot gift: user is not live');
    }
    onClose();
  };

  const handleMessage = () => {
    navigate(`/messages?to=${username}`);
    onClose();
  };

  const handleReport = () => {
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportReason || !user) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: user.id,
        reported_user_id: userId,
        reason: reportReason,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Report submitted successfully');
      setShowReportModal(false);
      setReportReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  const reportReasons = [
    { id: 'spam', label: 'Spam / Advertising' },
    { id: 'harassment', label: 'Harassment / Bullying' },
    { id: 'inappropriate', label: 'Inappropriate Content' },
    { id: 'impersonation', label: 'Impersonation' },
    { id: 'violence', label: 'Violence / Threats' },
    { id: 'scam', label: 'Scam / Fraud' },
    { id: 'other', label: 'Other' },
  ];

  const handleViewProfile = () => {
    navigate(`/profile/${username}`);
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-center mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Cover Image */}
        {coverImageUrl || targetProfile?.cover_image_url ? (
          <img 
            src={coverImageUrl || targetProfile?.cover_image_url} 
            alt="Cover" 
            className="w-full h-20 object-cover"
          />
        ) : (
          <div className="w-full h-20 bg-gradient-to-r from-purple-900 to-slate-900" />
        )}

        {/* Profile Section */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-3 -mt-8 mb-3" style={{ overflow: 'visible' }}>
            <div className="w-20 h-20" style={{ overflow: 'visible' }}>
              <ProfileFrame
                frame={userFrame}
                avatarUrl={avatarUrl || targetProfile?.avatar_url || '/default-avatar.png'}
                username={username}
                size="md"
              />
            </div>
            <div className="flex-1 min-w-0 mt-8">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white truncate text-lg">{username}</h3>
                {targetProfile?.is_verified && (
                  <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">✓</span>
                )}
                {subscription && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ 
                      backgroundColor: subscription.tier?.color_hex + '30',
                      color: subscription.tier?.color_hex 
                    }}
                  >
                    <Crown className="w-3 h-3 inline mr-1" />
                    {subscription.tier?.name}
                  </span>
                )}
                {following && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400">
                    Following
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Level {targetProfile?.level} • {targetProfile?.monthly_subscriber_count || 0} subscribers
              </p>
            </div>
          </div>

          {/* Stats Row */}
          {(targetProfile?.troll_coins !== undefined || targetProfile?.crowns !== undefined) && (
            <div className="flex gap-4 mb-3 text-xs text-slate-300">
              {targetProfile?.troll_coins !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">🪙</span> {targetProfile.troll_coins.toLocaleString()}
                </div>
              )}
              {targetProfile?.crowns !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-purple-400">👑</span> {targetProfile.crowns}
                </div>
              )}
            </div>
          )}

          {affiliation && (
            <div className="mb-3 text-xs text-slate-300">
              <span className="font-semibold text-white">
                {affiliation.type === 'agency' ? 'Agency' : 'Family'}:
              </span>{' '}
              {affiliation.name}
              {affiliation.role ? (
                <span className="text-slate-400"> • {affiliation.role}</span>
              ) : null}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {!isOwnProfile ? (
              <>
                <SubscribeButton
                  broadcasterId={userId}
                  broadcasterUsername={username}
                />
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    following
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  {following ? 'Following' : 'Follow'}
                </button>
                <button
                  onClick={handleMessage}
                  disabled={!targetProfile?.can_message && targetProfile?.can_message !== undefined}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm"
                  title={targetProfile?.can_message === false ? 'This user does not accept messages' : ''}
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
                <button
                  onClick={handleGift}
                  disabled={!isLive}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm"
                >
                  <Gift className="w-4 h-4" />
                  Gift
                </button>
                <button
                  onClick={handleReport}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 rounded-lg text-sm"
                >
                  <Flag className="w-4 h-4" />
                  Report User
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleViewProfile}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  <User className="w-4 h-4" />
                  View My Profile
                </button>
                <button
                  onClick={() => { onClose(); navigate('/settings'); }}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  <Camera className="w-4 h-4" />
                  Edit Profile
                </button>
              </>
            )}
          </div>

          {affiliation && !isOwnProfile && (
            <div className="grid grid-cols-1 gap-2 mb-3">
              {affiliation.type === 'family' ? (
                <button
                  onClick={() => {
                    navigate(`/family/profile/${affiliation.id}`)
                    onClose()
                  }}
                  className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                >
                  Join Family
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      navigate(`/agency/${affiliation.slug || affiliation.id}`)
                      onClose()
                    }}
                    className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm"
                  >
                    View Agency
                  </button>
                  <button
                    onClick={() => {
                      navigate(`/agency-apply/${affiliation.slug || affiliation.id}`)
                      onClose()
                    }}
                    className="w-full px-3 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-sm"
                  >
                    Apply to Join
                  </button>
                </>
              )}
            </div>
          )}

          {/* Subscriber badge if subscribed to this person */}
          {targetProfile?.subscriber_badge_color_hex && !isOwnProfile && (
            <div className="text-center">
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{
                  backgroundColor: targetProfile.subscriber_badge_color_hex + '20',
                  color: targetProfile.subscriber_badge_color_hex
                }}
              >
                <Crown className="w-3 h-3 inline mr-1" />
                Official Supporter
              </span>
              {subscription?.tier?.name === 'Mythic' && (
                <div className="mt-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    title="Mythic SLA: 99.95% uptime, 4K quality, VIP-only chat, 10min support response">
                    DM Access
                  </span>
                </div>
              )}
              {subscription?.tier?.sla_uptime_guarantee_pct !== undefined && (
                <div className="mt-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    title={`${subscription.tier.name} SLA: ${subscription.tier.sla_uptime_guarantee_pct}% uptime, ${subscription.tier.sla_quality_guarantee} quality`}>
                    {subscription.tier.sla_uptime_guarantee_pct}% SLA
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Report Modal */}
          {showReportModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
              <div className="bg-zinc-900 border border-red-500/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-red-900/20">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Flag className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Report User</h3>
                      <p className="text-xs text-zinc-400">Reporting @{username}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowReportModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Reason for reporting</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {reportReasons.map((reason) => (
                        <label
                          key={reason.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${
                            reportReason === reason.id
                              ? 'bg-red-500/20 border-red-500/50'
                              : 'bg-zinc-800 border-transparent hover:border-white/10'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reportReason"
                            value={reason.id}
                            checked={reportReason === reason.id}
                            onChange={(e) => setReportReason(e.target.value)}
                          />
                          <span className="text-sm text-white">{reason.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowReportModal(false)}
                      className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitReport}
                      disabled={!reportReason || reportSubmitting}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserMiniProfile;
