import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchUserWeather,
  getSkyColors,
  type WeatherData,
} from '@/lib/weatherService'

/* -------------------------------------------------------------------------- */
/* Street / city dimensions                                                    */
/* -------------------------------------------------------------------------- */

const SIDEWALK_HEIGHT = 20
const CURB_HEIGHT = 40
const CITY_HEIGHT = 420

export interface BuildingMeta {
  label: string
  to: string
}

const DEFAULT_BUILDINGS: BuildingMeta[] = [
  { label: 'Home', to: '/home' },
  { label: 'Chats', to: '/utromail' },
  { label: 'Coins', to: '/store' },
  { label: 'Treelz', to: '/treelz' },
  { label: 'Live', to: '/broadcast/setup' },
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
  'brick',
  'brick',
  'glass',
  'concrete',
  'stone',
  'darkGlass',
  'brick',
  'glass',
  'concrete',
  'stone',
  'brick',
  'glass',
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

function getMaterialColors(
  material: Material,
  isDark: boolean,
): MaterialColors {
  switch (material) {
    case 'brick':
      return {
        base: isDark
          ? 'rgba(170,95,75,0.96)'
          : 'rgba(155,85,60,0.96)',
        stroke: isDark
          ? 'rgba(110,55,40,0.55)'
          : 'rgba(110,55,40,0.4)',
        windowLitRgb: '255,220,120',
        windowUnlitNight: 'rgba(20,26,45,0.65)',
        windowUnlitDay: 'rgba(48,40,32,0.35)',
        label: '#0a0a0a',
        texture: true,
        isGlass: false,
      }

    case 'glass':
      return {
        base: isDark
          ? 'rgba(52,82,135,0.55)'
          : 'rgba(78,112,180,0.42)',
        stroke: isDark
          ? 'rgba(90,135,215,0.32)'
          : 'rgba(90,135,215,0.24)',
        windowLitRgb: '220,240,255',
        windowUnlitNight: 'rgba(30,55,100,0.6)',
        windowUnlitDay: 'rgba(165,200,245,0.32)',
        label: '#0a0a0a',
        texture: false,
        isGlass: true,
      }

    case 'concrete':
      return {
        base: isDark
          ? 'rgba(100,112,128,0.93)'
          : 'rgba(128,138,152,0.93)',
        stroke: isDark
          ? 'rgba(75,85,100,0.5)'
          : 'rgba(85,95,110,0.42)',
        windowLitRgb: '255,220,120',
        windowUnlitNight: 'rgba(55,65,80,0.6)',
        windowUnlitDay: 'rgba(150,160,175,0.38)',
        label: '#0a0a0a',
        texture: false,
        isGlass: false,
      }

    case 'stone':
      return {
        base: isDark
          ? 'rgba(120,122,132,0.93)'
          : 'rgba(138,135,145,0.93)',
        stroke: isDark
          ? 'rgba(85,88,98,0.5)'
          : 'rgba(95,98,108,0.42)',
        windowLitRgb: '255,220,120',
        windowUnlitNight: 'rgba(60,66,76,0.6)',
        windowUnlitDay: 'rgba(140,145,155,0.38)',
        label: '#0a0a0a',
        texture: true,
        isGlass: false,
      }

    case 'darkGlass':
      return {
        base: isDark
          ? 'rgba(12,24,48,0.8)'
          : 'rgba(24,38,68,0.68)',
        stroke: isDark
          ? 'rgba(120,175,255,0.3)'
          : 'rgba(110,165,255,0.24)',
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function lightenColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')

  const r0 = parseInt(clean.slice(0, 2), 16)
  const g0 = parseInt(clean.slice(2, 4), 16)
  const b0 = parseInt(clean.slice(4, 6), 16)

  const r = Math.min(255, Math.round(r0 + (255 - r0) * amount))
  const g = Math.min(255, Math.round(g0 + (255 - g0) * amount))
  const b = Math.min(255, Math.round(b0 + (255 - b0) * amount))

  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getMoonPhase(date: Date): {
  phase: string
  illumination: number
} {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z')
  const synodicMonth = 29.53058867

  const diff = date.getTime() - knownNewMoon.getTime()
  const days = diff / (1000 * 60 * 60 * 24)

  const phase =
    ((days % synodicMonth) + synodicMonth) % synodicMonth

  const illumination =
    0.5 *
    (1 - Math.cos((2 * Math.PI * phase) / synodicMonth))

  let phaseName = 'new'

  if (phase < 1) phaseName = 'new'
  else if (phase < 7.4) phaseName = 'waxing-crescent'
  else if (phase < 8.4) phaseName = 'first-quarter'
  else if (phase < 13.8) phaseName = 'waxing-gibbous'
  else if (phase < 15.8) phaseName = 'full'
  else if (phase < 22.2) phaseName = 'waning-gibbous'
  else if (phase < 23.2) phaseName = 'last-quarter'
  else if (phase < 28.5) phaseName = 'waning-crescent'

  return {
    phase: phaseName,
    illumination: Math.round(illumination * 100),
  }
}

function getSunPosition(
  time: WeatherData['time'],
): {
  x: number
  y: number
  opacity: number
} {
  if (time === 'day') {
    return { x: 15, y: 12, opacity: 0.9 }
  }

  if (time === 'sunrise') {
    return { x: 78, y: 22, opacity: 0.75 }
  }

  if (time === 'sunset') {
    return { x: 78, y: 22, opacity: 0.75 }
  }

  return {
    x: 0,
    y: 0,
    opacity: 0,
  }
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

  ctx.quadraticCurveTo(
    x + w,
    y,
    x + w,
    y + cr,
  )

  ctx.lineTo(x + w, y + h - cr)

  ctx.quadraticCurveTo(
    x + w,
    y + h,
    x + w - cr,
    y + h,
  )

  ctx.lineTo(x + cr, y + h)

  ctx.quadraticCurveTo(
    x,
    y + h,
    x,
    y + h - cr,
  )

  ctx.lineTo(x, y + cr)

  ctx.quadraticCurveTo(
    x,
    y,
    x + cr,
    y,
  )

  ctx.closePath()
}

/* -------------------------------------------------------------------------- */
/* Buildings                                                                  */
/* -------------------------------------------------------------------------- */

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
  windows: {
    lit: boolean
    person: boolean
    flicker: number
  }[]
}

function generateBuildings(
  metas: BuildingMeta[],
  canvasWidth: number,
): Building[] {
  const buildings: Building[] = []

  const count = Math.max(1, metas.length)
  const segmentWidth = canvasWidth / count

  for (let i = 0; i < count; i++) {
    const width =
      segmentWidth *
      (0.62 + Math.random() * 0.3)

    const height =
      100 + Math.random() * 220

    const material =
      MATERIAL_POOL[i % MATERIAL_POOL.length]

    const isGlass =
      material === 'glass' ||
      material === 'darkGlass'

    const cols = Math.max(
      isGlass ? 3 : 1,
      Math.floor(
        width / (isGlass ? 32 : 20),
      ),
    )

    const rows = Math.max(
      isGlass ? 3 : 1,
      Math.floor(
        height / (isGlass ? 28 : 24),
      ),
    )

    const winW = isGlass ? 20 : 10
    const winH = isGlass ? 18 : 14

    const windows = Array.from(
      { length: cols * rows },
      () => ({
        lit: Math.random() < 0.35,
        person: Math.random() < 0.3,
        flicker:
          Math.random() < 0.15
            ? Math.random() * 0.4
            : 0,
      }),
    )

    buildings.push({
      x:
        i * segmentWidth +
        (segmentWidth - width) / 2,
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

/* -------------------------------------------------------------------------- */
/* Trees — realistic with branches and layered foliage                        */
/* -------------------------------------------------------------------------- */

interface Tree {
  x: number
  height: number
  width: number
  variation: number
  type: 'oak' | 'pine' | 'maple'
  swayOffset: number
}

interface Leaf {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  size: number
  color: string
  opacity: number
}

function generateTrees(
  width: number,
  groundY: number,
): Tree[] {
  const trees: Tree[] = []

  const count = Math.max(
    18,
    Math.floor(width / 45),
  )

  const types: Tree['type'][] = ['oak', 'pine', 'maple']

  for (let i = 0; i < count; i++) {
    trees.push({
      x: Math.random() * width,
      height: 150 + Math.random() * 180,
      width: 55 + Math.random() * 45,
      variation: Math.random(),
      type: types[Math.floor(Math.random() * types.length)],
      swayOffset: Math.random() * Math.PI * 2,
    })
  }

  return trees
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  tree: Tree,
  groundY: number,
  isDark: boolean,
  time: number,
) {
  const baseY = groundY + 10
  const sway = Math.sin(time * 0.8 + tree.swayOffset) * 3

  const trunkColor = isDark
    ? 'rgba(45,30,20,0.95)'
    : 'rgba(70,45,25,0.9)'

  const trunkHighlight = isDark
    ? 'rgba(60,40,28,0.9)'
    : 'rgba(95,65,40,0.85)'

  const foliageColors = isDark
    ? {
        dark: 'rgba(15,50,30,0.85)',
        base: 'rgba(25,70,40,0.8)',
        mid: 'rgba(35,85,50,0.7)',
        light: 'rgba(50,105,60,0.6)',
      }
    : {
        dark: 'rgba(20,80,35,0.75)',
        base: 'rgba(40,110,55,0.7)',
        mid: 'rgba(60,140,70,0.6)',
        light: 'rgba(80,165,85,0.5)',
      }

  /* trunk with taper */

  const trunkBase = tree.width * 0.1
  const trunkTop = tree.width * 0.04
  const trunkHeight = tree.height * 0.4

  ctx.fillStyle = trunkColor

  ctx.beginPath()
  ctx.moveTo(
    tree.x - trunkBase,
    baseY,
  )

  ctx.lineTo(
    tree.x + trunkBase,
    baseY,
  )

  ctx.lineTo(
    tree.x + trunkTop + sway * 0.3,
    baseY - trunkHeight,
  )

  ctx.lineTo(
    tree.x - trunkTop + sway * 0.3,
    baseY - trunkHeight,
  )

  ctx.closePath()
  ctx.fill()

  /* trunk texture lines */

  ctx.strokeStyle = isDark
    ? 'rgba(30,20,12,0.5)'
    : 'rgba(50,30,15,0.4)'

  ctx.lineWidth = 1

  for (let i = 1; i < 4; i++) {
    const y = baseY - (trunkHeight / 4) * i
    const taper = 1 - (i / 4) * 0.6

    ctx.beginPath()
    ctx.moveTo(
      tree.x - trunkBase * taper * 0.7,
      y,
    )

    ctx.quadraticCurveTo(
      tree.x,
      y - 3,
      tree.x + trunkBase * taper * 0.7,
      y,
    )

    ctx.stroke()
  }

  /* branches */

  const branchStartY = baseY - trunkHeight * 0.6

  ctx.strokeStyle = trunkColor
  ctx.lineWidth = 4
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(
    tree.x + sway * 0.3,
    branchStartY,
  )

  ctx.quadraticCurveTo(
    tree.x - tree.width * 0.3 + sway * 0.5,
    branchStartY - tree.height * 0.15,
    tree.x - tree.width * 0.4 + sway * 0.7,
    branchStartY - tree.height * 0.25,
  )

  ctx.stroke()

  ctx.lineWidth = 3

  ctx.beginPath()
  ctx.moveTo(
    tree.x + sway * 0.3,
    branchStartY + 10,
  )

  ctx.quadraticCurveTo(
    tree.x + tree.width * 0.25 + sway * 0.5,
    branchStartY - tree.height * 0.1,
    tree.x + tree.width * 0.35 + sway * 0.7,
    branchStartY - tree.height * 0.2,
  )

  ctx.stroke()

  /* foliage clusters - multiple layers for depth */

  const canopyBase =
    baseY - trunkHeight + 10

  ctx.fillStyle = foliageColors.dark

  const darkBlobs = [
    {
      x: tree.x + sway * 0.7,
      y: canopyBase - tree.height * 0.35,
      r: tree.width * 0.5,
    },
    {
      x: tree.x - tree.width * 0.25 + sway * 0.6,
      y: canopyBase - tree.height * 0.22,
      r: tree.width * 0.4,
    },
    {
      x: tree.x + tree.width * 0.28 + sway * 0.6,
      y: canopyBase - tree.height * 0.25,
      r: tree.width * 0.38,
    },
  ]

  for (const blob of darkBlobs) {
    ctx.beginPath()
    ctx.arc(
      blob.x,
      blob.y,
      blob.r,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  ctx.fillStyle = foliageColors.base

  const baseBlobs = [
    {
      x: tree.x + sway * 0.8,
      y: canopyBase - tree.height * 0.42,
      r: tree.width * 0.45,
    },
    {
      x: tree.x - tree.width * 0.15 + sway * 0.7,
      y: canopyBase - tree.height * 0.5,
      r: tree.width * 0.35,
    },
    {
      x: tree.x + tree.width * 0.18 + sway * 0.7,
      y: canopyBase - tree.height * 0.52,
      r: tree.width * 0.38,
    },
    {
      x: tree.x + sway * 0.9,
      y: canopyBase - tree.height * 0.6,
      r: tree.width * 0.32,
    },
  ]

  for (const blob of baseBlobs) {
    ctx.beginPath()
    ctx.arc(
      blob.x,
      blob.y,
      blob.r,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  ctx.fillStyle = foliageColors.mid

  const midBlobs = [
    {
      x: tree.x - tree.width * 0.2 + sway * 0.85,
      y: canopyBase - tree.height * 0.45,
      r: tree.width * 0.28,
    },
    {
      x: tree.x + tree.width * 0.22 + sway * 0.85,
      y: canopyBase - tree.height * 0.48,
      r: tree.width * 0.3,
    },
    {
      x: tree.x + sway * 0.9,
      y: canopyBase - tree.height * 0.65,
      r: tree.width * 0.25,
    },
  ]

  for (const blob of midBlobs) {
    ctx.beginPath()
    ctx.arc(
      blob.x,
      blob.y,
      blob.r,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  /* highlights */

  ctx.fillStyle = foliageColors.light

  ctx.beginPath()
  ctx.arc(
    tree.x - tree.width * 0.15 + sway * 0.9,
    canopyBase - tree.height * 0.55,
    tree.width * 0.18,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.beginPath()
  ctx.arc(
    tree.x + tree.width * 0.12 + sway * 0.95,
    canopyBase - tree.height * 0.68,
    tree.width * 0.15,
    0,
    Math.PI * 2,
  )
  ctx.fill()
}

function drawTrees(
  ctx: CanvasRenderingContext2D,
  trees: Tree[],
  groundY: number,
  isDark: boolean,
  time: number,
) {
  for (const tree of trees) {
    drawTree(
      ctx,
      tree,
      groundY,
      isDark,
      time,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Flying leaves                                                              */
/* -------------------------------------------------------------------------- */

interface FlyingLeaf {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  size: number
  color: string
  opacity: number
}

function generateFlyingLeaves(
  width: number,
  _height: number,
  trees: Tree[],
): FlyingLeaf[] {
  const leaves: FlyingLeaf[] = []

  const leafColors = [
    'rgba(180,120,40,0.85)',
    'rgba(200,140,50,0.8)',
    'rgba(160,100,30,0.85)',
    'rgba(140,80,25,0.9)',
    'rgba(220,160,60,0.75)',
    'rgba(100,60,20,0.9)',
  ]

  for (const tree of trees) {
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2
      const dist = tree.width * 0.3 + Math.random() * tree.width * 0.4

      leaves.push({
        x: tree.x + Math.cos(angle) * dist,
        y: 100 + Math.random() * 150,
        vx: 0.5 + Math.random() * 1.5,
        vy: 0.3 + Math.random() * 0.8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed:
          (Math.random() - 0.5) * 0.1,
        size: 4 + Math.random() * 6,
        color:
          leafColors[
            Math.floor(
              Math.random() * leafColors.length,
            )
          ],
        opacity: 0.7 + Math.random() * 0.3,
      })
    }
  }

  return leaves
}

function drawFlyingLeaves(
  ctx: CanvasRenderingContext2D,
  leaves: FlyingLeaf[],
  width: number,
  height: number,
  time: number,
  _deltaTime: number,
) {
  for (let i = leaves.length - 1; i >= 0; i--) {
    const leaf = leaves[i]

    leaf.x += leaf.vx
    leaf.y += leaf.vy + Math.sin(time * 2 + i) * 0.3
    leaf.rotation += leaf.rotationSpeed

    if (
      leaf.x > width + 20 ||
      leaf.y > height + 20
    ) {
      leaves.splice(i, 1)
      continue
    }

    ctx.save()

    ctx.translate(
      leaf.x,
      leaf.y,
    )

    ctx.rotate(leaf.rotation)

    ctx.fillStyle = leaf.color
    ctx.globalAlpha = leaf.opacity

    ctx.beginPath()

    ctx.ellipse(
      0,
      0,
      leaf.size,
      leaf.size * 0.4,
      0,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    ctx.strokeStyle = 'rgba(80,50,20,0.5)'
    ctx.lineWidth = 0.5

    ctx.beginPath()
    ctx.moveTo(
      -leaf.size * 0.8,
      0,
    )
    ctx.lineTo(
      leaf.size * 0.8,
      0,
    )
    ctx.stroke()

    ctx.restore()
  }
}

function spawnLeaf(
  trees: Tree[],
  groundY: number,
): FlyingLeaf | null {
  if (Math.random() > 0.02) return null

  const tree = trees[Math.floor(Math.random() * trees.length)]

  if (!tree) return null

  const leafColors = [
    'rgba(180,120,40,0.85)',
    'rgba(200,140,50,0.8)',
    'rgba(160,100,30,0.85)',
    'rgba(140,80,25,0.9)',
    'rgba(220,160,60,0.75)',
  ]

  const angle = Math.random() * Math.PI * 2
  const dist = tree.width * 0.2 + Math.random() * tree.width * 0.5

  return {
    x: tree.x + Math.cos(angle) * dist,
    y:
      groundY + 10 - tree.height * 0.5 - Math.random() * tree.height * 0.3,
    vx: 0.8 + Math.random() * 2,
    vy: 0.2 + Math.random() * 0.6,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed:
      (Math.random() - 0.5) * 0.15,
    size: 3 + Math.random() * 5,
    color:
      leafColors[
        Math.floor(
          Math.random() * leafColors.length,
        )
      ],
    opacity: 0.6 + Math.random() * 0.4,
  }
}

/* -------------------------------------------------------------------------- */
/* Clouds — high in the sky                                                    */
/* -------------------------------------------------------------------------- */

interface Cloud {
  x: number
  y: number
  width: number
  height: number
  speed: number
  opacity: number
}

function generateClouds(
  width: number,
  height: number,
): Cloud[] {
  const clouds: Cloud[] = []

  const count = Math.max(
    5,
    Math.floor(width / 260),
  )

  for (let i = 0; i < count; i++) {
    /*
     * Keep clouds high.
     * Never place them down in the city/street area.
     */
    const maxY = Math.min(
      height * 0.3,
      150,
    )

    clouds.push({
      x: Math.random() * width,
      y: 30 + Math.random() * maxY,
      width: 140 + Math.random() * 180,
      height: 45 + Math.random() * 45,
      speed:
        0.08 + Math.random() * 0.2,
      opacity:
        0.15 + Math.random() * 0.25,
    })
  }

  return clouds
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  cloud: Cloud,
  isDark: boolean,
) {
  const color = isDark
    ? `rgba(180,195,220,${cloud.opacity * 0.65})`
    : `rgba(255,255,255,${cloud.opacity})`

  ctx.save()

  ctx.fillStyle = color

  const x = cloud.x
  const y = cloud.y
  const w = cloud.width
  const h = cloud.height

  ctx.beginPath()

  ctx.ellipse(
    x,
    y + h * 0.45,
    w * 0.38,
    h * 0.3,
    0,
    0,
    Math.PI * 2,
  )

  ctx.ellipse(
    x - w * 0.25,
    y + h * 0.42,
    w * 0.23,
    h * 0.27,
    0,
    0,
    Math.PI * 2,
  )

  ctx.ellipse(
    x + w * 0.25,
    y + h * 0.42,
    w * 0.26,
    h * 0.28,
    0,
    0,
    Math.PI * 2,
  )

  ctx.ellipse(
    x - w * 0.08,
    y + h * 0.2,
    w * 0.23,
    h * 0.35,
    0,
    0,
    Math.PI * 2,
  )

  ctx.ellipse(
    x + w * 0.1,
    y + h * 0.17,
    w * 0.2,
    h * 0.32,
    0,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  ctx.restore()
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  clouds: Cloud[],
  width: number,
  isDark: boolean,
) {
  for (const cloud of clouds) {
    drawCloud(
      ctx,
      cloud,
      isDark,
    )

    cloud.x += cloud.speed

    if (
      cloud.x -
        cloud.width >
      width
    ) {
      cloud.x = -cloud.width
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Birds                                                                       */
/* -------------------------------------------------------------------------- */

interface Bird {
  x: number
  y: number
  speed: number
  size: number
  flapOffset: number
}

function generateBirds(
  width: number,
  height: number,
): Bird[] {
  const birds: Bird[] = []

  const count = Math.max(
    7,
    Math.floor(width / 180),
  )

  for (let i = 0; i < count; i++) {
    birds.push({
      x: Math.random() * width,
      y:
        65 +
        Math.random() *
          Math.min(
            150,
            height * 0.25,
          ),
      speed:
        0.35 +
        Math.random() * 0.7,
      size:
        4 +
        Math.random() * 4,
      flapOffset:
        Math.random() * Math.PI * 2,
    })
  }

  return birds
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  bird: Bird,
  time: number,
  isDark: boolean,
) {
  const flap = Math.sin(
    time * 5 +
      bird.flapOffset,
  )

  const wing = flap * bird.size

  ctx.save()

  ctx.strokeStyle = isDark
    ? 'rgba(10,15,25,0.72)'
    : 'rgba(35,45,55,0.65)'

  ctx.lineWidth = Math.max(
    1,
    bird.size * 0.25,
  )

  ctx.lineCap = 'round'

  ctx.beginPath()

  ctx.moveTo(
    bird.x - bird.size,
    bird.y,
  )

  ctx.quadraticCurveTo(
    bird.x - bird.size * 0.45,
    bird.y - wing,
    bird.x,
    bird.y,
  )

  ctx.quadraticCurveTo(
    bird.x + bird.size * 0.45,
    bird.y - wing,
    bird.x + bird.size,
    bird.y,
  )

  ctx.stroke()

  ctx.restore()
}

function drawBirds(
  ctx: CanvasRenderingContext2D,
  birds: Bird[],
  width: number,
  time: number,
  isDark: boolean,
) {
  for (const bird of birds) {
    drawBird(
      ctx,
      bird,
      time,
      isDark,
    )

    bird.x += bird.speed

    if (bird.x > width + 30) {
      bird.x = -30
      bird.y =
        65 +
        Math.random() * 120
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Airplanes — random aircraft                                                 */
/* -------------------------------------------------------------------------- */

interface Airplane {
  x: number
  y: number
  speed: number
  scale: number
  direction: 1 | -1
  opacity: number
  active: boolean
  nextDelay: number
}

function createAirplane(
  width: number,
  height: number,
): Airplane {
  const direction: 1 | -1 =
    Math.random() > 0.5 ? 1 : -1

  return {
    x:
      direction === 1
        ? -120
        : width + 120,

    /*
     * Aircraft stay high above the buildings.
     */
    y:
      45 +
      Math.random() *
        Math.min(
          145,
          height * 0.28,
        ),

    speed:
      0.35 +
      Math.random() * 0.8,

    scale:
      0.45 +
      Math.random() * 0.55,

    direction,

    opacity:
      0.35 +
      Math.random() * 0.4,

    active: true,

    nextDelay:
      900 +
      Math.random() * 5000,
  }
}

function drawAirplane(
  ctx: CanvasRenderingContext2D,
  plane: Airplane,
  isDark: boolean,
) {
  ctx.save()

  ctx.translate(
    plane.x,
    plane.y,
  )

  ctx.scale(
    plane.direction * plane.scale,
    plane.scale,
  )

  const color = isDark
    ? `rgba(235,240,250,${plane.opacity})`
    : `rgba(45,55,70,${plane.opacity * 0.8})`

  ctx.fillStyle = color

  /* fuselage */

  ctx.beginPath()
  ctx.ellipse(
    0,
    0,
    25,
    4,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  /* nose */

  ctx.beginPath()
  ctx.moveTo(25, 0)
  ctx.lineTo(17, -3)
  ctx.lineTo(17, 3)
  ctx.closePath()
  ctx.fill()

  /* main wings */

  ctx.beginPath()
  ctx.moveTo(5, 0)
  ctx.lineTo(-8, -14)
  ctx.lineTo(-14, -14)
  ctx.lineTo(-6, 0)
  ctx.lineTo(-14, 14)
  ctx.lineTo(-8, 14)
  ctx.closePath()
  ctx.fill()

  /* tail */

  ctx.beginPath()
  ctx.moveTo(-16, 0)
  ctx.lineTo(-23, -9)
  ctx.lineTo(-18, -9)
  ctx.lineTo(-11, 0)
  ctx.closePath()
  ctx.fill()

  /* tiny aircraft light */

  ctx.fillStyle = isDark
    ? 'rgba(255,245,190,0.9)'
    : 'rgba(255,190,50,0.85)'

  ctx.beginPath()
  ctx.arc(
    20,
    0,
    1.5,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.restore()
}

function drawAirplanes(
  ctx: CanvasRenderingContext2D,
  airplanes: Airplane[],
  width: number,
  height: number,
  time: number,
  isDark: boolean,
) {
  for (const plane of airplanes) {
    if (plane.active) {
      drawAirplane(
        ctx,
        plane,
        isDark,
      )

      plane.x +=
        plane.speed *
        plane.direction

      /*
       * Slight natural flight movement.
       */
      plane.y +=
        Math.sin(
          time * 0.25 +
            plane.scale,
        ) * 0.025

      const offscreen =
        plane.direction === 1
          ? plane.x > width + 150
          : plane.x < -150

      if (offscreen) {
        plane.active = false
        plane.nextDelay =
          2500 +
          Math.random() * 10000
      }
    } else {
      plane.nextDelay -= 16

      if (plane.nextDelay <= 0) {
        const replacement =
          createAirplane(
            width,
            height,
          )

        Object.assign(
          plane,
          replacement,
        )
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* City                                                                       */
/* -------------------------------------------------------------------------- */

function drawCity(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  trees: Tree[],
  groundY: number,
  isNight: boolean,
  time: number,
  isDark: boolean,
) {
  ctx.clearRect(
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height,
  )

  /*
   * IMPORTANT:
   *
   * Trees are drawn FIRST.
   * Buildings are drawn SECOND.
   *
   * This makes the trees appear behind the skyline.
   */
  drawTrees(
    ctx,
    trees,
    groundY,
    isDark,
    time,
  )

  const streetTop =
    groundY +
    SIDEWALK_HEIGHT

  const curbCenterY =
    streetTop +
    CURB_HEIGHT / 2

  const segmentWidth =
    ctx.canvas.width /
    Math.max(1, buildings.length)

  for (const b of buildings) {
    const top =
      groundY -
      b.height

    const mc =
      getMaterialColors(
        b.material,
        isDark,
      )

    const isLiveBuilding =
      b.label === 'Live'

    /* live building glow */

    if (isLiveBuilding) {
      const pulse =
        0.6 +
        Math.sin(
          time * 3,
        ) *
          0.4

      ctx.shadowColor =
        `rgba(255,30,30,${pulse})`

      ctx.shadowBlur =
        25 +
        Math.sin(
          time * 3,
        ) *
          10
    }

    /* building */

    ctx.fillStyle = isLiveBuilding
      ? isDark
        ? 'rgba(160,30,30,0.95)'
        : 'rgba(200,40,40,0.9)'
      : mc.base

    ctx.fillRect(
      b.x,
      top,
      b.width,
      b.height,
    )

    ctx.strokeStyle =
      isLiveBuilding
        ? 'rgba(255,80,80,0.7)'
        : mc.stroke

    ctx.lineWidth = 1

    ctx.strokeRect(
      b.x,
      top,
      b.width,
      b.height,
    )

    if (isLiveBuilding) {
      ctx.shadowBlur = 0
    }

    /* brick / stone texture */

    if (mc.texture) {
      const mortar = isDark
        ? 'rgba(75,42,32,0.28)'
        : 'rgba(95,55,38,0.18)'

      const brickH = 14
      const brickW = 24

      ctx.strokeStyle =
        mortar

      ctx.lineWidth = 1

      for (
        let y = top;
        y < groundY;
        y += brickH
      ) {
        ctx.beginPath()
        ctx.moveTo(
          b.x,
          y,
        )
        ctx.lineTo(
          b.x + b.width,
          y,
        )
        ctx.stroke()
      }

      for (
        let y = top;
        y < groundY;
        y += brickH
      ) {
        const rowEven =
          Math.round(
            (y - top) /
              brickH,
          ) %
            2 ===
          0

        const offset =
          rowEven
            ? brickW / 2
            : 0

        ctx.beginPath()

        for (
          let x =
            b.x + offset;
          x <=
          b.x + b.width;
          x += brickW
        ) {
          ctx.moveTo(
            x,
            y,
          )
          ctx.lineTo(
            x,
            y + brickH,
          )
        }

        ctx.stroke()
      }
    }

    /* windows */

    const cols = b.cols
    const rows = b.rows
    const winW = b.winW
    const winH = b.winH

    const gapX =
      (b.width -
        cols * winW) /
      (cols + 1)

    const gapY =
      (b.height -
        rows * winH) /
      (rows + 1)

    for (
      let r = 0;
      r < rows;
      r++
    ) {
      for (
        let c = 0;
        c < cols;
        c++
      ) {
        const idx =
          r * cols + c

        const wx =
          b.x +
          gapX +
          c *
            (winW + gapX)

        const wy =
          top +
          gapY +
          r *
            (winH + gapY)

        const win =
          b.windows[idx]

        if (!win) continue

        if (isNight) {
          if (win.lit) {
            const flicker =
              Math.max(
                0,
                1 -
                  (time %
                    (3 +
                      idx *
                        0.1)) *
                    win.flicker,
              )

            const alpha =
              0.8 +
              Math.sin(
                time * 0.5 +
                  idx,
              ) *
                0.2

            ctx.shadowColor =
              `rgba(${mc.windowLitRgb},0.7)`

            ctx.shadowBlur =
              isDark ? 8 : 4

            ctx.fillStyle =
              `rgba(${mc.windowLitRgb},${Math.max(
                0.35,
                alpha *
                  flicker,
              )})`

            ctx.fillRect(
              wx,
              wy,
              winW,
              winH,
            )

            ctx.shadowBlur = 0

            if (win.person) {
              ctx.fillStyle =
                isDark
                  ? 'rgba(5,5,15,0.9)'
                  : 'rgba(230,230,240,0.5)'

              const move =
                Math.sin(
                  time * 1.5 +
                    idx,
                ) * 2.5

              ctx.fillRect(
                wx +
                  2 +
                  move,
                wy + 3,
                3,
                3,
              )

              ctx.fillRect(
                wx +
                  1 +
                  move,
                wy + 6,
                5,
                2,
              )
            }
          } else {
            ctx.fillStyle =
              mc.windowUnlitNight

            ctx.fillRect(
              wx,
              wy,
              winW,
              winH,
            )
          }
        } else {
          ctx.fillStyle =
            mc.windowUnlitDay

          ctx.fillRect(
            wx,
            wy,
            winW,
            winH,
          )
        }
      }
    }

    /* door */

    const doorW = Math.max(18, b.width * 0.18)
    const doorH = Math.max(28, b.height * 0.12)
    const doorX = b.x + (b.width - doorW) / 2
    const doorY = groundY - doorH

    ctx.fillStyle = isDark
      ? 'rgba(101,67,33,0.95)'
      : 'rgba(139,90,43,0.95)'

    ctx.fillRect(
      doorX,
      doorY,
      doorW,
      doorH,
    )

    ctx.strokeStyle = isDark
      ? 'rgba(60,40,20,0.9)'
      : 'rgba(80,50,25,0.9)'

    ctx.lineWidth = 2

    ctx.strokeRect(
      doorX,
      doorY,
      doorW,
      doorH,
    )

    /* door handle */

    ctx.fillStyle = isDark
      ? 'rgba(255,200,50,0.8)'
      : 'rgba(255,210,60,0.9)'

    ctx.beginPath()

    ctx.arc(
      doorX + doorW * 0.75,
      doorY + doorH * 0.55,
      2,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    /* building label */

    const labelX =
      b.x +
      b.width / 2

    const fontSize =
      Math.max(
        12,
        Math.min(
          16,
          segmentWidth *
            0.1,
        ),
      )

    ctx.font =
      `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`

    ctx.textAlign =
      'center'

    ctx.textBaseline =
      'middle'

    const maxTextW =
      segmentWidth *
      0.82

    let label = b.label

    if (
      ctx.measureText(
        label,
      ).width >
      maxTextW
    ) {
      while (
        label.length > 1 &&
        ctx.measureText(
          label + '…',
        ).width >
          maxTextW
      ) {
        label =
          label.slice(
            0,
            -1,
          )
      }

      label += '…'
    }

    const textW =
      ctx.measureText(
        label,
      ).width

    const textH =
      fontSize * 1.1

    const padX = 6
    const padY = 3
    const radius = 7

    const labelY =
      doorY - 12

    const pillX =
      labelX -
      textW / 2 -
      padX

    const pillY =
      labelY -
      textH / 2 -
      padY

    const pillW =
      textW +
      padX * 2

    const pillH =
      textH +
      padY * 2

    ctx.fillStyle =
      'rgba(0,0,0,0.65)'

    ctx.strokeStyle =
      'rgba(255,50,50,0.6)'

    ctx.lineWidth = 1

    roundRectPath(
      ctx,
      pillX,
      pillY,
      pillW,
      pillH,
      radius,
    )

    ctx.fill()
    ctx.stroke()

    ctx.fillStyle =
      '#ff3333'

    ctx.fillText(
      label,
      labelX,
      labelY,
    )
  }

  ctx.textAlign =
    'start'

  ctx.textBaseline =
    'alphabetic'
}

/* -------------------------------------------------------------------------- */
/* Street                                                                     */
/* -------------------------------------------------------------------------- */

function drawStreet(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  isDark: boolean,
) {
  const streetTop =
    groundY +
    SIDEWALK_HEIGHT

  const canvasH =
    ctx.canvas.height

  /* sidewalk */

  ctx.fillStyle = isDark
    ? 'rgba(70,75,85,0.95)'
    : 'rgba(160,165,175,0.9)'

  ctx.fillRect(
    0,
    groundY,
    ctx.canvas.width,
    SIDEWALK_HEIGHT,
  )

  /* sidewalk joints */

  ctx.strokeStyle =
    isDark
      ? 'rgba(40,45,55,0.8)'
      : 'rgba(120,125,135,0.7)'

  ctx.lineWidth = 1

  const jointSpacingX = 18
  const jointSpacingY = 13

  for (
    let x =
      jointSpacingX;
    x <
    ctx.canvas.width;
    x += jointSpacingX
  ) {
    ctx.beginPath()
    ctx.moveTo(
      x,
      groundY,
    )
    ctx.lineTo(
      x,
      streetTop,
    )
    ctx.stroke()
  }

  for (
    let y =
      groundY +
      jointSpacingY;
    y < streetTop;
    y += jointSpacingY
  ) {
    ctx.beginPath()
    ctx.moveTo(
      0,
      y,
    )
    ctx.lineTo(
      ctx.canvas.width,
      y,
    )
    ctx.stroke()
  }

  /* curb */

  ctx.fillStyle = isDark
    ? 'rgba(180,180,190,0.9)'
    : 'rgba(200,205,215,0.9)'

  ctx.fillRect(
    0,
    streetTop,
    ctx.canvas.width,
    CURB_HEIGHT,
  )

  /* road */

  const roadTop =
    streetTop +
    CURB_HEIGHT

  ctx.fillStyle = isDark
    ? 'rgba(25,28,35,0.95)'
    : 'rgba(50,52,58,0.9)'

  ctx.fillRect(
    0,
    roadTop,
    ctx.canvas.width,
    canvasH -
      roadTop,
  )

  /* center road line */

  ctx.strokeStyle =
    isDark
      ? 'rgba(255,220,100,0.5)'
      : 'rgba(255,220,100,0.7)'

  ctx.lineWidth = 2

  ctx.setLineDash([
    12,
    18,
  ])

  const centerY =
    roadTop +
    (canvasH -
      roadTop) /
      2

  ctx.beginPath()

  ctx.moveTo(
    0,
    centerY,
  )

  ctx.lineTo(
    ctx.canvas.width,
    centerY,
  )

  ctx.stroke()

  ctx.setLineDash([])

  /* road edge */

  ctx.strokeStyle =
    isDark
      ? 'rgba(255,255,255,0.2)'
      : 'rgba(255,255,255,0.4)'

  ctx.lineWidth = 1.5

  ctx.beginPath()

  ctx.moveTo(
    0,
    roadTop,
  )

  ctx.lineTo(
    ctx.canvas.width,
    roadTop,
  )

  ctx.stroke()
}

/* -------------------------------------------------------------------------- */
/* Walking person                                                              */
/* -------------------------------------------------------------------------- */

function drawWalkingPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  time: number,
) {
  const cycle =
    Math.sin(time * 7)

  const skin = '#d4a574'
  const shirt = '#2563eb'
  const pants = '#1e293b'
  const hair = '#3e2723'
  const shoe = '#0f172a'

  ctx.save()

  ctx.translate(
    x,
    groundY - 31,
  )

  ctx.scale(
    0.85,
    0.85,
  )

  ctx.fillStyle =
    'rgba(0,0,0,0.18)'

  ctx.beginPath()

  ctx.ellipse(
    2,
    35,
    15,
    5,
    0,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  /* body */

  ctx.fillStyle =
    shirt

  ctx.fillRect(
    -6,
    -40,
    12,
    40,
  )

  /* back leg */

  ctx.strokeStyle =
    pants

  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const bkneeX =
    -8 +
    Math.sin(cycle) *
      10

  const bkneeY =
    18 +
    Math.abs(
      Math.cos(cycle),
    ) *
      4

  const bfootX =
    bkneeX +
    Math.sin(
      cycle * 1.5,
    ) *
      6

  const bfootY = 36

  ctx.beginPath()
  ctx.moveTo(
    -2,
    0,
  )
  ctx.lineTo(
    bkneeX,
    bkneeY,
  )
  ctx.lineTo(
    bfootX,
    bfootY,
  )
  ctx.stroke()

  /* back arm */

  ctx.strokeStyle =
    shirt

  ctx.lineWidth = 5

  const belbowX =
    -10 +
    Math.sin(-cycle) *
      8

  const belbowY =
    -26 +
    Math.abs(
      Math.cos(-cycle),
    ) *
      3

  const bhandX =
    belbowX +
    Math.sin(
      -cycle * 1.5,
    ) *
      5

  const bhandY =
    belbowY + 10

  ctx.beginPath()

  ctx.moveTo(
    -6,
    -38,
  )

  ctx.lineTo(
    belbowX,
    belbowY,
  )

  ctx.lineTo(
    bhandX,
    bhandY,
  )

  ctx.stroke()

  /* front leg */

  const fkneeX =
    8 +
    Math.sin(-cycle) *
      10

  const fkneeY =
    18 +
    Math.abs(
      Math.cos(-cycle),
    ) *
      4

  const ffootX =
    fkneeX +
    Math.sin(
      -cycle * 1.5,
    ) *
      6

  const ffootY = 36

  ctx.strokeStyle =
    pants

  ctx.lineWidth = 7

  ctx.beginPath()

  ctx.moveTo(
    2,
    0,
  )

  ctx.lineTo(
    fkneeX,
    fkneeY,
  )

  ctx.lineTo(
    ffootX,
    ffootY,
  )

  ctx.stroke()

  /* front arm */

  const felbowX =
    10 +
    Math.sin(cycle) *
      8

  const felbowY =
    -26 +
    Math.abs(
      Math.cos(cycle),
    ) *
      3

  const fhandX =
    felbowX +
    Math.sin(
      cycle * 1.5,
    ) *
      5

  const fhandY =
    felbowY + 10

  ctx.strokeStyle =
    shirt

  ctx.lineWidth = 5

  ctx.beginPath()

  ctx.moveTo(
    6,
    -38,
  )

  ctx.lineTo(
    felbowX,
    felbowY,
  )

  ctx.lineTo(
    fhandX,
    fhandY,
  )

  ctx.stroke()

  /* hands */

  ctx.fillStyle =
    skin

  ctx.beginPath()

  ctx.arc(
    bhandX,
    bhandY,
    3,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  ctx.beginPath()

  ctx.arc(
    fhandX,
    fhandY,
    3,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  /* shoes */

  ctx.fillStyle =
    shoe

  ctx.beginPath()

  ctx.ellipse(
    ffootX - 2,
    ffootY,
    5,
    3,
    0,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  ctx.beginPath()

  ctx.ellipse(
    bfootX - 2,
    bfootY,
    5,
    3,
    0,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  /* head */

  const headX = 2
  const headY = -52

  ctx.fillStyle =
    skin

  ctx.beginPath()

  ctx.arc(
    headX,
    headY,
    9,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  /* hair */

  ctx.fillStyle =
    hair

  ctx.beginPath()

  ctx.arc(
    headX,
    headY - 2,
    9.5,
    Math.PI,
    0,
  )

  ctx.fill()

  /* eye */

  ctx.fillStyle =
    '#1e293b'

  ctx.beginPath()

  ctx.arc(
    headX + 3,
    headY - 1,
    1.5,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  /* smile */

  ctx.strokeStyle =
    '#1e293b'

  ctx.lineWidth = 1

  ctx.beginPath()

  ctx.arc(
    headX + 3,
    headY + 3,
    2.5,
    0.2,
    Math.PI - 0.2,
  )

  ctx.stroke()

  ctx.restore()
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function DynamicWeatherBackground({
  isDark = true,
  showWalker = false,
  buildings: buildingMetas = DEFAULT_BUILDINGS,
  onBuildingClick,
}: {
  isDark?: boolean
  showWalker?: boolean
  buildings?: BuildingMeta[]
  onBuildingClick?: (
    to: string,
  ) => void
}) {
  const cityCanvasRef =
    useRef<HTMLCanvasElement>(null)

  const precipCanvasRef =
    useRef<HTMLCanvasElement>(null)

  const backgroundRef =
    useRef<HTMLDivElement>(null)

  const navigate =
    useNavigate()

  const [weather, setWeather] =
    useState<WeatherData | null>(
      null,
    )

  const [mounted, setMounted] =
    useState(false)

  const buildingsRef =
    useRef<Building[]>([])

  const treesRef =
    useRef<Tree[]>([])

  const cloudsRef =
    useRef<Cloud[]>([])

  const birdsRef =
    useRef<Bird[]>([])

  const airplanesRef =
    useRef<Airplane[]>([])

  const buildingMetasRef =
    useRef(buildingMetas)

  const onBuildingClickRef =
    useRef(onBuildingClick)

  const walkerRef = useRef({
    x: -60,
    active: false,
  })

  const showWalkerRef =
    useRef(showWalker)

  const flyingLeavesRef =
    useRef<FlyingLeaf[]>([])

  /* Keep refs current */

  useEffect(() => {
    buildingMetasRef.current =
      buildingMetas
  }, [buildingMetas])

  useEffect(() => {
    onBuildingClickRef.current =
      onBuildingClick
  }, [onBuildingClick])

  useEffect(() => {
    showWalkerRef.current =
      showWalker
  }, [showWalker])

  /* Weather */

  const displayWeather =
    useMemo(() => {
      if (!weather) return null

      if (isDark) {
        return {
          ...weather,
          time:
            'night' as const,
        }
      }

      return {
        ...weather,
        time:
          'day' as const,
      }
    }, [weather, isDark])

  useEffect(() => {
    setMounted(true)

    let cancelled = false

    ;(async () => {
      try {
        const data =
          await fetchUserWeather()

        if (!cancelled) {
          setWeather(data)
        }
      } catch {
        const hour =
          new Date().getHours()

        let time:
          WeatherData['time'] =
          'day'

        if (
          hour >= 20 ||
          hour < 6
        ) {
          time = 'night'
        } else if (
          hour >= 6 &&
          hour < 8
        ) {
          time = 'sunrise'
        } else if (
          hour >= 18 &&
          hour < 20
        ) {
          time = 'sunset'
        }

        if (!cancelled) {
          setWeather({
            condition: 'clear',
            temperature: 72,
            windSpeed: 5,
            time,
            location:
              'Default Location',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const skyColors =
    useMemo(
      () =>
        displayWeather
          ? getSkyColors(
              displayWeather,
            )
          : null,
      [displayWeather],
    )

  const adjustedSky =
    useMemo(() => {
      if (!skyColors) return null

      if (isDark) {
        return skyColors
      }

      return {
        top: lightenColor(
          skyColors.top,
          0.35,
        ),
        bottom: lightenColor(
          skyColors.bottom,
          0.35,
        ),
        ambient: lightenColor(
          skyColors.ambient,
          0.35,
        ),
      }
    }, [
      skyColors,
      isDark,
    ])

  const moonInfo =
    useMemo(
      () =>
        getMoonPhase(
          new Date(),
        ),
      [mounted],
    )

  const sunPos =
    useMemo(
      () =>
        displayWeather
          ? getSunPosition(
              displayWeather.time,
            )
          : null,
      [displayWeather],
    )

  /* ------------------------------------------------------------------------ */
  /* Main canvas animation                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const cityCanvas =
      cityCanvasRef.current

    const precipCanvas =
      precipCanvasRef.current

    if (
      !cityCanvas ||
      !precipCanvas
    ) {
      return
    }

    const cityCtx =
      cityCanvas.getContext(
        '2d',
      )

    const precipCtx =
      precipCanvas.getContext(
        '2d',
      )

    if (
      !cityCtx ||
      !precipCtx
    ) {
      return
    }

    const resize = () => {
      const width =
        window.innerWidth

      const cityWrapper =
        cityCanvas.parentElement

      const rect =
        cityWrapper?.getBoundingClientRect()

      const cityHeight =
        rect?.height ??
        CITY_HEIGHT

      cityCanvas.width =
        width

      cityCanvas.height =
        cityHeight

      precipCanvas.width =
        width

      precipCanvas.height =
        window.innerHeight

      const groundY =
        cityCanvas.height -
        80

      buildingsRef.current =
        generateBuildings(
          buildingMetasRef.current,
          cityCanvas.width,
        )

      /*
       * Tall trees are generated relative to
       * the city ground but extend far upward.
       */
      treesRef.current =
        generateTrees(
          cityCanvas.width,
          groundY,
        )

      flyingLeavesRef.current =
        generateFlyingLeaves(
          cityCanvas.width,
          cityCanvas.height,
          treesRef.current,
        )

      /*
       * Clouds stay high.
       */
      cloudsRef.current =
        generateClouds(
          cityCanvas.width,
          cityCanvas.height,
        )

      /*
       * Birds occupy the high/middle sky.
       */
      birdsRef.current =
        generateBirds(
          cityCanvas.width,
          cityCanvas.height,
        )

      /*
       * Multiple airplanes are allowed,
       * but they spawn at random times.
       */
      airplanesRef.current =
        Array.from(
          {
            length: 4,
          },
          () => {
            const plane =
              createAirplane(
                cityCanvas.width,
                cityCanvas.height,
              )

            plane.active =
              Math.random() >
              0.55

            if (!plane.active) {
              plane.nextDelay =
                1000 +
                Math.random() *
                  10000
            }

            return plane
          },
        )
    }

    resize()

    window.addEventListener(
      'resize',
      resize,
    )

    const condition =
      displayWeather?.condition

    const isPrecip =
      condition === 'rain' ||
      condition === 'storm'

    const isSnow =
      condition === 'snow'

    const isNight =
      displayWeather?.time ===
      'night'

    const precipCount =
      isSnow
        ? 180
        : 260

    const precipParticles =
      Array.from(
        {
          length:
            precipCount,
        },
        () => ({
          x:
            Math.random() *
            precipCanvas.width,

          y:
            Math.random() *
            precipCanvas.height,

          speed: isSnow
            ? 0.4 +
              Math.random() *
                1.2
            : 6 +
              Math.random() *
                10,

          length: isSnow
            ? 2 +
              Math.random() *
                3
            : 10 +
              Math.random() *
                16,

          opacity: isDark
            ? 0.15 +
              Math.random() *
                0.45
            : 0.1 +
              Math.random() *
                0.25,

          wind:
            (Math.random() -
              0.5) *
            0.6,
        }),
      )

    let raf = 0
    let time = 0

    const draw = () => {
      time += 0.016

      cityCtx.clearRect(
        0,
        0,
        cityCanvas.width,
        cityCanvas.height,
      )

      precipCtx.clearRect(
        0,
        0,
        precipCanvas.width,
        precipCanvas.height,
      )

      /* -------------------------------------------------------------- */
      /* Clouds                                                          */
      /* -------------------------------------------------------------- */

      drawClouds(
        cityCtx,
        cloudsRef.current,
        cityCanvas.width,
        isDark,
      )

      /* -------------------------------------------------------------- */
      /* Birds                                                           */
      /* -------------------------------------------------------------- */

      drawBirds(
        cityCtx,
        birdsRef.current,
        cityCanvas.width,
        time,
        isDark,
      )

      /* -------------------------------------------------------------- */
      /* Airplanes                                                       */
      /* -------------------------------------------------------------- */

      drawAirplanes(
        cityCtx,
        airplanesRef.current,
        cityCanvas.width,
        cityCanvas.height,
        time,
        isDark,
      )

      /* -------------------------------------------------------------- */
      /* Rain / snow                                                     */
      /* -------------------------------------------------------------- */

      if (
        isPrecip ||
        isSnow
      ) {
        for (
          const p of precipParticles
        ) {
          precipCtx.beginPath()

          if (isSnow) {
            precipCtx.fillStyle =
              `rgba(255,255,255,${p.opacity})`

            precipCtx.arc(
              p.x,
              p.y,
              p.length * 0.5,
              0,
              Math.PI * 2,
            )

            precipCtx.fill()
          } else {
            const grad =
              precipCtx.createLinearGradient(
                p.x,
                p.y,
                p.x +
                  p.wind *
                    2,
                p.y +
                  p.length,
              )

            grad.addColorStop(
              0,
              'rgba(173,216,230,0)',
            )

            grad.addColorStop(
              1,
              `rgba(173,216,230,${p.opacity})`,
            )

            precipCtx.strokeStyle =
              grad

            precipCtx.lineWidth =
              1.2

            precipCtx.moveTo(
              p.x,
              p.y,
            )

            precipCtx.lineTo(
              p.x +
                p.wind *
                  2,
              p.y +
                p.length,
            )

            precipCtx.stroke()
          }

          p.y += p.speed
          p.x += p.wind

          if (
            p.y >
            precipCanvas.height
          ) {
            p.y = -p.length
            p.x =
              Math.random() *
              precipCanvas.width
          }

          if (
            p.x >
            precipCanvas.width
          ) {
            p.x = 0
          }

          if (p.x < 0) {
            p.x =
              precipCanvas.width
          }
        }
      }

      /* -------------------------------------------------------------- */
      /* City                                                            */
      /* -------------------------------------------------------------- */

      const groundY =
        cityCanvas.height -
        80

      drawCity(
        cityCtx,
        buildingsRef.current,
        treesRef.current,
        groundY,
        isNight,
        time,
        isDark,
      )

      drawStreet(
        cityCtx,
        groundY,
        isDark,
      )

      /* -------------------------------------------------------------- */
      /* Flying leaves                                                   */
      /* -------------------------------------------------------------- */

      const newLeaf = spawnLeaf(
        treesRef.current,
        groundY,
      )

      if (newLeaf) {
        flyingLeavesRef.current.push(newLeaf)
      }

      drawFlyingLeaves(
        cityCtx,
        flyingLeavesRef.current,
        cityCanvas.width,
        cityCanvas.height,
        time,
        0.016,
      )

      /* -------------------------------------------------------------- */
      /* Walker                                                          */
      /* -------------------------------------------------------------- */

      if (
        showWalkerRef.current
      ) {
        const walker =
          walkerRef.current

        if (!walker.active) {
          walker.active =
            true

          walker.x = -60
        }

        walker.x += 1.1

        if (
          walker.x >
          cityCanvas.width +
            80
        ) {
          walker.x = -60
        }

        drawWalkingPerson(
          cityCtx,
          walker.x,
          groundY,
          time,
        )
      } else {
        walkerRef.current.active =
          false
      }

      /* -------------------------------------------------------------- */
      /* Random window lights                                             */
      /* -------------------------------------------------------------- */

      if (
        isNight &&
        isDark &&
        Math.random() <
          0.03
      ) {
        const allWindows =
          buildingsRef.current.flatMap(
            (b) =>
              b.windows,
          )

        if (allWindows.length) {
          const idx =
            Math.floor(
              Math.random() *
                allWindows.length,
            )

          const target =
            allWindows[idx]

          if (target) {
            target.lit =
              !target.lit

            if (target.lit) {
              target.flicker =
                Math.random() <
                0.15
                  ? Math.random() *
                    0.4
                  : 0
            }
          }
        }
      }

      raf =
        requestAnimationFrame(
          draw,
        )
    }

    draw()

    return () => {
      cancelAnimationFrame(
        raf,
      )

      window.removeEventListener(
        'resize',
        resize,
      )
    }
  }, [
    displayWeather?.condition,
    displayWeather?.time,
    isDark,
  ])

  /* ------------------------------------------------------------------------ */
  /* Building click                                                           */
  /* ------------------------------------------------------------------------ */

  const handleCityClick = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    const canvas =
      cityCanvasRef.current

    if (!canvas) return

    const rect =
      canvas.getBoundingClientRect()

    const x =
      e.clientX -
      rect.left

    const building =
      buildingsRef.current.find(
        (b) =>
          x >= b.x &&
          x <=
            b.x +
              b.width,
      )

    if (!building) {
      return
    }

    const target =
      building.to

    if (
      onBuildingClickRef.current
    ) {
      onBuildingClickRef.current(
        target,
      )
    } else {
      navigate(target)
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Sky                                                                       */
  /* ------------------------------------------------------------------------ */

  const skyStyle =
    adjustedSky
      ? {
          background:
            `linear-gradient(to bottom, ${adjustedSky.top} 0%, ${adjustedSky.bottom} 100%)`,
        }
      : {
          background:
            'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)',
        }

  const isNight =
    displayWeather?.time ===
    'night'

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div
      ref={backgroundRef}
      className="pointer-events-none fixed inset-0"
      style={skyStyle}
    >
      {/* -------------------------------------------------------------- */}
      {/* Stars                                                           */}
      {/* -------------------------------------------------------------- */}

      {isNight &&
        isDark && (
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                'radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 40% 70%, white, transparent), radial-gradient(1px 1px at 60% 20%, white, transparent), radial-gradient(1px 1px at 80% 50%, white, transparent), radial-gradient(1px 1px at 10% 80%, white, transparent), radial-gradient(1px 1px at 70% 90%, white, transparent), radial-gradient(1px 1px at 90% 10%, white, transparent), radial-gradient(1px 1px at 50% 50%, white, transparent)',
              backgroundSize:
                '250px 250px',
            }}
          />
        )}

      {/* -------------------------------------------------------------- */}
      {/* Sun                                                             */}
      {/* -------------------------------------------------------------- */}

      {displayWeather &&
        sunPos &&
        sunPos.opacity > 0 && (
          <div
            className="absolute rounded-full"
            style={{
              top:
                `${sunPos.y}%`,
              left:
                `${sunPos.x}%`,
              width: 100,
              height: 100,
              background:
                'radial-gradient(circle, rgba(255,236,179,0.95) 0%, rgba(255,200,50,0.6) 40%, rgba(255,140,0,0) 70%)',
              opacity:
                sunPos.opacity,
              transform:
                'translate(-50%, -50%)',
              boxShadow:
                '0 0 80px rgba(255,200,50,0.5), 0 0 160px rgba(255,140,0,0.25)',
              zIndex: 1,
            }}
          />
        )}

      {/* -------------------------------------------------------------- */}
      {/* Moon                                                            */}
      {/* -------------------------------------------------------------- */}

      {isNight && (
        <div
          className="absolute rounded-full"
          style={{
            top: '10%',
            right: '12%',
            width: 80,
            height: 80,
            background:
              'radial-gradient(circle at 30% 30%, #fefefe, #d4d4d4)',
            opacity: 0.9,
            boxShadow:
              '0 0 50px rgba(200,210,255,0.4), 0 0 100px rgba(150,170,255,0.2)',
            zIndex: 1,
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow:
                `inset ${
                  moonInfo.illumination >
                  50
                    ? '-'
                    : ''
                }${Math.abs(
                  moonInfo.illumination -
                    50,
                ) * 0.8}px 0 0 rgba(10,15,30,0.85)`,
            }}
          />
        </div>
      )}

      {/* -------------------------------------------------------------- */}
      {/* City                                                             */}
      {/* -------------------------------------------------------------- */}

      <div className="absolute inset-x-0 bottom-0 z-[2] h-[420px]">
        <canvas
          ref={
            cityCanvasRef
          }
          onClick={
            handleCityClick
          }
          className="absolute inset-0 h-full w-full cursor-pointer"
          style={{
            pointerEvents:
              'auto',
          }}
        />

        <div
          className="absolute inset-x-0 bottom-0 h-6"
          style={{
            background: isDark
              ? 'linear-gradient(to top, rgba(10,15,30,0.9), transparent)'
              : 'linear-gradient(to top, rgba(200,210,220,0.4), transparent)',
          }}
        />
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Rain / snow                                                     */}
      {/* -------------------------------------------------------------- */}

      <canvas
        ref={
          precipCanvasRef
        }
        className="absolute inset-0 z-[4]"
        style={{
          pointerEvents:
            'none',
        }}
      />
    </div>
  )
}