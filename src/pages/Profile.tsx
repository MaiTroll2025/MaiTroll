/**
 * Profile.tsx - Complete Profile System Overhaul
 * Career-based profile with role cards, subscriptions, and dynamic tabs
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Bell, Ban, CheckCircle, CheckCircle2, ChevronDown, Coins, Crown,
    FileText, Heart, Loader2, LogOut, MapPin, MessageCircle,
    Package, RefreshCw, Settings, Shield, ShoppingBag,
    Trash2, UserPlus, Users, Video, X, Zap, MoreHorizontal,
    History, Award, Gavel, Scale, BookOpen, Newspaper, Music, Disc3, Mic2, LayoutDashboard, Play, Clock
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
import ProfileWatchlist from '../components/profile/ProfileWatchlist';
import UserInventory from './UserInventory';
import ProfileSettings from './ProfileSettings';
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
    const currentUser = useAuthStore((s) => s.user);
    const currentUserProfile = useAuthStore((s) => s.profile);
    const refreshProfile = useAuthStore.getState().refreshProfile;
    const fetchXP = useXPStore((s) => s.fetchXP);
    const subscribeToXP = useXPStore((s) => s.subscribeToXP);
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
    const profileNotFoundRef = useRef(false);

    const [artistProfile, setArtistProfile] = useState<any>(null);
    const [artistLoading, setArtistLoading] = useState(false);
    const [artistTracks, setArtistTracks] = useState<any[]>([]);
    const [artistAlbums, setArtistAlbums] = useState<any[]>([]);

    const isOwnProfile = currentUser?.id === profile?.id;
    const viewerRole = currentUserProfile?.troll_role || currentUserProfile?.role || 'user';
    const isAdminViewer = ['admin', 'troll_officer', 'lead_troll_officer'].includes(viewerRole);
    const isStaffViewer = ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary', 'officer', 'hr_admin', 'agency_hr_manager', 'ceo', 'superadmin', 'empire_partner', 'auctioneer', 'attorney', 'prosecutor', 'pastor', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'agency_hr', 'agency_leader', 'ceo_assistant', 'noah_assistant', 'academy_teacher', 'academy_director', 'admissions_officer'].includes(viewerRole) || currentUserProfile?.is_admin === true;
    const isViewBlocked = !isOwnProfile && !isAdminViewer && isBlocked;

    // Filter visible tabs based on roles and ownership
    const visibleTabs = useMemo(() => {
        const isArtist = (profile as any)?.is_record_label_artist === true;
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
            if (tab.key === 'music' || tab.key === 'albums' || tab.key === 'tracks') return isArtist || isOwnProfile;
            return true;
        });
    }, [activeRoles, isOwnProfile, profile]);

    // Fetch profile data
    useEffect(() => {
        window.scrollTo(0, 0);
        let isMounted = true;

        const fetchProfile = async () => {
            let targetId: string | null = null;
            if (userId) targetId = userId;
            else if (currentUser?.id && !username) targetId = currentUser.id;

            const fetchKey = `${userId || ''}|${username || ''}|${currentUser?.id || ''}`;
            if (lastFetchKeyRef.current !== fetchKey) {
                profileNotFoundRef.current = false;
            }
            if (profileNotFoundRef.current) return;
            if (!initialLoadRef.current && lastFetchKeyRef.current === fetchKey) return;

            const isDifferentProfile = prevProfileIdRef.current !== targetId && !username;
            if (initialLoadRef.current || isDifferentProfile) setLoading(true);

            const currentUserId = currentUser?.id;
            if (currentUserId) {
                fetchXP(currentUserId);
                subscribeToXP(currentUserId);
            }

            const PROFILE_COLS = 'id,username,display_name,avatar_url,cover_url,banner_url,troll_coins,role,is_admin,level,xp,xp_to_next_level,created_at,updated_at,bio,city,country,website,pronouns,is_verified,is_broadcaster,is_minor,is_attorney,is_judge,is_prosecutor,is_ceo_assistant,is_noah_assistant,is_journalist,is_news_caster,is_chief_news_caster,is_auctioneer,is_pastor,is_secretary';
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
                profileNotFoundRef.current = true;
                if (isMounted) setLoading(false);
                return;
            }

            console.log('[Profile Debug] Fetched profile:', {
                id: data.id,
                username: data.username,
                cover_url: data.cover_url,
                banner_url: data.banner_url,
                avatar_url: data.avatar_url,
            });

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
        (supabase
            .rpc('get_user_featured_badges', { p_user_id: profile.id, p_limit: 12 }) as any
        ).then(({ data }: any) => {
            if (isMounted) setBadges(data || []);
        })
            .then(undefined, (err) => console.error('Failed to load badges', err))
            .finally(() => {
                if (isMounted) setBadgesLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, [activeTab, profile?.id]);

    // Fetch artist profile data when profile is an artist
    useEffect(() => {
        if (!profile?.id || !(profile as any)?.is_record_label_artist) {
            setArtistProfile(null);
            setArtistTracks([]);
            setArtistAlbums([]);
            return;
        }

        let isMounted = true;
        setArtistLoading(true);

        (async () => {
            const { data: artist } = await supabase
                .from('record_label_artist_profiles')
                .select('*')
                .eq('user_id', profile.id)
                .maybeSingle();

            if (!isMounted) return;
            setArtistProfile(artist);

            if (artist?.id) {
                const [tracksRes, albumsRes] = await Promise.all([
                    supabase.from('record_label_tracks').select('*').eq('artist_id', artist.id).order('created_at', { ascending: false }).limit(20),
                    supabase.from('record_label_albums').select('*').eq('artist_id', artist.id).order('created_at', { ascending: false }).limit(20),
                ]);

                if (isMounted) {
                    setArtistTracks(tracksRes.data || []);
                    setArtistAlbums(albumsRes.data || []);
                }
            }

            if (isMounted) setArtistLoading(false);
        })();

        return () => { isMounted = false; };
    }, [profile?.id, (profile as any)?.is_record_label_artist]);

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
            if (!currentUser?.id || !profile?.id || currentUser.id === profile.id) return;
            const { data } = await supabase.from('user_follows').select('*').eq('follower_id', currentUser.id).eq('following_id', profile.id).maybeSingle();
            setIsFollowing(!!data);
        };
        checkFollowStatus();
    }, [currentUser?.id, profile?.id]);

    // Check block status
    useEffect(() => {
        const checkBlockStatus = async () => {
            if (!currentUser?.id || !profile?.id || currentUser.id === profile.id) {
                setIsBlocked(false);
                return;
            }
            const { data: iBlocked } = await supabase.from('user_blocks').select('id').eq('blocker_id', currentUser.id).eq('blocked_id', profile.id).maybeSingle();
            const { data: blockedMe } = await supabase.from('user_blocks').select('id').eq('blocker_id', profile.id).eq('blocked_id', currentUser.id).maybeSingle();
            setIsBlocked(!!iBlocked || !!blockedMe);
        };
        checkBlockStatus();
    }, [currentUser?.id, profile?.id]);

    // SEO metadata
    useEffect(() => {
        if (!profile?.username) return;

        const displayName = profile.display_name || profile.username;
        const title = `${displayName} | MaiTroll`;
        const description = profile.bio || `Check out ${displayName} on MaiTroll`;
        const profileUrl = `https://www.maitroll.com/profile/${encodeURIComponent(profile.username)}`;
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

        const updateMeta = (selector: string, attribute: string, content: string) => {
            let el = document.querySelector(selector);
            if (el) el.setAttribute(attribute, content);
            else {
                el = document.createElement('meta');
                if (selector.startsWith('meta[property="')) {
                    el.setAttribute('property', selector.replace('meta[property="', '').replace('"]', ''));
                } else if (selector.startsWith('meta[name="')) {
                    el.setAttribute('name', selector.replace('meta[name="', '').replace('"]', ''));
                }
                el.setAttribute(attribute, content);
                document.head.appendChild(el);
            }
        };

        updateMeta('meta[property="og:title"]', 'content', title);
        updateMeta('meta[property="og:description"]', 'content', description);
        updateMeta('meta[property="og:url"]', 'content', profileUrl);
        updateMeta('meta[property="og:type"]', 'content', 'profile');
        updateMeta('meta[property="og:image"]', 'content', ogImageUrl);
        updateMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
        updateMeta('meta[name="twitter:title"]', 'content', title);
        updateMeta('meta[name="twitter:description"]', 'content', description);
        updateMeta('meta[name="twitter:image"]', 'content', ogImageUrl);

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
        
        const escapeJsonLd = (str: string) => String(str || '')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\b/g, '\\b')
          .replace(/\f/g, '\\f')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u0062')
          .replace(/&/g, '\\u0026');
        
        schemaScript.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            name: `${displayName} on MaiTroll`,
            description: escapeJsonLd(description),
            url: profileUrl,
            mainEntity: {
                '@type': 'Person',
                name: escapeJsonLd(displayName),
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
            title: `${profile.display_name} on MaiTroll`,
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
                return null;
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
                return <ProfileSettings />;
            case 'music':
                return (
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Latest Track</h3>
                            {artistLoading ? (
                                <p className="text-white/50">Loading…</p>
                            ) : artistTracks.length === 0 ? (
                                <p className="text-white/50">No tracks published yet.</p>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {artistTracks.slice(0, 4).map((track: any) => (
                                        <div key={track.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                                                {track.cover_url ? (
                                                    <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center"><Music size={23} className="text-purple-300" /></div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-black text-white">{track.title}</p>
                                                <p className="truncate text-xs text-slate-400">{artistProfile?.stage_name}</p>
                                                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1"><Heart size={12} />{track.like_count.toLocaleString()}</span>
                                                    <span className="flex items-center gap-1"><Play size={12} />{track.play_count.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'albums':
                return (
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Albums</h3>
                            {artistLoading ? (
                                <p className="text-white/50">Loading…</p>
                            ) : artistAlbums.length === 0 ? (
                                <p className="text-white/50">No albums published yet.</p>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {artistAlbums.map((album: any) => (
                                        <div key={album.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                                            {album.cover_url && <img src={album.cover_url} alt={album.title} className="w-full aspect-square object-cover rounded-xl mb-3" />}
                                            <p className="font-black text-white truncate">{album.title}</p>
                                            <p className="text-xs text-slate-400">{album.release_date || 'Draft'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'tracks':
                return (
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Tracks</h3>
                            {artistLoading ? (
                                <p className="text-white/50">Loading…</p>
                            ) : artistTracks.length === 0 ? (
                                <p className="text-white/50">No tracks published yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {artistTracks.map((track: any) => (
                                        <div key={track.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
                                                {track.cover_url ? (
                                                    <img src={track.cover_url} alt={track.title} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center"><Music size={18} className="text-purple-300" /></div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-black text-white">{track.title}</p>
                                                <p className="truncate text-xs text-slate-400">{track.genre || 'No genre'}</p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Heart size={12} />{track.like_count.toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><Play size={12} />{track.play_count.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
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
                    onAvatarEdit={() => navigate('/profile/settings')}
                    onCoverEdit={() => navigate('/profile/settings', { state: { openCoverUpload: true } })}
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

                {/* MAI Record Label Artist Section */}
                {(profile as any)?.is_record_label_artist && (
                    <section className="mt-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Music className="w-5 h-5 text-purple-400" />
                            MAI Record Label
                        </h2>
                        <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 to-black/30 p-6">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className="flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs font-bold text-purple-300">
                                    <Music size={14} /> MAI Artist
                                </span>
                                {artistProfile?.verified && (
                                    <span className="flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
                                        <CheckCircle size={14} /> Verified
                                    </span>
                                )}
                                {artistProfile?.status === 'probation' && (
                                    <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
                                        <Clock size={14} /> Probation
                                    </span>
                                )}
                                {artistProfile?.status === 'active' && (
                                    <span className="flex items-center gap-1 rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-bold text-green-300">
                                        <CheckCircle2 size={14} /> Approved
                                    </span>
                                )}
                            </div>
                            {artistProfile && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                        <p className="text-white/50 text-xs">Stage Name</p>
                                        <p className="text-sm font-black text-white truncate">{artistProfile.stage_name}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                        <p className="text-white/50 text-xs">Genre</p>
                                        <p className="text-sm font-black text-white truncate">{artistProfile.primary_genre || 'N/A'}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                        <p className="text-white/50 text-xs">Joined</p>
                                        <p className="text-sm font-black text-white truncate">{new Date(artistProfile.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                        <p className="text-white/50 text-xs">Tracks</p>
                                        <p className="text-sm font-black text-white truncate">{artistTracks.length}</p>
                                    </div>
                                </div>
                            )}
                            {isOwnProfile && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button onClick={() => navigate('/artist/dashboard')} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white transition hover:bg-purple-500">
                                        <LayoutDashboard size={16} /> Artist Dashboard
                                    </button>
                                    <button onClick={() => navigate('/artist/contract')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">
                                        <FileText size={16} /> Contract
                                    </button>
                                </div>
                            )}
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
