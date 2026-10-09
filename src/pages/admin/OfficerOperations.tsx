import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  MessageSquare,
  Send,
  Shield
} from 'lucide-react';
import { supabase, UserRole } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store'; // Import useAuthStore
import { toast } from 'sonner';
import RequireRole from '../../components/RequireRole';
import { formatFullDateTime12hr } from '../../utils/timeFormat';

interface OfficerShift {
  id: string;
  officer_id: string;
  officer?: { username: string };
  shift_start: string;
  shift_end: string | null;
  status: string;
  owc_earned: number;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender?: { username: string };
  content: string;
  created_at: string;
}

interface ScheduleSlot {
  id: string;
  officer_id: string;
  officer?: { username: string };
  shift_date: string;
  shift_start_time: string;
  shift_end_time: string;
  status: string;
}

export default function OfficerOperations() {
  const user = useAuthStore((state) => state.user); // Get user from store
  const [activeTab, setActiveTab] = useState('shifts');
  const [shifts, setShifts] = useState<OfficerShift[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});

  const updateLoadError = useCallback((section: string, error?: unknown) => {
    setLoadErrors((current) => {
      const next = { ...current };
      if (error === undefined) {
        delete next[section];
      } else {
        next[section] = error instanceof Error ? error.message : String(error);
      }
      return next;
    });
  }, []);

  const loadShifts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_officer_shifts', limit: 50 }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const mappedData = (data?.shifts || []).map((s: any) => ({
        id: s.id,
        officer_id: s.officer_id,
        officer: s.officer,
        shift_start: s.clock_in,
        shift_end: s.clock_out,
        status: s.clock_out ? 'completed' : 'active',
        owc_earned: s.coins_earned || 0
      }));
      setShifts(mappedData);
      updateLoadError('Shifts');
    } catch (err) {
      console.error('Error loading shifts:', err);
      updateLoadError('Shifts', err);
    }
  }, [updateLoadError]);

  const loadSchedule = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_officer_shift_slots' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setScheduleSlots(data.slots || []);
      updateLoadError('Schedule');
    } catch (err) {
      console.error('Error loading schedule:', err);
      updateLoadError('Schedule', err);
    }
  }, [updateLoadError]);

  const loadChatMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('officer-actions', {
        body: { action: 'get_officer_chat_messages', limit: 100 }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setChatMessages(data.messages || []);
      updateLoadError('Officer chat');
    } catch (err) {
      console.error('Error loading chat:', err);
      updateLoadError('Officer chat', err);
    }
  }, [updateLoadError]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        loadShifts(),
        loadSchedule(),
        loadChatMessages()
      ]);
      setLoading(false);
    };
    init();

    // Polling every 30s
    const interval = setInterval(() => {
      loadShifts();
      loadSchedule();
      loadChatMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadShifts, loadSchedule, loadChatMessages]);

  // Realtime subscription for chat
  useEffect(() => {
    const channel = supabase
      .channel('officer-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'officer_chat_messages'
        },
        () => {
          loadChatMessages();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadChatMessages]);

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: { 
          action: 'send_officer_chat', 
          message: newMessage.trim()
        }
      });

      if (error) throw error;

      setNewMessage('');
      await loadChatMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  if (loading && shifts.length === 0 && scheduleSlots.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading officer operations...</div>
      </div>
    );
  }

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6 pt-16 lg:pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Officer Operations</h1>
                <p className="text-gray-400">Shift scheduling and officer communications</p>
              </div>
            </div>

          </div>

          {Object.entries(loadErrors).length > 0 && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <p className="mb-2 font-semibold">Some officer operations data could not be loaded.</p>
              <ul className="list-disc space-y-1 pl-5">
                {Object.entries(loadErrors).map(([section, message]) => (
                  <li key={section}>{section}: {message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'shifts', name: 'Shift Logs', icon: Calendar },
              { id: 'schedule', name: 'Master Schedule', icon: Calendar },
              { id: 'chat', name: 'Officer Chat', icon: MessageSquare }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Officer Shifts</h2>
              </div>

              <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Officer</th>
                      <th className="px-4 py-3 text-left">Clock In</th>
                      <th className="px-4 py-3 text-left">Clock Out</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">OWC Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="border-t border-zinc-700">
                        <td className="px-4 py-3">{shift.officer?.username || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm">
                          {formatFullDateTime12hr(shift.shift_start)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {shift.shift_end ? formatFullDateTime12hr(shift.shift_end) : 'In progress'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            shift.status === 'completed' ? 'bg-green-600' :
                            shift.status === 'active' ? 'bg-blue-600' :
                            shift.status === 'scheduled' ? 'bg-yellow-600' : 'bg-gray-600'
                          }`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-green-400">+{shift.owc_earned}</td>
                      </tr>
                    ))}
                    {shifts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No shifts found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Master Schedule</h2>
              </div>
              <div className="bg-zinc-900/50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left">Officer</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleSlots.map((slot) => (
                      <tr key={slot.id} className="border-t border-zinc-700">
                        <td className="px-4 py-3">{slot.officer?.username || 'Unknown'}</td>
                        <td className="px-4 py-3">{new Date(slot.shift_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                           {slot.shift_start_time} - {slot.shift_end_time}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            slot.status === 'booked' ? 'bg-green-600' : 'bg-gray-600'
                          }`}>
                            {slot.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {scheduleSlots.length === 0 && (
                      <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                           No active schedule slots found
                         </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Officer Internal Chat</h2>

              <div className="bg-zinc-900/50 rounded-lg p-4">
                <div className="h-96 overflow-y-auto mb-4 space-y-3">
                  {chatMessages.slice().reverse().map((message) => (
                    <div key={message.id} className="flex bg-zinc-800/70 p-3 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{message.sender?.username}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(message.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <div className="text-center text-gray-500 py-12">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Send message to officers..."
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  />
                  <button
                    onClick={sendChatMessage}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </RequireRole>
  );
}
