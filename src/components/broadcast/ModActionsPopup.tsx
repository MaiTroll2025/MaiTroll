import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Gift, Shield, Gavel, Ban, Eye, Clock, UserCheck, User,
  AlertTriangle, Building2, Wallet, FileText, Users,
  Mic, MicOff, AlertCircle, MessageSquareOff, LogOut, Power,
  Search, Car, UserPlus, MessageSquare, Flag, Crown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useChatStore } from '../../lib/chatStore';
import { toast } from 'sonner';
import GiftBoxModal from './GiftBoxModal';
import BackgroundCheckView from './BackgroundCheckView';
import { hasProtection } from '../../lib/insuranceSystem';
import {
  hasModActionsAccess,
  isBroadcasterOrBroadofficer,
  rpcModeratorMuteUser,
  rpcModeratorUnmuteUser,
  rpcModoArrest,
  rpcModeratorDisableChat,
  rpcModeratorKickUser,
  rpcModoSuspendLicense,
  rpcModoGrantLicense,
  rpcRemoveStreamBroadofficer,
  rpcResetUserPermissions,
  rpcModoEndStream,
  rpcApplyTrollCoinPenalty,
} from '../../types/moderationActions';
import { isProtectedPlatformRole } from '../../lib/protectedRoles';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string;
  role?: string;
  troll_role?: string;
  is_troll_officer?: boolean;
  is_lead_officer?: boolean;
  is_admin?: boolean;
  is_prosecutor?: boolean;
  is_attorney?: boolean;
  is_staff?: boolean;
}

interface ModActionsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  targetUsername: string;
  targetUserId: string;
  streamId: string;
  hostId: string;
  currentUserId?: string;
  onMuteUser?: (userId: string, duration: number) => void;
  onUnmuteUser?: (userId: string) => void;
  onArrestUser?: (userId: string, reason: string, severity: string, bailAmount: number) => void;
  onDisableChat?: (userId: string, duration: number) => void;
  onKickUser?: (userId: string) => void;
  onViewBackgroundCheck?: (userId: string) => void;
}

type TabType = 'gift' | 'mod' | 'social';

const MOD_ACTIONS_LIST = [
  { id: 'mute', label: 'Mute', icon: Mic, color: 'text-red-400', description: 'Mute user\'s microphone' },
  { id: 'unmute', label: 'Unmute', icon: MicOff, color: 'text-green-400', description: 'Unmute user\'s microphone' },
  { id: 'arrest', label: 'Arrest', icon: AlertCircle, color: 'text-orange-400', description: 'Send to Troll Jail' },
  { id: 'troll_coin_penalty', label: 'Coin Penalty', icon: Wallet, color: 'text-amber-400', description: 'Donate Troll Coins to admins' },
  { id: 'disable_chat', label: 'Disable Chat', icon: MessageSquareOff, color: 'text-yellow-400', description: 'Disable chat temporarily' },
  { id: 'kick', label: 'Kick', icon: LogOut, color: 'text-purple-400', description: 'Remove from broadcast' },
  { id: 'suspend_license', label: 'Suspend License', icon: Car, color: 'text-blue-400', description: 'Suspend driver\'s license' },
  { id: 'grant_license', label: 'Grant License', icon: UserCheck, color: 'text-green-400', description: 'Grant active driver license' },
  { id: 'remove_officer', label: 'Remove Officer', icon: Shield, color: 'text-red-500', description: 'Remove broadofficer status' },
  { id: 'set_to_user', label: 'Set to User', icon: User, color: 'text-gray-400', description: 'Remove all roles, set to user' },
  { id: 'end_stream', label: 'End Stream', icon: Power, color: 'text-red-500', description: 'End broadcast and restrict' },
  { id: 'background_check', label: 'Background', icon: FileText, color: 'text-blue-400', description: 'View user background' },
  { id: 'invite_to_role', label: 'Invite to Role', icon: Crown, color: 'text-emerald-400', description: 'Invite user to a new role', adminOnly: true },
];

const SEVERITY_LEVELS = [
  { id: 'minor', label: 'Minor', description: 'Minor offense', bailMultiplier: 1 },
  { id: 'moderate', label: 'Moderate', description: 'Moderate offense', bailMultiplier: 2 },
  { id: 'serious', label: 'Serious', description: 'Serious offense', bailMultiplier: 5 },
  { id: 'severe', label: 'Severe', description: 'Severe offense', bailMultiplier: 10 },
];

