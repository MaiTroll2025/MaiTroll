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
  const articleId = url.searchParams.get('id') || url.searchParams.get('articleId')
  const slug = url.searchParams.get('slug')

  if (!articleId && !slug) {
    return new Response('Missing article id or slug', { status: 400 })
  }

  try {
    let article: any = null

    if (articleId) {
      const { data, error } = await supabaseAdmin
        .from('tcnn_articles')
        .select('title, excerpt, featured_image_url, author_name, author_avatar, category, published_at, is_breaking')
        .eq('id', articleId)
        .eq('status', 'published')
        .maybeSingle()
      if (!error && data) article = data
    }

    if (!article && slug) {
      const { data, error } = await supabaseAdmin
        .from('tcnn_articles')
        .select('title, excerpt, featured_image_url, author_name, author_avatar, category, published_at, is_breaking')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()
      if (!error && data) article = data
    }

    if (!article) {
      return renderFallbackOG()
    }

    const title = article.title || 'TCNN Article'
    const categoryLabel = article.category ? article.category.toUpperCase() : 'NEWS'
    const imageUrl = article.featured_image_url || null

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
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #0c0a1a 0%, #151226 50%, #1a1035 100%)',
            fontFamily: 'Inter',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background glow */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '800px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(147,51,234,0.15) 0%, transparent 70%)',
            }}
          />

          {/* Featured image as background if available */}
          {imageUrl && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.25,
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}

          {/* Dark overlay for readability */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(12,10,26,0.7) 0%, rgba(12,10,26,0.85) 100%)',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'space-between',
              padding: '48px 56px',
              zIndex: 1,
            }}
          >
            {/* Top: Breaking badge + category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {article.is_breaking && (
                <div
                  style={{
                    background: '#ef4444',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>
                    BREAKING
                  </span>
                </div>
              )}
              <div
                style={{
                  background: 'rgba(147,51,234,0.25)',
                  border: '1px solid rgba(147,51,234,0.5)',
                  borderRadius: '4px',
                  padding: '4px 12px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#c084fc', letterSpacing: '1px' }}>
                  {categoryLabel}
                </span>
              </div>
            </div>

            {/* Middle: Title */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxWidth: '1000px',
              }}
            >
              <div
                style={{
                  fontSize: title.length > 60 ? '36px' : title.length > 35 ? '42px' : '50px',
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
              {article.excerpt && (
                <div
                  style={{
                    fontSize: '20px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {article.excerpt}
                </div>
              )}
            </div>

            {/* Bottom: TCNN branding + author */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* TCNN Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #9333ea, #db2777)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '22px', fontWeight: 700, color: 'white' }}>TC</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '22px', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>
                    TCNN
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>
                    Mai Troll NEWS NETWORK
                  </span>
                </div>
              </div>

              {/* Author */}
              {article.author_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {article.author_avatar ? (
                    <img
                      src={article.author_avatar}
                      width={32}
                      height={32}
                      style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(147,51,234,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: '#c084fc',
                        fontWeight: 600,
                      }}
                    >
                      {article.author_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>
                    {article.author_name}
                  </span>
                </div>
              )}
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
    console.error('[OG TCNN] Error:', err)
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
          background: 'linear-gradient(180deg, #0c0a1a 0%, #151226 50%, #1a1035 100%)',
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
          <span style={{ fontSize: '30px', fontWeight: 700, color: 'white' }}>TC</span>
        </div>
        <span style={{ fontSize: '36px', fontWeight: 700, color: 'white', letterSpacing: '3px' }}>
          TCNN
        </span>
        <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)' }}>
          Mai Troll News Network
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
