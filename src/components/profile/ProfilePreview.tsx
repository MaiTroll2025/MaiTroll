/**
 * ProfilePreview.tsx
 * Live preview component for profile customization
 */

import React from 'react';
import { MapPin, Link2, Calendar, UserPlus, MessageCircle, BadgeCheck } from 'lucide-react';

interface ProfilePreviewProps {
    profile: any;
    customization: {
        theme_color: string;
        accent_color: string;
        background_style: string;
        card_style: string;
    };
}

export default function ProfilePreview({ profile, customization }: ProfilePreviewProps) {
    const { theme_color = '#9333ea', accent_color = '#22d3ee', background_style, card_style } = customization;

    const getBackgroundStyle = () => {
        switch (background_style) {
            case 'solid':
                return { backgroundColor: `${theme_color}20` };
            case 'pattern':
                return {
                    backgroundImage: `linear-gradient(45deg, ${theme_color}10 25%, transparent 25%), 
                                      linear-gradient(-45deg, ${theme_color}10 25%, transparent 25%),
                                      linear-gradient(45deg, transparent 75%, ${theme_color}10 75%),
                                      linear-gradient(-45deg, transparent 75%, ${theme_color}10 75%)`,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                };
            case 'image':
                return { backgroundColor: `${theme_color}10` };
            case 'gradient':
            default:
                return {
                    background: `linear-gradient(135deg, ${theme_color}15 0%, ${accent_color}10 50%, ${theme_color}05 100%)`,
                };
        }
    };

    const getCardStyle = () => {
        switch (card_style) {
            case 'solid':
                return 'bg-slate-900 border border-white/10';
            case 'bordered':
                return 'bg-transparent border-2 border-white/20';
            case 'minimal':
                return 'bg-transparent';
            case 'glass':
            default:
                return 'bg-white/[0.03] backdrop-blur-xl border border-white/10';
        }
    };

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.username || 'default'}`;

    return (
        <div 
            className="rounded-2xl overflow-hidden max-w-md mx-auto"
            style={getBackgroundStyle()}
        >
            {/* Banner */}
            <div className="relative h-32 overflow-hidden">
                {profile?.cover_url || profile?.banner_url ? (
                    <img 
                        src={profile.cover_url || profile.banner_url} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div 
                        className="w-full h-full"
                        style={{ 
                            background: `linear-gradient(135deg, ${theme_color}60 0%, ${accent_color}40 100%)` 
                        }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>

            {/* Profile Content */}
            <div className="relative px-4 pb-4">
                {/* Avatar */}
                <div className="-mt-12 mb-3">
                    <div 
                        className="w-24 h-24 rounded-full border-4 p-0.5"
                        style={{ 
                            borderColor: theme_color,
                            backgroundColor: '#0f172a'
                        }}
                    >
                        <img 
                            src={avatarUrl} 
                            alt={profile?.display_name || 'Avatar'} 
                            className="w-full h-full rounded-full object-cover"
                        />
                    </div>
                </div>

                {/* Name & Username */}
                <div className="mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-white">
                            {profile?.display_name || profile?.username || 'Display Name'}
                        </h2>
                        {profile?.is_verified && (
                            <BadgeCheck className="w-5 h-5 text-blue-400" />
                        )}
                        {profile?.is_live && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                LIVE
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-white/50">@{profile?.username || 'username'}</p>
                </div>

                {/* Bio */}
                {profile?.bio && (
                    <p className="text-sm text-white/70 mb-3 line-clamp-3">
                        {profile.bio}
                    </p>
                )}

                {/* Location & Website */}
                <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-white/50">
                    {(profile?.city || profile?.country) && (
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[profile.city, profile.country].filter(Boolean).join(', ')}
                        </span>
                    )}
                    {profile?.website && (
                        <a 
                            href={profile.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline"
                            style={{ color: accent_color }}
                        >
                            <Link2 className="w-3 h-3" />
                            Website
                        </a>
                    )}
                    {profile?.created_at && (
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Joined {formatDate(profile.created_at)}
                        </span>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                        { label: 'Followers', value: profile?.followers_count || 0 },
                        { label: 'Following', value: profile?.following_count || 0 },
                        { label: 'Level', value: profile?.level || 1 },
                    ].map(stat => (
                        <div key={stat.label} className={`text-center p-2 rounded-xl ${getCardStyle()}`}>
                            <div className="text-lg font-bold text-white">
                                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                            </div>
                            <div className="text-xs text-white/40">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* XP Progress */}
                {profile?.xp !== undefined && (
                    <div className={`p-3 rounded-xl ${getCardStyle()} mb-3`}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/50">XP Progress</span>
                            <span className="text-xs font-medium" style={{ color: accent_color }}>
                                {profile.xp || 0} / {profile.xp_to_next_level || 100}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{ 
                                    width: `${Math.min(100, ((profile.xp || 0) / (profile.xp_to_next_level || 100)) * 100)}%`,
                                    background: `linear-gradient(90deg, ${theme_color}, ${accent_color})`
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button 
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90"
                        style={{ backgroundColor: theme_color }}
                    >
                        <UserPlus className="w-4 h-4" />
                        Follow
                    </button>
                    <button 
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-medium text-sm transition-all hover:opacity-80"
                        style={{ backgroundColor: `${accent_color}20`, color: accent_color }}
                    >
                        <MessageCircle className="w-4 h-4" />
                        Message
                    </button>
                </div>

                {/* Badges Preview */}
                <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-1">
                        {['🏆', '⭐', '🎯'].map((badge, i) => (
                            <div 
                                key={i}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 border-slate-900"
                                style={{ backgroundColor: `${theme_color}30` }}
                            >
                                {badge}
                            </div>
                        ))}
                    </div>
                    <span className="text-xs text-white/40">+3 badges</span>
                </div>
            </div>
        </div>
    );
}
