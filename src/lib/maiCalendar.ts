import { supabase } from '@/lib/supabase';
import { hasRole, UserRole } from '@/lib/supabase';

export const MAI_CALENDAR_PATH = '/calendar';
export const MAI_CALENDAR_EVENT_PATH = (slug: string) => `/calendar/events/${slug}`;
export const MAI_OFFICIAL_EVENT_PATH = (slug: string) => `/events/${slug}`;

export const CALENDAR_STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.SECRETARY,
  UserRole.CEO_ASSISTANT,
  UserRole.NOAH_ASSISTANT,
];

export type CalendarVisibility = 'public' | 'draft';
export type CalendarStatus = 'upcoming' | 'live' | 'completed' | 'canceled';
export type CalendarView = 'month' | 'week' | 'upcoming';

export interface MaiCalendarEvent {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  banner_url?: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location?: string | null;
  stream_url?: string | null;
  stream_id?: string | null;
  status: CalendarStatus;
  visibility: CalendarVisibility;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  is_official?: boolean;
  agora_channel?: string | null;
  official_host_id?: string | null;
  live_started_at?: string | null;
  live_ended_at?: string | null;
  max_guest_slots?: number;
}

export interface CreateCalendarEventInput {
  title: string;
  description: string;
  category: string;
  banner_url?: string;
  starts_at: string; // ISO UTC
  ends_at: string; // ISO UTC
  timezone: string;
  location?: string;
  stream_url?: string;
  visibility: CalendarVisibility;
  is_official?: boolean;
}

export function isCalendarStaff(profile: any): boolean {
  if (!profile) return false;
  return hasRole(profile, CALENDAR_STAFF_ROLES, { allowAdminOverride: true });
}

export function isCalendarAdmin(profile: any): boolean {
  if (!profile) return false;
  return profile.is_admin === true ||
    hasRole(profile, [UserRole.ADMIN], { allowAdminOverride: true });
}

/** Detect the browser's IANA time zone (e.g. America/Chicago). */
export function detectTimeZone(): string {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return 'UTC';
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** Convert a local date/time in a given IANA zone to a UTC ISO string. */
export function localToUtcISO(
  dateStr: string, // 'YYYY-MM-DD'
  timeStr: string, // 'HH:MM'
  timeZone: string,
): string {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeParts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr);
  if (!dateParts || !timeParts) {
    throw new RangeError('Enter a valid event date and time');
  }

  const [, yearText, monthText, dayText] = dateParts;
  const [, hourText, minuteText] = timeParts;
  const expected = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  const wallClockAsUtc = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
  );
  const wallClock = new Date(wallClockAsUtc);
  if (
    wallClock.getUTCFullYear() !== expected.year ||
    wallClock.getUTCMonth() + 1 !== expected.month ||
    wallClock.getUTCDate() !== expected.day
  ) {
    throw new RangeError('Enter a valid event date');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const readParts = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const get = (name: string) => Number(parts.find((part) => part.type === name)?.value);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
    };
  };
  const represented = readParts(new Date(wallClockAsUtc));
  const representedAsUtc = Date.UTC(
    represented.year,
    represented.month - 1,
    represented.day,
    represented.hour,
    represented.minute,
  );
  const utc = new Date(wallClockAsUtc - (representedAsUtc - wallClockAsUtc));
  const roundTrip = readParts(utc);
  if (
    roundTrip.year !== expected.year ||
    roundTrip.month !== expected.month ||
    roundTrip.day !== expected.day ||
    roundTrip.hour !== expected.hour ||
    roundTrip.minute !== expected.minute
  ) {
    throw new RangeError('That local time does not exist in the selected time zone');
  }
  return utc.toISOString();
}

export function utcToLocalInput(utcISO: string, timeZone: string): {
  date: string;
  time: string;
} {
  const instant = new Date(utcISO);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Event time is invalid');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (name: string) => parts.find((part) => part.type === name)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  if (!year || !month || !day || !hour || minute === undefined) {
    throw new RangeError('Could not format the event time in the selected time zone');
  }
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

