import { ImageResponse } from '@vercel/og'
import { supabaseAdmin } from '../_shared/auth'

export const runtime = 'edge'

async function fetchFont(weight: 'bold' | 'regular' | 'semibold' = 'bold'): Promise<ArrayBuffer> {
  const w = weight === 'bold' ? '700' : weight === 'semibold' ? '600' : '400'
  const url = `https://fonts.googleapis.com/css2?family=Inter:wght@${w}&display=swap`
  const cssRes = await fetch(url)
  const css = await cssRes.text()
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)
  if (!match) throw new Error('Font URL not found')
  const fontRes = await fetch(match[1])
  return fontRes.arrayBuffer()
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const courseId = url.searchParams.get('id') || url.searchParams.get('courseId')
  const slug = url.searchParams.get('slug')

  if (!courseId && !slug) {
    return new Response('Missing course id or slug', { status: 400 })
  }

  try {
    let course: any = null

    if (courseId) {
      const { data, error } = await supabaseAdmin
        .from('academy_courses')
        .select('title, short_description, cover_image_url, thumbnail_url, instructor_name, instructor_avatar, difficulty_level, duration_hours, category_name')
        .eq('id', courseId)
        .eq('status', 'published')
        .maybeSingle()
      if (!error && data) course = data
    }

    if (!course && slug) {
      const { data, error } = await supabaseAdmin
        .from('academy_courses')
        .select('title, short_description, cover_image_url, thumbnail_url, instructor_name, instructor_avatar, difficulty_level, duration_hours, category_name')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()
      if (!error && data) course = data
    }

    if (!course) {
      return renderFallbackOG()
    }

    const title = course.title || 'Academy Course'
    const imageUrl = course.cover_image_url || course.thumbnail_url || null
    const difficultyColors: Record<string, { bg: string; border: string; text: string }> = {
      beginner: { bg: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.5)', text: '#4ade80' },
      intermediate: { bg: 'rgba(234,179,8,0.2)', border: 'rgba(234,179,8,0.5)', text: '#facc15' },
      advanced: { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.5)', text: '#f87171' },
    }
    const diffColor = difficultyColors[course.difficulty_level] || difficultyColors.beginner

    const [boldFont, regularFont, semiboldFont] = await Promise.all([
      fetchFont('bold'),
      fetchFont('regular'),
      fetchFont('semibold'),
    ])

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            background: 'linear-gradient(135deg, #0a0a1a 0%, #12102a 50%, #1a1035 100%)',
            fontFamily: 'Inter',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Left side glow */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '30%',
              transform: 'translate(-50%, -50%)',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(147,51,234,0.2) 0%, transparent 70%)',
            }}
          />

          {/* Right side: Course image */}
          {imageUrl && (
            <div
              style={{
                width: '420px',
                height: '630px',
                flexShrink: 0,
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
              }}
            >
              {/* Gradient overlay on image */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, rgba(12,10,26,0.8) 0%, transparent 100%)',
                }}
              />
            </div>
          )}

          {/* Content area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              padding: imageUrl ? '48px 56px 48px 40px' : '48px 56px',
              zIndex: 1,
              gap: '20px',
            }}
          >
            {/* Academy badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #9333ea, #db2777)',
                  borderRadius: '6px',
                  padding: '5px 14px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', letterSpacing: '1.5px' }}>
                  Mai Troll ACADEMY
                </span>
              </div>
              {course.difficulty_level && (
                <div
                  style={{
                    background: diffColor.bg,
                    border: `1px solid ${diffColor.border}`,
                    borderRadius: '6px',
                    padding: '5px 14px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: diffColor.text, textTransform: 'capitalize' }}>
                    {course.difficulty_level}
                  </span>
                </div>
              )}
            </div>

            {/* Course title */}
            <div
              style={{
                fontSize: title.length > 50 ? '34px' : title.length > 30 ? '40px' : '46px',
                fontWeight: 700,
                color: 'white',
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>

            {/* Description */}
            {course.short_description && (
              <div
                style={{
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {course.short_description}
              </div>
            )}

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '4px' }}>
              {course.instructor_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {course.instructor_avatar ? (
                    <img
                      src={course.instructor_avatar}
                      width={28}
                      height={28}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(147,51,234,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        color: '#c084fc',
                        fontWeight: 600,
                      }}
                    >
                      {course.instructor_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)' }}>
                    {course.instructor_name}
                  </span>
                </div>
              )}
              {course.duration_hours && (
                <span style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)' }}>
                  {course.duration_hours}h course
                </span>
              )}
            </div>

            {/* Bottom branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: 'auto',
                paddingTop: '20px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #9333ea, #db2777)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '14px' }}>🎓</span>
              </div>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  background: 'linear-gradient(90deg, #9333ea, #db2777)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Mai Troll Academy
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
          { name: 'Inter', data: semiboldFont, weight: 600, style: 'normal' },
          { name: 'Inter', data: regularFont, weight: 400, style: 'normal' },
        ],
      }
    )
  } catch (err) {
    console.error('[OG Academy] Error:', err)
    return renderFallbackOG()
  }
}

function renderFallbackOG() {
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
          background: 'linear-gradient(135deg, #0a0a1a 0%, #12102a 50%, #1a1035 100%)',
          fontFamily: 'Inter',
          gap: '20px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #9333ea, #db2777)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '30px' }}>🎓</span>
        </div>
        <span style={{ fontSize: '32px', fontWeight: 700, color: 'white' }}>
          Mai Troll Academy
        </span>
        <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
          Learn. Grow. Earn.
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
