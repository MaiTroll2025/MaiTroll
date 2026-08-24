import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchUserWeather, getSkyColors, type WeatherData } from '@/lib/weatherService'

/* ----------------------------------------------------------------
   Street dimensions (shared between city + street rendering)
  ---------------------------------------------------------------- */
const SIDEWALK_HEIGHT = 20
const CURB_HEIGHT = 40

export interface BuildingMeta {
  label: string
  to: string
}

const DEFAULT_BUILDINGS: BuildingMeta[] = [
  { label: 'Home', to: '/home' },
  { label: 'Chats', to: '/utromail' },
  { label: 'Coins', to: '/store' },
  { label: 'Treelz', to: '/treelz' },
  { label: 'Live', to: '/explore' },
  { label: 'Auctions', to: '/auctions' },
  { label: 'Court', to: '/troll-court' },
  { label: 'Hydro', to: '/hytrogaming' },
  { label: 'Academy', to: '/academy' },
  { label: 'MAI Pay', to: '/mai-pay' },
  { label: 'Leaders', to: '/leaderboard' },
  { label: 'Profile', to: '/profile' },
]

type Material = 'brick' | 'glass' | 'concrete' | 'stone' | 'darkGlass'

const MATERIAL_POOL: Material[] = [
  'brick', 'brick', 'glass', 'concrete', 'stone', 'darkGlass',
  'brick', 'glass', 'concrete', 'stone', 'brick', 'glass',
]

interface MaterialColors {
  base: string
  stroke: string
  windowLitRgb: string
  windowUnlitNight: string
  windowUnlitDay: string
  label: string
  texture: boolean
  isGlass: boolean
}

function getMaterialColors(material: Material, isDark: boolean): MaterialColors {
  switch (material) {
    case 'brick':
      return {
        base: isDark ? 'rgba(170,95,75,0.96)' : 'rgba(155,85,60,0.96)',
        stroke: isDark ? 'rgba(110,55,40,0.55)' : 'rgba(110,55,40,0.4)',
        windowLitRgb: '255,220,120',
        windowUnlitNight: 'rgba(20,26,45,0.65)',
        windowUnlitDay: 'rgba(48,40,32,0.35)',
        label: '#0a0a0a',
        texture: true,
        isGlass: false,
      }
    case 'glass':
      return {
        base: isDark ? 'rgba(52,82,135,0.55)' : 'rgba(78,112,180,0.42)',
        stroke: isDark ? 'rgba(90,135,215,0.32)' : 'rgba(90,135,215,0.24)',
        windowLitRgb: '220,240,255',
        windowUnlitNight: 'rgba(30,55,100,0.6)',
        windowUnlitDay: 'rgba(165,200,245,0.32)',
        label: '#0a0a0a',
        texture: false,
        isGlass: true,
      }
    case 'concrete':
      return {
        base: isDark ? 'rgba(100,112,128,0.93)' : 'rgba(128,138,152,0.93)',
        stroke: isDark ? 'rgba(75,85,100,0.5)' : 'rgba(85,95,110,0.42)',
        windowLitRgb: '255,220,120',
        windowUnlitNight: 'rgba(55,65,80,0.6)',
        windowUnlitDay: 'rgba(150,160,175,0.38)',
        label: '#0a0a0a',
        texture: false,
        isGlass: false,
      }
    case 'stone':
      return {
        base: isDark ? 'rgba(120,122,132,0.93)' : 'rgba(138,135,145,0.93)',
        stroke: isDark ? 'rgba(85,88,98,0.5)' : 'rgba(95,98,108,0.42)',
        windowLitRgb: '255,220,120',
        windowUnlitNight: 'rgba(60,66,76,0.6)',
        windowUnlitDay: 'rgba(140,145,155,0.38)',
        label: '#0a0a0a',
        texture: true,
        isGlass: false,
      }
    case 'darkGlass':
      return {
        base: isDark ? 'rgba(12,24,48,0.8)' : 'rgba(24,38,68,0.68)',
        stroke: isDark ? 'rgba(120,175,255,0.3)' : 'rgba(110,165,255,0.24)',
        windowLitRgb: '190,225,255',
        windowUnlitNight: 'rgba(14,28,56,0.55)',
        windowUnlitDay: 'rgba(90,140,220,0.3)',
        label: '#f0f0f0',
        texture: false,
        isGlass: true,
      }
    default:
      return getMaterialColors('concrete', isDark)
  }
}