const ModActionsPopup = memo(function ModActionsPopup({
  isOpen,
  onClose,
  targetUser,
  targetUsername,
  targetUserId,
  streamId,
  hostId,
  currentUserId,
  onMuteUser,
  onUnmuteUser,
  onArrestUser,
  onDisableChat,
  onKickUser,
  onViewBackgroundCheck,
}: ModActionsPopupProps) {
   const { profile, user, isLoading } = useAuthStore();
   const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState<TabType>('gift');

   useEffect(() => {
     if (!isOpen) return
     console.debug('[ModActions][DEBUG] ModActionsPopup opened', {
       actorId: user?.id,
       actorProfileId: profile?.id,
       actorRole: profile?.role,
       actorTrollRole: profile?.troll_role,
       isBroadcaster: profile?.is_broadcaster,
       isAdmin: profile?.is_admin,
       targetUserId,
       targetUsername,
       targetUserRole: targetUser?.role,
       streamId,
       hostId,
     })
   }, [isOpen, user?.id, profile?.id, profile?.role, profile?.troll_role, profile?.is_broadcaster, profile?.is_admin, targetUserId, targetUsername, targetUser?.role, streamId, hostId])
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  
  // Arrest modal state
  const [showArrestModal, setShowArrestModal] = useState(false);
  const [arrestReason, setArrestReason] = useState('');
  const [arrestSeverity, setArrestSeverity] = useState('moderate');
  const [arrestBailAmount, setArrestBailAmount] = useState(100);
  const [isArresting, setIsArresting] = useState(false);

  // Troll Coin penalty state
  const [showTrollCoinPenaltyModal, setShowTrollCoinPenaltyModal] = useState(false);
  const [trollCoinPenaltyAmount, setTrollCoinPenaltyAmount] = useState(500);
  const [trollCoinPenaltyReason, setTrollCoinPenaltyReason] = useState('');
  const [trollCoinPenaltyCategory, setTrollCoinPenaltyCategory] = useState('Other');
  const [isApplyingTrollCoinPenalty, setIsApplyingTrollCoinPenalty] = useState(false);

  // Memoized handlers for arrest form
  const handleArrestReasonChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setArrestReason(e.target.value);
  }, []);

  const handleSeverityChange = useCallback((sev: string) => {
    setArrestSeverity(sev);
  }, []);
  
