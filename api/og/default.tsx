import { ImageResponse } from '@vercel/og'

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
  const title = url.searchParams.get('title') || 'Mai Troll'
  const subtitle = url.searchParams.get('subtitle') || 'Social Streaming Platform'

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
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f0a1e 0%, #1a1035 35%, #2d1b69 100%)',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at top left, rgba(147,51,234,0.35), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.25), transparent 30%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '48px',
            maxWidth: '1040px',
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px' }}>
            {title}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 400, color: '#cbd5e1', marginBottom: '16px' }}>
            {subtitle}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 400, color: '#94a3b8' }}>
            Live creators, communities, and streamers on Mai Troll.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: boldFont, weight: 700 },
        { name: 'Inter', data: regularFont, weight: 400 },
      ],
    }
  )
}
