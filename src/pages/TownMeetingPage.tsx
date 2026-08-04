import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import { supabase } from '@/supabaseClient';

type Meeting = {
  id: string;
  title: string;
  topic: string;
  agenda: string;
  meeting_type: string;
  is_active: boolean;
  started_at: string;
  livekit_room_name: string | null;
};

export default function TownMeetingPage() {
  const { user } = useAuthStore();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState('Town Hall');
  const [topic, setTopic] = useState('City updates');
  const [agenda, setAgenda] = useState('Share announcements and answer questions');
  const [meetingType, setMeetingType] = useState('general');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('town_meetings').select('*').order('started_at', { ascending: false }).limit(10);
      if (error) throw error;
      setMeetings((data as Meeting[]) || []);
    } catch (error: any) {
      toast.error(error.message || 'Unable to load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleStartMeeting = async () => {
    try {
      setBusy(true);
      const { data, error } = await supabase.rpc('start_town_meeting', {
        p_title: title,
        p_topic: topic,
        p_agenda: agenda,
        p_meeting_type: meetingType,
        p_scheduled_duration_minutes: 60,
        p_seat_roles: { mayor: 'Mayor', staff: 'Staff' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Town meeting created');
        await loadMeetings();
      } else {
        toast.error(data?.reason || 'Unable to start meeting');
      }
    } catch (error: any) {
      toast.error(error.message || 'Unable to start meeting');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050714] px-4 py-24 text-white md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Town Meeting</p>
          <h1 className="text-3xl font-black text-white">Open city conversations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Launch a town meeting, assign seats, and connect citizens to the mayor and staff.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
            <h2 className="text-xl font-black text-white">Start a meeting</h2>
            <div className="mt-4 space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Meeting title" />
              <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Meeting topic" />
              <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} className="min-h-[120px] w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white" placeholder="Agenda" />
              <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="w-full rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-sm text-white">
                <option value="general">General</option>
                <option value="emergency">Emergency</option>
                <option value="budget">Budget</option>
                <option value="public_safety">Public Safety</option>
              </select>
              <button onClick={handleStartMeeting} disabled={busy} className="rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-70">
                {busy ? 'Starting…' : 'Start meeting'}
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-6 backdrop-blur-2xl">
            <h2 className="text-xl font-black text-white">Recent meetings</h2>
            {loading ? (
              <p className="mt-4 text-sm text-slate-400">Loading meetings…</p>
            ) : meetings.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No meetings yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-2xl border border-cyan-300/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-white">{meeting.title}</span>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
                        {meeting.is_active ? 'Live' : 'Archived'}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-400">{meeting.topic}</p>
                    <p className="mt-1 text-xs text-slate-500">{meeting.agenda}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