// Mute modal state
   const [showMuteModal, setShowMuteModal] = useState(false);
   const [muteDuration, setMuteDuration] = useState(5); // minutes
   const [isMuting, setIsMuting] = useState(false);
   
   // Disable chat modal state
   const [showDisableChatModal, setShowDisableChatModal] = useState(false);
   const [chatDisableDuration, setChatDisableDuration] = useState(5); // minutes
   const [isDisablingChat, setIsDisablingChat] = useState(false);
   
   // License suspension modal state
   const [showSuspendLicenseModal, setShowSuspendLicenseModal] = useState(false);
   const [suspendLicenseDuration, setSuspendLicenseDuration] = useState(24); // hours
   const [isSuspendingLicense, setIsSuspendingLicense] = useState(false);
   const [licenseSuspendReason, setLicenseSuspendReason] = useState('');
   
   // License grant state
   const [isGrantingLicense, setIsGrantingLicense] = useState(false);

   // Kick state
   const [isKicking, setIsKicking] = useState(false);
   const [hasInsuranceProtection, setHasInsuranceProtection] = useState(false);
  
  // End stream state
  const [showEndStreamModal, setShowEndStreamModal] = useState(false);
  const [restrictDuration, setRestrictDuration] = useState(60); // minutes
  const [isEndingStream, setIsEndingStream] = useState(false);
  const [endStreamReason, setEndStreamReason] = useState('');
  
  // Social state
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSocialReportModal, setShowSocialReportModal] = useState(false);
  const [socialReportReason, setSocialReportReason] = useState('');
  const [socialReportDescription, setSocialReportDescription] = useState('');
  const [isSubmittingSocialReport, setIsSubmittingSocialReport] = useState(false);

  // Role invite state
  const [showRoleInviteModal, setShowRoleInviteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const openChatBubble = useChatStore((state) => state.openChatBubble);
  
// Strict Mod Actions access: only the 9 authorized roles may use Mod Actions.
  // Ordinary accounts get NO access (no Mod Actions tab, no buttons, no popup).
  const hasModAccess = hasModActionsAccess(profile);
  const visibleActions = MOD_ACTIONS_LIST;
  const currentActorId = currentUserId || profile?.id;
  const isHost = currentActorId === hostId;
  const isTargetProtected = isProtectedPlatformRole(targetUser as any);
  const PROTECTED_ACTION_IDS = new Set(['mute', 'unmute', 'arrest', 'disable_chat', 'kick', 'suspend_license', 'remove_officer', 'set_to_user', 'end_stream']);
   const isActorBroadcasterOrOfficer = isBroadcasterOrBroadofficer(profile);
   const isActorAdmin = profile?.role === 'admin' || profile?.troll_role === 'admin' || profile?.is_admin === true;
   const isAuthorizedRole = isActorAdmin ||
     profile?.role === 'judge' || profile?.troll_role === 'judge' ||
     profile?.role === 'lead_troll_officer' || profile?.troll_role === 'lead_troll_officer' || profile?.is_lead_officer === true ||
     profile?.role === 'secretary' || profile?.troll_role === 'secretary' || profile?.is_secretary === true ||
     profile?.role === 'troll_officer' || profile?.troll_role === 'troll_officer' || profile?.is_troll_officer === true;
   const RESTRICTED_FOR_BROADCASTER_IDS = new Set(['suspend_license', 'grant_license', 'set_to_user', 'arrest']);
   const ADMIN_ONLY_IDS = new Set(['invite_to_role']);
   const baseActions = isTargetProtected ? visibleActions.filter((a) => !PROTECTED_ACTION_IDS.has(a.id)) : visibleActions;
   const nonAdminFiltered = isActorAdmin ? baseActions : baseActions.filter((a) => !ADMIN_ONLY_IDS.has(a.id));
   const filteredActions = (isActorBroadcasterOrOfficer && !isAuthorizedRole)
     ? nonAdminFiltered.filter((a) => !RESTRICTED_FOR_BROADCASTER_IDS.has(a.id))
     : nonAdminFiltered;
  const [effectiveStreamId, setEffectiveStreamId] = useState(streamId || '');
  const [effectiveHostId, setEffectiveHostId] = useState(hostId || '');

  // User search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    setEffectiveStreamId(streamId || '');
    setEffectiveHostId(hostId || '');
  }, [streamId, hostId]);

  useEffect(() => {
    if (streamId || !isOpen) return;

    const resolveActiveStream = async () => {
      try {
        const userIds = [hostId, targetUserId, currentActorId].filter(Boolean);
        if (userIds.length === 0) return;

        const { data, error } = await supabase
          .from('streams')
          .select('id, user_id, broadcaster_id, status, is_live')
          .or(`user_id.in.(${userIds.join(',')}),broadcaster_id.in.(${userIds.join(',')})`)
          .or('is_live.eq.true,status.eq.live,status.eq.active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data?.id) {
          setEffectiveStreamId(data.id);
          setEffectiveHostId(data.user_id || data.broadcaster_id || hostId || '');
        }
      } catch (error) {
        console.warn('[ModActions] Could not resolve active stream, global actions still available:', error);
      }
    };

    resolveActiveStream();
  }, [streamId, hostId, targetUserId, currentActorId, isOpen]);

  // Check if target is host
  const handleUserSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, troll_role, is_troll_officer, is_lead_officer, is_admin')
        .or(`username.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('[ModActions] Search error:', error);
      setSearchError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUserFromSearch = (user: UserProfile) => {
    setSearchResults([]);
    setSearchQuery('');
    setShowSearchModal(false);
    // This would need to be passed as a callback to update parent's targetUser
    toast.success(`Selected ${user.username}`);
  };

  // Check if target is host
  const isTargetHost = targetUserId === hostId;

  // Check insurance status for kick
  useEffect(() => {
    if (targetUserId) {
      checkInsuranceStatus();
    }
  }, [targetUserId]);

  const checkInsuranceStatus = async () => {
    try {
      const hasKickProtection = await hasProtection(targetUserId, 'kick');
      setHasInsuranceProtection(hasKickProtection);
    } catch (error) {
      console.error('Error checking insurance:', error);
    }
  };

  const handleMute = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;
    if (!effectiveStreamId) {
      toast.error('Mutting requires an active stream context');
      return;
    }
    console.debug('[ModActions][DEBUG] Mute clicked', {
      actorId: profile?.id,
      actorRole: profile?.role,
      actorTrollRole: profile?.troll_role,
      isBroadcaster: profile?.is_broadcaster,
      targetUserId,
      targetUsername,
      streamId: effectiveStreamId,
    });
    setIsMuting(true);
    try {
      const res = await rpcModeratorMuteUser(
        effectiveStreamId,
        targetUserId,
        muteDuration,
        `Muted for ${muteDuration} minutes`
      );
      console.debug('[ModActions][DEBUG] Mute RPC result', res);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} has been muted for ${muteDuration} minutes`);
      setShowMuteModal(false);
      onMuteUser?.(targetUserId, muteDuration);
    } catch (error) {
      console.error('[ModActions] Error muting user:', error);
      toast.error('Failed to mute user');
    } finally {
      setIsMuting(false);
    }
  };

  const handleUnmute = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;
    if (!effectiveStreamId) {
      toast.error('Unmuting requires an active stream context');
      return;
    }
    console.debug('[ModActions][DEBUG] Unmute clicked', {
      actorId: profile?.id,
      actorRole: profile?.role,
      actorTrollRole: profile?.troll_role,
      isBroadcaster: profile?.is_broadcaster,
      targetUserId,
      targetUsername,
      streamId: effectiveStreamId,
    });
    try {
      const res = await rpcModeratorUnmuteUser(
        effectiveStreamId,
        targetUserId
      );
      console.debug('[ModActions][DEBUG] Unmute RPC result', res);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} has been unmuted`);
      setShowUnmuteModal(false);
      onUnmuteUser?.(targetUserId);
    } catch (error) {
      console.error('[ModActions] Error unmuting user:', error);
      toast.error('Failed to unmute user');
    } finally {
      setIsUnmuting(false);
    }
  };

  const handleArrest = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId || !arrestReason) return;
    console.debug('[ModActions][DEBUG] Arrest clicked', {
      actorId: profile?.id,
      actorRole: profile?.role,
      actorTrollRole: profile?.troll_role,
      isBroadcaster: profile?.is_broadcaster,
      targetUserId,
      targetUsername,
      streamId: effectiveStreamId,
    });
    setIsArresting(true);

    try {
      const res = await rpcModoArrest(
        effectiveStreamId || '',
        targetUserId,
        arrestReason,
        arrestSeverity as 'minor' | 'moderate' | 'serious' | 'severe'
      );
      console.debug('[ModActions][DEBUG] Arrest RPC result', res);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      const data = res.data || {};
      const courtDate = data.court_date || '';
      const bail = data.bail || 100;
      setArrestBailAmount(Number(bail));
      toast.success(
        `${targetUsername} arrested - Court: ${courtDate ? new Date(String(courtDate)).toLocaleDateString() : 'scheduled'}`
      );
      setShowArrestModal(false);
      setArrestReason('');
      setArrestSeverity('moderate');
      onArrestUser?.(targetUserId, arrestReason, arrestSeverity, Number(bail));
    } catch (error) {
      console.error('Error arresting user:', error);
      toast.error('Failed to arrest user');
    } finally {
      setIsArresting(false);
    }
  };

  const handleTrollCoinPenalty = async () => {
    if (!profile || isLoading) {
      toast.error('Authentication data is still loading. Please try again.');
      return;
    }
    const amount = Math.floor(Number(trollCoinPenaltyAmount));
    if (!targetUserId || amount <= 0 || !trollCoinPenaltyReason.trim()) {
      toast.error('Enter a positive amount and violation reason');
      return;
    }

    setIsApplyingTrollCoinPenalty(true);
    try {
      const res = await rpcApplyTrollCoinPenalty(
        targetUserId,
        profile.id,
        trollCoinPenaltyReason.trim(),
        trollCoinPenaltyCategory,
        amount,
        effectiveStreamId || streamId || null,
        profile.username,
        targetUsername,
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} received a ${amount.toLocaleString()} Troll Coin penalty`);
      setShowTrollCoinPenaltyModal(false);
      setTrollCoinPenaltyReason('');
      setTrollCoinPenaltyCategory('Other');
      onClose();
    } catch (error) {
      console.error('[ModActions] Error applying Troll Coin penalty:', error);
      toast.error('Failed to apply Troll Coin penalty');
    } finally {
      setIsApplyingTrollCoinPenalty(false);
    }
  };

