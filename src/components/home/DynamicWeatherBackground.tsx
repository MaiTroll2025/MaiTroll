import { useEffect, useRef, useState, useMemo } from 'react'
import { fetchUserWeather, getSkyColors, type WeatherData } from '@/lib/weatherService'

/* ----------------------------------------------------------------
   Helpers
---------------------------------------------------------------- */

function getMoonPhase(date: Date): { phase: string; illumination: number } {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z')
  const synodicMonth = 29.53058867
  const diff = date.getTime() - knownNewMoon.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  const phase = ((days % synodicMonth) + synodicMonth) % synodicMonth
  const illumination = 0.5 * (1 - Math.cos((2 * Math.PI * phase) / synodicMonth))
  let phaseName = 'new'
  if (phase < 1.0) phaseName = 'new'
  else if (phase < 7.4) phaseName = 'waxing-crescent'
  else if (phase < 8.4) phaseName = 'first-quarter'
  else if (phase < 13.8) phaseName = 'waxing-gibbous'
  else if (phase < 15.8) phaseName = 'full'
  else if (phase < 22.2) phaseName = 'waning-gibbous'
  else if (phase < 23.2) phaseName = 'last-quarter'
  else if (phase < 28.5) phaseName = 'waning-crescent'
  else phaseName = 'new'
  return { phase: phaseName, illumination: Math.round(illumination * 100) }
}

function getSunPosition(time: WeatherData['time']): { x: number; y: number; opacity: number } {
  if (time === 'day') return { x: 15, y: 12, opacity: 0.9 }
  if (time === 'sunrise') return { x: 78, y: 22, opacity: 0.75 }
  if (time === 'sunset') return { x: 78, y: 22, opacity: 0.75 }
  return { x: 0, y: 0, opacity: 0 }
}

/* ----------------------------------------------------------------
   City skyline
---------------------------------------------------------------- */

interface Building {
  x: number
  width: number
  height: number
  windows: { lit: boolean; person: boolean; flicker: number }[]
}

function generateBuildings(count: number, canvasWidth: number, groundY: number): Building[] {
  const buildings: Building[] = []
  const segmentWidth = canvasWidth / count
  for (let i = 0; i < count; i++) {
    const width = segmentWidth * (0.6 + Math.random() * 0.35)
    const height = 100 + Math.random() * 220
    const cols = Math.max(1, Math.floor(width / 20))
    const rows = Math.max(1, Math.floor(height / 24))
    const windows = Array.from({ length: cols * rows }, () => ({
      lit: false,
      person: Math.random() < 0.3,
      flicker: Math.random() < 0.15 ? Math.random() * 0.4 : 0,
    }))
    buildings.push({
      x: i * segmentWidth + (segmentWidth - width) / 2,
      width,
      height,
      windows,
    })
  }
  return buildings
}

function drawCity(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  groundY: number,
  isNight: boolean,
  time: number
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const b of buildings) {
    const top = groundY - b.height
    ctx.fillStyle = 'rgba(30,40,70,0.95)'
    ctx.fillRect(b.x, top, b.width, b.height)
    ctx.strokeStyle = 'rgba(100,120,180,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(b.x, top, b.width, b.height)

    const cols = Math.max(1, Math.floor(b.width / 20))
    const rows = Math.max(1, Math.floor(b.height / 24))
    const winW = 10
    const winH = 14
    const gapX = (b.width - cols * winW) / (cols + 1)
    const gapY = (b.height - rows * winH) / (rows + 1)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const wx = b.x + gapX + c * (winW + gapX)
        const wy = top + gapY + r * (winH + gapY)
        const win = b.windows[idx]

        if (isNight) {
          if (win.lit) {
            const flicker = Math.max(0, 1 - (time % (3 + idx * 0.1)) * win.flicker)
            const alpha = 0.8 + Math.sin(time * 0.5 + idx) * 0.2
            ctx.fillStyle = `rgba(255,220,100,${Math.max(0.35, alpha * flicker)})`
            ctx.shadowColor = 'rgba(255,200,60,0.8)'
            ctx.shadowBlur = 8
            ctx.fillRect(wx, wy, winW, winH)
            ctx.shadowBlur = 0

            if (win.person) {
              ctx.fillStyle = 'rgba(5,5,15,0.9)'
              const move = Math.sin(time * 1.5 + idx) * 2.5
              ctx.fillRect(wx + 2 + move, wy + 3, 3, 3)
              ctx.fillRect(wx + 1 + move, wy + 6, 5, 2)
            }
          } else {
            ctx.fillStyle = 'rgba(12,18,35,0.75)'
            ctx.fillRect(wx, wy, winW, winH)
          }
        } else {
          ctx.fillStyle = 'rgba(20,30,55,0.55)'
          ctx.fillRect(wx, wy, winW, winH)
        }
      }
    }
  }
}

