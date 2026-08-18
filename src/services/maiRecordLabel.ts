import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { createNotification } from '@/lib/notifications'

// ============================================================
// TYPES
// ============================================================

export type ApplicationStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'withdrawn'

export type ArtistStatus =
  | 'probation'
  | 'active'
  | 'suspended'
  | 'terminated'

export type ContractTier =
  | 'probation'
  | 'standard'
  | 'tier_90_10'
  | 'tier_95_5'

export type ContractStatus =
  | 'pending_signature'
  | 'active'
  | 'completed'
  | 'terminated'
  | 'superseded'

export type AlbumStatus =
  | 'draft'
  | 'published'
  | 'archived'

export type TrackStatus =
  | 'draft'
  | 'processing'
  | 'published'
  | 'rejected'
  | 'archived'

export type TransactionType =
  | 'artist_tip'
  | 'track_tip'
  | 'track_revenue'
  | 'album_revenue'
  | 'adjustment'
  | 'bonus'

export type TransactionStatus =
  | 'pending'
  | 'completed'
  | 'reversed'
  | 'failed'

// ============================================================
// APPLICATION
// ============================================================

export interface RecordLabelApplication {
  id: string
  user_id: string
  legal_name: string
  stage_name: string
  artist_bio?: string | null
  primary_genre: string
  additional_genres: string[]
  years_making_music?: number | null
  location?: string | null
  website_url?: string | null
  spotify_url?: string | null
  apple_music_url?: string | null
  soundcloud_url?: string | null
  youtube_url?: string | null
  other_links: any[]
  sample_track_urls: string[]
  why_join?: string | null
  confirms_original_music: boolean
  confirms_rights_control: boolean
  agreed_to_application_terms: boolean
  status: ApplicationStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  decline_reason?: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// ARTIST PROFILE
// ============================================================

export interface RecordLabelUserProfile {
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

export interface RecordLabelArtistProfile {
  id: string
  user_id: string
  application_id?: string | null
  stage_name: string
  bio?: string | null
  primary_genre?: string | null
  genres: string[]
  artist_image_url?: string | null
  verified: boolean
  status: ArtistStatus
  created_at: string
  updated_at: string
  user_profiles?: RecordLabelUserProfile | null
  track_count?: number
  total_plays?: number
}

// ============================================================
// CONTRACT
// ============================================================

export interface RecordLabelContract {
  id: string
  artist_id: string
  application_id?: string | null
  contract_number: string
  tier: ContractTier
  artist_split_bps: number
  label_split_bps: number
  effective_at: string
  probation_ends_at?: string | null
  expires_at?: string | null
  status: ContractStatus
  terms_version: string
  artist_signed_at?: string | null
  mai_accepted_at?: string | null
  created_by?: string | null
  terminated_at?: string | null
  termination_reason?: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// BALANCE
// ============================================================

export interface RecordLabelArtistBalance {
  artist_id: string
  available_coins: number
  pending_coins: number
  lifetime_artist_coins: number
  lifetime_gross_coins: number
  updated_at: string
}

// ============================================================
// ALBUM
// ============================================================

export interface RecordLabelAlbum {
  id: string
  artist_id: string
  title: string
  description?: string | null
  cover_url?: string | null
  status: AlbumStatus
  release_date?: string | null
  published_at?: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// TRACK
// ============================================================

export interface RecordLabelTrack {
  id: string
  artist_id: string
  album_id?: string | null
  title: string
  description?: string | null
  audio_url?: string | null
  cover_url?: string | null
  genre?: string | null
  duration_seconds?: number | null
  explicit: boolean
  status: TrackStatus
  like_count: number
  play_count: number
  tip_coins: number
  published_at?: string | null
  created_at: string
  updated_at: string
  user_id?: string | null
  artist?: RecordLabelArtistProfile | null
  album?: RecordLabelAlbum | null
}

// ============================================================
// TRACK LIKE
// ============================================================

export interface RecordLabelTrackLike {
  id: string
  track_id: string
  user_id: string
  created_at: string
}

// ============================================================
// TRANSACTION
// ============================================================

export interface RecordLabelTransaction {
  id: string
  artist_id: string
  track_id?: string | null
  album_id?: string | null
  contract_id?: string | null
  payer_user_id?: string | null
  transaction_type: TransactionType
  source_transaction_id?: string | null
  gross_coins: number
  artist_split_bps: number
  label_split_bps: number
  artist_coins: number
  label_coins: number
  cashout_eligible: boolean
  status: TransactionStatus
  metadata: Record<string, any>
  created_at: string
}

// ============================================================
// APPLICATION REVIEW
// ============================================================

export interface RecordLabelApplicationReview {
  id: string
  application_id: string
  reviewed_by: string
  decision: 'approved' | 'declined'
  review_notes?: string | null
  decline_reason?: string | null
  created_at: string
}

// ============================================================
// ARTIST DASHBOARD
// ============================================================

export interface ArtistDashboard {
  artist_id: string
  stats: {
    total_tracks: number
    total_albums: number
    total_likes: number
    total_plays: number
    total_tips: number
  }
  balance: {
    available_coins: number
    pending_coins: number
    lifetime_artist_coins: number
    lifetime_gross_coins: number
  }
  contract?: {
    id: string
    contract_number: string
    tier: ContractTier
    artist_split_bps: number
    label_split_bps: number
    status: ContractStatus
    effective_at: string
    probation_ends_at?: string | null
    terms_version: string
  }
}

// ============================================================
// HELPERS
// ============================================================

function getCurrentUserId(): string | null {
  const user = useAuthStore.getState().user
  return user?.id ?? null
}

function normalizeUserProfile(
  profile:
    | RecordLabelUserProfile
    | RecordLabelUserProfile[]
    | null
    | undefined,
): RecordLabelUserProfile | null {
  if (!profile) return null

  if (Array.isArray(profile)) {
    return profile[0] ?? null
  }

  return profile
}

function normalizeArtistProfile(
  artist: any,
): RecordLabelArtistProfile {
  return {
    ...artist,
    user_profiles: normalizeUserProfile(artist.user_profiles),
  }
}

// Notification type compatibility helper.
// The notification system should eventually add these values
// to NotificationType directly.
type NotificationTypeValue =
  Parameters<typeof createNotification>[1]

function staffNotificationType(
  type: string,
): NotificationTypeValue {
  return type as unknown as NotificationTypeValue
}

// ============================================================
// ARTIST DISCOVERY
// ============================================================

export async function getNewArtists(
  limit = 8,
): Promise<{
  data: RecordLabelArtistProfile[] | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_artist_profiles')
    .select(`
      id,
      user_id,
      application_id,
      stage_name,
      bio,
      primary_genre,
      genres,
      artist_image_url,
      verified,
      status,
      created_at,
      updated_at,
      user_profiles:user_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .in('status', ['probation', 'active'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return {
      data: null,
      error,
    }
  }

  const artistIds = data.map((artist) => artist.id)

  if (artistIds.length === 0) {
    return {
      data: [],
      error: null,
    }
  }

  const { data: trackStats, error: trackError } = await supabase
    .from('record_label_tracks')
    .select('artist_id, play_count, status')
    .in('artist_id', artistIds)
    .in('status', ['published', 'processing'])

  if (trackError) {
    return {
      data: null,
      error: trackError,
    }
  }

  const statsMap = new Map<
    string,
    {
      track_count: number
      total_plays: number
    }
  >()

  for (const track of trackStats ?? []) {
    const current =
      statsMap.get(track.artist_id) ?? {
        track_count: 0,
        total_plays: 0,
      }

    current.track_count += 1
    current.total_plays += track.play_count ?? 0

    statsMap.set(track.artist_id, current)
  }

  const enriched = data.map((artist) => ({
    ...normalizeArtistProfile(artist),
    ...(statsMap.get(artist.id) ?? {
      track_count: 0,
      total_plays: 0,
    }),
  }))

  return {
    data: enriched,
    error: null,
  }
}

export async function getTopLikedTracks(
  limit = 8,
): Promise<{
  data: RecordLabelTrack[] | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_tracks')
    .select(`
      id,
      artist_id,
      album_id,
      title,
      description,
      audio_url,
      cover_url,
      genre,
      duration_seconds,
      explicit,
      status,
      like_count,
      play_count,
      tip_coins,
      published_at,
      created_at,
      updated_at,
      artist:record_label_artist_profiles!inner (
        id,
        user_id,
        stage_name,
        bio,
        primary_genre,
        genres,
        artist_image_url,
        verified,
        status,
        created_at,
        updated_at
      )
    `)
    .eq('status', 'published')
    .order('like_count', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return {
      data: null,
      error,
    }
  }

  return {
    data: data.map((track: any) => ({
      ...track,
      artist: track.artist
        ? normalizeArtistProfile(track.artist)
        : null,
    })),
    error: null,
  }
}

// ============================================================
// APPLICATIONS
// ============================================================

export async function getMyApplication(
  userId: string,
): Promise<{
  data: RecordLabelApplication | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    data: data as RecordLabelApplication | null,
    error,
  }
}

export async function submitApplication(payload: {
  legal_name: string
  stage_name: string
  artist_bio?: string
  primary_genre: string
  additional_genres?: string[]
  years_making_music?: number
  location?: string
  website_url?: string
  spotify_url?: string
  apple_music_url?: string
  soundcloud_url?: string
  youtube_url?: string
  other_links?: any[]
  sample_track_urls?: string[]
  why_join?: string
  confirms_original_music: boolean
  confirms_rights_control: boolean
  agreed_to_application_terms: boolean
}): Promise<{
  data: RecordLabelApplication | null
  error: any
}> {
  const userId = getCurrentUserId()

  if (!userId) {
    return {
      data: null,
      error: new Error('Not authenticated'),
    }
  }

  const { data, error } = await supabase
    .from('record_label_applications')
    .insert({
      user_id: userId,
      legal_name: payload.legal_name,
      stage_name: payload.stage_name,
      artist_bio: payload.artist_bio,
      primary_genre: payload.primary_genre,
      additional_genres: payload.additional_genres ?? [],
      years_making_music: payload.years_making_music,
      location: payload.location,
      website_url: payload.website_url,
      spotify_url: payload.spotify_url,
      apple_music_url: payload.apple_music_url,
      soundcloud_url: payload.soundcloud_url,
      youtube_url: payload.youtube_url,
      other_links: payload.other_links ?? [],
      sample_track_urls: payload.sample_track_urls ?? [],
      why_join: payload.why_join,
      confirms_original_music:
        payload.confirms_original_music,
      confirms_rights_control:
        payload.confirms_rights_control,
      agreed_to_application_terms:
        payload.agreed_to_application_terms,
    })
    .select()
    .single()

  return {
    data: data as RecordLabelApplication | null,
    error,
  }
}

// ============================================================
// ARTIST PROFILES
// ============================================================

export async function getArtistProfileByUserId(
  userId: string,
): Promise<{
  data: RecordLabelArtistProfile | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_artist_profiles')
    .select(`
      id,
      user_id,
      application_id,
      stage_name,
      bio,
      primary_genre,
      genres,
      artist_image_url,
      verified,
      status,
      created_at,
      updated_at,
      user_profiles:user_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('user_id', userId)
    .maybeSingle()

  return {
    data: data
      ? normalizeArtistProfile(data)
      : null,
    error,
  }
}

export async function getArtistProfile(
  artistId: string,
): Promise<{
  data: RecordLabelArtistProfile | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_artist_profiles')
    .select(`
      id,
      user_id,
      application_id,
      stage_name,
      bio,
      primary_genre,
      genres,
      artist_image_url,
      verified,
      status,
      created_at,
      updated_at,
      user_profiles:user_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('id', artistId)
    .maybeSingle()

  return {
    data: data
      ? normalizeArtistProfile(data)
      : null,
    error,
  }
}

// ============================================================
// ALBUMS
// ============================================================

export async function getArtistAlbums(
  artistId: string,
): Promise<{
  data: RecordLabelAlbum[] | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_albums')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })

  return {
    data: data as RecordLabelAlbum[] | null,
    error,
  }
}

export async function createAlbum(payload: {
  artist_id: string
  title: string
  description?: string
  cover_url?: string
  status?: AlbumStatus
  release_date?: string
}): Promise<{
  data: RecordLabelAlbum | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_albums')
    .insert({
      artist_id: payload.artist_id,
      title: payload.title,
      description: payload.description,
      cover_url: payload.cover_url,
      status: payload.status ?? 'draft',
      release_date: payload.release_date,
    })
    .select()
    .single()

  return {
    data: data as RecordLabelAlbum | null,
    error,
  }
}

// ============================================================
// TRACKS
// ============================================================

export async function getArtistTracks(
  artistId: string,
): Promise<{
  data: RecordLabelTrack[] | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_tracks')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })

  return {
    data: data as RecordLabelTrack[] | null,
    error,
  }
}

export async function getTrack(
  trackId: string,
): Promise<{
  data: RecordLabelTrack | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_tracks')
    .select(`
      *,
      artist:record_label_artist_profiles (
        id,
        user_id,
        stage_name,
        bio,
        primary_genre,
        genres,
        artist_image_url,
        verified,
        status
      ),
      album:record_label_albums (
        id,
        title,
        cover_url,
        status
      )
    `)
    .eq('id', trackId)
    .maybeSingle()

  if (!data) {
    return {
      data: null,
      error,
    }
  }

  return {
    data: {
      ...data,
      artist: data.artist
        ? normalizeArtistProfile(data.artist)
        : null,
    } as RecordLabelTrack,
    error,
  }
}

export async function createTrack(payload: {
  artist_id: string
  album_id?: string | null
  title: string
  description?: string
  audio_url?: string
  cover_url?: string
  genre?: string
  duration_seconds?: number
  explicit?: boolean
  status?: TrackStatus
}): Promise<{
  data: RecordLabelTrack | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_tracks')
    .insert({
      artist_id: payload.artist_id,
      album_id: payload.album_id ?? null,
      title: payload.title,
      description: payload.description,
      audio_url: payload.audio_url,
      cover_url: payload.cover_url,
      genre: payload.genre,
      duration_seconds: payload.duration_seconds,
      explicit: payload.explicit ?? false,
      status: payload.status ?? 'draft',
    })
    .select()
    .single()

  return {
    data: data as RecordLabelTrack | null,
    error,
  }
}

export async function updateTrack(
  trackId: string,
  payload: Partial<RecordLabelTrack>,
): Promise<{
  data: RecordLabelTrack | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_tracks')
    .update(payload)
    .eq('id', trackId)
    .select()
    .single()

  return {
    data: data as RecordLabelTrack | null,
    error,
  }
}

export async function deleteTrack(
  trackId: string,
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('record_label_tracks')
    .delete()
    .eq('id', trackId)

  return { error }
}

export async function deleteAlbum(
  albumId: string,
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('record_label_albums')
    .delete()
    .eq('id', albumId)

  return { error }
}

// ============================================================
// LIKES
// ============================================================

export async function likeTrack(
  trackId: string,
): Promise<{ data: any; error: any }> {
  const { data: current, error: fetchError } =
    await supabase
      .from('record_label_tracks')
      .select('like_count')
      .eq('id', trackId)
      .single()

  if (fetchError || !current) {
    return {
      data: null,
      error: fetchError,
    }
  }

  const { data, error } = await supabase
    .from('record_label_tracks')
    .update({
      like_count: (current.like_count ?? 0) + 1,
    })
    .eq('id', trackId)
    .select()
    .single()

  return {
    data: data as RecordLabelTrack | null,
    error,
  }
}

export async function unlikeTrack(
  trackId: string,
): Promise<{ data: any; error: any }> {
  const { data: current, error: fetchError } =
    await supabase
      .from('record_label_tracks')
      .select('like_count')
      .eq('id', trackId)
      .single()

  if (fetchError || !current) {
    return {
      data: null,
      error: fetchError,
    }
  }

  const { data, error } = await supabase
    .from('record_label_tracks')
    .update({
      like_count: Math.max(
        (current.like_count ?? 0) - 1,
        0,
      ),
    })
    .eq('id', trackId)
    .select()
    .single()

  return {
    data,
    error,
  }
}

// ============================================================
// TIPS
// ============================================================

export async function tipArtist(params: {
  artistId: string
  grossCoins: number
  payerUserId: string
  trackId?: string
  albumId?: string
}): Promise<{
  data: any
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'tip_mai_artist',
    {
      p_artist_id: params.artistId,
      p_gross_coins: params.grossCoins,
      p_payer_user_id: params.payerUserId,
      p_track_id: params.trackId ?? null,
      p_album_id: params.albumId ?? null,
    },
  )

  return {
    data,
    error,
  }
}

// ============================================================
// ADMIN
// ============================================================

export async function getPendingApplicationCount(): Promise<{
  count: number | null
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'get_mai_pending_application_count',
  )

  return {
    count: data as number | null,
    error,
  }
}

export async function getApplications(
  filters?: {
    status?: ApplicationStatus
    limit?: number
  },
): Promise<{
  data: RecordLabelApplication[] | null
  error: any
}> {
  let query = supabase
    .from('record_label_applications')
    .select(`
      *,
      user_profiles:user_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  return {
    data: data as RecordLabelApplication[] | null,
    error,
  }
}

export async function getApplicationDetails(
  applicationId: string,
): Promise<{
  data: RecordLabelApplication | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_applications')
    .select(`
      *,
      user_profiles:user_id (
        username,
        display_name,
        avatar_url,
        email
      )
    `)
    .eq('id', applicationId)
    .maybeSingle()

  return {
    data: data as RecordLabelApplication | null,
    error,
  }
}

export async function approveApplication(
  applicationId: string,
  reviewedBy: string,
): Promise<{
  data: any
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'approve_mai_application',
    {
      p_application_id: applicationId,
      p_reviewed_by: reviewedBy,
    },
  )

  return { data, error }
}

export async function declineApplication(
  applicationId: string,
  reviewedBy: string,
  declineReason?: string,
  reviewNotes?: string,
): Promise<{
  data: any
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'decline_mai_application',
    {
      p_application_id: applicationId,
      p_reviewed_by: reviewedBy,
      p_decline_reason: declineReason ?? null,
      p_review_notes: reviewNotes ?? null,
    },
  )

  return { data, error }
}

// ============================================================
// CONTRACTS
// ============================================================

export async function getArtistContract(
  artistId: string,
): Promise<{
  data: RecordLabelContract | null
  error: any
}> {
  const { data, error } = await supabase
    .from('record_label_contracts')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    data: data as RecordLabelContract | null,
    error,
  }
}

export async function acceptContract(
  contractId: string,
): Promise<{
  data: RecordLabelContract | null
  error: any
}> {
  const userId = getCurrentUserId()

  if (!userId) {
    return {
      data: null,
      error: new Error('Not authenticated'),
    }
  }

  const { data, error } = await supabase
    .from('record_label_contracts')
    .update({
      status: 'active',
      artist_signed_at: new Date().toISOString(),
    })
    .eq('id', contractId)
    .select()
    .single()

  return {
    data: data as RecordLabelContract | null,
    error,
  }
}

// ============================================================
// ARTIST DASHBOARD
// ============================================================

export async function getArtistDashboard(
  userId: string,
): Promise<{
  data: ArtistDashboard | null
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'get_mai_artist_dashboard',
    {
      p_user_id: userId,
    },
  )