const handleDisableChat = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;
    if (!effectiveStreamId) {
      toast.error('Disabling chat requires an active stream context');
      return;
    }
    setIsDisablingChat(true);
    try {
      const res = await rpcModeratorDisableChat(
        effectiveStreamId,
        targetUserId,
        chatDisableDuration,
        `Chat disabled for ${chatDisableDuration} minutes`
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername}'s chat disabled for ${chatDisableDuration} minutes`);
      setShowDisableChatModal(false);
      onDisableChat?.(targetUserId, chatDisableDuration);
    } catch (error) {
      console.error('Error disabling chat:', error);
      toast.error('Failed to disable chat');
    } finally {
      setIsDisablingChat(false);
    }
  };

const handleSuspendLicense = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId || !licenseSuspendReason) return;
    setIsSuspendingLicense(true);
    try {
      const res = await rpcModoSuspendLicense(
        targetUserId,
        licenseSuspendReason,
        suspendLicenseDuration
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername}'s license suspended for ${suspendLicenseDuration} hours`);
      setShowSuspendLicenseModal(false);
      setLicenseSuspendReason('');
      onClose();
    } catch (error) {
      console.error('Error suspending license:', error);
      toast.error('Failed to suspend license');
    } finally {
      setIsSuspendingLicense(false);
    }
  };