/** Format a UTC ISO instant for display in a target IANA zone. */
export function formatUtcInZone(utcISO: string, timeZone: string): {
  localISO: string;
  abbreviated: string;
  offset: string;
} {
  const d = new Date(utcISO);
  const dateTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);

  const abbrev = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || '';

  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || '';

  return { localISO: dateTime, abbreviated: abbrev, offset };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function statusLabel(status: CalendarStatus): string {
  switch (status) {
    case 'live': return '● LIVE';
    case 'upcoming': return 'Upcoming';
    case 'completed': return 'Completed';
    case 'canceled': return 'Canceled';
    default: return status;
  }
}

export async function fetchPublicEvents(): Promise<MaiCalendarEvent[]> {
  const { data, error } = await supabase
    .from('mai_calendar_events')
    .select('*')
    .eq('visibility', 'public')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data || []) as MaiCalendarEvent[];
}

export async function fetchStaffEvents(): Promise<MaiCalendarEvent[]> {
  const { data, error } = await supabase
    .from('mai_calendar_events')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data || []) as MaiCalendarEvent[];
}

export async function createCalendarEvent(input: CreateCalendarEventInput) {
  if (input.is_official) {
    const { data, error } = await supabase.functions.invoke('official-events', {
      body: {
        action: 'create',
        title: input.title,
        description: input.description,
        category: input.category,
        banner_url: input.banner_url,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        timezone: input.timezone,
        location: input.location,
      },
    });
    if (error) throw error;
    if (!data?.event) {
      throw new Error(data?.error || 'Failed to create official event');
    }
    return data.event as MaiCalendarEvent;
  }

  const slug = slugify(input.title) + '-' + crypto.randomUUID().slice(0, 6);
  const { data, error } = await supabase
    .from('mai_calendar_events')
    .insert({
      slug,
      title: input.title,
      description: input.description,
      category: input.category,
      banner_url: input.banner_url || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      timezone: input.timezone,
      location: input.location || null,
      stream_url: input.stream_url || null,
      visibility: input.visibility,
      status: 'upcoming',
      published_at: input.visibility === 'public' ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MaiCalendarEvent;
}

export async function updateCalendarEvent(
  id: string,
  input: Partial<CreateCalendarEventInput> & { status?: CalendarStatus; visibility?: CalendarVisibility },
  publishedAt?: string | null,
) {
  const updates: Partial<CreateCalendarEventInput> & {
    status?: CalendarStatus;
    updated_at: string;
    published_at?: string | null;
  } = { ...input, updated_at: new Date().toISOString() };
  if (updates.visibility === 'public' && publishedAt === null) {
    updates.published_at = new Date().toISOString();
  }
  if (updates.visibility === 'draft') {
    updates.published_at = null;
  }
  const { data, error } = await supabase
    .from('mai_calendar_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MaiCalendarEvent;
}

export async function cancelCalendarEvent(id: string) {
  const { data, error } = await supabase
    .from('mai_calendar_events')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MaiCalendarEvent;
}

export async function fetchEventBySlug(slug: string): Promise<MaiCalendarEvent | null> {
  const { data, error } = await supabase
    .from('mai_calendar_events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as MaiCalendarEvent | null;
}

export function googleCalendarUrl(event: MaiCalendarEvent): string {
  const start = new Date(event.starts_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(event.ends_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function appleCalendarUrl(event: MaiCalendarEvent): string {
  const start = new Date(event.starts_at).toISOString();
  const end = new Date(event.ends_at).toISOString();
  const params = new URLSearchParams({
    title: event.title,
    description: event.description || '',
    location: event.location || '',
    start: start,
    end: end,
  });
  return `https://www.apple.com/calendar/events/preview?${params.toString()}`;
}

export function generateICS(event: MaiCalendarEvent): string {
  const start = new Date(event.starts_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(event.ends_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `mai-calendar-${event.id}@maitroll.com`;
  const desc = (event.description || '').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MaiTroll//MaiCalendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${event.location || ''}`,
    `URL:${window.location.origin}${MAI_CALENDAR_EVENT_PATH(event.slug)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(event: MaiCalendarEvent) {
  const content = generateICS(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(event.title)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
