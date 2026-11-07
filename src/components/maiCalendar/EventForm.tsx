'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Calendar, Link, X, Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  isCalendarStaff,
  isCalendarAdmin,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  detectTimeZone,
  localToUtcISO,
  utcToLocalInput,
  type CalendarVisibility,
  type CreateCalendarEventInput,
  type MaiCalendarEvent,
} from '@/lib/maiCalendar';

interface EventFormProps {
  event?: MaiCalendarEvent | null;
  initialDate?: string;
  isOfficial?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
];

const CATEGORIES = [
  { value: 'community_meeting', label: 'Community Meeting', icon: '🏛️' },
  { value: 'creator_event', label: 'Creator Event', icon: '✨' },
  { value: 'battle_event', label: 'Battle Event', icon: '⚡' },
  { value: 'gaming_tournament', label: 'Gaming Tournament', icon: '🎯' },
  { value: 'church_service', label: 'Church Service', icon: '⛪' },
  { value: 'share_a_thon', label: 'Share-A-Thon', icon: '📢' },
  { value: 'charity_event', label: 'Charity Event', icon: '💝' },
  { value: 'custom_event', label: 'Custom Event', icon: '📌' },
];

export default function EventForm({ event, initialDate, isOfficial = false, onClose, onSuccess }: EventFormProps) {
  const { profile } = useAuthStore();
  const staff = isCalendarStaff(profile);

  const isEdit = !!event;
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [timezone, setTimezone] = useState(event?.timezone || detectTimeZone());
  const startInput = event?.starts_at
    ? utcToLocalInput(event.starts_at, timezone)
    : { date: initialDate || '', time: '' };
  const endInput = event?.ends_at
    ? utcToLocalInput(event.ends_at, timezone)
    : { date: initialDate || '', time: '' };
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [category, setCategory] = useState(event?.category || 'custom_event');
  const [bannerUrl, setBannerUrl] = useState(event?.banner_url || '');
  const [startDate, setStartDate] = useState(startInput.date);
  const [startTime, setStartTime] = useState(startInput.time);
  const [endDate, setEndDate] = useState(endInput.date);
  const [endTime, setEndTime] = useState(endInput.time);
  const [location, setLocation] = useState(event?.location || '');
  const [streamUrl, setStreamUrl] = useState(event?.stream_url || '');
  const [visibility, setVisibility] = useState<CalendarVisibility>(event?.visibility || 'public');
  const [officialEvent, setOfficialEvent] = useState(event?.is_official ?? isOfficial);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!open) onClose();
  }, [open, onClose]);

  if (!staff) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const startsAt = localToUtcISO(startDate, startTime, timezone);
      const endsAt = localToUtcISO(endDate, endTime, timezone);
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        throw new Error('The event end must be after its start');
      }

      const input: CreateCalendarEventInput = {
        title: title.trim(),
        description: description.trim(),
        category,
        banner_url: bannerUrl.trim() || undefined,
        starts_at: startsAt,
        ends_at: endsAt,
        timezone,
        location: location.trim() || undefined,
        stream_url: streamUrl.trim() || undefined,
        visibility: officialEvent ? 'public' : visibility,
        is_official: officialEvent,
      };

      if (isEdit && event) {
        await updateCalendarEvent(event.id, input, event.published_at ?? null);
        toast.success('Event updated');
      } else {
        if (officialEvent && !isCalendarAdmin(profile)) {
          throw new Error('Only admins can create official events');
        }
        await createCalendarEvent(input);
        toast.success(officialEvent ? 'Official event created' : 'Event created');
      }
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!isEdit || !event) return;
    if (!window.confirm('Cancel this event? This will notify registered users.')) return;
    setLoading(true);
    try {
      await cancelCalendarEvent(event.id);
      toast.success('Event canceled');
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit calendar event' : 'Create calendar event'}
    >
      <div
        className="absolute inset-0"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className="w-full max-w-2xl bg-[#0b1220]/95 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-400" />
            {isEdit ? 'Edit Event' : 'Post to Calendar'}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Event title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. MaiTroll Live Beta Launch"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-slate-950 text-white">
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this event about?"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-400 focus:outline-none"
            />
          </div>

          {!isEdit && isCalendarAdmin(profile) && (
            <label className="flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
              <input
                type="checkbox"
                checked={officialEvent}
                onChange={(e) => {
                  setOfficialEvent(e.target.checked);
                  if (e.target.checked) setVisibility('public');
                }}
                className="mt-1 accent-cyan-400"
              />
              <span>
                <span className="block text-sm font-bold text-cyan-200">Official Agora event</span>
                <span className="block text-xs text-slate-400">
                  Creates one public calendar listing with an Agora live room, guest-seat approvals, event chat, and free-coin gifts.
                </span>
              </span>
            </label>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Banner image URL</label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => {
                  if (e.target.value === 'public' || e.target.value === 'draft') {
                    setVisibility(e.target.value);
                  }
                }}
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
              >
                <option value="public" className="bg-slate-950 text-white">Public</option>
                {!officialEvent && <option value="draft" className="bg-slate-950 text-white">Draft (staff only)</option>}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Time zone</label>
            <p className="text-xs text-slate-500">Detected: {detectTimeZone()}</p>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus:border-violet-400 focus:outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-slate-950 text-white">{tz}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="MaiTroll Live, Online, or external"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-400 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Stream link (optional)</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://maitroll.com/live/..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-400 focus:outline-none"
              />
              <button
                type="button"
                className="rounded-xl bg-white/5 px-3 py-2 text-violet-300 hover:bg-white/10 border border-white/10"
              >
                <Link className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isEdit && event ? (
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Cancel event
              </button>
              <span className="text-xs text-slate-500">
                Created {new Date(event.created_at).toLocaleDateString()}
              </span>
            </div>
          ) : null}

          {deleteConfirm && (
            <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-sm text-red-300">Canceling will mark this event as canceled on the public calendar.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelEvent}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Confirm cancel
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10"
                >
                  Keep
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-black text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:from-violet-400 hover:to-purple-500 disabled:opacity-50"
            >
              {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Publish event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
