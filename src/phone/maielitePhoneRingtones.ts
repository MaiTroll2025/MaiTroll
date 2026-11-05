import { supabase } from '@/lib/supabase'

export type PhoneRingtoneKind = 'text' | 'audio' | 'video'

export type PhoneRingtonePreferences = Record<PhoneRingtoneKind, string>

export type StoredPhoneRingtonePreferences = Partial<PhoneRingtonePreferences>

export const DEFAULT_PHONE_RINGTONES: PhoneRingtonePreferences = {
  text: '/sounds/calls/mai-text-chime.wav',
  audio: '/sounds/calls/mai-audio-ring.wav',
  video: '/sounds/calls/mai-video-ring.wav',
}

export const PHONE_RINGTONE_OPTIONS = [
  { label: 'Text Chime', value: '/sounds/calls/mai-text-chime.wav' },
  { label: 'Classic Ring', value: '/sounds/calls/mai-audio-ring.wav' },
  { label: 'Video Ring', value: '/sounds/calls/mai-video-ring.wav' },
] as const

const ringtoneFields: Record<PhoneRingtoneKind, string> = {
  text: 'text_ringtone',
  audio: 'audio_ringtone',
  video: 'video_ringtone',
}

const validRingtoneValues = new Set<string>(PHONE_RINGTONE_OPTIONS.map(({ value }) => value))
const playedMessageIds = new Set<string>()

export async function loadPhoneRingtonePreferences(userId: string): Promise<StoredPhoneRingtonePreferences> {
  const { data, error } = await supabase
    .from('maielite_phone_settings')
    .select('text_ringtone,audio_ringtone,video_ringtone')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[MaiElitePhone] Could not load ringtone preferences:', error)
    return {}
  }

  return {
    text: validRingtoneValues.has(data?.text_ringtone) ? data.text_ringtone : undefined,
    audio: validRingtoneValues.has(data?.audio_ringtone) ? data.audio_ringtone : undefined,
    video: validRingtoneValues.has(data?.video_ringtone) ? data.video_ringtone : undefined,
  }
}

export async function savePhoneRingtonePreference(
  userId: string,
  kind: PhoneRingtoneKind,
  ringtone: string,
) {
  if (!validRingtoneValues.has(ringtone)) {
    return new Error('Unsupported ringtone selection')
  }

  const { error } = await supabase
    .from('maielite_phone_settings')
    .upsert(
      { user_id: userId, [ringtoneFields[kind]]: ringtone, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  return error
}

export async function playTextMessageRingtone(userId: string, messageId: string): Promise<void> {
  const playedKey = `${userId}:${messageId}`
  if (playedMessageIds.has(playedKey)) return
  playedMessageIds.add(playedKey)
  if (playedMessageIds.size > 100) {
    const oldestKey = playedMessageIds.values().next().value
    if (oldestKey) playedMessageIds.delete(oldestKey)
  }

  const preferences = await loadPhoneRingtonePreferences(userId)
  const audio = new Audio(preferences.text || DEFAULT_PHONE_RINGTONES.text)
  try {
    await audio.play()
  } catch {
    // Browsers may block notification audio until the user interacts with the page.
  }
}
