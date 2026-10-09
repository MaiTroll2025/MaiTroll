import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAgoraRoom } from '@/hooks/useAgoraRoom';
import { toast } from 'sonner';
import { PhoneOff, Users, Mic, MicOff, Video, VideoOff, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TeamMeetingGrid from '../components/TeamMeetingRoom/TeamMeetingGrid';
import MeetingDocumentShare from '../components/TeamMeetingRoom/MeetingDocumentShare';
import { motion } from 'framer-motion';

interface StaffMeeting {
  id: string;
  title: string;
  description?: string;
  room_name: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  max_participants: number;
  created_by: string;
  started_at?: string;
  ended_at?: string;
}

// Fallback access check: used only when RPC fails
// Includes all valid staff roles plus organization members
const checkStaffAccessFallback = (profileData: any): boolean => {
  const role = profileData?.role;
  const is_admin = profileData?.is_admin === true;
  const is_ceo = profileData?.is_ceo === true;
  const is_lead_officer = profileData?.is_lead_officer === true;
  const is_troll_officer = profileData?.is_troll_officer === true;
  const is_officer = profileData?.is_officer === true;
  const is_secretary = profileData?.is_secretary === true;
  const is_prosecutor = profileData?.is_prosecutor === true;
  const is_judge = profileData?.is_judge === true;
  const is_attorney = profileData?.is_attorney === true;
  const is_pastor = profileData?.is_pastor === true;
  const is_moderator = profileData?.is_moderator === true;
  const is_ceo_assistant = profileData?.is_ceo_assistant === true;
  const is_noah_assistant = profileData?.is_noah_assistant === true;
  const is_agency_hr = profileData?.is_agency_hr === true;
  const is_agency_hr_manager = profileData?.is_agency_hr_manager === true;
  const is_journalist = profileData?.is_journalist === true;
  const is_tcnn_news_caster = profileData?.is_tcnn_news_caster === true;
  const is_tcnn_chief_news_caster = profileData?.is_tcnn_chief_news_caster === true;
  const is_troller = profileData?.is_troller === true;
  const is_troll_family_leader = profileData?.is_troll_family_leader === true;
  const is_agency_leader = profileData?.is_agency_leader === true;
  const is_noah_admin = profileData?.is_noah_admin === true;
  const has_organization = !!profileData?.organization_id;

  return !!(
    // Role field checks - all valid staff roles
    role === 'ceo' ||
    role === 'admin' ||
    role === 'lead_officer' ||
    role === 'lead_troll_officer' ||
    role === 'troll_officer' ||
    role === 'officer' ||
    role === 'secretary' ||
    role === 'prosecutor' ||
    role === 'judge' ||
    role === 'attorney' ||
    role === 'pastor' ||
    role === 'moderator' ||
    role === 'ceo_assistant' ||
    role === 'noah_assistant' ||
    role === 'agency_hr' ||
    role === 'agency_hr_manager' ||
    role === 'journalist' ||
    role === 'tcnn_news_caster' ||
    role === 'tcnn_chief_news_caster' ||
    role === 'troller' ||
    role === 'troll_family_leader' ||
    role === 'agency_leader' ||
    role === 'noah_admin' ||
    // Boolean flag checks
    is_admin ||
    is_ceo ||
    is_lead_officer ||
    is_troll_officer ||
    is_officer ||
    is_secretary ||
    is_prosecutor ||
    is_judge ||
    is_attorney ||
    is_pastor ||
    is_moderator ||
    is_ceo_assistant ||
    is_noah_assistant ||
    is_agency_hr ||
    is_agency_hr_manager ||
    is_journalist ||
    is_tcnn_news_caster ||
    is_tcnn_chief_news_caster ||
    is_troller ||
    is_troll_family_leader ||
    is_agency_leader ||
    is_noah_admin ||
    // Organization members
    has_organization
  );
};

export const TeamMeetingRoom: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [meeting, setMeeting] = useState<StaffMeeting | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDocumentShare, setShowDocumentShare] = useState(false);

  // Function to send notifications to all staff when meeting starts
  const sendStaffMeetingNotifications = async (meetingId: string) => {
    try {
      // Get all staff user IDs using the same logic as access check
      const { data: staffUsers, error: staffError } = await supabase
        .rpc('get_staff_user_ids');

      if (staffError) {
        console.error('Error getting staff users for notifications:', staffError);
        // Fallback: get users with staff roles manually
        const { data: staffFallbackUsers, error: fallbackError } = await supabase
          .from('user_profiles')
          .select('id')
          .or('role.eq.admin,role.eq.lead_troll_officer,role.eq.troll_officer,role.eq.officer,role.eq.secretary,role.eq.prosecutor,role.eq.judge,role.eq.attorney,role.eq.pastor,role.eq.moderator,role.eq.ceo,role.eq.ceo_assistant,role.eq.noah_assistant,role.eq.agency_hr,role.eq.agency_hr_manager,role.eq.journalist,role.eq.tcnn_news_caster,role.eq.tcnn_chief_news_caster,role.eq.troller,role.eq.troll_family_leader,role.eq.agency_leader,role.eq.noah_admin,is_admin.eq.true,is_ceo.eq.true,is_lead_officer.eq.true,is_troll_officer.eq.true,is_officer.eq.true,is_secretary.eq.true,is_prosecutor.eq.true,is_judge.eq.true,is_attorney.eq.true,is_pastor.eq.true,is_moderator.eq.true,is_ceo_assistant.eq.true,is_noah_assistant.eq.true,is_agency_hr.eq.true,is_agency_hr_manager.eq.true,is_journalist.eq.true,is_tcnn_news_caster.eq.true,is_tcnn_chief_news_caster.eq.true,is_troller.eq.true,is_troll_family_leader.eq.true,is_agency_leader.eq.true,is_noah_admin.eq.true');

        // Also get organization members
        const { data: orgFallbackUsers, error: orgError } = await supabase
          .from('user_profiles')
          .select('id')
          .not('organization_id', 'is', null);

        if (fallbackError || orgError) {
          console.error('Error in fallback staff query:', fallbackError || orgError);
          return;
        }

        const staffIdsSet = new Set<string>();
        staffFallbackUsers?.forEach((u: any) => staffIdsSet.add(u.id));
        orgFallbackUsers?.forEach((u: any) => staffIdsSet.add(u.id));
        const staffIds = Array.from(staffIdsSet);
        await sendNotificationsToStaff(staffIds, meetingId);
      } else {
        const staffIds = staffUsers?.map((user: any) => user.id) || [];
        await sendNotificationsToStaff(staffIds, meetingId);
      }
    } catch (error) {
      console.error('Error sending staff meeting notifications:', error);
    }
  };

  const sendNotificationsToStaff = async (staffIds: string[], meetingId: string) => {
    if (staffIds.length === 0) return;

    try {
      // Call the bulk notifications function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-bulk-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          type: 'team_meeting_started',
          title: `Team Meeting: ${meeting?.title || 'Staff Meeting'}`,
          message: `A team meeting has started. Click to join.`,
          metadata: {
            meeting_id: meetingId,
            meeting_title: meeting?.title,
            action_url: `/meeting/${meetingId}`
          },
          sendToAll: false,
          targetUserIds: staffIds
        })
      });

      if (!response.ok) {
        console.error('Failed to send staff notifications:', await response.text());
      } else {
        console.log(`Sent meeting notifications to ${staffIds.length} staff members`);
      }
    } catch (error) {
      console.error('Error sending staff notifications:', error);
    }
  };

  // Guard refs to prevent duplicate joins
  const hasJoinedRef = useRef(false);
  const _hasInitializedRef = useRef(false);

   // Fetch meeting details
   useEffect(() => {
     const fetchMeeting = async () => {
       if (!meetingId || !user) {
         console.log('❌ Missing meetingId or user:', { meetingId, userId: user?.id });
         setIsLoading(false);
         return;
       }

       try {
         console.log('📍 Fetching meeting:', meetingId);

         // Get meeting details
         const { data: meetingData, error: meetingError } = await supabase
           .from('staff_meetings')
           .select('*')
           .eq('id', meetingId)
           .maybeSingle();

         if (meetingError) throw meetingError;
          if (!meetingData) {
            console.error('❌ Meeting not found:', meetingId);
            const errMsg = 'Meeting not found';
            setLoadError(errMsg);
            toast.error(errMsg);
            setIsLoading(false);
            return;
          }

          // Check if meeting has ended
          if (meetingData.status === 'ended' || meetingData.status === 'cancelled') {
            console.error('❌ Meeting has ended or been cancelled');
            const errMsg = meetingData.status === 'ended' ? 'This meeting has ended.' : 'This meeting has been cancelled.';
            setLoadError(errMsg);
            toast.error(errMsg);
            setIsLoading(false);
            return;
          }

          console.log('✅ Meeting loaded:', meetingData);
          setMeeting(meetingData);

          // For live meetings, check if there are active participants
          if (meetingData.status === 'live') {
            const { count: activeCount } = await supabase
              .from('staff_meeting_participants')
              .select('id', { count: 'exact' })
              .eq('meeting_id', meetingId)
              .eq('is_active', true);

            if (activeCount === 0) {
              console.error('❌ Meeting has no active participants - access denied');
              const errMsg = 'This meeting has ended or has no active participants.';
              setLoadError(errMsg);
              toast.error(errMsg);
              setIsLoading(false);
              return;
            }
          }

         // Get user profile - fetch ALL fields the RPC function might need
         const { data: profileData, error: profileError } = await supabase
           .from('user_profiles')
           .select('*')
           .eq('id', user.id)
           .maybeSingle();

         if (profileError) {
           console.error('❌ Profile fetch error:', profileError);
           throw profileError;
         }

         console.log('✅ User profile loaded:', {
           id: profileData?.id,
           username: profileData?.username,
           role: profileData?.role,
           is_admin: profileData?.is_admin,
           is_ceo: profileData?.is_ceo,
           is_lead_officer: profileData?.is_lead_officer,
           is_troll_officer: profileData?.is_troll_officer,
           is_pastor: profileData?.is_pastor,
         });

         if (profileData) {
           setUserProfile(profileData);
         }

           // Check if user can access this meeting (staff roles only)
           console.log('🔐 Checking staff role access for team meetings');

           let hasAccess = false;
           let rpcResult: boolean | null = null;
           let rpcErrorMsg: string | null = null;

           try {
             // Call RPC function - primary source of truth
             const { data: canAccess, error: accessError } = await supabase
               .rpc('can_access_staff_meeting', { p_user_id: user.id });

             console.log('🔐 RPC access check result:', { canAccess, accessError: accessError?.message });

             rpcResult = canAccess ?? null;
             rpcErrorMsg = accessError?.message || null;

             if (accessError) {
               // RPC returned an error - fall back to profile-based check
               console.warn('⚠️  RPC call error, using fallback check:', accessError.message);
               hasAccess = checkStaffAccessFallback(profileData);
             } else if (canAccess === true) {
               // RPC explicitly granted access
               hasAccess = true;
               console.log('✅ RPC granted access');
             } else if (canAccess === false) {
               // RPC explicitly denied access
               hasAccess = false;
               console.log('❌ RPC denied access');
             } else {
               // RPC returned null/undefined - treat as failure and fallback
               console.warn('⚠️  RPC returned null/undefined, using fallback check');
               hasAccess = checkStaffAccessFallback(profileData);
             }
           } catch (rpcErr: any) {
             // RPC threw an exception - fall back to profile-based check
             console.warn('⚠️  RPC call failed, using fallback check:', rpcErr);
             rpcErrorMsg = rpcErr?.message || String(rpcErr);
             hasAccess = checkStaffAccessFallback(profileData);
           }

           // Structured debug logging BEFORE final decision
           console.log('ACCESS DEBUG', {
             userId: user.id,
             username: profileData?.username,
             role: profileData?.role,
             is_admin: profileData?.is_admin,
             is_ceo: profileData?.is_ceo,
             is_lead_officer: profileData?.is_lead_officer,
             is_troll_officer: profileData?.is_troll_officer,
             rpcResult,
             rpcError: rpcErrorMsg,
             finalAccess: hasAccess
           });

           if (!hasAccess) {
             console.error('❌ User denied access - not a staff member');
             console.error('📋 Profile:', profileData);
              const errMsg = 'Access denied. Team meetings require staff roles or organization membership (Admin, Lead Troll Officer, Troll Officer, Secretary, Prosecutor, Pastor, Auctioneer, or Organization Member).';
             setLoadError(errMsg);
             toast.error(errMsg);
             setIsLoading(false);
             return;
           }

         console.log('✅ Access granted - proceeding to join');

         // Add user as participant (upsert to avoid duplicates)
         const { error: joinError } = await supabase
           .from('staff_meeting_participants')
           .upsert(
             {
               meeting_id: meetingId,
               user_id: user.id,
               status: 'joined',
               joined_at: new Date().toISOString(),
               is_active: true
             },
             {
               onConflict: 'meeting_id,user_id'
             }
           );

         if (joinError) {
           console.error('❌ Join error:', joinError);
           throw joinError;
         }

         setIsLoading(false);
       } catch (error) {
         console.error('🔥 Error fetching meeting:', error);
         const errMsg = error instanceof Error ? error.message : 'Failed to load meeting';
         setLoadError(errMsg);
         toast.error(errMsg);
         setIsLoading(false);
       }
     };

     fetchMeeting();
   }, [meetingId, user]);

    // Subscribe to participant count changes (Modern Supabase v2+ API)
    useEffect(() => {
      if (!meetingId) return;

      // Set up real-time subscription using modern Supabase API
      const channel = supabase
        .channel(`staff_meeting:${meetingId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'staff_meeting_participants',
            filter: `meeting_id=eq.${meetingId}`
          },
          (_payload) => {
            // Fetch updated count when participants change
            const fetchCount = async () => {
              try {
                const { count } = await supabase
                  .from('staff_meeting_participants')
                  .select('id', { count: 'exact' })
                  .eq('meeting_id', meetingId)
                  .eq('is_active', true);

                const activeCount = count || 0;
                setParticipantCount(activeCount);

                // If meeting is live and no active participants, end the meeting
                if (meeting?.status === 'live' && activeCount === 0) {
                  console.log('No active participants remaining, ending meeting');
                  await supabase
                    .from('staff_meetings')
                    .update({
                      status: 'ended',
                      ended_at: new Date().toISOString()
                    })
                    .eq('id', meetingId);

                  // Update local state
                  setMeeting(prev => prev ? { ...prev, status: 'ended', ended_at: new Date().toISOString() } : null);

                  toast.info('Meeting ended - no active participants');
                }
              } catch (error) {
                console.error('Error fetching participant count:', error);
              }
            };
            fetchCount();
          }
        )
        .subscribe();

      return () => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    }, [meetingId, meeting?.status]);

  // Subscribe to team meeting notifications in real-time
  useEffect(() => {
    if (!user?.id) return;

    const notificationChannel = supabase
      .channel(`team-meeting-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as any;
          if (newNotification?.type === 'team_meeting_started') {
            // Show in-app notification for team meeting
            toast.info(newNotification.title || 'Team Meeting Started', {
              action: {
                label: 'Join',
                onClick: () => {
                  if (newNotification.metadata?.meeting_id) {
                    navigate(`/meeting/${newNotification.metadata.meeting_id}`);
                  }
                }
              },
              duration: 15000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (notificationChannel) {
        supabase.removeChannel(notificationChannel);
      }
    };
  }, [user?.id, navigate]);

  // Use Agora room for video/audio
  const {
    isConnected,
    remoteUsers,
    localVideoTrack,
    localAudioTrack,
    toggleCamera,
    toggleMicrophone,
    isPublishing,
    error: agoraError,
    joinChannel,
    leaveChannel
  } = useAgoraRoom({
    channelName: meeting?.room_name || '',
    userId: user?.id || '',
    userName: userProfile?.username || 'User',
    role: 'publisher',
    onUserJoined: (user) => {
      console.log('👤 User joined Agora channel:', user.uid);
    },
    onUserLeft: (user) => {
      console.log('👤 User left Agora channel:', user.uid);
    },
    onError: (error) => {
      console.error('🔥 Agora error:', error);
      toast.error('Video connection error: ' + error);
    }
  });

  // Auto-join when meeting is ready - ONLY ONCE
  useEffect(() => {
    if (!meeting?.room_name || hasJoinedRef.current || loadError) {
      console.log('⏸️ Auto-join blocked:', {
        hasRoomName: !!meeting?.room_name,
        hasJoinedAlready: hasJoinedRef.current,
        hasError: !!loadError
      });
      return;
    }

    hasJoinedRef.current = true;
    console.log('🚀 Auto-joining Agora channel:', meeting.room_name);
    joinChannel();
  }, [meeting?.room_name, loadError]); // ONLY depends on meeting data, not joinChannel

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, []);

   const handleLeaveRoom = useCallback(async () => {
     try {
       // Mark user as inactive
       if (user && meetingId) {
         await supabase
           .from('staff_meeting_participants')
           .update({
             is_active: false,
             left_at: new Date().toISOString()
           })
           .eq('meeting_id', meetingId)
           .eq('user_id', user.id);
       }

       // Leave Agora channel
       await leaveChannel();

       navigate('/');
     } catch (error) {
       console.error('❌ Error leaving room:', error);
       navigate('/');
     }
   }, [leaveChannel, user, meetingId, navigate]);

    const handleStartMeeting = useCallback(async () => {
      try {
        if (!meetingId) return;

        // Update meeting status to live
        await supabase
          .from('staff_meetings')
          .update({
            status: 'live',
            started_at: new Date().toISOString()
          })
          .eq('id', meetingId);

        // Send notifications to all staff members
        await sendStaffMeetingNotifications(meetingId);

        // Show success toast
        toast.success('Meeting started successfully');
      } catch (error) {
        console.error('Error starting meeting:', error);
        toast.error('Failed to start meeting');
      }
    }, [meetingId]);

  // Get mic and camera state from track properties
  const _isMicMuted = !isPublishing || (localAudioTrack && !('enabled' in localAudioTrack ? localAudioTrack.enabled : true));
  const _isCameraMuted = !isPublishing || (localVideoTrack && !('enabled' in localVideoTrack ? localVideoTrack.enabled : true));

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center flex-col gap-4 p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-white text-lg font-semibold">⚠️ Error Loading Meeting</p>
          <p className="text-gray-400 text-sm">{loadError}</p>
          <div className="bg-gray-900/50 border border-gray-700 rounded p-3 text-xs text-gray-300 max-h-40 overflow-auto">
            <p className="font-mono break-words">{loadError}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => {
              console.log('🔄 Retrying meeting load...');
              setLoadError(null);
              setIsLoading(true);
              window.location.reload();
            }} className="bg-blue-600 hover:bg-blue-700">
              Retry
            </Button>
            <Button onClick={() => navigate('/admin/meetings')} variant="outline">Go to Dashboard</Button>
            <Button onClick={() => navigate('/')} variant="ghost">Home</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{meeting.title}</h1>
          <p className="text-gray-400 text-sm flex items-center gap-2 mt-1">
            <Users className="w-4 h-4" />
            {participantCount} participant{participantCount !== 1 ? 's' : ''} in room
          </p>
        </div>

         <div className="flex items-center gap-4">
           {agoraError && (
             <div className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded">
               ❌ {agoraError}
             </div>
           )}

           {!isConnected && !agoraError && (
             <div className="text-yellow-400 text-sm bg-yellow-900/20 px-3 py-2 rounded animate-pulse">
               ⏳ Connecting to meeting...
             </div>
           )}

           {isConnected && (
             <div className="text-green-400 text-sm">
               ✅ Connected
             </div>
           )}

           {isPublishing && (
             <div className="flex items-center gap-2">
               <motion.button
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 onClick={toggleMicrophone}
                 className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                 title={localAudioTrack?.enabled ? 'Mute' : 'Unmute'}
               >
                 {localAudioTrack?.enabled ? (
                   <Mic className="w-4 h-4" />
                 ) : (
                   <MicOff className="w-4 h-4 text-red-400" />
                 )}
               </motion.button>

               <motion.button
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 onClick={toggleCamera}
                 className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors"
                 title={localVideoTrack?.enabled ? 'Turn off camera' : 'Turn on camera'}
               >
                 {localVideoTrack?.enabled ? (
                   <Video className="w-4 h-4" />
                 ) : (
                   <VideoOff className="w-4 h-4 text-red-400" />
                 )}
               </motion.button>
             </div>
           )}

            {meeting?.status === 'scheduled' && (userProfile?.is_admin || userProfile?.is_ceo) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStartMeeting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Users className="w-4 h-4" />
                Start Meeting
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDocumentShare(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Documents
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLeaveRoom}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <PhoneOff className="w-4 h-4" />
              Leave Meeting
            </motion.button>
         </div>
      </div>

      {/* Main Grid */}
      {isConnected && (
        <TeamMeetingGrid
          localUserId={user.id}
          remoteUsers={remoteUsers}
          localVideoTrack={localVideoTrack}
          localAudioTrack={localAudioTrack}
          localUsername={userProfile?.username || 'User'}
          localRole={userProfile?.role || 'user'}
          meetingId={meetingId}
        />
      )}

      {/* Loading State */}
      {!isConnected && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full mx-auto mb-4"
            />
            <p className="text-white text-lg">Connecting to meeting...</p>
          </div>
        </div>
      )}

      {/* Document Share Panel */}
      <MeetingDocumentShare
        meetingId={meetingId || ''}
        isOpen={showDocumentShare}
        onClose={() => setShowDocumentShare(false)}
      />
    </div>
  );
};

export default TeamMeetingRoom;
