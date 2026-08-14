import { supabaseAdmin } from '../_shared/auth'
import { generateOGHTML, buildOGImageUrl } from '../_shared/og-html'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://www.maitroll.com'
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/images/mai-troll-preview.png`

export const runtime = 'edge'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const broadcastId = params.id
  
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(broadcastId);
  
  let stream: any = null
  let broadcaster: any = null
  
  try {
    if (isUUID) {
      const { data, error } = await supabaseAdmin
        .from('streams')
        .select('*, user_profiles!streams_broadcaster_id_fkey(username, avatar_url, thumbnail_url)')
        .eq('id', broadcastId)
        .maybeSingle();
      
      if (!error && data) {
        stream = data
        broadcaster = data.user_profiles
      }
    } else {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, avatar_url, thumbnail_url')
        .eq('username', broadcastId)
        .maybeSingle();
      
      if (!userError && userData) {
        const { data: streamData, error: streamError } = await supabaseAdmin
          .from('streams')
          .select('*, user_profiles!streams_broadcaster_id_fkey(username, avatar_url, thumbnail_url)')
          .eq('user_id', userData.id)
          .eq('is_live', true)
          .eq('status', 'live')
          .maybeSingle();
        
        if (!streamError && streamData) {
          stream = streamData
          broadcaster = streamData.user_profiles || userData
        }
      }
    }
    
    if (!stream) {
      return new Response(
        generateOGHTML({
          title: 'Stream Not Found',
          description: 'This broadcast is not available.',
          image: FALLBACK_PREVIEW_IMAGE,
          url: `${APP_URL}/watch/${broadcastId}`,
          type: 'website',
          isLive: false,
        }),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }
    
    const isLive = stream.status === 'live'
    const statusText = isLive ? 'LIVE' : 'Ended'
    const previewImage = stream.thumbnail_url || broadcaster?.thumbnail_url || broadcaster?.avatar_url || FALLBACK_PREVIEW_IMAGE
    const username = broadcaster?.username || null

    const streamUrl = username
      ? `${APP_URL}/live/${encodeURIComponent(username)}`
      : `${APP_URL}/watch/${stream.id}`

    // Use dynamic profile OG image for the broadcaster
    const ogImage = username
      ? buildOGImageUrl({ kind: 'profile', username })
      : previewImage

    return new Response(
      generateOGHTML({
        title: `${username || 'Broadcaster'} is ${statusText} on MaiTroll`,
        description: stream.title || 'Watch this live broadcast on MaiTroll',
        image: previewImage,
        ogImageUrl: ogImage,
        url: streamUrl,
        type: isLive ? 'video.other' : 'website',
        isLive,
        videoUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
        twitterCard: isLive ? 'player' : 'summary_large_image',
        twitterPlayerUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )

  } catch (error) {
    console.error('[Social] Error:', error)

    return new Response(
      generateOGHTML({
        title: 'MaiTroll - Live Streaming',
        description: 'Join MaiTroll for live streaming and more.',
        image: FALLBACK_PREVIEW_IMAGE,
        url: `${APP_URL}/watch/${broadcastId}`,
        type: 'website',
        isLive: false,
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}