/* ----------------------------------------------------------------
   Helpers
 ---------------------------------------------------------------- */

function lightenColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  const r = Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) + (255 - parseInt(clean.slice(0, 2), 16)) * amount))
  const g = Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) + (255 - parseInt(clean.slice(2, 4), 16)) * amount))
  const b = Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) + (255 - parseInt(clean.slice(4, 6), 16)) * amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

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
  label: string
  to: string
  material: Material
  cols: number
  rows: number
  winW: number
  winH: number
  windows: { lit: boolean; person: boolean; flicker: number }[]
}

function generateBuildings(metas: BuildingMeta[], canvasWidth: number, groundY: number): Building[] {
  const buildings: Building[] = []
  const count = metas.length
  const segmentWidth = canvasWidth / count
  for (let i = 0; i < count; i++) {
    const width = segmentWidth * (0.62 + Math.random() * 0.3)
    const height = 100 + Math.random() * 220
    const material = MATERIAL_POOL[i % MATERIAL_POOL.length]
    const isGlass = material === 'glass' || material === 'darkGlass'
    const cols = Math.max(isGlass ? 3 : 1, Math.floor(width / (isGlass ? 32 : 20)))
    const rows = Math.max(isGlass ? 3 : 1, Math.floor(height / (isGlass ? 28 : 24)))
    const winW = isGlass ? 20 : 10
    const winH = isGlass ? 18 : 14
    const windows = Array.from({ length: cols * rows }, () => ({
      lit: false,
      person: Math.random() < 0.3,
      flicker: Math.random() < 0.15 ? Math.random() * 0.4 : 0,
    }))
    buildings.push({
      x: i * segmentWidth + (segmentWidth - width) / 2,
      width,
      height,
      label: metas[i].label,
      to: metas[i].to,
      material,
      cols,
      rows,
      winW,
      winH,
      windows,
    })
  }
  return buildings
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const cr = Math.min(r, Math.min(w, h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + cr)
  ctx.lineTo(x + w, y + h - cr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h)
  ctx.lineTo(x + cr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - cr)
  ctx.lineTo(x, y + cr)
  ctx.quadraticCurveTo(x, y, x + cr, y)
  ctx.closePath()
}

function drawCity(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  groundY: number,
  isNight: boolean,
  time: number,
  isDark: boolean
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const streetTop = groundY + SIDEWALK_HEIGHT
  const curbCenterY = streetTop + CURB_HEIGHT / 2
  const segmentWidth = ctx.canvas.width / buildings.length

  for (const b of buildings) {
    const top = groundY - b.height
    const mc = getMaterialColors(b.material, isDark)

    ctx.fillStyle = mc.base
    ctx.fillRect(b.x, top, b.width, b.height)
    ctx.strokeStyle = mc.stroke
    ctx.lineWidth = 1
    ctx.strokeRect(b.x, top, b.width, b.height)

    if (mc.texture) {
      const mortar = isDark ? 'rgba(75,42,32,0.28)' : 'rgba(95,55,38,0.18)'
      const brickH = 14
      const brickW = 24
      ctx.strokeStyle = mortar
      ctx.lineWidth = 1
      // horizontal mortar joints
      for (let y = top; y < groundY; y += brickH) {
        ctx.beginPath()
        ctx.moveTo(b.x, y)
        ctx.lineTo(b.x + b.width, y)
        ctx.stroke()
      }
      // vertical mortar joints (staggered every other row)
      for (let y = top; y < groundY; y += brickH) {
        const rowEven = Math.round((y - top) / brickH) % 2 === 0
        const offset = rowEven ? brickW / 2 : 0
        ctx.beginPath()
        for (let x = b.x + offset; x <= b.x + b.width; x += brickW) {
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + brickH)
        }
        ctx.stroke()
      }
    }

    const cols = b.cols
    const rows = b.rows
    const winW = b.winW
    const winH = b.winH
    const gapX = (b.width - cols * winW) / (cols + 1)
    const gapY = (b.height - rows * winH) / (rows + 1)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const wx = b.x + gapX + c * (winW + gapX)
        const wy = top + gapY + r * (winH + gapY)
        const win = b.windows[idx]
        if (!win) continue

        if (isNight) {
          if (win.lit) {
            const flicker = Math.max(0, 1 - (time % (3 + idx * 0.1)) * win.flicker)
            const alpha = 0.8 + Math.sin(time * 0.5 + idx) * 0.2
            ctx.shadowColor = `rgba(${mc.windowLitRgb},0.7)`
            ctx.shadowBlur = isDark ? 8 : 4
            ctx.fillStyle = `rgba(${mc.windowLitRgb},${Math.max(0.35, alpha * flicker)})`
            ctx.fillRect(wx, wy, winW, winH)
            ctx.shadowBlur = 0

            if (win.person) {
              ctx.fillStyle = isDark ? 'rgba(5,5,15,0.9)' : 'rgba(230,230,240,0.5)'
              const move = Math.sin(time * 1.5 + idx) * 2.5
              ctx.fillRect(wx + 2 + move, wy + 3, 3, 3)
              ctx.fillRect(wx + 1 + move, wy + 6, 5, 2)
            }
          } else {
            ctx.fillStyle = mc.windowUnlitNight
            ctx.fillRect(wx, wy, winW, winH)
          }
        } else {
          ctx.fillStyle = mc.windowUnlitDay
          ctx.fillRect(wx, wy, winW, winH)
        }
      }
    }

    /* Building label — centered in its segment, drawn inside the curb band */
    const labelX = b.x + b.width / 2
    const fontSize = Math.max(12, Math.min(16, segmentWidth * 0.1))
    ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const maxTextW = segmentWidth * 0.82
    let label = b.label
    if (ctx.measureText(label).width > maxTextW) {
      while (label.length > 1 && ctx.measureText(label + '…').width > maxTextW) {
        label = label.slice(0, -1)
      }
      label += '…'
    }
    const textW = ctx.measureText(label).width
    const textH = fontSize * 1.1
    const padX = 6
    const padY = 3
    const radius = 7
    const pillX = labelX - textW / 2 - padX
    const pillY = curbCenterY - textH / 2 - padY
    const pillW = textW + padX * 2
    const pillH = textH + padY * 2

    ctx.fillStyle = 'rgba(248,249,252,0.9)'
    ctx.strokeStyle = 'rgba(120,135,155,0.45)'
    ctx.lineWidth = 1
    roundRectPath(ctx, pillX, pillY, pillW, pillH, radius)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#000000'
    ctx.fillText(label, labelX, curbCenterY)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }
}

