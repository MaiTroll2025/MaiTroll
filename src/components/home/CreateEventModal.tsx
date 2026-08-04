import { useState } from 'react';
import { toast } from 'sonner';
import {
  X,
  Calendar,
  Clock,
  Image,
  Palette,
  Users,
  Shield,
  MapPin,
  Tag,
  FileText,
} from 'lucide-react';

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
  initialDate?: string
}

const EVENT_CATEGORIES = [
  { slug: 'pride_event', name: 'Pride Event', icon: '🏳️‍🌈', color: '#EC4899' },
  { slug: 'trollathon', name: 'Trollathon', icon: '🎮', color: '#8B5CF6' },
  { slug: 'auction_event', name: 'Auction Event', icon: '🔨', color: '#F59E0B' },
  { slug: 'gaming_tournament', name: 'Gaming Tournament', icon: '🎯', color: '#10B981' },
  { slug: 'family_war', name: 'Family War', icon: '⚔️', color: '#EF4444' },
  { slug: 'community_meeting', name: 'Community Meeting', icon: '🏛️', color: '#3B82F6' },
  { slug: 'president_town_hall', name: 'President Town Hall', icon: '🎤', color: '#F97316' },
  { slug: 'academy_class', name: 'Academy Class', icon: '📚', color: '#06B6D4' },
  { slug: 'church_service', name: 'Church Service', icon: '⛪', color: '#A855F7' },
  { slug: 'share_a_thon', name: 'Share-A-Thon', icon: '📢', color: '#EC4899' },
  { slug: 'charity_event', name: 'Charity Event', icon: '💝', color: '#14B8A6' },
  { slug: 'creator_event', name: 'Creator Event', icon: '✨', color: '#F472B6' },
  { slug: 'voice_room_event', name: 'Voice Room Event', icon: '🎙️', color: '#6366F1' },
  { slug: 'battle_event', name: 'Battle Event', icon: '⚡', color: '#DC2626' },
  { slug: 'custom_event', name: 'Custom Event', icon: '📌', color: '#6B7280' },
];

