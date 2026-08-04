/**
 * EnhancedPublicProfile.tsx
 * Redesigned public profile page with comprehensive stats
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { buildOGImageUrl } from '@/lib/og';
import { getLevelName } from '@/lib/xp';
import { Share2 } from 'lucide-react';
import {
  MapPin, Calendar, Users, UserPlus, MessageCircle,
  Crown, BadgeCheck, Zap, Video, Mic, ShoppingBag,
  Trophy, Globe, ExternalLink
} from 'lucide-react';

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  is_visible: boolean;
}

interface ProfileStats {
  total_broadcasts: number;
  total_broadcast_duration_minutes: number;
  total_broadcast_viewers: number;
  total_broadcast_gifts_received: number;
  total_podcasts: number;
  total_podcast_episodes: number;
  total_podcast_listens: number;
  total_marketplace_items: number;
  total_marketplace_sales: number;
  total_marketplace_revenue_coins: number;
  total_achievements: number;
  achievement_points: number;
}

interface EnhancedProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  banner_url: string | null;
  bio: string | null;
  level: number;
  xp: number;
  xp_to_next_level: number;
  city: string | null;
  country: string | null;
  website: string | null;
  pronouns: string | null;
  is_verified: boolean;
  is_live: boolean;
  followers_count: number;
  following_count: number;
  created_at: string;
  theme_color: string;
  accent_color: string;
}

const PLATFORM_ICONS: Record<string, { icon: string; color: string }> = {
  tiktok: { icon: '🎵', color: '#00f2ea' },
  instagram: { icon: '📷', color: '#E4405F' },
  facebook: { icon: '👤', color: '#1877F2' },
  x: { icon: '𝕏', color: '#000000' },
  twitter: { icon: '𝕏', color: '#000000' },
  youtube: { icon: '▶️', color: '#FF0000' },
  twitch: { icon: '🎮', color: '#9146FF' },
  kick: { icon: '🎯', color: '#53FC18' },
  discord: { icon: '💬', color: '#5865F2' },
  onlyfans: { icon: '⭐', color: '#00AFF0' },
  reddit: { icon: '🤖', color: '#FF4500' },
  linkedin: { icon: '💼', color: '#0A66C2' },
  github: { icon: '🐙', color: '#8B5CF6' },
  website: { icon: '🌐', color: '#6366F1' },
  personal_website: { icon: '🌐', color: '#6366F1' },
};

export default function EnhancedPublicProfile() {
  const { username } = useParams();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState<EnhancedProfile | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('v_user_profiles_complete')
          .select('*')
          .eq('username', username)
          .maybeSingle();

        if (error || !data) {
          console.error('Profile not found:', error);
          setLoading(false);
          return;
        }

        setProfile(data as EnhancedProfile);

        // Fetch social links
        const { data: links } = await supabase.rpc('get_profile_social_links', {
          p_user_id: data.id,
        });
        setSocialLinks((links || []).filter((l: SocialLink) => l.is_visible && l.url));

        // Fetch stats
        const { data: profileStats } = await supabase.rpc('get_profile_statistics', {
          p_user_id: data.id,
        });
        setStats(profileStats?.[0] || null);

        // Fetch featured badges/achievements
        const { data: badges } = await supabase.rpc('get_user_featured_badges', {
          p_user_id: data.id,
          p_limit: 8,
        });
        setAchievements(badges || []);

        // Update SEO
        updateSEOTags(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const updateSEOTags = (profileData: EnhancedProfile) => {
    const displayName = profileData.display_name || profileData.username;
    const title = `${displayName} | Mai Troll`;
    const description = profileData.bio || `Check out ${displayName}'s profile on Mai Troll`;
    const profileUrl = `${window.location.origin}/${username}`;
    const ogImageUrl = buildOGImageUrl({ kind: 'profile', username: username! });

    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    } else {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      metaDesc.setAttribute('content', description);
      document.head.appendChild(metaDesc);
    }

    const updateOG = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="og:${prop}"]`);
      if (el) { el.setAttribute('content', content); return }
      el = document.createElement('meta');
      el.setAttribute('property', `og:${prop}`);
      el.setAttribute('content', content);
      document.head.appendChild(el);
    };

    updateOG('title', title);
    updateOG('description', description);
    updateOG('url', profileUrl);
    updateOG('type', 'profile');
    updateOG('image', ogImageUrl);
  };

  const handleShare = async () => {
    const shareData = {
      title: `${profile?.display_name} on Mai Troll`,
      text: profile?.bio || `Check out ${profile?.display_name}'s profile`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
          <p className="text-white/50">This profile doesn't exist.</p>
        </div>
      </div>
    );
  }

  const themeColor = profile.theme_color || '#9333ea';
  const accentColor = profile.accent_color || '#22d3ee';
  const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Banner */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        {profile.cover_url || profile.banner_url ? (
          <img
            src={profile.cover_url || profile.banner_url || ''}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${themeColor}60 0%, ${accentColor}40 50%, ${themeColor}30 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
      </div>

      {/* Profile Content */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="relative -mt-20 pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div className="shrink-0">
              <div
                className="w-40 h-40 rounded-full border-4 p-1 bg-slate-950"
                style={{ borderColor: themeColor }}
              >
                <img
                  src={avatarUrl}
                  alt={profile.display_name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {profile.is_live && (
                <div className="absolute -mt-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-red-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-500/50">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-black text-white">
                  {profile.display_name}
                </h1>
                {profile.is_verified && (
                  <BadgeCheck className="w-7 h-7 text-blue-400" />
                )}
                {profile.pronouns && (
                  <span className="text-sm text-white/50">({profile.pronouns})</span>
                )}
              </div>
              <p className="text-lg text-white/50 mb-3">@{profile.username}</p>

              {profile.bio && (
                <p className="text-white/70 max-w-2xl mb-4 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                {(profile.city || profile.country) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {[profile.city, profile.country].filter(Boolean).join(', ')}
                  </span>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:underline"
                    style={{ color: accentColor }}
                  >
                    <Globe className="w-4 h-4" />
                    Website
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              {currentUser?.id !== profile.id && (
                <>
                  <button
                    className="flex items-center gap-2 px-6 py-2 rounded-xl font-medium text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: themeColor }}
                  >
                    <UserPlus className="w-4 h-4" />
                    Follow
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all hover:opacity-80"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <div className="text-3xl font-black text-white">{profile.followers_count.toLocaleString()}</div>
            <div className="text-sm text-white/50">Followers</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <div className="text-3xl font-black text-white">{profile.following_count.toLocaleString()}</div>
            <div className="text-sm text-white/50">Following</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <div className="text-3xl font-black" style={{ color: accentColor }}>Level {profile.level}</div>
            <div className="text-sm text-white/50">{getLevelName(profile.level)}</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
            <div className="text-3xl font-black text-white">{stats?.total_achievements || 0}</div>
            <div className="text-sm text-white/50">Achievements</div>
          </div>
        </div>

        {/* XP Progress */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/70 font-medium">XP Progress to Level {profile.level + 1}</span>
            <span className="font-bold" style={{ color: accentColor }}>
              {profile.xp} / {profile.xp_to_next_level}
            </span>
          </div>
          <div className="h-4 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (profile.xp / (profile.xp_to_next_level || 100)) * 100)}%`,
                background: `linear-gradient(90deg, ${themeColor}, ${accentColor})`,
              }}
            />
          </div>
        </div>

        {/* Broadcast/Podcast/Marketplace Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Broadcast Stats */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Video className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Broadcasts</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/50">Total Streams</span>
                  <span className="font-bold text-white">{stats.total_broadcasts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Total Hours</span>
                  <span className="font-bold text-white">{formatDuration(stats.total_broadcast_duration_minutes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Total Viewers</span>
                  <span className="font-bold text-white">{stats.total_broadcast_viewers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Gifts Received</span>
                  <span className="font-bold text-white">{stats.total_broadcast_gifts_received.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Podcast Stats */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Podcasts</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/50">Total Podcasts</span>
                  <span className="font-bold text-white">{stats.total_podcasts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Episodes</span>
                  <span className="font-bold text-white">{stats.total_podcast_episodes.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Total Listens</span>
                  <span className="font-bold text-white">{stats.total_podcast_listens.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Marketplace Stats */}
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Marketplace</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/50">Items Listed</span>
                  <span className="font-bold text-white">{stats.total_marketplace_items.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Total Sales</span>
                  <span className="font-bold text-white">{stats.total_marketplace_sales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Revenue</span>
                  <span className="font-bold text-white">{stats.total_marketplace_revenue_coins.toLocaleString()} TC</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4">Social Links</h3>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((link) => {
                const platform = PLATFORM_ICONS[link.platform] || { icon: '🔗', color: '#6366F1' };
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    style={{ borderColor: `${platform.color}30` }}
                  >
                    <span className="text-lg">{platform.icon}</span>
                    <span className="text-white capitalize">{link.platform}</span>
                    <ExternalLink className="w-3 h-3 text-white/30" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Featured Achievements
            </h3>
            <div className="flex flex-wrap gap-3">
              {achievements.map((badge, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
                  style={{ borderColor: badge.badge_color ? `${badge.badge_color}30` : undefined }}
                >
                  <span className="text-2xl">{badge.badge_icon || '🏆'}</span>
                  <div>
                    <div className="font-medium text-white">{badge.badge_name}</div>
                    <div className="text-xs text-white/50">
                      {new Date(badge.earned_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
