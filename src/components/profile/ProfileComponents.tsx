/**
 * ProfileComponents.tsx
 * Role cards and profile component for the career-based profile system
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import LevelStatusCard from '@/components/home/LevelStatusCard';
import { useTheme } from '@/hooks/useTheme'
import {
    Gavel, FileText, Mic, Radio, ShoppingBag, Video,
    Star, Award, Users, TrendingUp, Clock, DollarSign, Eye,
    CheckCircle, Shield, Crown, Heart, MessageCircle, UserPlus,
    Settings, Package, History, Bookmark, Send, MoreHorizontal,
    ShoppingCart, Hammer, BookOpen, Newspaper, Scale, Ticket, AlertTriangle, ShieldAlert,
    Camera, Music, Disc3, Mic2, Key
} from 'lucide-react';

interface UserProfile {
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
    followers_count: number;
    following_count: number;
    posts_count: number;
    is_verified: boolean;
    is_live: boolean;
    is_minor?: boolean;
    created_at: string;
    theme_color?: string;
    accent_color?: string;
    role?: string;
    is_admin?: boolean;
    is_attorney?: boolean;
    is_judge?: boolean;
    is_prosecutor?: boolean;
    is_ceo_assistant?: boolean;
    is_noah_assistant?: boolean;
    is_journalist?: boolean;
    is_news_caster?: boolean;
    is_chief_news_caster?: boolean;
    is_auctioneer?: boolean;
    is_pastor?: boolean;
    is_secretary?: boolean;
}

interface ProfileHeaderProps {
    profile: UserProfile;
    isOwnProfile: boolean;
    isFollowing: boolean;
    onFollow: () => void;
    onEdit: () => void;
    onShare: () => void;
    onMessage: () => void;
    onSubscribe: () => void;
    onUnsubscribe: () => void;
    isSubscribed: boolean;
    subscriberCount: number;
    modActionsCount?: number;
    showModActionsStat?: boolean;
    onModActionsClick?: () => void;
    isJailed?: boolean;
    onAvatarEdit?: () => void;
    onCoverEdit?: () => void;
    onFollowersClick?: () => void;
    onFollowingClick?: () => void;
}

export function ProfileHeader({
    profile,
    isOwnProfile,
    isFollowing,
    onFollow,
    onEdit,
    onShare,
    onMessage,
    onSubscribe,
    onUnsubscribe,
    isSubscribed,
    subscriberCount,
    modActionsCount = 0,
    showModActionsStat = false,
    onModActionsClick,
    isJailed = false,
    onAvatarEdit,
    onCoverEdit,
    onFollowersClick,
    onFollowingClick,
}: ProfileHeaderProps) {
    const { theme } = useTheme()
    const themeColor = profile.theme_color || '#9333ea';
    const accentColor = profile.accent_color || '#22d3ee';
    const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`;
    const [expandedCover, setExpandedCover] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const getCareerRoleLabel = (): string | null => {
        if (!profile) return null;
        if (profile.role === 'attorney' || profile.is_attorney) return 'Attorney';
        if (profile.role === 'prosecutor' || profile.is_prosecutor) return 'Prosecutor';
        if (profile.role === 'judge' || profile.is_judge) return 'Judge';
        if (profile.role === 'ceo_assistant' || profile.is_ceo_assistant) return 'CEO Assistant';
        if (profile.role === 'noah_assistant' || profile.is_noah_assistant) return 'Noah Assistant';
        if (profile.role === 'journalist' || profile.is_journalist) return 'Journalist';
        if (profile.role === 'tcnn_news_caster' || profile.is_news_caster) return 'News Caster';
        if (profile.role === 'tcnn_chief_news_caster' || profile.is_chief_news_caster) return 'Chief News Caster';
        if (profile.role === 'auctioneer' || profile.is_auctioneer) return 'Auctioneer';
        if (profile.role === 'pastor' || profile.is_pastor) return 'Pastor';
        if (profile.role === 'secretary' || profile.is_secretary) return 'Secretary';
        return null;
    };

    const careerRoleLabel = getCareerRoleLabel();

    useEffect(() => {
        if (!expandedCover) return;
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setExpandedCover(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [expandedCover]);

    return (
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-[0_0_60px_rgba(147,51,234,0.16)] backdrop-blur-2xl overflow-hidden">
            {/* Banner */}
            <div className="relative h-56 md:h-72 overflow-hidden">
                {(profile.cover_url || profile.banner_url) ? (
                    <img
                        src={profile.cover_url || profile.banner_url}
                        alt="Cover"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setExpandedCover(true)}
                        onLoad={() => console.log('[Cover Photo Debug] Image loaded:', profile.cover_url || profile.banner_url)}
                        onError={(e) => console.error('[Cover Photo Debug] Image failed to load:', profile.cover_url || profile.banner_url, e)}
                    />
                ) : (
                    <div className="w-full h-full cursor-pointer" onClick={() => setExpandedCover(true)} style={{ background: `linear-gradient(135deg, ${themeColor}60 0%, ${accentColor}40 50%, ${themeColor}30 100%)` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-black/45 to-black/10 pointer-events-none" />
                {(() => {
                    const coverSrc = profile.cover_url || profile.banner_url;
                    console.log('[Cover Photo Debug]', {
                        username: profile.username,
                        hasCover: !!coverSrc,
                        cover_url: profile.cover_url,
                        banner_url: profile.banner_url,
                        src: coverSrc,
                    });
                    return null;
                })()}
                <div className={`absolute left-5 top-5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-xl pointer-events-none ${theme === 'light' ? 'border-gray-300 bg-white/80 text-gray-900' : 'border-white/20 bg-slate-950/60 text-white/80'}`}>
                    Mai Troll Profile
                </div>
                {isOwnProfile && onCoverEdit && (
                    <button
                        onClick={onCoverEdit}
                        className="absolute bottom-4 right-4 rounded-full bg-slate-950/80 border border-white/20 px-3 py-2 text-white hover:bg-slate-900 hover:border-white/40 transition flex items-center gap-1.5"
                        title="Change cover photo"
                    >
                        <Camera className="h-4 w-4" />
                        <span className="text-xs font-semibold">Change Cover</span>
                    </button>
                )}
            </div>

            {expandedCover && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setExpandedCover(false)}
                >
                    <div
                        className="relative max-w-[95vw] max-h-[95vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="absolute top-2 right-2 z-20 rounded-full bg-slate-800/90 p-2 text-white hover:bg-slate-700 transition-colors"
                            onClick={() => setExpandedCover(false)}
                            aria-label="Close cover preview"
                        >
                            ✕
                        </button>
                        <img
                            src={profile.cover_url || profile.banner_url}
                            alt="Cover expanded"
                            className="max-h-[90vh] w-auto object-contain"
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 text-white text-sm">
                            Auto-closing in {countdown}s
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Profile Info */}
            <div className="relative px-5 pb-6 md:px-8">
                <div className="-mt-20 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    {/* Avatar & Name */}
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                        <div className={`relative h-44 w-44 shrink-0 rounded-full border-4 bg-black p-1 shadow-[0_0_50px_rgba(0,0,0,0.8)] ${profile.is_live ? 'border-red-400' : 'border-white/20'}`}
                            style={{ borderColor: profile.is_live ? undefined : themeColor }}>
                            <img src={avatarUrl} alt={profile.display_name} className="w-full h-full rounded-full object-cover" />
                            {isOwnProfile && onAvatarEdit && (
                                <button
                                    onClick={onAvatarEdit}
                                    className="absolute -bottom-1 -right-1 rounded-full bg-slate-950/80 border border-white/20 p-2 text-white hover:bg-slate-900 hover:border-white/40 transition"
                                    title="Change profile picture"
                                >
                                    <Camera className="h-4 w-4" />
                                </button>
                            )}
                            {isJailed && (
                                <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                                    <div className="absolute inset-0 bg-black/40" />
                                    <div className="absolute inset-0" style={{
                                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(0,0,0,0.8) 8px, rgba(0,0,0,0.8) 12px), repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(0,0,0,0.8) 8px, rgba(0,0,0,0.8) 12px)',
                                    }} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white shadow-lg">JAILED</span>
                                    </div>
                                </div>
                            )}
                            {profile.is_live && (
                                <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-[0_0_24px_rgba(239,68,68,0.8)] animate-pulse">
                                    LIVE
                                </span>
                            )}
                        </div>

                        <div className="pb-1">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                {profile.is_verified && (
                                    <span className="flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-300">
                                        <CheckCircle className="w-3 h-3" /> Verified
                                    </span>
                                )}
                                {profile.is_minor && (
                                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
                                        Minor Account
                                    </span>
                                )}
                                {subscriberCount > 0 && (
                                    <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs font-bold text-purple-300">
                                        {subscriberCount} Subscribers
                                    </span>
                                )}
                            </div>
                            <h1 className={`text-3xl font-black tracking-tight md:text-5xl ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                                {profile.username || profile.display_name}
                            </h1>
                            <div className={`mt-2 flex flex-wrap items-center gap-3 text-sm ${theme === 'light' ? 'text-gray-500' : 'text-white/50'}`}>
                                <span className="font-bold" style={{ color: accentColor }}>
                                    {careerRoleLabel || `@${profile.username}`}
                                </span>
                                {profile.bio && <span className={theme === 'light' ? 'text-gray-400' : 'text-white/40'}>•</span>}
                                <span className={`max-w-xs truncate ${theme === 'light' ? 'text-gray-600' : ''}`}>{profile.bio}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pb-2">
                        {isOwnProfile ? (
                            <>
                                <button onClick={onEdit} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 font-bold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-pink-500">
                                    <Settings className="w-4 h-4" /> Edit Profile
                                </button>
                                <button onClick={onShare} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/10">
                                    <Send className="w-4 h-4" /> Share
                                </button>
                            </>
                        ) : isJailed ? (
                            <>
                                <button onClick={onFollow} className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition ${isFollowing ? 'border border-white/10 bg-white/5 text-white/80' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-pink-500'}`}>
                                    <UserPlus className="w-4 h-4" /> {isFollowing ? 'Following' : 'Follow'}
                                </button>
                                {showModActionsStat && (
                                    <button onClick={onModActionsClick} className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 font-bold text-red-300 transition hover:bg-red-500/20">
                                        <ShieldAlert className="w-4 h-4" /> Mod Actions
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button onClick={onFollow} className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition ${isFollowing ? 'border border-white/10 bg-white/5 text-white/80' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-pink-500'}`}>
                                    <UserPlus className="w-4 h-4" /> {isFollowing ? 'Following' : 'Follow'}
                                </button>
                                <button onClick={isSubscribed ? onUnsubscribe : onSubscribe} className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition ${isSubscribed ? 'bg-green-600 hover:bg-green-500 text-white' : 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20'}`}>
                                    <Crown className="w-4 h-4" /> {isSubscribed ? 'Subscribed' : 'Subscribe'}
                                </button>
                                <button onClick={onMessage} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/10">
                                    <MessageCircle className="w-4 h-4" /> Message
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Level System — moved from home left nav sidebar; shown next to Mod Actions */}
                <LevelStatusCard />

                {/* Stats */}
                <div className="mt-6 grid grid-cols-3 gap-2 md:max-w-xl md:gap-3">
                    {[
                        { label: 'Followers', value: profile.followers_count, clickable: !!onFollowersClick, onClick: onFollowersClick },
                        { label: 'Following', value: profile.following_count, clickable: !!onFollowingClick, onClick: onFollowingClick },
                        ...(showModActionsStat ? [{ label: 'Mod Actions', value: modActionsCount, clickable: true, onClick: onModActionsClick }] : []),
                    ].map(stat => (
                        <div key={stat.label} className={`rounded-2xl border border-white/10 bg-black/40 p-3 text-center transition ${stat.clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-cyan-500/5' : 'hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/5'}`} onClick={stat.clickable ? stat.onClick : undefined}>
                            <div className="text-sm font-black text-white sm:text-2xl">{stat.value.toLocaleString()}</div>
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50 sm:text-xs sm:tracking-[0.25em]">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

interface RoleCardProps {
    roleType: string;
    stats: any;
    onClick?: () => void;
}

export function RoleCard({ roleType, stats, onClick }: RoleCardProps) {
    const roleConfig: Record<string, {
        title: string;
        icon: React.ElementType;
        color: string;
        bgColor: string;
        stats: { key: string; label: string; icon: React.ElementType }[];
    }> = {
        auctioneer: {
            title: 'Auctioneer',
            icon: Gavel,
            color: 'text-amber-400',
            bgColor: 'bg-amber-400/10 border-amber-400/30',
            stats: [
                { key: 'auctions_hosted', label: 'Auctions Hosted', icon: Hammer },
                { key: 'items_sold', label: 'Items Sold', icon: ShoppingCart },
                { key: 'coins_generated', label: 'Coins Generated', icon: DollarSign },
                { key: 'reputation_score', label: 'Reputation', icon: Star }
            ]
        },
        attorney: {
            title: 'Attorney',
            icon: Scale,
            color: 'text-blue-400',
            bgColor: 'bg-blue-400/10 border-blue-400/30',
            stats: [
                { key: 'cases_handled', label: 'Cases Handled', icon: FileText },
                { key: 'cases_won', label: 'Cases Won', icon: CheckCircle },
                { key: 'appeals_won', label: 'Appeals Won', icon: TrendingUp },
                { key: 'rating', label: 'Rating', icon: Star }
            ]
        },
        prosecutor: {
            title: 'Prosecutor',
            icon: Shield,
            color: 'text-red-400',
            bgColor: 'bg-red-400/10 border-red-400/30',
            stats: [
                { key: 'cases_prosecuted', label: 'Cases Prosecuted', icon: FileText },
                { key: 'successful_prosecutions', label: 'Successful', icon: CheckCircle },
                { key: 'conviction_rate', label: 'Conviction Rate', icon: TrendingUp }
            ]
        },
        journalist: {
            title: 'Journalist',
            icon: Newspaper,
            color: 'text-purple-400',
            bgColor: 'bg-purple-400/10 border-purple-400/30',
            stats: [
                { key: 'articles_published', label: 'Articles', icon: FileText },
                { key: 'investigations_completed', label: 'Investigations', icon: BookOpen },
                { key: 'followers_count', label: 'Followers', icon: Users }
            ]
        },
        pastor: {
            title: 'Pastor',
            icon: BookOpen,
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-400/10 border-cyan-400/30',
            stats: [
                { key: 'services_hosted', label: 'Services', icon: Radio },
                { key: 'community_members_helped', label: 'Helped', icon: Heart },
                { key: 'church_followers', label: 'Followers', icon: Users }
            ]
        },
        seller: {
            title: 'Seller',
            icon: ShoppingBag,
            color: 'text-green-400',
            bgColor: 'bg-green-400/10 border-green-400/30',
            stats: [
                { key: 'items_sold', label: 'Items Sold', icon: ShoppingCart },
                { key: 'active_listings', label: 'Active Listings', icon: Package },
                { key: 'seller_rating', label: 'Rating', icon: Star },
                { key: 'store_followers', label: 'Store Followers', icon: Users }
            ]
        },
        broadcaster: {
            title: 'Broadcaster',
            icon: Video,
            color: 'text-pink-400',
            bgColor: 'bg-pink-400/10 border-pink-400/30',
            stats: [
                { key: 'total_broadcasts', label: 'Broadcasts', icon: Video },
                { key: 'broadcast_hours', label: 'Hours', icon: Clock },
                { key: 'highest_viewers', label: 'Peak Viewers', icon: Eye },
                { key: 'total_gift_coins', label: 'Gifts Received', icon: DollarSign }
            ]
        }
    };

    const config = roleConfig[roleType];
    if (!config) return null;

    const Icon = config.icon;

    return (
        <div className={`rounded-2xl border p-5 ${config.bgColor} transition hover:scale-[1.02]`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${config.bgColor}`}>
                        <Icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <h3 className="text-lg font-bold text-white">{config.title}</h3>
                </div>
                {onClick && (
                    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${config.color} border border-current/30 hover:bg-white/5 transition`}>
                        View
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                {config.stats.map(stat => {
                    const StatIcon = stat.icon;
                    const value = stats?.[stat.key];
                    return (
                        <div key={stat.key} className="bg-black/20 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <StatIcon className="w-4 h-4 text-white/50" />
                                <span className="text-xs text-white/50">{stat.label}</span>
                            </div>
                            <div className="text-xl font-bold text-white">
                                {typeof value === 'number' ? value.toLocaleString() : value?.toFixed(1) || '0'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface ProfileTabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    visibleTabs: { key: string; label: string; icon: React.ElementType }[];
    isOwnProfile: boolean;
}

export function ProfileTabs({ activeTab, onTabChange, visibleTabs, isOwnProfile }: ProfileTabsProps) {
    return (
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 backdrop-blur-2xl p-3">
            <div className="flex flex-wrap gap-2">
                {visibleTabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                                isActive
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                                    : 'border border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/10'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export const PROFILE_TABS = [
    { key: 'social', label: 'Social', icon: Users },
    { key: 'broadcasts', label: 'Broadcasts', icon: Video },
    { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { key: 'auctions', label: 'Auctions', icon: Gavel },
    { key: 'court', label: 'Court', icon: Scale },
    { key: 'agency', label: 'Agency', icon: Shield },
    { key: 'church', label: 'Church', icon: BookOpen },
    { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
    { key: 'badges', label: 'Badges', icon: Award },
    { key: 'keys', label: 'Keys', icon: Key },
    { key: 'inventory', label: 'Inventory & Perks', icon: Package },
    { key: 'purchases', label: 'Purchase History', icon: History },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'music', label: 'Music', icon: Music },
    { key: 'albums', label: 'Albums', icon: Disc3 },
    { key: 'tracks', label: 'Tracks', icon: Mic2 },
];

export default ProfileComponents;

function ProfileComponents() {
    return null;
}
