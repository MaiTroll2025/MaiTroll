/**
 * Profile.tsx - Complete Profile System Overhaul
 * Career-based profile with role cards, subscriptions, and dynamic tabs
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Bell, Ban, CheckCircle, ChevronDown, Coins, Crown,
    FileText, Heart, Loader2, LogOut, MapPin, MessageCircle,
    Package, RefreshCw, Settings, Shield, ShoppingBag,
    Trash2, UserPlus, Users, Video, X, Zap, MoreHorizontal,
    History, Award, Gavel, Scale, BookOpen, Newspaper
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { buildOGImageUrl } from '../lib/og';
import { getLevelName } from '../lib/xp';
import { useXPStore } from '@/stores/useXPStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import SubscriptionTierSelector from '../components/user/SubscriptionTierSelector';
import { ProfileHeader, RoleCard, ProfileTabs, PROFILE_TABS } from '../components/profile/ProfileComponents';
import ProfileFeed from '../components/profile/ProfileFeed';
import ProfileReplays from '../components/profile/ProfileReplays';
import ProfileWatchlist from '../components/profile/ProfileWatchlist';
import UserInventory from './UserInventory';
import ProfileMaitalentPromos from './ProfileMaitalentPromos';
import UserModActionsModal from '../components/profile/UserModActionsModal';
import { useProfileFrameStore } from '../stores/useProfileFrameStore';
import type { ProfileFrame as ProfileFrameType } from '../config/profileFrames';

interface ActiveRole {
    role_type: string;
    is_active: boolean;
}

interface RoleStats {
    [key: string]: any;
}

function ProfileInner() {
    const { username, userId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user: currentUser, profile: currentUserProfile } = useAuthStore();
    const refreshProfile = useAuthStore.getState().refreshProfile;
    const { fetchXP, subscribeToXP, unsubscribe } = useXPStore();
    const { mySubscriberCount, myMonthlyRevenue, fetchMySubscriberStats } = useSubscriptionStore();

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isProfileLive, setIsProfileLive] = useState(false);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'social');
    const [badges, setBadges] = useState<any[]>([]);
    const [badgesLoading, setBadgesLoading] = useState(false);
    const [activeRoles, setActiveRoles] = useState<ActiveRole[]>([]);
    const [roleStats, setRoleStats] = useState<RoleStats>({});
    const [isFollowing, setIsFollowing] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [postsCount, setPostsCount] = useState(0);
    const [modActionsCount, setModActionsCount] = useState(0);
    const [showUserModActions, setShowUserModActions] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [showColorPickerModal, setShowColorPickerModal] = useState(false);
    const [equippedFrame, setEquippedFrame] = useState<ProfileFrameType | null>(null);
    const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
    const tabDropdownRef = useRef<HTMLDivElement | null>(null);
    const initialLoadRef = useRef(true);
    const lastFetchKeyRef = useRef<string | null>(null);

    const isOwnProfile = currentUser?.id === profile?.id;
    const viewerRole = currentUserProfile?.troll_role || currentUserProfile?.role || 'user';
    const isAdminViewer = ['admin', 'troll_officer', 'lead_troll_officer'].includes(viewerRole);
    const isStaffViewer = ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary', 'officer', 'hr_admin', 'agency_hr_manager', 'ceo', 'superadmin', 'empire_partner', 'auctioneer', 'attorney', 'prosecutor', 'pastor', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'agency_hr', 'agency_leader', 'ceo_assistant', 'noah_assistant', 'academy_teacher', 'academy_director', 'admissions_officer'].includes(viewerRole) || currentUserProfile?.is_admin === true;
    const isViewBlocked = !isOwnProfile && !isAdminViewer && isBlocked;

    // Filter visible tabs based on roles and ownership
    const visibleTabs = useMemo(() => {
        return PROFILE_TABS.filter(tab => {
            if (tab.key === 'settings') return isOwnProfile;
            if (tab.key === 'purchases') return isOwnProfile;
            if (tab.key === 'promos') return isOwnProfile;
            if (tab.key === 'inventory') return isOwnProfile;
            if (tab.key === 'subscriptions') return true;
            if (tab.key === 'broadcasts') return activeRoles.some(r => r.role_type === 'broadcaster') || isOwnProfile;
            if (tab.key === 'auctions') return activeRoles.some(r => r.role_type === 'auctioneer') || isOwnProfile;
            if (tab.key === 'court') return activeRoles.some(r => ['attorney', 'prosecutor'].includes(r.role_type)) || isOwnProfile;
            if (tab.key === 'agency') return activeRoles.some(r => ['agency_leader', 'agency_hr', 'agency_hr_manager', 'secretary'].includes(r.role_type)) || isOwnProfile;
            if (tab.key === 'church') return activeRoles.some(r => r.role_type === 'pastor') || isOwnProfile;
            if (tab.key === 'marketplace') return activeRoles.some(r => r.role_type === 'seller') || isOwnProfile;
            return true;
        });
    }, [activeRoles, isOwnProfile]);

    // Fetch profile data
    useEffect(() => {
        window.scrollTo(0, 0);
        let isMounted = true;

        const fetchProfile = async () => {
            let targetId: string | null = null;
            if (userId) targetId = userId;
            else if (currentUser?.id && !username) targetId = currentUser.id;

            const fetchKey = `${userId || ''}|${username || ''}|${currentUser?.id || ''}`;
            if (!initialLoadRef.current && lastFetchKeyRef.current === fetchKey) return;

            const isDifferentProfile = prevProfileIdRef.current !== targetId && !username;
            if (initialLoadRef.current || isDifferentProfile) setLoading(true);

            const currentUserId = currentUser?.id;
            if (currentUserId) {
                fetchXP(currentUserId);
                subscribeToXP(currentUserId);
            }

            const PROFILE_COLS = 'id,username,display_name,avatar_url,cover_url,banner_url,troll_coins,role,is_admin,level,xp,xp_to_next_level,created_at,updated_at,bio,city,country,website,pronouns,is_verified,is_broadcaster,is_minor';
            let query = supabase.from('user_profiles').select(PROFILE_COLS);
            if (userId) query = query.eq('id', userId);
            else if (username) query = query.eq('username', username);
            else if (currentUserId) query = query.eq('id', currentUserId);
            else {
                if (isMounted) setLoading(false);
                return;
            }

            const { data, error } = await query.maybeSingle();
            if (error || !data) {
                console.error('Profile not found:', error);
                if (isMounted) setLoading(false);
                return;
            }

            prevProfileIdRef.current = data.id;
            initialLoadRef.current = false;

            // Fetch additional data
            const [followersRes, followingRes, postsRes, rolesRes, modActionsRes] = await Promise.all([
                supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', data.id),
                supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', data.id),
                supabase.from('troll_posts').select('id', { count: 'exact', head: true }).eq('user_id', data.id),
                supabase.rpc('get_user_active_roles', { p_user_id: data.id }),
                supabase.from('moderation_actions').select('id', { count: 'exact', head: true }).eq('target_user_id', data.id)
            ]);

            // Fetch role statistics
            const roles = (rolesRes.data || []) as ActiveRole[];
            const stats: RoleStats = {};
            for (const role of roles) {
                const { data: roleStat } = await supabase.rpc('get_role_statistics', {
                    p_user_id: data.id,
                    p_role_type: role.role_type
                });
                if (roleStat) stats[role.role_type] = roleStat;
            }

            // Check if current user is subscribed
            let subscribed = false;
            if (currentUser && currentUser.id !== data.id) {
                const { data: subData } = await supabase.rpc('get_user_active_subscription', {
                    p_subscriber_id: currentUser.id,
                    p_creator_id: data.id
                });
                subscribed = !!subData;
            }

            // Fetch equipped frame
            let frame: ProfileFrameType | null = null;
            try {
                const { data: frameData } = await supabase
                    .from('user_profile_frames')
                    .select('frame_id, is_equipped')
                    .eq('user_id', data.id)
                    .eq('is_equipped', true)
                    .maybeSingle();
                if (frameData?.frame_id) {
                    const { LAUNCH_FRAMES } = await import('../config/profileFrames');
                    frame = LAUNCH_FRAMES.find(f => f.id === frameData.frame_id) || null;
                }
            } catch { /* ignore frame load errors */ }

            if (isMounted) {
                setProfile(data);
                setFollowersCount(followersRes.count || 0);
                setFollowingCount(followingRes.count || 0);
                setPostsCount(postsRes.count || 0);
                setModActionsCount(modActionsRes.count || 0);
                setActiveRoles(roles);
                setRoleStats(stats);
                setIsSubscribed(subscribed);
                setEquippedFrame(frame);
                lastFetchKeyRef.current = fetchKey;
                setLoading(false);
            }
        };

        fetchProfile();

        return () => {
            isMounted = false;
        };
    }, [currentUser?.id, fetchXP, subscribeToXP, userId, username]);

    // Fetch featured badges when the Badges tab is active
    useEffect(() => {
        if (activeTab !== 'badges' || !profile?.id) return;
        let isMounted = true;
        setBadgesLoading(true);
        supabase
            .rpc('get_user_featured_badges', { p_user_id: profile.id, p_limit: 12 })
            .then(({ data }: any) => {
                if (isMounted) setBadges(data || []);
            })
            .catch((err) => console.error('Failed to load badges', err))
            .finally(() => {
                if (isMounted) setBadgesLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, [activeTab, profile?.id]);

    const prevProfileIdRef = useRef<string | null>(null);

    // Real-time profile updates
    useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase
            .channel(`profile-updates-${profile.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${profile.id}` },
                async (payload) => {
                    const newProfile = payload.new as any;
                    setProfile((prev: any) => ({ ...prev, ...newProfile }));
                    if (currentUser?.id === newProfile.id) await refreshProfile();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile?.id, currentUser?.id, refreshProfile]);

    // Check live status
    useEffect(() => {
        if (!profile?.id) return;
        let isMounted = true;

        const checkLiveStatus = async () => {
            try {
                const { data } = await supabase.from('streams').select('id').eq('broadcaster_id', profile.id).eq('is_live', true).maybeSingle();
                if (isMounted) setIsProfileLive(!!data);
            } catch (err) {
                console.error('Error checking live status:', err);
            }
        };

        checkLiveStatus();
        const channel = supabase
            .channel(`profile-live-${profile.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'streams', filter: `broadcaster_id=eq.${profile.id}` }, checkLiveStatus)
            .subscribe();

        return () => { isMounted = false; supabase.removeChannel(channel); };
    }, [profile?.id]);

    // Check follow status
    useEffect(() => {
        const checkFollowStatus = async () => {
            if (!currentUser || !profile?.id || currentUser.id === profile.id) return;
            const { data } = await supabase.from('user_follows').select('*').eq('follower_id', currentUser.id).eq('following_id', profile.id).maybeSingle();
            setIsFollowing(!!data);
        };
        checkFollowStatus();
    }, [currentUser, profile?.id]);

    // Check block status
    useEffect(() => {
        const checkBlockStatus = async () => {
            if (!currentUser || !profile?.id || currentUser.id === profile.id) {
                setIsBlocked(false);
                return;
            }
            const { data: iBlocked } = await supabase.from('user_blocks').select('id').eq('blocker_id', currentUser.id).eq('blocked_id', profile.id).maybeSingle();
            const { data: blockedMe } = await supabase.from('user_blocks').select('id').eq('blocker_id', profile.id).eq('blocked_id', currentUser.id).maybeSingle();
            setIsBlocked(!!iBlocked || !!blockedMe);
        };
        checkBlockStatus();
    }, [currentUser, profile?.id]);

    // SEO metadata
    useEffect(() => {
        if (!profile?.username) return;

        const displayName = profile.display_name || profile.username;
        const title = `${displayName} | Mai Troll`;
        const description = profile.bio || `Check out ${displayName}'s profile on Mai Troll`;
        const profileUrl = `${window.location.origin}/${encodeURIComponent(profile.username)}`;
        const ogImageUrl = buildOGImageUrl({ kind: 'profile', username: profile.username });

        document.title = title;

        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', description);
        else {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            metaDesc.setAttribute('content', description);
            document.head.appendChild(metaDesc);
        }

        const updateOG = (prop: string, content: string) => {
            let el = document.querySelector(`meta[property="og:${prop}"]`);
            if (el) el.setAttribute('content', content);
            else {
                el = document.createElement('meta');
                el.setAttribute('property', `og:${prop}`);
                el.setAttribute('content', content);
                document.head.appendChild(el);
            }
        };

        updateOG('title', title);
        updateOG('description', description);
        updateOG('url', profileUrl);
        updateOG('type', 'profile');
        updateOG('image', ogImageUrl);

        let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (canonical) canonical.href = profileUrl;
        else {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            canonical.setAttribute('href', profileUrl);
            document.head.appendChild(canonical);
        }

        const existingSchema = document.querySelector('#profile-schema');
        if (existingSchema) existingSchema.remove();

        const schemaScript = document.createElement('script');
        schemaScript.id = 'profile-schema';
        schemaScript.type = 'application/ld+json';
        schemaScript.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: `${displayName} on Mai Troll`,
            description,
            url: profileUrl,
            mainEntity: {
                '@type': 'Person',
                name: displayName,
                url: profileUrl,
                image: profile.avatar_url || undefined
            }
        });
        document.head.appendChild(schemaScript);

        return () => {
            const schema = document.querySelector('#profile-schema');
            if (schema) schema.remove();
        };
    }, [profile?.username, profile?.display_name, profile?.avatar_url, profile?.bio]);

    const handleFollow = async () => {
        if (!currentUser) return toast.error('Please login to follow users');
        if (currentUser.id === profile.id) return toast.error('You cannot follow yourself');

        if (isFollowing) {
            const { error } = await supabase.from('user_follows').delete().match({ follower_id: currentUser.id, following_id: profile.id });
            if (error) return toast.error('Failed to unfollow user');
            setIsFollowing(false);
            setFollowersCount(prev => Math.max(0, prev - 1));
            toast.success(`Unfollowed ${profile.username}`);
        } else {
            const { error } = await supabase.from('user_follows').insert({ follower_id: currentUser.id, following_id: profile.id });
            if (error) return toast.error('Failed to follow user');
            setIsFollowing(true);
            setFollowersCount(prev => prev + 1);
            toast.success(`Followed ${profile.username}`);
        }
    };

    const handleMessage = async () => {
        if (!currentUser) return toast.error('Please login to message users');
        navigate(`/utromail?recipientId=${encodeURIComponent(profile.id)}`);
    };

    const handleShare = async () => {
        const shareData = {
            title: `${profile.display_name} on Mai Troll`,
            text: profile.bio || `Check out ${profile.display_name}'s profile`,
            url: window.location.href,
        };
        if (navigator.share) {
            try { await navigator.share(shareData); } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied!');
        }
    };

    const handleTabSelect = (tabKey: string) => {
        setActiveTab(tabKey);
        setSearchParams({ tab: tabKey });
        setIsTabDropdownOpen(false);
    };

    const handleOpenUserModActions = useCallback(() => {
        setShowUserModActions(true);
    }, []);

    if (loading) {
        return (
        <div className="min-h-screen bg-slate-950 text-white pb-20 relative overflow-visible">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
                <div className="relative flex min-h-screen items-center justify-center">
                    <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 px-8 py-6 text-center backdrop-blur-2xl">
                        <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-cyan-300" />
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">Loading Profile</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-slate-950 text-white">
                <div className="relative flex min-h-screen items-center justify-center p-6">
                    <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 max-w-md p-8 text-center backdrop-blur-2xl">
                        <h2 className="text-2xl font-black text-white">User not found</h2>
                        <p className="mt-2 text-zinc-400">The user you are looking for does not exist.</p>
                        <button onClick={() => navigate('/')} className="mt-6 rounded-2xl bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 px-6 py-3 font-bold text-white">Go Home</button>
                    </div>
                </div>
            </div>
        );
    }

    if (isViewBlocked) {
        return (
            <div className="min-h-screen bg-slate-950 text-white">
                <div className="relative flex min-h-screen items-center justify-center p-6">
                    <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 max-w-md p-8 text-center backdrop-blur-2xl">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-red-500/30 bg-red-950/30">
                            <Ban className="h-10 w-10 text-red-400" />
                        </div>
                        <h2 className="text-2xl font-black text-white">User Unavailable</h2>
                        <p className="mt-2 text-zinc-400">You cannot view this profile.</p>
                        <button onClick={() => navigate('/')} className="mt-6 rounded-2xl bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 px-6 py-3 font-bold text-white">Go Home</button>
                    </div>
                </div>
            </div>
        );
    }

    const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'social':
                return <ProfileFeed userId={profile.id} />;
            case 'broadcasts':
                return <ProfileReplays userId={profile.id} />;
            case 'watchlist':
                return <ProfileWatchlist userId={profile.id} />;
            case 'inventory':
                return <UserInventory embedded />;
            case 'subscriptions':
                return (
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Subscription Overview</h3>
                            {isOwnProfile ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                                        <p className="text-white/50 text-sm">Subscribers</p>
                                        <p className="text-3xl font-black text-cyan-300">{mySubscriberCount}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                                        <p className="text-white/50 text-sm">Monthly Revenue</p>
                                        <p className="text-3xl font-black text-green-300">{myMonthlyRevenue.toLocaleString()} TC</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                                        <p className="text-white/50 text-sm">Cash Value</p>
                                        <p className="text-3xl font-black text-yellow-300">${(myMonthlyRevenue / 300).toFixed(2)}</p>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSubscriptionModal(true)}
                                    className="w-full rounded-2xl bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 px-6 py-4 font-bold text-white"
                                >
                                    <Crown className="inline w-5 h-5 mr-2" />
                                    Subscribe to {profile.username}
                                </button>
                            )}
                        </div>
                    </div>
                );
            case 'badges':
                return (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Achievement Badges</h3>
                        {badgesLoading ? (
                            <p className="text-white/50">Loading badges…</p>
                        ) : badges.length === 0 ? (
                            <p className="text-white/50">Badges will appear here as you achieve milestones.</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                {badges.map((badge: any, i: number) => (
                                    <div key={badge?.id || i} className="flex flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
                                        {badge?.icon_url ? (
                                            <img src={badge.icon_url} alt={badge?.name || 'Badge'} className="h-12 w-12 rounded-full object-cover" />
                                        ) : (
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15 text-2xl">🏅</div>
                                        )}
                                        <p className="mt-2 text-xs font-semibold text-white">{badge?.name || 'Badge'}</p>
                                        {badge?.description && (
                                            <p className="mt-0.5 text-[10px] text-white/50">{badge.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'settings':
                return (
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Account Settings</h3>
                            <button onClick={() => navigate('/profile/settings')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-semibold text-white hover:bg-white/10 transition">
                                Open Profile Settings
                            </button>
                        </div>
                    </div>
                );
            case 'promos':
                return <ProfileMaitalentPromos />;
            default:
                return <ProfileFeed userId={profile.id} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-20 relative overflow-y-auto">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(147,51,234,0.22),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(45,212,191,0.16),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.85))]" />

            <main className="relative mx-auto max-w-7xl px-3 py-5 sm:px-6 lg:px-8">
                {/* Profile Header */}
                <ProfileHeader
                    profile={
                        isOwnProfile
                            ? { ...(currentUserProfile || profile), followers_count: followersCount, following_count: followingCount, posts_count: postsCount }
                            : { ...profile, followers_count: followersCount, following_count: followingCount, posts_count: postsCount }
                    }
                    isOwnProfile={isOwnProfile}
                    isFollowing={isFollowing}
                    onFollow={handleFollow}
                    onEdit={() => navigate('/profile/settings')}
                    onShare={handleShare}
                    onMessage={handleMessage}
                    onSubscribe={() => setShowSubscriptionModal(true)}
                    onUnsubscribe={async () => {
                        if (currentUser) {
                            await supabase.rpc('unsubscribe_from_broadcaster', {
                                p_subscriber_id: currentUser.id,
                                p_broadcaster_id: profile.id
                            });
                            setIsSubscribed(false);
                            toast.success('Unsubscribed');
                        }
                    }}
                    isSubscribed={isSubscribed}
                    subscriberCount={isOwnProfile ? mySubscriberCount : (profile?.subscriber_count || 0)}
                    modActionsCount={modActionsCount}
                    showModActionsStat={isStaffViewer}
                    onModActionsClick={handleOpenUserModActions}
                    isJailed={!!profile?.is_jailed}
                />

                {/* Role Cards */}
                {activeRoles.length > 0 && (
                    <section className="mt-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Award className="w-5 h-5 text-purple-400" />
                            Career Roles
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeRoles.map(role => (
                                <RoleCard
                                    key={role.role_type}
                                    roleType={role.role_type}
                                    stats={roleStats[role.role_type]}
                                    onClick={() => {
                                        const tabMap: Record<string, string> = {
                                            auctioneer: 'auctions',
                                            attorney: 'court',
                                            prosecutor: 'court',
                                            journalist: 'social',
                                            pastor: 'church',
                                            seller: 'marketplace',
                                            broadcaster: 'broadcasts'
                                        };
                                        const targetTab = tabMap[role.role_type];
                                        if (targetTab) handleTabSelect(targetTab);
                                    }}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Profile Tabs */}
                <section className="mt-6">
                    <ProfileTabs
                        activeTab={activeTab}
                        onTabChange={handleTabSelect}
                        visibleTabs={visibleTabs}
                        isOwnProfile={isOwnProfile}
                    />

                    <div className="mt-6">
                        {renderTabContent()}
                    </div>
                </section>
            </main>

            {/* Subscription Modal */}
            {showSubscriptionModal && (
                <SubscriptionTierSelector
                    broadcasterId={profile.id}
                    broadcasterUsername={profile.username}
                    onClose={() => setShowSubscriptionModal(false)}
                    onSelect={() => {
                        setShowSubscriptionModal(false);
                        setIsSubscribed(true);
                    }}
                />
            )}

            {/* User Mod Actions Modal */}
            {showUserModActions && (
                <UserModActionsModal
                    isOpen={showUserModActions}
                    onClose={() => setShowUserModActions(false)}
                    userId={profile.id}
                    username={profile.username}
                    currentUserId={currentUser?.id}
                />
            )}
        </div>
    );
}

export default function Profile() {
    const inRouter = useInRouterContext();
    if (!inRouter) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
                <div className="text-sm text-zinc-400">Profile view is unavailable outside the app router.</div>
            </div>
        );
    }
    return <ProfileInner />;
}