const handleGrantLicense = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;
    setIsGrantingLicense(true);
    try {
      const res = await rpcModoGrantLicense(targetUserId);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} has been granted a driver license`);
      onClose();
    } catch (error) {
      console.error('Error granting license:', error);
      toast.error('Failed to grant license');
    } finally {
      setIsGrantingLicense(false);
    }
  };

const handleKick = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;

    const isAdminOrLead = profile?.role === 'admin' ||
                         profile?.role === 'lead_troll_officer' ||
                         profile?.is_admin ||
                         profile?.is_lead_officer;

    if (hasInsuranceProtection && !isAdminOrLead) {
      toast.error('Cannot kick user with active insurance protection');
      return;
    }

    if (!effectiveStreamId) {
      toast.error('Kick requires an active stream context');
      return;
    }

    setIsKicking(true);
    try {
      const res = await rpcModeratorKickUser(
        effectiveStreamId,
        targetUserId,
        'Kicked by moderator'
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} has been kicked from the broadcast`);
      onKickUser?.(targetUserId);
      onClose();
    } catch (error) {
      console.error('Error kicking user:', error);
      toast.error('Failed to kick user');
    } finally {
      setIsKicking(false);
    }
  };

  const handleBackgroundCheck = async () => {
    if (!targetUserId) {
      toast.error('No user selected');
      return;
    }

    onViewBackgroundCheck?.(targetUserId);
    setShowBackgroundModal(true);
  };

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'mute':
        setShowMuteModal(true);
        break;
      case 'unmute':
        handleUnmute();
        break;
      case 'arrest':
        setShowArrestModal(true);
        break;
      case 'troll_coin_penalty':
        setShowTrollCoinPenaltyModal(true);
        break;
      case 'disable_chat':
        setShowDisableChatModal(true);
        break;
      case 'kick':
        handleKick();
        break;
      case 'suspend_license':
        setShowSuspendLicenseModal(true);
        break;
      case 'grant_license':
        handleGrantLicense();
        break;
      case 'remove_officer':
        handleRemoveOfficer();
        break;
      case 'set_to_user':
        handleSetToUser();
        break;
      case 'end_stream':
        setShowEndStreamModal(true);
        break;
      case 'background_check':
        handleBackgroundCheck();
        break;
    }
  };

