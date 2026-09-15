import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Video, Users, Clock, Play, StopCircle, Trash2, ChevronRight,
  RefreshCw, Plus, Calendar, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  created_at: string;
  participant_count?: number;
}

export default function AdminMeetingsDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [meetings, setMeetings] = useState<StaffMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'scheduled' | 'ended'>('all');

// Check access and determine permissions - all staff roles can create/access meetings
   const canCreateMeeting = profile && (
     profile.role === 'admin' ||
     profile.role === 'ceo' ||
     profile.role === 'lead_officer' ||
     profile.role === 'lead_troll_officer' ||
     profile.role === 'troll_officer' ||
     profile.role === 'officer' ||
     profile.role === 'secretary' ||
     profile.role === 'prosecutor' ||
     profile.role === 'judge' ||
     profile.role === 'attorney' ||
     profile.role === 'pastor' ||
     profile.role === 'auctioneer' ||
     profile.role === 'moderator' ||
     profile.role === 'ceo_assistant' ||
     profile.role === 'noah_assistant' ||
     profile.role === 'agency_hr' ||
     profile.role === 'agency_hr_manager' ||
     profile.role === 'journalist' ||
     profile.role === 'tcnn_news_caster' ||
     profile.role === 'tcnn_chief_news_caster' ||
     profile.role === 'troller' ||
     profile.role === 'troll_family_leader' ||
     profile.role === 'agency_leader' ||
     profile.role === 'noah_admin' ||
     profile.is_admin === true ||
     profile.is_ceo === true ||
     profile.is_lead_officer === true ||
     profile.is_troll_officer === true ||
profile.is_officer === true ||
      profile.is_secretary === true ||
      profile.is_prosecutor === true ||
      profile.is_judge === true ||
      profile.is_attorney === true ||
      profile.is_pastor === true ||
      profile.is_moderator === true ||
      profile.is_ceo_assistant === true ||
      profile.is_noah_assistant === true ||
      profile.is_agency_hr === true ||
      profile.is_agency_hr_manager === true ||
      profile.is_journalist === true ||
      profile.is_tcnn_news_caster === true ||
      profile.is_tcnn_chief_news_caster === true ||
      profile.is_troller === true ||
      profile.is_troll_family_leader === true ||
      profile.is_agency_leader === true ||
      profile.is_noah_admin === true ||
      profile.officer_role === 'lead_officer'
    );

  useEffect(() => {
    if (!user || !profile) {
      navigate('/');
      return;
    }

    // Log permission info
    console.log('🔐 User Access Check:', {
      userId: user.id,
      userRole: profile.role,
      isAdmin: profile.is_admin,
      isLeadOfficer: profile.is_lead_officer,
      officerRole: profile.officer_role,
      canCreateMeeting
    });

    // Allow access if user has any staff role
    if (!canCreateMeeting) {
      toast.error('Insufficient permissions to access team meetings');
      navigate('/');
    }
  }, [user, profile, navigate, canCreateMeeting]);

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff_meetings')
        .select(`
          id,
          title,
          description,
          room_name,
          status,
          max_participants,
          created_by,
          started_at,
          ended_at,
          created_at,
          staff_meeting_participants(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const meetingsWithCount = data.map(m => ({
        ...m,
        participant_count: m.staff_meeting_participants[0]?.count || 0
      }));

      setMeetings(meetingsWithCount);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch meetings on mount and when user changes
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Create new staff meeting
  const handleCreateMeeting = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      const now = new Date();
      const roomName = `staff-meeting-${Date.now()}`;
      const meetingTitle = `Staff Meeting ${now.toLocaleString()}`;

      const { data, error } = await supabase
        .from('staff_meetings')
        .insert([
          {
            title: meetingTitle,
            description: 'New staff meeting',
            room_name: roomName,
            status: 'scheduled',
            max_participants: 100,
            created_by: user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Meeting "${meetingTitle}" created successfully!`);

      // Refresh meetings list
      fetchMeetings();

      // Navigate to the meeting room with a longer delay to ensure state is ready
      console.log('🚀 Navigating to meeting room in 1 second...');
      setTimeout(() => {
        console.log('🚀 Navigating now to /meeting/' + data.id);
        navigate(`/meeting/${data.id}`);
      }, 1000);
    } catch (error: any) {
      console.error('🔥 Unexpected error creating meeting:', error);
      toast.error(error?.message || 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  // End meeting
  const handleEndMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('staff_meetings')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', meetingId);

      if (error) throw error;

      fetchMeetings();
      toast.success('Meeting ended');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to end meeting');
    }
  };