const ACCESS_LEVELS = [
  { value: 'everyone', label: 'Everyone', description: 'All users can join' },
  { value: 'verified_users', label: 'Verified Users', description: 'Only verified users' },
  { value: 'founding_officers', label: 'Founding Officers', description: 'Founding officers only' },
  { value: 'staff', label: 'Staff', description: 'Staff members only' },
  { value: 'creators', label: 'Creators', description: 'Verified creators' },
  { value: 'agencies', label: 'Agencies', description: 'Agency members' },
  { value: 'specific_levels', label: 'Specific Levels', description: 'Users above a certain level' },
  { value: 'specific_users', label: 'Specific Users', description: 'Manually selected users' },
  { value: 'invite_only', label: 'Invite Only', description: 'Invitation required' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Visible to everyone' },
  { value: 'private', label: 'Private', description: 'Only visible to participants' },
  { value: 'invite_only', label: 'Invite Only', description: 'Only invited users see it' },
];

export default function CreateEventModal({ isOpen, onClose, onCreated, initialDate }: CreateEventModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_slug: 'custom_event',
    event_date: initialDate || new Date().toISOString().split('T')[0],
    start_time: '12:00',
    end_time: '13:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    banner_image_url: '',
    thumbnail_url: '',
    event_color: '#8B5CF6',
    max_participants: '',
    visibility: 'public' as const,
    access_level: 'everyone' as const,
    min_level: 1,
    rules: '',
    location_type: 'virtual' as const,
    location_details: '',
    tags: '',
  });

  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Auto-set color based on category
    if (field === 'category_slug') {
      const cat = EVENT_CATEGORIES.find(c => c.slug === value);
      if (cat) {
        setFormData(prev => ({ ...prev, [field]: value, event_color: cat.color }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase.rpc('create_event', {
        p_title: formData.title,
        p_description: formData.description,
        p_category_slug: formData.category_slug,
        p_event_date: formData.event_date,
        p_creator_id: user.id,
        p_creator_username: profileData?.username || user.email?.split('@')[0] || 'Admin',
        p_start_time: formData.start_time ? `${formData.event_date}T${formData.start_time}:00` : null,
        p_end_time: formData.end_time ? `${formData.event_date}T${formData.end_time}:00` : null,
        p_timezone: formData.timezone,
        p_banner_image_url: formData.banner_image_url || null,
        p_thumbnail_url: formData.thumbnail_url || null,
        p_event_color: formData.event_color,
        p_max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        p_visibility: formData.visibility,
        p_access_level: formData.access_level,
        p_min_level: formData.min_level,
        p_requirements: [],
        p_rules: formData.rules || null,
        p_location_type: formData.location_type,
        p_location_details: formData.location_details || null,
        p_tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        p_metadata: {},
      });

      if (error) {
        toast.error(error.message || 'Failed to create event');
        return;
      }

      toast.success('Event created successfully!');
      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error('Error creating event:', err);
      toast.error(err.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm pt-4 pb-24">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a0e1a] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Create Event</h2>
              <p className="text-xs text-slate-400">Schedule a new event for Mai Troll</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Event Name */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              Event Name *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="Enter event name"
              required
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50 focus:bg-white/[0.08]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Describe your event"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50 focus:bg-white/[0.08]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <Tag className="h-3.5 w-3.5 text-cyan-400" />
              Event Category *
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {EVENT_CATEGORIES.map(cat => (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => handleChange('category_slug', cat.slug)}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                    formData.category_slug === cat.slug
                      ? 'border-violet-400/50 bg-violet-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[10px] font-bold text-white">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                Date *
              </label>
              <input
                type="date"
                value={formData.event_date}
                onChange={e => handleChange('event_date', e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/50"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Clock className="h-3.5 w-3.5 text-green-400" />
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={e => handleChange('start_time', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/50"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Clock className="h-3.5 w-3.5 text-red-400" />
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={e => handleChange('end_time', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/50"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <Palette className="h-3.5 w-3.5 text-pink-400" />
              Event Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.event_color}
                onChange={e => handleChange('event_color', e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent"
              />
              <input
                type="text"
                value={formData.event_color}
                onChange={e => handleChange('event_color', e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          {/* Max Participants */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              Maximum Participants
            </label>
            <input
              type="number"
              value={formData.max_participants}
              onChange={e => handleChange('max_participants', e.target.value)}
              placeholder="Leave empty for unlimited"
              min="1"
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50"
            />
          </div>

          {/* Visibility & Access */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Shield className="h-3.5 w-3.5 text-orange-400" />
                Visibility
              </label>
              <select
                value={formData.visibility}
                onChange={e => handleChange('visibility', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/50"
              >
                {VISIBILITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0e1a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Shield className="h-3.5 w-3.5 text-purple-400" />
                Access Level
              </label>
              <select
                value={formData.access_level}
                onChange={e => handleChange('access_level', e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/50"
              >
                {ACCESS_LEVELS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0e1a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Level Requirement */}
          {formData.access_level === 'specific_levels' && (
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                Minimum Level
              </label>
              <input
                type="number"
                value={formData.min_level}
                onChange={e => handleChange('min_level', parseInt(e.target.value) || 1)}
                min="1"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/50"
              />
            </div>
          )}

          {/* Location */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-green-400" />
              Location
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['virtual', 'physical', 'hybrid'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChange('location_type', type)}
                  className={`rounded-xl border p-2 text-center text-xs font-bold capitalize transition ${
                    formData.location_type === type
                      ? 'border-violet-400/50 bg-violet-500/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {formData.location_type !== 'virtual' && (
              <input
                type="text"
                value={formData.location_details}
                onChange={e => handleChange('location_details', e.target.value)}
                placeholder="Enter location details"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50"
              />
            )}
          </div>

          {/* Banner & Thumbnail URLs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Image className="h-3.5 w-3.5 text-cyan-400" />
                Banner Image URL
              </label>
              <input
                type="url"
                value={formData.banner_image_url}
                onChange={e => handleChange('banner_image_url', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                <Image className="h-3.5 w-3.5 text-pink-400" />
                Thumbnail URL
              </label>
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={e => handleChange('thumbnail_url', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50"
              />
            </div>
          </div>

          {/* Rules */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              Rules & Guidelines
            </label>
            <textarea
              value={formData.rules}
              onChange={e => handleChange('rules', e.target.value)}
              placeholder="Enter event rules and guidelines"
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
              <Tag className="h-3.5 w-3.5 text-amber-400" />
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={e => handleChange('tags', e.target.value)}
              placeholder="fun, tournament, prizes"
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/50"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.1]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !formData.title}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-3 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
