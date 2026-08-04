import { ImageResponse } from '@vercel/og'
import { supabaseAdmin } from '../_shared/auth'

export const runtime = 'edge'

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://maiMai Troll.com'

async function fetchFont(weight: 'bold' | 'regular' = 'bold'): Promise<ArrayBuffer> {
  const family = weight === 'bold' ? 'Inter:wght@700' : 'Inter:wght@400'
  const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  const cssRes = await fetch(url)
  const css = await cssRes.text()
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)
  if (!match) throw new Error('Font URL not found')
  const fontRes = await fetch(match[1])
  return fontRes.arrayBuffer()
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const username = url.searchParams.get('u') || url.searchParams.get('username')

  if (!username) {
    return new Response('Missing username', { status: 400 })
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('v_user_profiles_complete')
      .select(`
        id, username, display_name, avatar_url, cover_url, banner_url,
        level, role, is_admin, is_broadcaster, is_verified, bio,
        city, country, website, pronouns, theme_color, accent_color,
        total_broadcasts, total_podcasts, total_achievement,
        followers_count, following_count, created_at,
        xp, xp_to_next_level
      `)
      .eq('username', username)
      .maybeSingle()

    if (error || !profile) {
      return renderFallbackOG(username)
    }

    const { data: liveStream } = await supabaseAdmin
      .from('streams')
      .select('id, title')
      .eq('broadcaster_id', profile.id)
      .eq('is_live', true)
      .eq('status', 'live')
      .maybeSingle()

    const isLive = !!liveStream
    const displayName = profile.display_name || profile.username || username
    const level = profile.level || 1
    const avatarUrl = profile.avatar_url || null
    const coverUrl = profile.cover_url || profile.banner_url || null
    const themeColor = profile.theme_color || '#9333ea'
    const accentColor = profile.accent_color || '#22d3ee'
    const bio = profile.bio || ''
    const isVerified = profile.is_verified || false

    const [boldFont, regularFont] = await Promise.all([
      fetchFont('bold'),
      fetchFont('regular'),
    ])

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(135deg, #0f0a1e 0%, #1a1035 40%, #2d1b69 100%)`,
            fontFamily: 'Inter',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background decorative elements */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${themeColor}40 0%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '350px',
              height: '350px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`,
            }}
          />

          {/* Grid pattern overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Cover image background if available */}
          {coverUrl && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '200px',
                backgroundImage: `url(${coverUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.3,
              }}
            />
          )}

          {/* Main content card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              zIndex: 1,
              padding: '40px',
              marginTop: '20px',
            }}
          >
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                width={140}
                height={140}
                style={{
                  borderRadius: '50%',
                  border: `4px solid ${themeColor}`,
                  objectFit: 'cover',
                  boxShadow: `0 0 30px ${themeColor}60`,
                }}
              />
            ) : (
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${themeColor}, ${accentColor})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '56px',
                  fontWeight: 700,
                  color: 'white',
                  border: `4px solid ${themeColor}`,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Verified badge */}
            {isVerified && (
              <div
                style={{
                  position: 'absolute',
                  top: '170px',
                  right: 'calc(50% - 90px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#1DA1F2',
                  border: '3px solid #0f0a1e',
                }}
              >
                <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>✓</span>
              </div>
            )}

            {/* Name */}
            <div
              style={{
                fontSize: '42px',
                fontWeight: 700,
                color: 'white',
                textAlign: 'center',
                maxWidth: '800px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '10px',
              }}
            >
              {displayName}
            </div>

            {/* Username */}
            <div
              style={{
                fontSize: '24px',
                color: accentColor,
                fontWeight: 500,
              }}
            >
              @{profile.username || username}
            </div>

            {/* Bio preview */}
            {bio && (
              <div
                style={{
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.7)',
                  textAlign: 'center',
                  maxWidth: '600px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {bio.substring(0, 100)}{bio.length > 100 ? '...' : ''}
              </div>
            )}

            {/* Level + Stats row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '8px',
              }}
            >
              {/* Level badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: `${themeColor}30`,
                  border: `1px solid ${themeColor}60`,
                  borderRadius: '9999px',
                  padding: '8px 20px',
                }}
              >
                <span style={{ fontSize: '18px', color: accentColor, fontWeight: 700 }}>
                  Level {level}
                </span>
              </div>

              {/* Followers */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '9999px',
                  padding: '8px 20px',
                }}
              >
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
                  {(profile.followers_count || 0).toLocaleString()} Followers
                </span>
              </div>

              {/* Live badge */}
              {isLive && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.6)',
                    borderRadius: '9999px',
                    padding: '8px 20px',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#ef4444',
                    }}
                  />
                  <span style={{ fontSize: '16px', color: '#fca5a5', fontWeight: 700 }}>
                    Live Now
                  </span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                marginTop: '8px',
              }}
            >
              {profile.total_broadcasts > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>
                    {profile.total_broadcasts.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Broadcasts</span>
                </div>
              )}
              {profile.total_podcasts > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>
                    {profile.total_podcasts.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Podcasts</span>
                </div>
              )}
              {profile.total_achievements > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>
                    {profile.total_achievements.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Achievements</span>
                </div>
              )}
            </div>

            {/* Mai Troll branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '16px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, ${themeColor}, ${accentColor})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '18px' }}>TC</span>
              </div>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  background: `linear-gradient(90deg, ${themeColor}, ${accentColor})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Mai Troll
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Inter', data: boldFont, weight: 700, style: 'normal' },
          { name: 'Inter', data: regularFont, weight: 400, style: 'normal' },
        ],
      }
    )
  } catch (err) {
    console.error('[OG Profile] Error:', err)
    return renderFallbackOG(username)
  }
}

function renderFallbackOG(username: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1035 40%, #2d1b69 100%)',
          fontFamily: 'Inter',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '52px', fontWeight: 700, color: 'white' }}>@{username}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #9333ea, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '18px' }}>TC</span>
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 700,
              background: 'linear-gradient(90deg, #9333ea, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Mai Troll
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