  if (error) {
    return {
      data: null,
      error,
    }
  }

  return {
    data: data as ArtistDashboard | null,
    error: null,
  }
}

// ============================================================
// TRACK PLAY
// ============================================================

export async function incrementTrackPlay(
  trackId: string,
): Promise<{
  data: any
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'increment_mai_track_play',
    {
      p_track_id: trackId,
    },
  )

  return {
    data,
    error,
  }
}

// ============================================================
// ADMIN STATS
// ============================================================

export async function getAdminMaiStats(): Promise<{
  data: any
  error: any
}> {
  const [
    pendingAppsRes,
    activeArtistsRes,
    probationArtistsRes,
    totalAlbumsRes,
    totalTracksRes,
    totalPlaysRes,
    totalLikesRes,
    totalTipsRes,
  ] = await Promise.all([
    supabase
      .from('record_label_applications')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'pending'),

    supabase
      .from('record_label_artist_profiles')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'active'),

    supabase
      .from('record_label_artist_profiles')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'probation'),

    supabase
      .from('record_label_albums')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'published'),

    supabase
      .from('record_label_tracks')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .in('status', ['published', 'processing']),

    supabase
      .from('record_label_tracks')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .in('status', ['published', 'processing'])
      .neq('play_count', 0),

    supabase
      .from('record_label_tracks')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .in('status', ['published', 'processing'])
      .neq('like_count', 0),

    supabase
      .from('record_label_tracks')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .in('status', ['published', 'processing'])
      .neq('tip_coins', 0),
  ])

  return {
    data: {
      pending_applications:
        pendingAppsRes.count ?? 0,
      active_artists:
        activeArtistsRes.count ?? 0,
      probation_artists:
        probationArtistsRes.count ?? 0,
      total_albums:
        totalAlbumsRes.count ?? 0,
      total_tracks:
        totalTracksRes.count ?? 0,
      total_plays:
        totalPlaysRes.count ?? 0,
      total_likes:
        totalLikesRes.count ?? 0,
      total_tips:
        totalTipsRes.count ?? 0,
    },
    error: null,
  }
}

