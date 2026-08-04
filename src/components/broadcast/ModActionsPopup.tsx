import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Gift, Shield, Gavel, Ban, Eye, Clock, UserCheck, User,
  AlertTriangle, Building2, Wallet, FileText, Users,
  Mic, MicOff, AlertCircle, MessageSquareOff, LogOut, Power,
  Search, Car
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import GiftBoxModal from './GiftBoxModal';
import BackgroundCheckView from './BackgroundCheckView';
import { getActiveInsurance, hasProtection, ProtectionType } from '../../lib/insuranceSystem';
import { isStaffProfile } from '../../lib/staff';
import { notifyBroadofficerRemoved } from '../../lib/notifications';

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

type TabType = 'gift' | 'mod';

const MOD_ACTIONS_LIST = [
  { id: 'mute', label: 'Mute', icon: Mic, color: 'text-red-400', description: 'Mute user\'s microphone' },
  { id: 'unmute', label: 'Unmute', icon: MicOff, color: 'text-green-400', description: 'Unmute user\'s microphone' },
  { id: 'arrest', label: 'Arrest', icon: AlertCircle, color: 'text-orange-400', description: 'Send to Troll Jail' },
  { id: 'disable_chat', label: 'Disable Chat', icon: MessageSquareOff, color: 'text-yellow-400', description: 'Disable chat temporarily' },
  { id: 'kick', label: 'Kick', icon: LogOut, color: 'text-purple-400', description: 'Remove from broadcast' },
  { id: 'suspend_license', label: 'Suspend License', icon: Car, color: 'text-blue-400', description: 'Suspend driver\'s license' },
  { id: 'grant_license', label: 'Grant License', icon: UserCheck, color: 'text-green-400', description: 'Grant active driver license' },
  { id: 'remove_officer', label: 'Remove Officer', icon: Shield, color: 'text-red-500', description: 'Remove broadofficer status' },
  { id: 'set_to_user', label: 'Set to User', icon: User, color: 'text-gray-400', description: 'Remove all roles, set to user' },
  { id: 'end_stream', label: 'End Stream', icon: Power, color: 'text-red-500', description: 'End broadcast and restrict' },
  { id: 'background_check', label: 'Background', icon: FileText, color: 'text-blue-400', description: 'View user background' },
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
  const { profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('gift');
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  
  // Arrest modal state
  const [showArrestModal, setShowArrestModal] = useState(false);
  const [arrestReason, setArrestReason] = useState('');
  const [arrestSeverity, setArrestSeverity] = useState('moderate');
  const [arrestBailAmount, setArrestBailAmount] = useState(100);
  const [isArresting, setIsArresting] = useState(false);

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
  
  const isOfficer = isStaffProfile(profile);
  const isPlainUser = !isOfficer &&
    !profile?.is_admin &&
    !profile?.is_lead_officer &&
    !(profile?.role && ['admin', 'ceo', 'owner', 'superadmin', 'staff', 'moderator', 'lead_troll_officer', 'broadcaster'].includes(profile.role));
  const visibleActions = useMemo(
    () => isPlainUser ? MOD_ACTIONS_LIST.filter((a) => a.id !== 'arrest') : MOD_ACTIONS_LIST,
    [isPlainUser]
  );
  const currentActorId = currentUserId || profile?.id;
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
    if (!targetUserId || !currentActorId) return;
    setIsMuting(true);
    try {
      if (effectiveStreamId) {
        const { error } = await supabase.rpc('moderator_mute_user', {
          p_stream_id: effectiveStreamId,
          p_target_user_id: targetUserId,
          p_duration_minutes: muteDuration,
          p_reason: `Muted for ${muteDuration} minutes`,
        });
        if (error) throw error;
      } else {
        const mutedUntil = new Date(Date.now() + muteDuration * 60 * 1000).toISOString();
        const { error } = await supabase
          .from('user_profiles')
          .update({
            muted_until: mutedUntil,
            mic_muted_until: mutedUntil,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);

        if (error) throw error;

        await supabase
          .from('chat_blocks')
          .upsert(
            {
              user_id: targetUserId,
              stream_id: null,
              blocked_by: currentActorId,
              expires_at: mutedUntil,
              reason: `Chat disabled for ${muteDuration} minutes`,
            },
            { onConflict: 'stream_id,user_id' },
          )
          .then(() => undefined, () => undefined);
      }

      toast.success(`${targetUsername} has been muted for ${muteDuration} minutes`);
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
    if (!targetUserId) return;
    try {
      if (effectiveStreamId) {
        const { error } = await supabase.rpc('moderator_unmute_user', {
          p_stream_id: effectiveStreamId,
          p_target_user_id: targetUserId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            muted_until: null,
            mic_muted_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);

        if (error) throw error;
      }

      toast.success(`${targetUsername} has been unmuted`);
      onUnmuteUser?.(targetUserId);
    } catch (error) {
      console.error('Error unmuting user:', error);
      toast.error('Failed to unmute user');
    }
  };

  const handleArrest = async () => {
    if (!targetUserId || !currentActorId || !arrestReason) return;
    setIsArresting(true);
    
    try {
      // Calculate bail amount based on severity
      const severity = SEVERITY_LEVELS.find(s => s.id === arrestSeverity);
      const bail = severity ? severity.bailMultiplier * 100 : 100;
      setArrestBailAmount(bail);
      
      // Get next court date (Tue or Thu)
      const today = new Date();
      const dow = today.getDay();
      let nextCourtDate: Date;
      if (dow === 0 || dow === 1) nextCourtDate = new Date(today.setDate(today.getDate() + (2 - dow))); // Sun/Mon -> Tue
      else if (dow === 2 || dow === 3) nextCourtDate = new Date(today.setDate(today.getDate() + (4 - dow))); // Tue/Wed -> Thu
      else if (dow === 4) nextCourtDate = today; // Thu -> today
      else nextCourtDate = new Date(today.setDate(today.getDate() + (2 + 7 - dow) % 7)); // Fri/Sat -> Tue
      
      const courtDateStr = nextCourtDate.toISOString().split('T')[0];
      
      // 1. Create jail record
      const arrestDate = new Date().toISOString();

      // Look up arrested user's IP geolocation for geofence device tracking
      const { data: userIpRecords } = await supabase
        .from('user_ip_tracking')
        .select('latitude, longitude, ip_address')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(1);

       await supabase.from('jail').insert({
         user_id: targetUserId,
         release_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
         reason: arrestReason,
         sentence_days: 1,
         arrested_by: currentActorId,
         court_date: courtDateStr,
         status: 'jailed',
         severity: arrestSeverity,
         bond_amount: bail,
         arrest_latitude: userIpRecords?.[0]?.latitude ?? null,
         arrest_longitude: userIpRecords?.[0]?.longitude ?? null,
       });
      
       // 2. Find or create court docket for next Tue/Thu
       const { data: docket } = await supabase
         .from('court_dockets')
         .select('id, cases_count')
         .eq('court_date', courtDateStr)
         .maybeSingle();
      
      let docketId: string;
      
      if (docket && docket.cases_count < 20) {
        docketId = docket.id;
        await supabase
          .from('court_dockets')
          .update({ cases_count: (docket.cases_count || 0) + 1 })
          .eq('id', docketId);
      } else {
        const { data: newDocket } = await supabase
          .from('court_dockets')
          .insert({
            court_date: courtDateStr,
            max_cases: 20,
            cases_count: 1,
            status: 'open',
          })
          .select()
          .single();
        docketId = newDocket?.id;
      }
      
      // 3. Create court case
      await supabase.from('court_cases').insert({
        docket_id: docketId,
        defendant_id: targetUserId,
        plaintiff_id: currentActorId,
        reason: arrestReason,
        status: 'pending',
        case_type: 'criminal'
      });
      
      toast.success(`${targetUsername} arrested - Court: ${new Date(courtDateStr).toLocaleDateString()}`);
      setShowArrestModal(false);
      setArrestReason('');
      setArrestSeverity('moderate');
      onArrestUser?.(targetUserId, arrestReason, arrestSeverity, bail);
    } catch (error) {
      console.error('Error arresting user:', error);
      toast.error('Failed to arrest user');
    } finally {
      setIsArresting(false);
    }
  };

  const handleDisableChat = async () => {
    if (!targetUserId || !currentActorId) return;
    setIsDisablingChat(true);
    try {
      if (effectiveStreamId) {
        const { error } = await supabase.rpc('moderator_disable_chat', {
          p_stream_id: effectiveStreamId,
          p_target_user_id: targetUserId,
          p_duration_minutes: chatDisableDuration,
          p_reason: `Chat disabled for ${chatDisableDuration} minutes`,
        });
        if (error) throw error;
      } else {
        const disabledUntil = new Date(Date.now() + chatDisableDuration * 60 * 1000).toISOString();
        await supabase
          .from('user_profiles')
          .update({
            muted_until: disabledUntil,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);
      }

      toast.success(`${targetUsername}'s chat disabled for ${chatDisableDuration} minutes`);
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
    if (!targetUserId || !licenseSuspendReason) return;
    setIsSuspendingLicense(true);
    try {
      const suspendedUntil = new Date(Date.now() + suspendLicenseDuration * 60 * 60 * 1000).toISOString();

      const { error: licenseError } = await supabase
        .from('user_driver_licenses')
        .upsert({
          user_id: targetUserId,
          status: 'suspended',
          suspended_until: suspendedUntil,
          expires_at: suspendedUntil,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (licenseError) throw licenseError;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ drivers_license_status: 'suspended' })
        .eq('id', targetUserId);

      if (profileError) {
        console.error('[ModActions] Profile update error:', profileError);
      }

      const { data: broadcastCheck } = await supabase.rpc('can_user_broadcast', { p_user_id: targetUserId });

      await supabase.from('notifications').insert({
        user_id: targetUserId,
        type: 'license_suspension_started',
        title: 'License Suspended',
        message: `Your driver's license has been suspended for ${suspendLicenseDuration} hours. Reason: ${licenseSuspendReason}`,
        data: { reason: licenseSuspendReason, duration_hours: suspendLicenseDuration, suspendedUntil, granted_by: currentActorId },
      });

      await supabase.from('broadcast_mod_actions').insert({
        action_type: 'suspend_license',
        action_name: 'Suspend License',
        target_user_id: targetUserId,
        target_display_name: targetUsername,
        target_role_before: targetUser?.role,
        target_role_after: targetUser?.role,
        reason: licenseSuspendReason,
        duration_minutes: suspendLicenseDuration * 60,
        previous_status: 'unknown',
        new_status: 'suspended',
        expires_at: suspendedUntil,
        success: true,
        actor_id: currentActorId,
        actor_role: profile?.role,
        actor_display_name: profile?.username || profile?.full_name || 'Unknown',
        created_at: new Date().toISOString(),
      });

      toast.success(`${targetUsername}'s license suspended for ${suspendLicenseDuration} hours`);
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
    if (!targetUserId) return;
    setIsGrantingLicense(true);
    try {
      const licenseExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const insuranceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: licenseError } = await supabase
        .from('user_driver_licenses')
        .upsert({
          user_id: targetUserId,
          status: 'active',
          suspended_until: null,
          issued_at: new Date().toISOString(),
          expires_at: licenseExpiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (licenseError) throw licenseError;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          drivers_license_status: 'active',
          drivers_license_expiry: licenseExpiresAt,
          car_insurance_expiry: insuranceExpiresAt,
        })
        .eq('id', targetUserId);

      if (profileError) {
        console.error('[ModActions] Profile update error:', profileError);
      }

      const { error: insuranceError } = await supabase
        .from('user_insurances')
        .upsert({
          user_id: targetUserId,
          protection_type: 'car',
          is_active: true,
          expires_at: insuranceExpiresAt,
          issued_at: new Date().toISOString(),
        }, { onConflict: 'user_id,protection_type' });

      if (insuranceError) {
        console.error('[ModActions] Insurance insert error:', insuranceError);
      }

      const { data: broadcastCheck } = await supabase.rpc('can_user_broadcast', { p_user_id: targetUserId });

      await supabase.from('notifications').insert({
        user_id: targetUserId,
        type: 'license_granted',
        title: 'Driver License Granted',
        message: 'Your driver license and 30 days of car insurance have been granted by moderators. You can now broadcast and go live.',
        data: { granted_by: currentActorId, license_expires_at: licenseExpiresAt, insurance_expires_at: insuranceExpiresAt },
      });

      await supabase.from('broadcast_mod_actions').insert({
        action_type: 'grant_license',
        action_name: 'Grant License',
        target_user_id: targetUserId,
        target_display_name: targetUsername,
        target_role_before: targetUser?.role,
        target_role_after: targetUser?.role,
        previous_status: 'none',
        new_status: 'active',
        expires_at: licenseExpiresAt,
        success: true,
        actor_id: currentActorId,
        actor_role: profile?.role,
        actor_display_name: profile?.username || profile?.full_name || 'Unknown',
        created_at: new Date().toISOString(),
      });

      toast.success(`${targetUsername} has been granted a driver license`);
      onClose();
    } catch (error) {
      console.error('Error granting license:', error);
      toast.error('Failed to grant license');
    } finally {
      setIsGrantingLicense(false);
    }
  };

  const handleKick = async () => {
    if (!targetUserId) return;
    
    const isAdminOrLead = profile?.role === 'admin' || 
                         profile?.role === 'lead_troll_officer' || 
                         profile?.is_admin ||
                         profile?.is_lead_officer;
    
    if (hasInsuranceProtection && !isAdminOrLead) {
      toast.error('Cannot kick user with active insurance protection');
      return;
    }
    
    setIsKicking(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId);

      if (!isUuid) {
        if (!effectiveStreamId) {
          toast.error('Guest kick requires an active stream');
          return;
        }

        const { error: seatError } = await supabase
          .from('stream_seat_sessions')
          .update({
            status: 'kicked',
            kick_reason: 'Kicked by moderator',
            left_at: new Date().toISOString(),
          })
          .eq('stream_id', effectiveStreamId)
          .eq('guest_id', targetUserId)
          .eq('status', 'active');

        if (seatError) throw seatError;

        toast.success(`${targetUsername} has been kicked from the broadcast`);
        onKickUser?.(targetUserId);
        onClose();
        return;
      }

      if (!effectiveStreamId) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            is_kicked: true,
            kicked_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            last_kicked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);

        if (profileError) throw profileError;

        toast.success(`${targetUsername} has been kicked globally`);
        onKickUser?.(targetUserId);
        onClose();
        return;
      }

      const { error: kickError } = await supabase.rpc('moderator_kick_user', {
        p_stream_id: effectiveStreamId,
        p_target_user_id: targetUserId,
        p_reason: 'Kicked by moderator',
      });
      if (kickError) throw kickError;

      toast.success(`${targetUsername} has been kicked from the broadcast`);
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
    if (!targetUserId || !currentActorId) return;

    const sid = effectiveStreamId || streamId;
    if (!sid) {
      toast.error('No active stream context for this action');
      return;
    }

    try {
      const { error } = await supabase.rpc('remove_stream_broadofficer', {
        p_stream_id: sid,
        p_officer_id: targetUserId,
      });
      if (error) throw error;

      const content = `${targetUsername} is no longer a Broadofficer.`;
      const systemMessage = {
        id: `broadofficer-removed-${sid}-${targetUserId}-${Date.now()}`,
        user_id: currentActorId,
        content,
        created_at: new Date().toISOString(),
        type: 'system',
        user_profiles: { username: 'System', avatar_url: '' },
      };
      void supabase.from('stream_messages').insert({
        stream_id: sid,
        user_id: currentActorId,
        content,
        type: 'system',
      });
      const channel = supabase.channel(`stream-chat:${sid}-${Date.now()}`);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.send({ type: 'broadcast', event: 'chat', payload: systemMessage });
          setTimeout(() => { supabase.removeChannel(channel); }, 3000);
        }
      });

      void notifyBroadofficerRemoved(targetUserId, sid, profile?.username || undefined);

      toast.success(`${targetUsername} is no longer a Broadofficer`);
      onClose();
    } catch (error) {
      console.error('[ModActions] Error removing officer:', error);
      toast.error('Failed to remove Broadofficer');
    }
  };

  const handleSetToUser = async () => {
    if (!targetUserId || !currentActorId) return;

    try {
      const { data: authCheck, error: authError } = await supabase.rpc('can_set_to_user', {
        p_actor_id: currentActorId,
        p_target_id: targetUserId,
      });

      if (authError || !authCheck?.allowed) {
        throw new Error(authError?.message || authCheck?.reason || 'Unauthorized');
      }

      const { error: resetError } = await supabase.rpc('reset_user_permissions', {
        p_target_user_id: targetUserId,
      });
      if (resetError) throw resetError;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role: 'user',
          troll_role: null,
          is_admin: false,
          is_troll_officer: false,
          is_lead_officer: false,
          is_prosecutor: false,
          is_attorney: false,
          is_secretary: false,
          is_staff: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (updateError) throw updateError;

      await supabase.from('broadcast_mod_actions').insert({
        action_type: 'set_to_user',
        action_name: 'Set to User',
        target_user_id: targetUserId,
        target_display_name: targetUsername,
        target_role_before: targetUser?.role,
        target_role_after: 'user',
        previous_status: targetUser?.role,
        new_status: 'user',
        success: true,
        actor_id: currentActorId,
        actor_role: profile?.role,
        actor_display_name: profile?.username || profile?.full_name || 'Unknown',
        created_at: new Date().toISOString(),
      });

      toast.success(`${targetUsername} set to user - all roles and dashboard access removed`);
      onClose();
    } catch (error) {
      console.error('[ModActions] Error setting to user:', error);
      toast.error('Failed to set user role');
    }
  };

  const handleEndStream = async () => {
    if (!currentActorId) return;
    setIsEndingStream(true);
    try {
      const streamIdToEnd = effectiveStreamId || targetUserId ? undefined : undefined;
      let streamData: any = null;

      if (!streamIdToEnd && targetUserId) {
        const { data: activeStream } = await supabase
          .from('streams')
          .select('id, user_id, broadcaster_id, status, is_live, stream_channel')
          .or(`user_id.eq.${targetUserId},broadcaster_id.eq.${targetUserId}`)
          .or('is_live.eq.true,status.eq.live,status.eq.active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        streamData = activeStream;
      } else if (effectiveStreamId) {
        const { data: stream } = await supabase
          .from('streams')
          .select('id, user_id, broadcaster_id, status, is_live, stream_channel')
          .eq('id', effectiveStreamId)
          .maybeSingle();
        streamData = stream;
      }

      if (!streamData?.id) {
        throw new Error('No active stream found to end');
      }

      const isStreamOwner = streamData.user_id === currentActorId || streamData.broadcaster_id === currentActorId;
      const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
      if (!isStreamOwner && !isAdmin) {
        throw new Error('Only stream owner or admin can end this stream');
      }

      const { error: updateError } = await supabase
        .from('streams')
        .update({
          status: 'ended',
          is_live: false,
          ended_at: new Date().toISOString(),
          end_time: new Date().toISOString(),
          is_force_ended: true,
          ended_by: currentActorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', streamData.id);

      if (updateError) throw updateError;

      const restrictUntil = new Date(Date.now() + restrictDuration * 60 * 1000).toISOString();
      await supabase.from('broadcast_restrictions').insert({
        user_id: streamData.user_id,
        restricted_by: currentActorId,
        reason: endStreamReason || 'Ended by moderator',
        duration_minutes: restrictDuration,
        expires_at: restrictUntil,
      });

      const roomName = streamData.stream_channel || streamData.id;
      if (roomName) {
        await supabase.from('stream_participants').delete().eq('stream_id', streamData.id);
      }

      await supabase.from('broadcast_mod_actions').insert({
        action_type: 'end_stream',
        action_name: 'End Stream',
        target_user_id: streamData.user_id,
        broadcast_id: streamData.id,
        livekit_room_name: roomName,
        reason: endStreamReason || 'Ended by moderator',
        duration_minutes: restrictDuration,
        new_status: 'ended',
        expires_at: restrictUntil,
        success: true,
        actor_id: currentActorId,
        actor_role: profile?.role,
        actor_display_name: profile?.username || profile?.full_name || 'Unknown',
        created_at: new Date().toISOString(),
      });

      toast.success('Stream ended and broadcaster restricted');
      setShowEndStreamModal(false);
      onClose();
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Failed to end stream');
    } finally {
      setIsEndingStream(false);
    }
  };

  if (!isOpen) return null;

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
              {visibleActions.map((action) => {
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
        streamId={streamId}
        broadcasterId={hostId}
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
    </>
  );
});

export default ModActionsPopup;
