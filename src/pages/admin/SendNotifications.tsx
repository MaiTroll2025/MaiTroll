import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { NotificationType } from '../../lib/sendNotification';
import { toast } from 'sonner';
import { Bell, Users, Send, AlertCircle, CheckCircle } from 'lucide-react';

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'stream_live', label: 'Stream Live' },
  { value: 'join_approved', label: 'Join Approved' },
  { value: 'moderation_alert', label: 'Moderation Alert' },
  { value: 'new_follower', label: 'New Follower' },
  { value: 'gift_received', label: 'Gift Received' },
  { value: 'message', label: 'Message' },
  { value: 'support_reply', label: 'Support Reply' },
  { value: 'payout_update', label: 'Payout Update' },
  { value: 'role_update', label: 'Role Update' },
  { value: 'application_result', label: 'Application Result' },
  { value: 'troll_drop', label: 'Troll Drop' },
];

export default function SendNotifications() {
  const [type, setType] = useState<NotificationType>('stream_live');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [metadata, setMetadata] = useState('{}');
  const [sendToAll, setSendToAll] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    notificationCount?: number;
    failedCount?: number;
    message?: string;
  } | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter both title and message');
      return;
    }

    let metadataObj = {};
    try {
      if (metadata.trim()) {
        metadataObj = JSON.parse(metadata);
      }
    } catch {
      toast.error('Invalid JSON in metadata');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const functionsUrl = import.meta.env.VITE_SUPABASE_URL 
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
        : 'https://gejtbllazzighxwxudyu.supabase.co/functions/v1';

      const response = await fetch(`${functionsUrl}/send-bulk-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          title: title.trim(),
          message: message.trim(),
          metadata: metadataObj,
          targetUserIds: sendToAll ? [] : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notifications');
      }

      setResult({
        success: true,
        notificationCount: data.notificationCount,
        failedCount: data.failedCount,
        message: data.message,
      });

      toast.success(`✅ ${data.message}`);
      
      // Reset form on success
      setTitle('');
      setMessage('');
      setMetadata('{}');

    } catch (error: any) {
      console.error('Error sending notifications:', error);
      setResult({
        success: false,
        message: error.message || 'Unknown error',
      });
      toast.error(error.message || 'Failed to send notifications');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bell className="w-8 h-8 text-purple-400" />
            Send Notifications
          </h1>
          <p className="text-gray-400 mt-2">
            Send notifications to all users or specific users
          </p>
        </div>

        <div className="grid gap-6">
          {/* Notification Form */}
          <div className="bg-[#1A1A24] border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              Create Notification
            </h2>

            <div className="grid gap-4">
              {/* Notification Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Notification Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as NotificationType)}
                  className="w-full bg-[#0A0814] border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                >
                  {NOTIFICATION_TYPES.map((nt) => (
                    <option key={nt.value} value={nt.value}>
                      {nt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter notification title..."
                  className="w-full bg-[#0A0814] border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter notification message..."
                  rows={4}
                  className="w-full bg-[#0A0814] border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              {/* Metadata */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Metadata (JSON, optional)
                </label>
                <textarea
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={2}
                  className="w-full bg-[#0A0814] border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none resize-none font-mono text-sm"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Target Audience
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="target"
                      checked={sendToAll}
                      onChange={() => setSendToAll(true)}
                      className="w-4 h-4 text-purple-500"
                    />
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      All Users
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="target"
                      checked={!sendToAll}
                      onChange={() => setSendToAll(false)}
                      className="w-4 h-4 text-purple-500"
                    />
                    <span>Specific Users (Coming Soon)</span>
                  </label>
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !message.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`border rounded-xl p-6 ${
              result.success 
                ? 'bg-green-900/20 border-green-500/50' 
                : 'bg-red-900/20 border-red-500/50'
            }`}>
              <h3 className={`text-lg font-semibold flex items-center gap-2 mb-3 ${
                result.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {result.success ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Success
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Failed
                  </>
                )}
              </h3>
              
              <p className="text-gray-300">
                {result.message || result.message}
              </p>
              
              {result.success && result.notificationCount !== undefined && (
                <div className="mt-3 text-sm text-gray-400">
                  <p>✅ Notifications sent: {result.notificationCount}</p>
                  {result.failedCount && result.failedCount > 0 && (
                    <p>❌ Failed: {result.failedCount}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <h3 className="text-blue-400 font-semibold mb-2">Tips</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Use &quot;Troll Drop&quot; type for coin giveaways (includes coins metadata)</li>
              <li>• Metadata can include extra data like action URLs, amounts, etc.</li>
              <li>• Notifications are sent immediately to all users</li>
              <li>• Users will see notifications in their bell icon</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