// ============================================================
// ARTIST STAFF / ARTIST MANAGEMENT
// ============================================================

export interface ArtistStaffSearchResult {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
}

export interface ArtistStaffMembershipResult {
  id: string
  artist_id: string
  employee_user_id: string
  position: string
  status: string
  pay_type: string
  pay_amount: number
  pay_currency: string
  pay_frequency: string
  permissions: Record<string, boolean>
  start_date: string | null
  end_date: string | null
  offered_at: string
  accepted_at: string | null
  declined_at: string | null
  terminated_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  termination_reason: string | null
  notes: string | null
  employee_username?: string
  employee_display_name?: string
  employee_avatar_url?: string | null
}

export interface ArtistStaffDashboardResult {
  active_count: number
  pending_count: number
  suspended_count: number
  monthly_cost: number
  active_positions: string[]
}

export interface ArtistStaffPaymentResult {
  id: string
  membership_id: string
  employee_user_id: string
  amount: number
  currency: string
  status: string
  payment_type: string | null
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  created_at: string
  notes: string | null
  employee_username?: string
  employee_display_name?: string
  position?: string
}

// ============================================================
// GET ARTIST ID
// ============================================================

export async function getArtistIdFromUser(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('record_label_artist_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.id
}

// ============================================================
// SEARCH STAFF CANDIDATES
// ============================================================

export async function searchArtistStaffCandidates(
  params: {
    artistId: string
    search: string
    limit?: number
  },
): Promise<{
  data: ArtistStaffSearchResult[] | null
  error: any
}> {
  const {
    artistId,
    search,
    limit = 20,
  } = params

  const artistUserResult = await supabase
    .from('record_label_artist_profiles')
    .select('user_id')
    .eq('id', artistId)
    .single()

  if (
    artistUserResult.error ||
    !artistUserResult.data
  ) {
    return {
      data: null,
      error:
        artistUserResult.error ??
        new Error('Artist not found'),
    }
  }

  const { data, error } = await supabase.rpc(
    'search_artist_staff_candidates',
    {
      p_artist_id: artistId,
      p_search: search,
      p_limit: limit,
    },
  )

  return {
    data: data as ArtistStaffSearchResult[] | null,
    error,
  }
}

// ============================================================
// CREATE STAFF OFFER
// ============================================================

export async function createArtistStaffOffer(
  params: {
    artistId: string
    employeeUserId: string
    position: string
    payType: string
    payAmount: number
    payFrequency: string
    permissions: Record<string, boolean>
    startDate?: string | null
    notes?: string
  },
): Promise<{
  data: string | null
  error: any
}> {
  const {
    artistId,
    employeeUserId,
    position,
    payType,
    payAmount,
    payFrequency,
    permissions,
    startDate,
    notes,
  } = params

  const { data, error } = await supabase.rpc(
    'create_artist_staff_offer',
    {
      p_artist_id: artistId,
      p_employee_user_id: employeeUserId,
      p_position: position,
      p_pay_type: payType,
      p_pay_amount: payAmount,
      p_pay_frequency: payFrequency,
      p_permissions: permissions,
      p_start_date: startDate ?? null,
      p_notes: notes ?? null,
    },
  )

  if (error) {
    return {
      data: null,
      error,
    }
  }

  const membershipId = data as string

  const artistResult = await supabase
    .from('record_label_artist_profiles')
    .select('stage_name, user_id')
    .eq('id', artistId)
    .single()

  if (
    !artistResult.error &&
    artistResult.data
  ) {
    const artistStageName =
      artistResult.data.stage_name

    const artistUserId =
      artistResult.data.user_id

    const employeeResult = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('id', employeeUserId)
      .single()

    const employeeName =
      employeeResult.data?.display_name ??
      employeeResult.data?.username ??
      'A user'

    void createNotification(
      employeeUserId,
      staffNotificationType('artist_staff_offer'),
      'Artist Staff Offer',
      `${artistStageName} has offered you a position as ${position}.`,
      {
        action_url: '/artist/staff',
        actor_id: artistUserId,
        actor_username: artistStageName,
        membership_id: membershipId,
      },
    ).catch(() => {})

    void createNotification(
      artistUserId,
      staffNotificationType('artist_staff_offer_sent'),
      'Staff Offer Sent',
      `${employeeName} has been offered a ${position} position.`,
      {
        action_url: '/artist/dashboard/staff',
        membership_id: membershipId,
      },
    ).catch(() => {})
  }

  return {
    data: membershipId,
    error: null,
  }
}

// ============================================================
// RESPOND TO STAFF OFFER
// ============================================================

export async function respondToArtistStaffOffer(
  params: {
    membershipId: string
    accept: boolean
  },
): Promise<{ error: any }> {
  const {
    membershipId,
    accept,
  } = params

  const { error } = await supabase.rpc(
    'respond_to_artist_staff_offer',
    {
      p_membership_id: membershipId,
      p_accept: accept,
    },
  )

  if (error) {
    return { error }
  }

  const membershipResult = await supabase
    .from('artist_staff_memberships')
    .select(
      'artist_id, employee_user_id, position',
    )
    .eq('id', membershipId)
    .single()

  if (
    !membershipResult.error &&
    membershipResult.data
  ) {
    const {
      artist_id,
      employee_user_id,
      position,
    } = membershipResult.data

    const artistResult = await supabase
      .from('record_label_artist_profiles')
      .select('user_id, stage_name')
      .eq('id', artist_id)
      .single()

    const employeeResult = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('id', employee_user_id)
      .single()

    if (
      !artistResult.error &&
      artistResult.data
    ) {
      const employeeName =
        employeeResult.data?.display_name ??
        employeeResult.data?.username ??
        'A user'

      const message = accept
        ? `${employeeName} accepted your ${position} offer.`
        : `${employeeName} declined your ${position} offer.`

      const type = accept
        ? 'artist_staff_offer_accepted'
        : 'artist_staff_offer_declined'

      void createNotification(
        artistResult.data.user_id,
        staffNotificationType(type),
        accept
          ? 'Offer Accepted'
          : 'Offer Declined',
        message,
        {
          action_url:
            '/artist/dashboard/staff',
          membership_id: membershipId,
        },
      ).catch(() => {})
    }
  }

  return {
    error: null,
  }
}

// ============================================================
// UPDATE STAFF MEMBER
// ============================================================

export async function updateArtistStaffMember(
  params: {
    membershipId: string
    position?: string
    payType?: string
    payAmount?: number
    payFrequency?: string
    permissions?: Record<string, boolean>
    notes?: string
  },
): Promise<{ error: any }> {
  const {
    membershipId,
    position,
    payType,
    payAmount,
    payFrequency,
    permissions,
    notes,
  } = params

  const { error } = await supabase.rpc(
    'update_artist_staff_member',
    {
      p_membership_id: membershipId,
      p_position: position ?? null,
      p_pay_type: payType ?? null,
      p_pay_amount: payAmount ?? null,
      p_pay_frequency: payFrequency ?? null,
      p_permissions: permissions ?? null,
      p_notes: notes ?? null,
    },
  )

  return { error }
}

// ============================================================
// SUSPEND STAFF MEMBER
// ============================================================

export async function suspendArtistStaffMember(
  params: {
    membershipId: string
    reason?: string
  },
): Promise<{ error: any }> {
  const {
    membershipId,
    reason,
  } = params

  const { error } = await supabase.rpc(
    'suspend_artist_staff_member',
    {
      p_membership_id: membershipId,
      p_reason: reason ?? null,
    },
  )

  if (error) {
    return { error }
  }

  const membershipResult = await supabase
    .from('artist_staff_memberships')
    .select(
      'employee_user_id, position',
    )
    .eq('id', membershipId)
    .single()

  if (
    !membershipResult.error &&
    membershipResult.data
  ) {
    void createNotification(
      membershipResult.data.employee_user_id,
      staffNotificationType(
        'artist_staff_suspended',
      ),
      'Staff Status Changed',
      `Your ${membershipResult.data.position} position has been suspended.`,
      {
        action_url: '/artist/staff',
        membership_id: membershipId,
      },
    ).catch(() => {})
  }

  return {
    error: null,
  }
}

// ============================================================
// TERMINATE STAFF MEMBER
// ============================================================

export async function terminateArtistStaffMember(
  params: {
    membershipId: string
    reason?: string
  },
): Promise<{ error: any }> {
  const {
    membershipId,
    reason,
  } = params

  const { error } = await supabase.rpc(
    'terminate_artist_staff_member',
    {
      p_membership_id: membershipId,
      p_reason: reason ?? null,
    },
  )

  if (error) {
    return { error }
  }

  const membershipResult = await supabase
    .from('artist_staff_memberships')
    .select(
      'employee_user_id, position',
    )
    .eq('id', membershipId)
    .single()

  if (
    !membershipResult.error &&
    membershipResult.data
  ) {
    void createNotification(
      membershipResult.data.employee_user_id,
      staffNotificationType(
        'artist_staff_terminated',
      ),
      'Employment Terminated',
      `Your ${membershipResult.data.position} position has been terminated.`,
      {
        action_url: '/artist/staff',
        membership_id: membershipId,
      },
    ).catch(() => {})
  }

  return {
    error: null,
  }
}

// ============================================================
// REACTIVATE STAFF MEMBER
// ============================================================

export async function reactivateArtistStaffMember(
  params: {
    membershipId: string
  },
): Promise<{ error: any }> {
  const { membershipId } = params

  const { error } = await supabase.rpc(
    'reactivate_artist_staff_member',
    {
      p_membership_id: membershipId,
    },
  )

  return { error }
}

// ============================================================
// GET ARTIST STAFF
// ============================================================

export async function getArtistStaff(
  params: {
    artistId: string
  },
): Promise<{
  data: ArtistStaffMembershipResult[] | null
  error: any
}> {
  const { artistId } = params

  const { data, error } = await supabase.rpc(
    'get_artist_staff',
    {
      p_artist_id: artistId,
    },
  )

  return {
    data:
      data as ArtistStaffMembershipResult[] | null,
    error,
  }
}

// ============================================================
// GET MY STAFF JOBS
// ============================================================

export async function getMyArtistStaffJobs(): Promise<{
  data: any[] | null
  error: any
}> {
  const { data, error } = await supabase.rpc(
    'get_my_artist_staff_jobs',
  )

  return {
    data: data as any[] | null,
    error,
  }
}

// ============================================================
// STAFF DASHBOARD
// ============================================================

export async function getArtistStaffDashboard(
  params: {
    artistId: string
  },
): Promise<{
  data: ArtistStaffDashboardResult | null
  error: any
}> {
  const { artistId } = params

  const { data, error } = await supabase.rpc(
    'get_artist_staff_dashboard',
    {
      p_artist_id: artistId,
    },
  )

  if (error) {
    return {
      data: null,
      error,
    }
  }

  return {
    data:
      data as ArtistStaffDashboardResult | null,
    error: null,
  }
}

// ============================================================
// STAFF PAYMENTS
// ============================================================

export async function getArtistStaffPayments(
  params: {
    artistId: string
  },
): Promise<{
  data: ArtistStaffPaymentResult[] | null
  error: any
}> {
  const { artistId } = params

  const { data, error } = await supabase.rpc(
    'get_artist_staff_payments',
    {
      p_artist_id: artistId,
    },
  )

  return {
    data:
      data as ArtistStaffPaymentResult[] | null,
    error,
  }
}