const handleRemoveOfficer = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;

    const sid = effectiveStreamId || streamId;
    if (!sid) {
      toast.error('No active stream context for this action');
      return;
    }

    try {
      const sid = effectiveStreamId || streamId;
      if (!sid) {
        toast.error('No active stream context for this action');
        return;
      }

      const res = await rpcRemoveStreamBroadofficer(
        sid,
        targetUserId
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} is no longer a Broadofficer`);
      onClose();
    } catch (error) {
      console.error('[ModActions] Error removing officer:', error);
      toast.error('Failed to remove Broadofficer');
    }
  };

const handleSetToUser = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    if (!targetUserId) return;

    try {
      const res = await rpcResetUserPermissions(targetUserId);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || `${targetUsername} set to user - all roles and dashboard access removed`);
      onClose();
    } catch (error) {
      console.error('[ModActions] Error setting to user:', error);
      toast.error('Failed to set user role');
    }
  };

const handleEndStream = async () => {
    if (!profile || isLoading) {
      toast.error("Authentication data is still loading. Please try again.");
      return;
    }
    setIsEndingStream(true);
    try {
      const res = await rpcModoEndStream(
        effectiveStreamId || '',
        targetUserId || undefined,
        endStreamReason || 'Ended by moderator',
        restrictDuration
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message || 'Stream ended and broadcaster restricted');
      setShowEndStreamModal(false);
      onClose();
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Failed to end stream');
    } finally {
      setIsEndingStream(false);
    }
  };

  const handleSocialFollow = async () => {
    if (!user || !profile) {
      navigate('/auth?mode=signup');
      return;
    }
    if (isFollowing) {
      const { error } = await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
      if (!error) {
        setIsFollowing(false);
        toast.success(`Unfollowed ${targetUsername}`);
      }
    } else {
      const { error } = await supabase.from('user_follows').insert({ follower_id: user.id, following_id: targetUserId });
      if (!error) {
        setIsFollowing(true);
        toast.success(`Followed ${targetUsername}`);
      }
    }
  };

  const handleSocialMessage = () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    openChatBubble(targetUserId, targetUsername, targetUser?.avatar_url);
    onClose();
  };

  const handleSocialReport = () => {
    setShowSocialReportModal(true);
  };

  const submitSocialReport = async () => {
    if (!socialReportReason || !user) return;
    setIsSubmittingSocialReport(true);
    try {
      const { error } = await supabase.from('moderation_reports').insert({
        reporter_id: user.id,
        reported_user_id: targetUserId,
        reason: socialReportReason,
        description: socialReportDescription,
        stream_id: effectiveStreamId || streamId,
        status: 'pending'
      });
      if (error) throw error;
      toast.success('Report submitted successfully');
      setShowSocialReportModal(false);
      setSocialReportReason('');
      setSocialReportDescription('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report');
    } finally {
      setIsSubmittingSocialReport(false);
    }
  };

  useEffect(() => {
    if (!user || !targetUserId) return;
    const checkFollow = async () => {
      const { data } = await supabase.from('user_follows').select('id').eq('follower_id', user.id).eq('following_id', targetUserId).maybeSingle();
      setIsFollowing(!!data);
    };
    checkFollow();
  }, [user, targetUserId]);

  const handleModRoleInvite = async () => {
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }
    setIsInviting(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/auth?mode=signup');
        return;
      }

      const { data, error } = await supabase.rpc('create_role_invite', {
        p_inviter_id: currentUser.id,
        p_invitee_id: targetUserId,
        p_role: selectedRole
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        const { notifyRoleInviteReceived } = await import('../../lib/notifications');
        await notifyRoleInviteReceived(targetUserId, targetUsername, selectedRole, result.invite_id);
        toast.success(`Role invitation sent to ${targetUsername}`);
        setShowRoleInviteModal(false);
        setSelectedRole('');
      } else {
        toast.error(result?.error || 'Failed to send invite');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

// Deny popup access entirely for accounts without an authorized Mod Actions role.
  if (isLoading) return null;
  if (!user) {
    navigate('/login');
    return null;
  }
  if (!isOpen || (!hasModAccess && !isHost)) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed left-1/2 top-[15%] -translate-x-1/2 -translate-y-0 w-[400px] max-h-[75vh] rounded-2xl overflow-hidden z-[70] shadow-[0_25px_120px_rgba(124,58,237,0.35)] bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.18),_transparent_35%),_rgba(15,23,42,0.98)] border border-purple-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-gradient-to-r from-violet-950 via-slate-900 to-slate-950/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-600 via-violet-600 to-cyan-500 flex items-center justify-center ring-2 ring-white/10 shadow-[0_0_24px_rgba(167,139,250,0.22)]">
              {targetUser?.avatar_url ? (
                <img src={targetUser.avatar_url} alt={targetUsername} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-bold">{targetUsername?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold tracking-wide">{targetUsername}</h3>
              <span className="text-[11px] uppercase tracking-[0.18em] text-purple-300/80">Mai Troll Command</span>
              {targetUser?.role && (
                <div className="mt-1 text-[10px] text-slate-400 capitalize">{targetUser.role.replace('_', ' ')}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('gift')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'gift' 
                ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gift className="w-4 h-4 inline mr-2" />
            Gift
          </button>
          <button
            onClick={() => setActiveTab('mod')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'mod' 
                ? 'text-red-400 border-b-2 border-red-400 bg-red-500/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Mod Actions
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'social' 
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Social
          </button>
        </div>

{/* Content */}
         <div className="p-4 overflow-y-auto max-h-[500px]">
           {activeTab === 'gift' ? (
             <div className="text-center py-8">
               <p className="text-slate-400 mb-4">Send a gift to {targetUsername}</p>
               <button
                 onClick={() => setIsGiftModalOpen(true)}
                 className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
               >
                 <Gift className="w-5 h-5 inline mr-2" />
                 Open Gift Box
               </button>
             </div>
           ) : activeTab === 'social' ? (
             <div className="space-y-4">
               <p className="text-slate-400 text-center text-sm">Social actions for {targetUsername}</p>
               <div className="grid grid-cols-3 gap-3">
                 <button onClick={handleSocialFollow} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl transition-colors border border-white/5">
                   <UserPlus size={20} />
                   <span className="text-[10px] font-medium">Follow</span>
                 </button>
                 <button onClick={handleSocialMessage} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-xl transition-colors border border-white/5">
                   <MessageSquare size={20} />
                   <span className="text-[10px] font-medium">Message</span>
                 </button>
                 <button onClick={handleSocialReport} className="flex flex-col items-center justify-center gap-1 p-3 bg-slate-800 hover:bg-slate-700 text-yellow-500 rounded-xl transition-colors border border-white/5">
                   <Flag size={20} />
                   <span className="text-[10px] font-medium">Report</span>
                 </button>
               </div>
             </div>
           ) : (
             <>
               {/* Search Users Button */}
               <div className="mb-4">
                 <button
                   onClick={() => setShowSearchModal(true)}
                   className="w-full py-2 px-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/10"
                 >
                   <Search className="w-4 h-4" />
                   Search Users
                 </button>
               </div>
               
                <div className="grid grid-cols-2 gap-3">
               {filteredActions.map((action) => {
                const Icon = action.icon;
                const isKickAction = action.id === 'kick';
                const isDisabled = (isKickAction && hasInsuranceProtection && 
                                  !(profile?.role === 'admin' || profile?.is_admin || profile?.is_lead_officer || profile?.role === 'lead_troll_officer'));
                
                return (
                  <button
                    key={action.id}
                    onClick={() => handleAction(action.id)}
                    disabled={isDisabled}
                    className={`p-3 rounded-2xl border transition-all text-left ${
                      isDisabled
                        ? 'border-slate-700 bg-slate-900/70 opacity-50 cursor-not-allowed'
                        : 'border-purple-500/20 bg-slate-900/75 hover:border-purple-400/40 hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${action.color}`} />
                    <div className="text-sm font-semibold text-white">{action.label}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {action.description}
                    </div>
                    {isKickAction && hasInsuranceProtection && (
                      <div className="text-xs text-orange-300 mt-2">Has Insurance</div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        </div>

        {/* Troll Coin Penalty Modal */}
        <AnimatePresence>
          {showTrollCoinPenaltyModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4 z-40"
            >
              <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  <h3 className="text-white font-semibold">Troll Coin Penalty</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Deduct coins from {targetUsername} and send them to the Admin Donation pool.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Amount</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={trollCoinPenaltyAmount}
                      onChange={(e) => setTrollCoinPenaltyAmount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Violation Category</label>
                    <select
                      value={trollCoinPenaltyCategory}
                      onChange={(e) => setTrollCoinPenaltyCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      <option>Harassment</option>
                      <option>Spam</option>
                      <option>Abuse</option>
                      <option>Terms Violation</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Violation Reason</label>
                    <textarea
                      value={trollCoinPenaltyReason}
                      onChange={(e) => setTrollCoinPenaltyReason(e.target.value)}
                      placeholder="Describe the violation..."
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowTrollCoinPenaltyModal(false)}
                    disabled={isApplyingTrollCoinPenalty}
                    className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTrollCoinPenalty}
                    disabled={isApplyingTrollCoinPenalty}
                    className="flex-1 py-2 bg-amber-500 text-slate-950 rounded-lg text-sm font-semibold hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isApplyingTrollCoinPenalty ? 'Applying...' : 'Apply Penalty'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arrest Modal */}
        <AnimatePresence>
          {showArrestModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-orange-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <h3 className="text-white font-semibold">Arrest {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Reason for Arrest</label>
                    <input
                      type="text"
                      value={arrestReason}
                      onChange={handleArrestReasonChange}
                      placeholder="e.g., Harassment, Violation of terms..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      autoComplete="off"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Severity</label>
                    <div className="grid grid-cols-4 gap-2">
                      {SEVERITY_LEVELS.map((sev) => (
                        <button
                          key={sev.id}
                          onClick={() => handleSeverityChange(sev.id)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            arrestSeverity === sev.id
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 text-sm">Bail Amount</span>
                    <span className="text-white font-bold">{arrestBailAmount} coins</span>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowArrestModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleArrest}
                      disabled={!arrestReason || isArresting}
                      className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-500 disabled:opacity-50"
                    >
                      {isArresting ? 'Arresting...' : 'Submit Arrest'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mute Modal */}
        <AnimatePresence>
          {showMuteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="w-5 h-5 text-red-400" />
                  <h3 className="text-white font-semibold">Mute {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Mute Duration (minutes)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 5, 10, 15, 30].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setMuteDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            muteDuration === dur
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur}m
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowMuteModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMute}
                      disabled={isMuting}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500 disabled:opacity-50"
                    >
                      {isMuting ? 'Muting...' : 'Mute User'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disable Chat Modal */}
        <AnimatePresence>
          {showDisableChatModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-yellow-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquareOff className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-white font-semibold">Disable Chat for {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Disable Duration (minutes)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 5, 10, 15, 30].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setChatDisableDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            chatDisableDuration === dur
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur}m
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowDisableChatModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDisableChat}
                      disabled={isDisablingChat}
                      className="flex-1 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-500 disabled:opacity-50"
                    >
                      {isDisablingChat ? 'Disabling...' : 'Disable Chat'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suspend License Modal */}
        <AnimatePresence>
          {showSuspendLicenseModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Car className="w-5 h-5 text-blue-400" />
                  <h3 className="text-white font-semibold">Suspend License for {targetUsername}</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Reason for Suspension</label>
                    <input
                      type="text"
                      value={licenseSuspendReason}
                      onChange={(e) => setLicenseSuspendReason(e.target.value)}
                      placeholder="e.g., Traffic violations, reckless driving..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Suspension Duration (hours)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[6, 12, 24, 48, 72, 168].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setSuspendLicenseDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            suspendLicenseDuration === dur
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur < 24 ? `${dur}h` : dur < 168 ? `${dur/24}d` : '7d'}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowSuspendLicenseModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSuspendLicense}
                      disabled={!licenseSuspendReason || isSuspendingLicense}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50"
                    >
                      {isSuspendingLicense ? 'Suspending...' : 'Suspend License'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End Stream Modal */}
        <AnimatePresence>
          {showEndStreamModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
            >
              <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4 w-full max-w-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Power className="w-5 h-5 text-red-400" />
                  <h3 className="text-white font-semibold">End Stream & Restrict</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Reason (optional)</label>
                    <input
                      type="text"
                      value={endStreamReason}
                      onChange={(e) => setEndStreamReason(e.target.value)}
                      placeholder="e.g., Violation of terms..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-slate-400 block mb-1">Restriction Duration</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[15, 30, 60, 120, 240].map((dur) => (
                        <button
                          key={dur}
                          onClick={() => setRestrictDuration(dur)}
                          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                            restrictDuration === dur
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          {dur < 60 ? `${dur}m` : `${dur/60}h`}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowEndStreamModal(false)}
                      className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEndStream}
                      disabled={isEndingStream}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-500 disabled:opacity-50"
                    >
                      {isEndingStream ? 'Ending...' : 'End Stream'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Gift Modal */}
<GiftBoxModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        recipientId={targetUserId}
        streamId={effectiveStreamId}
        broadcasterId={effectiveHostId}
      />

      <AnimatePresence>
        {showBackgroundModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-blue-400/30 bg-slate-950 shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-white">Background Check</h3>
                  <p className="text-xs text-slate-400">{targetUsername}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBackgroundModal(false)}
                  className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Close background check"
                >
                  <X size={18} />
                </button>
              </div>
              <BackgroundCheckView userId={targetUserId} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Search Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4 z-50"
          >
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 w-full max-w-md">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-slate-400" />
                <h3 className="text-white font-semibold">Search Users</h3>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUserSearch()}
                    placeholder="Username or User ID..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleUserSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-500 disabled:opacity-50"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {searchError && (
                  <div className="text-red-400 text-sm">{searchError}</div>
                )}

                {searchResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUserFromSearch(user)}
                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-left hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-sm">{user.username?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">{user.username}</div>
                            <div className="text-slate-400 text-xs">
                              {user.is_admin ? 'Admin' : user.is_lead_officer ? 'Lead Officer' : user.is_troll_officer ? 'Officer' : 'User'}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                 <div className="flex gap-2 mt-4">
                   <button
                     onClick={() => setShowSearchModal(false)}
                     className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                   >
                     Cancel
                   </button>
                 </div>
               </div>
             </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role Invite Modal */}
        <AnimatePresence>
           {showRoleInviteModal && (
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4 z-50"
             >
               <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4 w-full max-w-sm">
                 <div className="flex items-center gap-2 mb-4">
                   <Crown className="w-5 h-5 text-emerald-400" />
                   <h3 className="text-white font-semibold">Invite {targetUsername} to Role</h3>
                 </div>
                 
                 <div className="space-y-3">
                   <div>
                     <label className="text-sm text-slate-400 block mb-1">Select Role</label>
                     <select
                       value={selectedRole}
                       onChange={(e) => setSelectedRole(e.target.value)}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                     >
                       <option value="">Choose a role...</option>
                       <option value="troll_officer">Troll Officer</option>
                       <option value="lead_troll_officer">Lead Troll Officer</option>
                       <option value="moderator">Moderator</option>
                       <option value="secretary">Secretary</option>
                       <option value="agency_hr">Agency HR</option>
                       <option value="agency_hr_manager">Agency HR Manager</option>
                       <option value="agency_leader">Agency Leader</option>
                       <option value="attorney">Attorney</option>
                       <option value="prosecutor">Prosecutor</option>
                       <option value="pastor">Pastor</option>
                       <option value="journalist">Journalist</option>
                       <option value="auctioneer">Auctioneer</option>
                       <option value="ceo_assistant">CEO Assistant</option>
                       <option value="noah_assistant">Noah Assistant</option>
                       <option value="empire_partner">Empire Partner</option>
                       <option value="president">President</option>
                       <option value="vice_president">Vice President</option>
                       <option value="superadmin">Super Admin</option>
                       <option value="ceo">CEO</option>
                     </select>
                   </div>
                   
                   <div className="flex gap-2 mt-4">
                     <button
                       onClick={() => setShowRoleInviteModal(false)}
                       className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                     >
                       Cancel
                     </button>
                     <button
                       onClick={handleModRoleInvite}
                       disabled={!selectedRole || isInviting}
                       className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500 disabled:opacity-50"
                     >
                       {isInviting ? 'Sending...' : 'Send Invite'}
                     </button>
                   </div>
                 </div>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
       </>
   );
});

export default ModActionsPopup;