// Start meeting
const handleStartMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('staff_meetings')
        .update({ status: 'live', started_at: new Date().toISOString() })
        .eq('id', meetingId);

      if (error) throw error;

      // Get all staff user IDs
      const { data: staffUsers, error: staffError } = await supabase
        .rpc('get_staff_user_ids');

      // Fallback: get users with staff roles manually (including organization members)
      let staffIds: string[] = [];
      if (staffError) {
        const [{ data: fallbackUsers }, { data: orgFallbackUsers }] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('id')
            .or('role.eq.admin,role.eq.lead_troll_officer,role.eq.troll_officer,role.eq.officer,role.eq.secretary,role.eq.prosecutor,role.eq.judge,role.eq.attorney,role.eq.pastor,role.eq.moderator,role.eq.ceo,role.eq.ceo_assistant,role.eq.noah_assistant,role.eq.agency_hr,role.eq.agency_hr_manager,role.eq.journalist,role.eq.tcnn_news_caster,role.eq.tcnn_chief_news_caster,role.eq.troller,role.eq.troll_family_leader,role.eq.agency_leader,role.eq.noah_admin,is_admin.eq.true,is_ceo.eq.true,is_lead_officer.eq.true,is_troll_officer.eq.true,is_officer.eq.true,is_secretary.eq.true,is_prosecutor.eq.true,is_judge.eq.true,is_attorney.eq.true,is_pastor.eq.true,is_moderator.eq.true,is_ceo_assistant.eq.true,is_noah_assistant.eq.true,is_agency_hr.eq.true,is_agency_hr_manager.eq.true,is_journalist.eq.true,is_tcnn_news_caster.eq.true,is_tcnn_chief_news_caster.eq.true,is_troller.eq.true,is_troll_family_leader.eq.true,is_agency_leader.eq.true,is_noah_admin.eq.true'),
          supabase
            .from('user_profiles')
            .select('id')
            .not('organization_id', 'is', null)
        ]);

        const staffIdsSet = new Set<string>();
        fallbackUsers?.forEach((u: any) => staffIdsSet.add(u.id));
        orgFallbackUsers?.forEach((u: any) => staffIdsSet.add(u.id));
        staffIds = Array.from(staffIdsSet);
      } else {
        staffIds = staffUsers?.map((u: any) => u.id) || [];
      }

      // Send notifications to all staff members
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-bulk-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          type: 'team_meeting_started',
          title: 'Team Meeting Started',
          message: 'A staff meeting has started. Click to join.',
          metadata: {
            meeting_id: meetingId,
            action_url: `/meeting/${meetingId}`
          },
          targetUserIds: staffIds
        })
      });

      if (!response.ok) {
        console.error('Failed to send staff meeting notifications:', await response.text());
      }

      // Navigate to the meeting room to display the staff grid
      navigate(`/meeting/${meetingId}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start meeting');
     }
   };

  // Delete meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure? This will delete the meeting and all participant records.')) return;

    try {
      const { error } = await supabase
        .from('staff_meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      fetchMeetings();
      toast.success('Meeting deleted');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete meeting');
    }
  };

  // Filter meetings
  const filteredMeetings = meetings.filter(m => {
    if (activeFilter === 'all') return true;
    return m.status === activeFilter;
  });

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Team Meetings</h1>
            <p className="text-gray-400 text-sm mt-1">Create and manage staff meetings</p>
          </div>
          {canCreateMeeting && (
            <Button
              onClick={handleCreateMeeting}
              disabled={isCreating}
              className="bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-400 text-black hover:from-yellow-500 hover:via-yellow-400 hover:to-yellow-300 font-semibold"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  New Meeting
                </>
              )}
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-700 pb-4">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'ghost'}
            onClick={() => setActiveFilter('all')}
            className={activeFilter === 'all' ? 'bg-yellow-600 hover:bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}
          >
            All ({meetings.length})
          </Button>
          <Button
            variant={activeFilter === 'live' ? 'default' : 'ghost'}
            onClick={() => setActiveFilter('live')}
            className={activeFilter === 'live' ? 'bg-green-600 hover:bg-green-500 text-black' : 'text-gray-400 hover:text-white'}
          >
            Live
          </Button>
          <Button
            variant={activeFilter === 'scheduled' ? 'default' : 'ghost'}
            onClick={() => setActiveFilter('scheduled')}
            className={activeFilter === 'scheduled' ? 'bg-blue-600 hover:bg-blue-500' : 'text-gray-400 hover:text-white'}
          >
            Scheduled
          </Button>
          <Button
            variant={activeFilter === 'ended' ? 'default' : 'ghost'}
            onClick={() => setActiveFilter('ended')}
            className={activeFilter === 'ended' ? 'bg-gray-600 hover:bg-gray-500' : 'text-gray-400 hover:text-white'}
          >
            Ended
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
          </div>
        )}

        {/* No meetings */}
        {!isLoading && meetings.length === 0 && (
          <div className="text-center py-12 bg-[#1a1625] rounded-xl border border-gray-700">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meetings yet</h3>
            <p className="text-gray-400 mb-4">Create your first staff meeting</p>
            {canCreateMeeting && (
              <Button onClick={handleCreateMeeting} className="bg-yellow-600 hover:bg-yellow-500 text-black">
                <Plus className="w-4 h-4 mr-2" />
                Create Meeting
              </Button>
            )}
          </div>
        )}

        {/* Meetings List */}
        {!isLoading && meetings.length > 0 && (
          <div className="space-y-4">
            {filteredMeetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a1625] rounded-xl border border-gray-700 p-6 hover:border-yellow-500/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{meeting.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        meeting.status === 'live' ? 'bg-green-500/20 text-green-400' :
                        meeting.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                      </span>
                    </div>
                    {meeting.description && (
                      <p className="text-gray-400 text-sm mb-3">{meeting.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {meeting.participant_count || 0} participants
                      </span>
                      <span className="text-gray-600">|</span>
                      <span>Max: {meeting.max_participants}</span>
                      <span className="text-gray-600">|</span>
                      <span>{new Date(meeting.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {meeting.status === 'live' && (
                      <Button
                        onClick={() => navigate(`/meeting/${meeting.id}`)}
                        className="bg-green-600 hover:bg-green-500 text-black font-semibold"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Join Live
                      </Button>
                    )}
                    {meeting.status === 'scheduled' && (
                      <Button
                        onClick={() => handleStartMeeting(meeting.id)}
                        className="bg-yellow-600 hover:bg-yellow-500 text-black"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => navigate(`/meeting/${meeting.id}`)}
                      className="text-gray-400 hover:text-white border-gray-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    {meeting.status === 'live' && (
                      <Button
                        variant="ghost"
                        onClick={() => handleEndMeeting(meeting.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <StopCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredMeetings.length === 0 && activeFilter !== 'all' && (
              <div className="text-center py-8 text-gray-400">
                No {activeFilter} meetings
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}