function drawStreet(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  isDark: boolean
) {
  const curbHeight = CURB_HEIGHT
  const sidewalkHeight = SIDEWALK_HEIGHT
  const streetTop = groundY + sidewalkHeight
  const canvasH = ctx.canvas.height

  ctx.fillStyle = isDark ? 'rgba(70,75,85,0.95)' : 'rgba(160,165,175,0.9)'
  ctx.fillRect(0, groundY, ctx.canvas.width, sidewalkHeight)

  ctx.strokeStyle = isDark ? 'rgba(40,45,55,0.8)' : 'rgba(120,125,135,0.7)'
  ctx.lineWidth = 1
  const jointSpacingX = 18
  const jointSpacingY = 13
  for (let x = jointSpacingX; x < ctx.canvas.width; x += jointSpacingX) {
    ctx.beginPath()
    ctx.moveTo(x, groundY)
    ctx.lineTo(x, streetTop)
    ctx.stroke()
  }
  for (let y = groundY + jointSpacingY; y < streetTop; y += jointSpacingY) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(ctx.canvas.width, y)
    ctx.stroke()
  }

  ctx.fillStyle = isDark ? 'rgba(180,180,190,0.9)' : 'rgba(200,205,215,0.9)'
  ctx.fillRect(0, streetTop, ctx.canvas.width, curbHeight)

  ctx.fillStyle = isDark ? 'rgba(25,28,35,0.95)' : 'rgba(50,52,58,0.9)'
  ctx.fillRect(0, streetTop + curbHeight, ctx.canvas.width, canvasH - streetTop - curbHeight)

  ctx.strokeStyle = isDark ? 'rgba(255,220,100,0.5)' : 'rgba(255,220,100,0.7)'
  ctx.lineWidth = 2
  ctx.setLineDash([12, 18])
  const centerY = streetTop + curbHeight + (canvasH - streetTop - curbHeight) / 2
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(ctx.canvas.width, centerY)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, streetTop + curbHeight)
  ctx.lineTo(ctx.canvas.width, streetTop + curbHeight)
  ctx.stroke()
}

function drawWalkingPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  time: number
) {
  const cycle = Math.sin(time * 7)
  const skin = '#d4a574'
  const shirt = '#2563eb'
  const pants = '#1e293b'
  const hair = '#3e2723'
  const shoe = '#0f172a'

  ctx.save()
  ctx.translate(x, groundY - 5)
  ctx.scale(0.85, 0.85)

  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(2, 3, 15, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = shirt
  ctx.fillRect(-6, -40, 12, 40)

  ctx.strokeStyle = pants
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const bkneeX = -8 + Math.sin(cycle) * 10
  const bkneeY = 18 + Math.abs(Math.cos(cycle)) * 4
  const bfootX = bkneeX + Math.sin(cycle * 1.5) * 6
  const bfootY = 36
  ctx.beginPath()
  ctx.moveTo(-2, 0)
  ctx.lineTo(bkneeX, bkneeY)
  ctx.lineTo(bfootX, bfootY)
  ctx.stroke()

  ctx.strokeStyle = shirt
  ctx.lineWidth = 5
  const belbowX = -10 + Math.sin(-cycle) * 8
  const belbowY = -26 + Math.abs(Math.cos(-cycle)) * 3
  const bhandX = belbowX + Math.sin(-cycle * 1.5) * 5
  const bhandY = belbowY + 10
  ctx.beginPath()
  ctx.moveTo(-6, -38)
  ctx.lineTo(belbowX, belbowY)
  ctx.lineTo(bhandX, bhandY)
  ctx.stroke()

  const fkneeX = 8 + Math.sin(-cycle) * 10
  const fkneeY = 18 + Math.abs(Math.cos(-cycle)) * 4
  const ffootX = fkneeX + Math.sin(-cycle * 1.5) * 6
  const ffootY = 36
  ctx.strokeStyle = pants
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(2, 0)
  ctx.lineTo(fkneeX, fkneeY)
  ctx.lineTo(ffootX, ffootY)
  ctx.stroke()

  const felbowX = 10 + Math.sin(cycle) * 8
  const felbowY = -26 + Math.abs(Math.cos(cycle)) * 3
  const fhandX = felbowX + Math.sin(cycle * 1.5) * 5
  const fhandY = felbowY + 10
  ctx.strokeStyle = shirt
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(6, -38)
  ctx.lineTo(felbowX, felbowY)
  ctx.lineTo(fhandX, fhandY)
  ctx.stroke()

  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.arc(bhandX, bhandY, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(fhandX, fhandY, 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = shoe
  ctx.beginPath()
  ctx.ellipse(ffootX - 2, ffootY, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(bfootX - 2, bfootY, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  const headX = 2
  const headY = -52
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.arc(headX, headY, 9, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = hair
  ctx.beginPath()
  ctx.arc(headX, headY - 2, 9.5, Math.PI, 0)
  ctx.fill()

  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.arc(headX + 3, headY - 1, 1.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(headX + 3, headY + 3, 2.5, 0.2, Math.PI - 0.2)
  ctx.stroke()

  ctx.restore()
}

/* ----------------------------------------------------------------
   Dynamic weather background
--------------------------------------------------------------- */

export default function DynamicWeatherBackground({
  isDark = true,
  showWalker = false,
  buildings: buildingMetas = DEFAULT_BUILDINGS,
  onBuildingClick,
}: {
  isDark?: boolean
  showWalker?: boolean
  buildings?: BuildingMeta[]
  onBuildingClick?: (to: string) => void
}) {
  const cityCanvasRef = useRef<HTMLCanvasElement>(null)
  const precipCanvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [mounted, setMounted] = useState(false)
  const buildingsRef = useRef<Building[]>([])
  const buildingMetasRef = useRef(buildingMetas)
  const onBuildingClickRef = useRef(onBuildingClick)
  const walkerRef = useRef({ x: -60, active: false })
  const showWalkerRef = useRef(showWalker)

  useEffect(() => {
    buildingMetasRef.current = buildingMetas
  }, [buildingMetas])
  useEffect(() => {
    onBuildingClickRef.current = onBuildingClick
  }, [onBuildingClick])

  useEffect(() => {
    showWalkerRef.current = showWalker
  }, [showWalker])

  const displayWeather = useMemo(() => {
    if (!weather) return null
    if (isDark) return { ...weather, time: 'night' as const }
    return { ...weather, time: 'day' as const }
  }, [weather, isDark])

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

  const skyColors = useMemo(() => displayWeather ? getSkyColors(displayWeather) : null, [displayWeather])
  const adjustedSky = useMemo(() => {
    if (!skyColors) return null
    if (isDark) return skyColors
    return {
      top: lightenColor(skyColors.top, 0.35),
      bottom: lightenColor(skyColors.bottom, 0.35),
      ambient: lightenColor(skyColors.ambient, 0.35),
    }
  }, [skyColors, isDark])
  const moonInfo = useMemo(() => getMoonPhase(new Date()), [mounted])
  const sunPos = useMemo(() => displayWeather ? getSunPosition(displayWeather.time) : null, [displayWeather])

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
      buildingsRef.current = generateBuildings(buildingMetasRef.current, cityCanvas.width, groundY)
    }
    resize()
    window.addEventListener('resize', resize)

    const isPrecip = displayWeather?.condition === 'rain' || displayWeather?.condition === 'storm'
    const isSnow = displayWeather?.condition === 'snow'
    const isNight = displayWeather?.time === 'night'

    const precipCount = isSnow ? 180 : 260
    const precipParticles = Array.from({ length: precipCount }, () => ({
      x: Math.random() * precipCanvas.width,
      y: Math.random() * precipCanvas.height,
      speed: isSnow ? 0.4 + Math.random() * 1.2 : 6 + Math.random() * 10,
      length: isSnow ? 2 + Math.random() * 3 : 10 + Math.random() * 16,
      opacity: isDark ? 0.15 + Math.random() * 0.45 : 0.1 + Math.random() * 0.25,
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
      drawCity(cityCtx, buildingsRef.current, groundY, isNight, time, isDark)
      drawStreet(cityCtx, groundY, isDark)

      /* Walking person */
      if (showWalkerRef.current) {
        const walker = walkerRef.current
        if (!walker.active) {
          walker.active = true
          walker.x = -60
        }
        walker.x += 1.1
        if (walker.x > cityCanvas.width + 80) {
          walker.x = -60
        }
        drawWalkingPerson(cityCtx, walker.x, groundY, time)
      } else {
        walkerRef.current.active = false
      }

      /* Randomly toggle lights at night */
      if (isNight && isDark && Math.random() < 0.03) {
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
  }, [displayWeather?.condition, displayWeather?.time])

  /* ---------- Building click → navigate to its tab ---------- */
  const handleCityClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = cityCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const b = buildingsRef.current.find((bld) => x >= bld.x && x <= bld.x + bld.width)
    if (!b) return
    const target = b.to
    if (onBuildingClickRef.current) onBuildingClickRef.current(target)
    else navigate(target)
  }

  /* ---------- Sky CSS ---------- */
  const skyStyle = adjustedSky
    ? { background: `linear-gradient(to bottom, ${adjustedSky.top} 0%, ${adjustedSky.bottom} 100%)` }
    : { background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)' }

  /* ---------- Moon ---------- */
  const isNight = displayWeather?.time === 'night'

  return (
    <div ref={backgroundRef} className="pointer-events-none fixed inset-0" style={skyStyle}>
      {/* Stars at night */}
      {isNight && isDark && (
        <div className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 40% 70%, white, transparent), radial-gradient(1px 1px at 60% 20%, white, transparent), radial-gradient(1px 1px at 80% 50%, white, transparent), radial-gradient(1px 1px at 10% 80%, white, transparent), radial-gradient(1px 1px at 70% 90%, white, transparent), radial-gradient(1px 1px at 90% 10%, white, transparent), radial-gradient(1px 1px at 50% 50%, white, transparent)',
            backgroundSize: '250px 250px',
          }}
        />
      )}

      {/* Sun */}
      {displayWeather && sunPos && sunPos.opacity > 0 && (
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
          onClick={handleCityClick}
          className="absolute inset-0 h-full w-full cursor-pointer"
          style={{ pointerEvents: 'auto' }}
        />
         <div className="absolute inset-x-0 bottom-0 h-6"
           style={{
             background: isDark
               ? 'linear-gradient(to top, rgba(10,15,30,0.9), transparent)'
               : 'linear-gradient(to top, rgba(200,210,220,0.4), transparent)',
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