/* ----------------------------------------------------------------
   Dynamic weather background
---------------------------------------------------------------- */

export default function DynamicWeatherBackground() {
  const cityCanvasRef = useRef<HTMLCanvasElement>(null)
  const precipCanvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [mounted, setMounted] = useState(false)
  const buildingsRef = useRef<Building[]>([])

  useEffect(() => {
    setMounted(true)
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchUserWeather()
        if (!cancelled) setWeather(data)
      } catch {
        const hour = new Date().getHours()
        let time: WeatherData['time'] = 'day'
        if (hour >= 20 || hour < 6) time = 'night'
        else if (hour >= 6 && hour < 8) time = 'sunrise'
        else if (hour >= 18 && hour < 20) time = 'sunset'
        if (!cancelled) setWeather({ condition: 'clear', temperature: 72, windSpeed: 5, time, location: 'Default Location' })
      }
    })()
    return () => { cancelled = true }
  }, [])

  const skyColors = useMemo(() => weather ? getSkyColors(weather) : null, [weather])
  const moonInfo = useMemo(() => getMoonPhase(new Date()), [mounted])
  const sunPos = useMemo(() => weather ? getSunPosition(weather.time) : null, [weather])

  /* ---------- Canvas animation: rain/snow + city ---------- */
  useEffect(() => {
    const cityCanvas = cityCanvasRef.current
    const precipCanvas = precipCanvasRef.current
    if (!cityCanvas || !precipCanvas) return
    const cityCtx = cityCanvas.getContext('2d')
    const precipCtx = precipCanvas.getContext('2d')
    if (!cityCtx || !precipCtx) return

    const resize = () => {
      const w = window.innerWidth
      const cityWrapper = cityCanvasRef.current?.parentElement
      const rect = cityWrapper?.getBoundingClientRect()
      const cityH = rect?.height ?? 420
      cityCanvas.width = w
      cityCanvas.height = cityH
      precipCanvas.width = w
      precipCanvas.height = window.innerHeight
      const groundY = cityCanvas.height - 80
      buildingsRef.current = generateBuildings(32, cityCanvas.width, groundY)
    }
    resize()
    window.addEventListener('resize', resize)

    const isPrecip = weather?.condition === 'rain' || weather?.condition === 'storm'
    const isSnow = weather?.condition === 'snow'
    const isNight = weather?.time === 'night'

    const precipCount = isSnow ? 180 : 260
    const precipParticles = Array.from({ length: precipCount }, () => ({
      x: Math.random() * precipCanvas.width,
      y: Math.random() * precipCanvas.height,
      speed: isSnow ? 0.4 + Math.random() * 1.2 : 6 + Math.random() * 10,
      length: isSnow ? 2 + Math.random() * 3 : 10 + Math.random() * 16,
      opacity: 0.15 + Math.random() * 0.45,
      wind: (Math.random() - 0.5) * 0.6,
    }))

    let raf: number
    let time = 0
    const draw = () => {
      time += 0.016
      cityCtx.clearRect(0, 0, cityCanvas.width, cityCanvas.height)
      precipCtx.clearRect(0, 0, precipCanvas.width, precipCanvas.height)

      /* Precipitation */
      if (isPrecip || isSnow) {
        for (const p of precipParticles) {
          precipCtx.beginPath()
          if (isSnow) {
            precipCtx.fillStyle = `rgba(255,255,255,${p.opacity})`
            precipCtx.arc(p.x, p.y, p.length * 0.5, 0, Math.PI * 2)
            precipCtx.fill()
          } else {
            const grad = precipCtx.createLinearGradient(p.x, p.y, p.x + p.wind * 2, p.y + p.length)
            grad.addColorStop(0, 'rgba(173,216,230,0)')
            grad.addColorStop(1, `rgba(173,216,230,${p.opacity})`)
            precipCtx.strokeStyle = grad
            precipCtx.lineWidth = 1.2
            precipCtx.moveTo(p.x, p.y)
            precipCtx.lineTo(p.x + p.wind * 2, p.y + p.length)
            precipCtx.stroke()
          }
          p.y += p.speed
          p.x += p.wind
          if (p.y > precipCanvas.height) { p.y = -p.length; p.x = Math.random() * precipCanvas.width }
          if (p.x > precipCanvas.width) p.x = 0
          if (p.x < 0) p.x = precipCanvas.width
        }
      }

      /* City */
      const groundY = cityCanvas.height - 80
      drawCity(cityCtx, buildingsRef.current, groundY, isNight, time)

      /* Randomly toggle lights at night */
      if (isNight && Math.random() < 0.03) {
        const allWindows = buildingsRef.current.flatMap(b => b.windows)
        const idx = Math.floor(Math.random() * allWindows.length)
        const target = allWindows[idx]
        if (target) {
          target.lit = !target.lit
          if (target.lit) target.flicker = Math.random() < 0.15 ? Math.random() * 0.4 : 0
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [weather?.condition, weather?.time])

  /* ---------- Sky CSS ---------- */
  const skyStyle = skyColors
    ? { background: `linear-gradient(to bottom, ${skyColors.top} 0%, ${skyColors.bottom} 100%)` }
    : { background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)' }

  /* ---------- Moon ---------- */
  const isNight = weather?.time === 'night'

  return (
    <div ref={backgroundRef} className="pointer-events-none fixed inset-0" style={skyStyle}>
      {/* Stars at night */}
      {isNight && (
        <div className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 40% 70%, white, transparent), radial-gradient(1px 1px at 60% 20%, white, transparent), radial-gradient(1px 1px at 80% 50%, white, transparent), radial-gradient(1px 1px at 10% 80%, white, transparent), radial-gradient(1px 1px at 70% 90%, white, transparent), radial-gradient(1px 1px at 90% 10%, white, transparent), radial-gradient(1px 1px at 50% 50%, white, transparent)',
            backgroundSize: '250px 250px',
          }}
        />
      )}

      {/* Sun */}
      {weather && sunPos && sunPos.opacity > 0 && (
        <div
          className="absolute rounded-full"
          style={{
            top: `${sunPos.y}%`,
            left: `${sunPos.x}%`,
            width: 100,
            height: 100,
            background: 'radial-gradient(circle, rgba(255,236,179,0.95) 0%, rgba(255,200,50,0.6) 40%, rgba(255,140,0,0) 70%)',
            opacity: sunPos.opacity,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 80px rgba(255,200,50,0.5), 0 0 160px rgba(255,140,0,0.25)',
            zIndex: 1,
          }}
        />
      )}

      {/* Moon */}
      {isNight && (
        <div
          className="absolute rounded-full"
          style={{
            top: '10%',
            right: '12%',
            width: 80,
            height: 80,
            background: 'radial-gradient(circle at 30% 30%, #fefefe, #d4d4d4)',
            opacity: 0.9,
            boxShadow: '0 0 50px rgba(200,210,255,0.4), 0 0 100px rgba(150,170,255,0.2)',
            zIndex: 1,
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `inset ${moonInfo.illumination > 50 ? '-' : ''}${Math.abs(moonInfo.illumination - 50) * 0.8}px 0 0 rgba(10,15,30,0.85)`,
            }}
          />
        </div>
      )}

      {/* City wrapper - fixed at bottom of viewport, visible behind content */}
      <div className="absolute inset-x-0 bottom-0 z-[2] h-[420px]">
        <canvas
          ref={cityCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: 'none' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background: 'linear-gradient(to top, rgba(10,15,30,0.95), transparent)',
          }}
        />
      </div>

      {/* Precipitation canvas */}
      <canvas
        ref={precipCanvasRef}
        className="absolute inset-0 z-[4]"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  )
}
