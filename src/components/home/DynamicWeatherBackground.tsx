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

interface BuildingMetaExtended extends BuildingMeta {
  type?: 'home' | 'arcade' | 'bank' | 'court' | 'standard' | 'achievement'
}

const DEFAULT_BUILDINGS: BuildingMetaExtended[] = [
  { label: 'Your Home', to: '/home', type: 'home' },
  { label: 'Chats', to: '/utromail', type: 'standard' },
  { label: 'MAI Troll Bank', to: '/store', type: 'bank' },
  { label: 'Treelz', to: '/treelz', type: 'standard' },
  { label: 'Go Live', to: '/broadcast/setup', type: 'standard' },
  { label: 'Court House', to: '/troll-court', type: 'court' },
  { label: 'Hytro Arcade', to: '/hytrogaming', type: 'arcade' },
  { label: 'MAI Pay', to: '/mai-pay', type: 'bank' },
  { label: 'Leaders', to: '/leaderboard', type: 'achievement' },
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
  buildingType: 'home' | 'arcade' | 'bank' | 'court' | 'standard' | 'achievement'
}

function generateBuildings(
  metas: BuildingMetaExtended[],
  canvasWidth: number,
): Building[] {
  const buildings: Building[] = []

  const count = Math.max(1, metas.length)
  const segmentWidth = canvasWidth / count

  for (let i = 0; i < count; i++) {
    const buildingType = metas[i].type || 'standard'

    // Give each landmark a silhouette that matches what it actually is.
    // Homes stay short and wide, and banks have a more substantial civic
    // footprint. Other buildings keep the original randomized skyline proportions.
    let width: number
    let height: number

    if (buildingType === 'home') {
      width = segmentWidth * (0.52 + Math.random() * 0.16)
      height = 105 + Math.random() * 55
    } else if (buildingType === 'bank') {
      width = segmentWidth * (0.72 + Math.random() * 0.18)
      height = 155 + Math.random() * 70
    } else {
      width = segmentWidth * (0.62 + Math.random() * 0.3)
      height = 100 + Math.random() * 220
    }

    // Select material based on building type
    let material: Material
    if (buildingType === 'bank') {
      material = 'concrete'
    } else if (buildingType === 'court') {
      material = 'stone'
    } else if (buildingType === 'arcade') {
      material = 'darkGlass'
    } else if (buildingType === 'home') {
      material = 'brick'
    } else {
      material = MATERIAL_POOL[i % MATERIAL_POOL.length]
    }

    const isGlass =
      material === 'glass' ||
      material === 'darkGlass'

    let cols: number
    let rows: number
    let winW: number
    let winH: number

    if (buildingType === 'home') {
      cols = Math.max(2, Math.floor(width / 34))
      rows = Math.max(1, Math.min(2, Math.floor(height / 48)))
      winW = 15
      winH = 18
    } else if (buildingType === 'bank') {
      cols = Math.max(4, Math.floor(width / 38))
      rows = Math.max(2, Math.min(4, Math.floor(height / 45)))
      winW = 17
      winH = 19
    } else {
      cols = Math.max(
        isGlass ? 3 : 1,
        Math.floor(
          width / (isGlass ? 32 : 20),
        ),
      )
      rows = Math.max(
        isGlass ? 3 : 1,
        Math.floor(
          height / (isGlass ? 28 : 24),
        ),
      )
      winW = isGlass ? 20 : 10
      winH = isGlass ? 18 : 14
    }

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
      buildingType,
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
        dark: 'rgba(28,22,38,0.92)',
        base: 'rgba(55,35,48,0.86)',
        mid: 'rgba(92,48,38,0.76)',
        light: 'rgba(165,76,28,0.68)',
      }
    : {
        dark: 'rgba(38,55,34,0.78)',
        base: 'rgba(70,85,38,0.72)',
        mid: 'rgba(135,86,35,0.68)',
        light: 'rgba(220,125,35,0.58)',
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
      height * 0.18,
      85,
    )

    clouds.push({
      x: Math.random() * width,
      y: 12 + Math.random() * maxY,
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
        35 +
        Math.random() *
          Math.min(
            95,
            height * 0.2,
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

    // Gentle, continuous vertical flight so birds follow a natural path.
    bird.y += Math.sin(time * 0.9 + bird.flapOffset) * 0.12

    if (bird.x > width + 30) {
      bird.x = -30
      bird.y =
        35 +
        Math.random() * 95
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

function drawBuildingDecorations(
  ctx: CanvasRenderingContext2D,
  building: Building,
  top: number,
  groundY: number,
  isDark: boolean,
  mc: MaterialColors,
) {
  const roofColor = isDark
    ? 'rgba(45,35,32,0.98)'
    : 'rgba(75,55,45,0.95)'

  switch (building.buildingType) {
    case 'bank': {
      // A recognizable real-world bank silhouette: civic facade, flat/parapet
      // roof, prominent sign, tall front windows, and a columned entrance.
      ctx.fillStyle = isDark
        ? 'rgba(42,46,55,0.98)'
        : 'rgba(205,202,190,0.98)'
      ctx.fillRect(
        building.x - 3,
        top - 8,
        building.width + 6,
        10,
      )

      // Bank name panel.
      ctx.fillStyle = isDark
        ? 'rgba(220,225,230,0.92)'
        : 'rgba(248,245,232,0.98)'
      ctx.fillRect(
        building.x + building.width * 0.16,
        top + 10,
        building.width * 0.68,
        24,
      )
      ctx.fillStyle = isDark
        ? 'rgba(30,45,65,0.98)'
        : 'rgba(40,65,90,0.98)'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        building.label.toUpperCase().includes('BANK') ? building.label.toUpperCase() : 'MAI TROLL BANK',
        building.x + building.width / 2,
        top + 26,
      )

      // Classical front columns.
      const colCount = 4
      const colW = Math.max(4, building.width * 0.018)
      for (let i = 0; i < colCount; i++) {
        const cx =
          building.x +
          building.width * (0.12 + i * 0.255)
        ctx.fillStyle = isDark
          ? 'rgba(170,175,185,0.9)'
          : 'rgba(235,232,218,0.98)'
        ctx.fillRect(cx, top + 38, colW, building.height - 52)
        ctx.fillRect(cx - 3, top + 36, colW + 6, 5)
        ctx.fillRect(cx - 3, groundY - 18, colW + 6, 5)
      }

      // Main entrance and subtle vault-door detail.
      const doorW = Math.min(52, building.width * 0.22)
      const doorX = building.x + (building.width - doorW) / 2
      ctx.fillStyle = isDark
        ? 'rgba(25,30,40,0.98)'
        : 'rgba(55,65,75,0.98)'
      ctx.fillRect(doorX, groundY - 58, doorW, 58)
      ctx.strokeStyle = 'rgba(190,195,200,0.75)'
      ctx.lineWidth = 2
      ctx.strokeRect(doorX + 4, groundY - 54, doorW - 8, 50)

      ctx.fillStyle = 'rgba(200,170,90,0.8)'
      ctx.beginPath()
      ctx.arc(doorX + doorW / 2, groundY - 29, 7, 0, Math.PI * 2)
      ctx.stroke()
      break
    }

    case 'home': {
      // A house should read as a house, not a rectangular commercial building:
      // lower profile, pitched roof, chimney, centered door, and porch.
      ctx.fillStyle = roofColor
      ctx.beginPath()
      ctx.moveTo(building.x - 8, top + 8)
      ctx.lineTo(building.x + building.width / 2, top - 42)
      ctx.lineTo(building.x + building.width + 8, top + 8)
      ctx.closePath()
      ctx.fill()

      // Chimney.
      ctx.fillStyle = isDark
        ? 'rgba(75,55,50,0.98)'
        : 'rgba(130,75,55,0.95)'
      ctx.fillRect(
        building.x + building.width * 0.72,
        top - 42,
        Math.max(8, building.width * 0.09),
        28,
      )

      // Front porch roof.
      const porchW = building.width * 0.48
      const porchX = building.x + (building.width - porchW) / 2
      ctx.fillStyle = roofColor
      ctx.fillRect(porchX - 5, groundY - 52, porchW + 10, 7)

      // Porch posts.
      ctx.fillStyle = isDark
        ? 'rgba(180,180,175,0.85)'
        : 'rgba(235,230,215,0.95)'
      ctx.fillRect(porchX, groundY - 47, 5, 47)
      ctx.fillRect(porchX + porchW - 5, groundY - 47, 5, 47)

      // Door.
      ctx.fillStyle = 'rgba(95,60,38,0.98)'
      ctx.fillRect(
        building.x + building.width / 2 - 11,
        groundY - 43,
        22,
        43,
      )
      ctx.fillStyle = 'rgba(245,205,95,0.95)'
      ctx.beginPath()
      ctx.arc(
        building.x + building.width / 2 + 7,
        groundY - 21,
        2.5,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      break
    }

    case 'court': {
      ctx.fillStyle = roofColor
      ctx.beginPath()
      ctx.moveTo(building.x, top)
      ctx.lineTo(building.x + building.width / 2, top - 30)
      ctx.lineTo(building.x + building.width, top)
      ctx.closePath()
      ctx.fill()

      const colCount = 4
      const colWidth = building.width / (colCount + 1)
      ctx.strokeStyle = 'rgba(180,180,180,0.6)'
      ctx.lineWidth = 3
      for (let i = 0; i < colCount; i++) {
        ctx.beginPath()
        ctx.moveTo(building.x + colWidth * (i + 1), top)
        ctx.lineTo(building.x + colWidth * (i + 1), groundY - 10)
        ctx.stroke()
      }
      break
    }

    case 'arcade': {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.7)'
      ctx.fillRect(building.x + 5, top + 15, building.width - 10, 20)
      ctx.fillStyle = 'rgba(255, 200, 0, 0.9)'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('ARCADE', building.x + building.width / 2, top + 28)
      break
    }

    case 'achievement': {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.7)'
      const rungs = 6
      const rungHeight = building.height / (rungs + 1)
      ctx.strokeStyle = 'rgba(180,140,60,0.7)'
      ctx.lineWidth = 2
      for (let i = 0; i < rungs; i++) {
        const y = top + rungHeight * (i + 1)
        ctx.beginPath()
        ctx.moveTo(building.x + 8, y)
        ctx.lineTo(building.x + building.width - 8, y)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(building.x + 5, top)
      ctx.lineTo(building.x + 5, groundY)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(building.x + building.width - 5, top)
      ctx.lineTo(building.x + building.width - 5, groundY)
      ctx.stroke()
      break
    }
  }
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
/* Halloween atmosphere                                                      */
/* -------------------------------------------------------------------------- */

function drawHalloweenAtmosphere(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  groundY: number,
  time: number,
  isDark: boolean,
) {
  /* Spooky purple/orange atmospheric glow behind the city. */
  const skyGlow = ctx.createLinearGradient(0, 0, 0, groundY)
  skyGlow.addColorStop(0, isDark ? 'rgba(18,5,35,0.30)' : 'rgba(75,20,90,0.10)')
  skyGlow.addColorStop(0.55, isDark ? 'rgba(45,8,55,0.18)' : 'rgba(120,35,70,0.06)')
  skyGlow.addColorStop(1, 'rgba(255,105,0,0.03)')
  ctx.fillStyle = skyGlow
  ctx.fillRect(0, 0, width, groundY)

  /* Slow-moving fog along the street. */
  const fogY = groundY + 18
  for (let i = 0; i < 5; i++) {
    const offset = ((time * (5 + i * 1.5) * (i % 2 ? -1 : 1)) + i * 190) % (width + 360)
    const x = offset - 180
    const fog = ctx.createRadialGradient(x, fogY, 0, x, fogY, 190 + i * 25)
    fog.addColorStop(0, isDark ? 'rgba(210,195,235,0.09)' : 'rgba(255,245,255,0.10)')
    fog.addColorStop(1, 'rgba(210,195,235,0)')
    ctx.fillStyle = fog
    ctx.fillRect(x - 210, fogY - 55, 420, 120)
  }

  /* Small bats crossing the upper skyline. */
  for (let i = 0; i < 5; i++) {
    const travel = (time * (8 + i * 2) + i * 180) % (width + 180)
    const x = travel - 90
    const y = 70 + Math.sin(time * 0.7 + i * 1.8) * 16 + i * 28
    const flap = Math.sin(time * 7 + i) * 4
    const size = 5 + (i % 3)

    ctx.save()
    ctx.translate(x, y)
    ctx.strokeStyle = isDark ? 'rgba(8,5,14,0.90)' : 'rgba(35,18,45,0.65)'
    ctx.lineWidth = 1.7
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(-size * 1.7, 0)
    ctx.quadraticCurveTo(-size, -size - flap, 0, 0)
    ctx.quadraticCurveTo(size, -size + flap, size * 1.7, 0)
    ctx.stroke()

    ctx.fillStyle = isDark ? 'rgba(8,5,14,0.90)' : 'rgba(35,18,45,0.65)'
    ctx.beginPath()
    ctx.ellipse(0, 1, size * 0.38, size * 0.65, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /* Pumpkins on the sidewalk: each building gets a nearby glowing jack-o'-lantern. */
  const pumpkinCount = Math.max(5, Math.floor(width / 150))
  for (let i = 0; i < pumpkinCount; i++) {
    const x = ((i + 0.5) * width) / pumpkinCount
    const bob = Math.sin(time * 1.4 + i) * 0.8
    const y = groundY + 9 + bob
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 28)
    glow.addColorStop(0, 'rgba(255,130,20,0.20)')
    glow.addColorStop(1, 'rgba(255,80,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - 30, y - 30, 60, 60)

    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = '#e87516'
    ctx.beginPath()
    ctx.ellipse(-5, 0, 7, 9, 0, 0, Math.PI * 2)
    ctx.ellipse(5, 0, 7, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#6b3b16'
    ctx.fillRect(-1.5, -11, 3, 4)

    ctx.fillStyle = '#160d1d'
    ctx.beginPath()
    ctx.moveTo(-7, -2); ctx.lineTo(-2, -5); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(2, -5); ctx.lineTo(7, -2); ctx.lineTo(3, 0); ctx.closePath(); ctx.fill()
    ctx.fillRect(-5, 4, 10, 2)
    ctx.restore()
  }

  /* A subtle orange/purple horizon wash. */
  const horizon = ctx.createLinearGradient(0, groundY - 55, 0, groundY + 30)
  horizon.addColorStop(0, 'rgba(255,105,0,0)')
  horizon.addColorStop(0.65, isDark ? 'rgba(255,80,0,0.055)' : 'rgba(255,120,0,0.035)')
  horizon.addColorStop(1, 'rgba(120,40,180,0.07)')
  ctx.fillStyle = horizon
  ctx.fillRect(0, groundY - 55, width, 90)

  void height
}

/* -------------------------------------------------------------------------- */
/* City                                                                       */
/* -------------------------------------------------------------------------- */

function drawCity(
  ctx: CanvasRenderingContext2D,
  _buildings: Building[],
  trees: Tree[],
  groundY: number,
  _isNight: boolean,
  time: number,
  isDark: boolean,
) {
  /*
   * Buildings are rendered as real HTML/CSS elements in the React layer.
   * Keeping them outside the canvas gives each building proper depth,
   * responsive text, hover states, clickable navigation, and richer
   * architecture while the canvas continues to handle the animated world.
   */
  drawTrees(
    ctx,
    trees,
    groundY,
    isDark,
    time,
  )
}

/* -------------------------------------------------------------------------- */
/* Realistic HTML buildings                                                     */
/* -------------------------------------------------------------------------- */

interface RealisticBuildingProps {
  building: Building
  isDark: boolean
  isNight: boolean
  onClick: (to: string) => void
}

function getBuildingFacade(
  building: Building,
  isDark: boolean,
): {
  background: string
  border: string
  trim: string
  shadow: string
  windowFrame: string
} {
  switch (building.buildingType) {
    case 'home':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #7f3f32 0%, #9f5541 48%, #693229 100%)'
          : 'linear-gradient(135deg, #a95f48 0%, #c8795a 48%, #8d4637 100%)',
        border: isDark ? 'rgba(55,25,22,.9)' : 'rgba(95,45,34,.7)',
        trim: isDark ? '#e5d5bd' : '#f2e3c8',
        shadow: 'rgba(25,15,12,.5)',
        windowFrame: '#38271f',
      }
    case 'bank':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #4e5967 0%, #707b89 50%, #38414d 100%)'
          : 'linear-gradient(135deg, #d8d4c8 0%, #f0ede3 50%, #c3c0b5 100%)',
        border: isDark ? 'rgba(20,25,32,.9)' : 'rgba(85,82,75,.65)',
        trim: isDark ? '#d8d4c9' : '#fffdf4',
        shadow: 'rgba(20,25,30,.48)',
        windowFrame: '#27303a',
      }
    case 'court':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #62636c 0%, #858691 50%, #50515a 100%)'
          : 'linear-gradient(135deg, #b9b6ad 0%, #ddd9ce 50%, #aaa79f 100%)',
        border: isDark ? 'rgba(35,35,40,.9)' : 'rgba(85,82,76,.7)',
        trim: isDark ? '#dedbd1' : '#f7f3e8',
        shadow: 'rgba(25,25,28,.48)',
        windowFrame: '#3d3e46',
      }
    case 'arcade':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #111c36 0%, #213866 48%, #0b1328 100%)'
          : 'linear-gradient(135deg, #243f70 0%, #456aa5 48%, #172a4b 100%)',
        border: 'rgba(80,145,255,.55)',
        trim: '#62e6ff',
        shadow: 'rgba(15,30,70,.58)',
        windowFrame: '#0b1224',
      }
    case 'achievement':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #3e4654 0%, #606b7c 50%, #2c3441 100%)'
          : 'linear-gradient(135deg, #8792a3 0%, #aeb7c5 50%, #717c8d 100%)',
        border: isDark ? 'rgba(20,25,34,.9)' : 'rgba(70,78,90,.7)',
        trim: '#e8d27a',
        shadow: 'rgba(25,30,38,.5)',
        windowFrame: '#28303c',
      }
    default:
      return {
        background: isDark
          ? 'linear-gradient(135deg, #46515f 0%, #667484 50%, #35404d 100%)'
          : 'linear-gradient(135deg, #9ba8b7 0%, #c0cbd7 50%, #8794a3 100%)',
        border: isDark ? 'rgba(20,25,32,.9)' : 'rgba(70,78,90,.65)',
        trim: '#e7e9eb',
        shadow: 'rgba(20,25,30,.45)',
        windowFrame: '#303945',
      }
  }
}

function RealisticBuilding({
  building,
  isDark,
  isNight,
  onClick,
}: RealisticBuildingProps) {
  const facade = getBuildingFacade(building, isDark)
  const isHome = building.buildingType === 'home'
  const isBank = building.buildingType === 'bank'
  const isCourt = building.buildingType === 'court'
  const isArcade = building.buildingType === 'arcade'
  const isAchievement = building.buildingType === 'achievement'

  const windows = building.windows.map((win, index) => {
    const row = Math.floor(index / building.cols)
    const col = index % building.cols
    const gapX =
      (building.width - building.cols * building.winW) /
      (building.cols + 1)
    const gapY =
      (building.height - building.rows * building.winH) /
      (building.rows + 1)

    return {
      ...win,
      left:
        gapX +
        col * (building.winW + gapX),
      top:
        gapY +
        row * (building.winH + gapY),
    }
  })

  const livePulse =
    building.label.toLowerCase().includes('live')

  return (
    <button
      type="button"
      aria-label={`Open ${building.label}`}
      onClick={() => onClick(building.to)}
      className="group absolute block cursor-pointer appearance-none border-0 bg-transparent p-0 text-left"
      style={{
        left: building.x,
        bottom: 80,
        width: building.width,
        height: building.height + (isHome ? 48 : isCourt ? 34 : 16),
        pointerEvents: 'auto',
        zIndex: 6,
        filter: `drop-shadow(0 18px 14px ${facade.shadow})`,
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 transition-transform duration-200 ease-out group-hover:-translate-y-1"
        style={{
          height: building.height,
        }}
      >
        {/* Main facade */}
        <div
          className="absolute inset-0 overflow-hidden rounded-t-[3px]"
          style={{
            background: facade.background,
            border: `1px solid ${facade.border}`,
            boxShadow: `
              inset 8px 0 16px rgba(255,255,255,.08),
              inset -10px 0 18px rgba(0,0,0,.18),
              inset 0 -12px 20px rgba(0,0,0,.16)
            `,
          }}
        >
          {/* Subtle facade texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                building.material === 'brick'
                  ? 'repeating-linear-gradient(0deg, transparent 0 13px, rgba(60,30,20,.32) 14px), repeating-linear-gradient(90deg, transparent 0 23px, rgba(70,35,25,.25) 24px)'
                  : building.material === 'stone'
                    ? 'repeating-linear-gradient(0deg, transparent 0 21px, rgba(45,45,50,.18) 22px), repeating-linear-gradient(90deg, transparent 0 42px, rgba(255,255,255,.08) 43px)'
                    : 'linear-gradient(90deg, rgba(255,255,255,.08), transparent 18%, transparent 82%, rgba(0,0,0,.08))',
            }}
          />

          {/* Windows */}
          {windows.map((win, index) => {
            const lit = isNight && win.lit
            return (
              <span
                key={`${building.label}-window-${index}`}
                className="absolute overflow-hidden rounded-[2px] transition-all duration-300"
                style={{
                  left: win.left,
                  top: win.top,
                  width: building.winW,
                  height: building.winH,
                  background: lit
                    ? `linear-gradient(145deg, rgba(${getMaterialColors(building.material, isDark).windowLitRgb},.98), rgba(${getMaterialColors(building.material, isDark).windowLitRgb},.58))`
                    : isNight
                      ? getMaterialColors(building.material, isDark).windowUnlitNight
                      : getMaterialColors(building.material, isDark).windowUnlitDay,
                  border: `2px solid ${facade.windowFrame}`,
                  boxShadow: lit
                    ? `0 0 10px rgba(${getMaterialColors(building.material, isDark).windowLitRgb},.55), inset 0 0 4px rgba(255,255,255,.35)`
                    : 'inset 0 0 4px rgba(0,0,0,.28)',
                }}
              >
                {lit && win.person && (
                  <span
                    className="absolute left-1/2 top-1/2 h-[35%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background: isDark
                        ? 'rgba(12,15,24,.9)'
                        : 'rgba(40,45,55,.55)',
                    }}
                  />
                )}
              </span>
            )
          })}

          {/* Ground-level entrance */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{
              width: Math.max(22, building.width * 0.18),
              height: Math.max(34, building.height * 0.13),
              background:
                'linear-gradient(90deg, #34251d, #65432d 45%, #2d211b)',
              border: '2px solid rgba(20,15,12,.8)',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.5)',
            }}
          >
            <span
              className="absolute right-[18%] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
              style={{ background: '#f5cf68', boxShadow: '0 0 5px #f5cf68' }}
            />
          </div>
        </div>

        {/* Home pitched roof */}
        {isHome && (
          <>
            <div
              className="absolute -left-[5%] -top-10 h-0 w-0"
              style={{
                borderLeft: `${building.width * 0.55}px solid transparent`,
                borderRight: `${building.width * 0.55}px solid transparent`,
                borderBottom: `52px solid ${isDark ? '#3a2725' : '#5b3830'}`,
                filter: 'drop-shadow(0 -3px 3px rgba(0,0,0,.3))',
              }}
            />
            <div
              className="absolute right-[17%] -top-10 w-[9%] min-w-[8px]"
              style={{
                height: 30,
                background: isDark ? '#513832' : '#865547',
                border: '1px solid rgba(40,25,20,.55)',
              }}
            />
            <div
              className="absolute left-[26%] right-[26%] bottom-[38%] h-1"
              style={{ background: facade.trim, opacity: .9 }}
            />
          </>
        )}

        {/* Bank parapet, sign, columns and entrance canopy */}
        {isBank && (
          <>
            <div
              className="absolute -left-[2%] -right-[2%] -top-2 h-3"
              style={{
                background: facade.trim,
                border: `1px solid ${facade.border}`,
                boxShadow: '0 3px 5px rgba(0,0,0,.25)',
              }}
            />
            <div
              className="absolute left-[14%] right-[14%] top-3 flex h-7 items-center justify-center rounded-sm px-1 text-center text-[10px] font-black uppercase tracking-[.08em]"
              style={{
                background: isDark
                  ? 'rgba(235,232,220,.9)'
                  : 'rgba(255,252,240,.98)',
                color: '#26384a',
                boxShadow: '0 2px 5px rgba(0,0,0,.2)',
              }}
            >
              {building.label.includes('Bank') ? building.label : 'MAI Troll Bank'}
            </div>
            <div className="absolute inset-x-[8%] bottom-0 top-[16%] flex justify-around">
              {[0, 1, 2, 3].map((column) => (
                <span
                  key={column}
                  className="h-full w-[3%] min-w-[4px]"
                  style={{
                    background: `linear-gradient(90deg, ${isDark ? '#9aa0aa' : '#f4f0e5'}, ${isDark ? '#e0e1dc' : '#ffffff'}, ${isDark ? '#858b95' : '#d0ccc1'})`,
                    boxShadow: '1px 0 3px rgba(0,0,0,.25)',
                  }}
                />
              ))}
            </div>
            <div
              className="absolute bottom-[13%] left-[30%] right-[30%] h-[3%] rounded-full"
              style={{
                background: facade.trim,
                boxShadow: '0 2px 4px rgba(0,0,0,.25)',
              }}
            />
          </>
        )}

        {/* Court house portico */}
        {isCourt && (
          <>
            <div
              className="absolute -left-[2%] -right-[2%] -top-7 h-7"
              style={{
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
                background: facade.trim,
                boxShadow: '0 -2px 4px rgba(0,0,0,.25)',
              }}
            />
            <div
              className="absolute left-[12%] right-[12%] top-0 h-3"
              style={{ background: facade.trim }}
            />
            {[0, 1, 2, 3].map((column) => (
              <span
                key={column}
                className="absolute bottom-0 top-0 w-[3%] min-w-[4px]"
                style={{
                  left: `${20 + column * 20}%`,
                  background: `linear-gradient(90deg, ${isDark ? '#85868d' : '#aaa79f'}, ${isDark ? '#eeeae0' : '#f7f3e8'}, ${isDark ? '#777880' : '#9b988f'})`,
                }}
              />
            ))}
          </>
        )}

        {/* Arcade neon marquee */}
        {isArcade && (
          <div
            className="absolute left-[5%] right-[5%] top-4 rounded-md border px-2 py-1 text-center text-[10px] font-black tracking-[.18em]"
            style={{
              color: '#fff',
              borderColor: 'rgba(98,230,255,.85)',
              background: 'linear-gradient(90deg, rgba(255,0,120,.7), rgba(80,80,255,.75), rgba(0,220,255,.7))',
              boxShadow: '0 0 14px rgba(98,230,255,.6), inset 0 0 10px rgba(255,255,255,.15)',
              textShadow: '0 0 8px rgba(255,255,255,.9)',
            }}
          >
            HYTRO ARCADE
          </div>
        )}

        {/* Leaders / achievement crown */}
        {isAchievement && (
          <div
            className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider"
            style={{
              color: '#fff4b0',
              background: 'linear-gradient(180deg, #8c6b1d, #4e3b13)',
              border: '1px solid rgba(255,225,110,.7)',
              boxShadow: '0 0 12px rgba(255,210,60,.25)',
            }}
          >
            LEADERS
          </div>
        )}

        {/* Halloween building decorations */}
        <div
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden="true"
        >
          {/* Purple/orange haunted trim */}
          <div
            className="absolute left-[3%] right-[3%] top-0 h-1 rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(255,112,0,.9), rgba(126,34,206,.95), rgba(255,112,0,.9))',
              boxShadow: '0 0 10px rgba(255,90,0,.45), 0 0 14px rgba(126,34,206,.35)',
            }}
          />

          {/* Spider webs in upper corners */}
          <div
            className="absolute left-1 top-1 h-10 w-10 opacity-80"
            style={{
              backgroundImage: `
                radial-gradient(circle at 0 0, transparent 0 2px, rgba(245,245,245,.55) 2px 3px, transparent 3px),
                repeating-conic-gradient(from 0deg at 0 0, rgba(245,245,245,.38) 0deg 2deg, transparent 2deg 22deg)
              `,
              borderRadius: '0 0 100% 0',
            }}
          />
          <div
            className="absolute right-1 top-1 h-10 w-10 rotate-90 opacity-80"
            style={{
              backgroundImage: `
                radial-gradient(circle at 0 0, transparent 0 2px, rgba(245,245,245,.55) 2px 3px, transparent 3px),
                repeating-conic-gradient(from 0deg at 0 0, rgba(245,245,245,.38) 0deg 2deg, transparent 2deg 22deg)
              `,
              borderRadius: '0 0 100% 0',
            }}
          />

          {/* Jack-o'-lantern */}
          <div
            className="absolute bottom-[8%] left-[7%] flex h-7 w-8 items-center justify-center rounded-[45%] border border-orange-300/60 bg-orange-500 shadow-[0_0_12px_rgba(255,120,0,.55)] animate-pulse"
          >
            <span className="absolute -top-1 h-1.5 w-1 rounded-full bg-green-700" />
            <span className="text-[8px] leading-none text-black">⌁⌁</span>
          </div>

          {/* Hanging ghost */}
          <div
            className="absolute right-[7%] top-[13%] text-[20px] opacity-80 animate-pulse"
            style={{ filter: 'drop-shadow(0 0 7px rgba(210,190,255,.45))' }}
          >
            👻
          </div>

          {/* Type-specific Halloween accent */}
          {isBank && (
            <div
              className="absolute right-[8%] bottom-[12%] rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase"
              style={{
                color: '#ffd166',
                background: 'rgba(60,15,75,.82)',
                border: '1px solid rgba(255,166,0,.6)',
                boxShadow: '0 0 8px rgba(255,120,0,.3)',
              }}
            >
              Spooky Savings
            </div>
          )}

          {isCourt && (
            <div
              className="absolute left-1/2 top-[16%] -translate-x-1/2 text-[18px]"
              style={{ filter: 'drop-shadow(0 0 8px rgba(126,34,206,.55))' }}
            >
              ☠
            </div>
          )}

          {isArcade && (
            <div
              className="absolute bottom-[18%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[7px] font-black tracking-widest"
              style={{
                color: '#ffb347',
                background: 'rgba(22,7,40,.86)',
                border: '1px solid rgba(255,102,0,.65)',
                boxShadow: '0 0 10px rgba(255,70,0,.45), 0 0 10px rgba(126,34,206,.35)',
              }}
            >
              HALLOWEEN ARCADE
            </div>
          )}

          {isAchievement && (
            <div
              className="absolute right-[7%] top-[12%] text-[18px]"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,180,40,.55))' }}
            >
              🕸️
            </div>
          )}
        </div>

        {/* Building label plaque */}
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-center text-[11px] font-bold shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-105"
          style={{
            bottom: -34,
            maxWidth: Math.max(90, building.width * .92),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isDark ? '#f8fafc' : '#0f172a',
            background: isDark
              ? 'rgba(5,10,18,.86)'
              : 'rgba(255,255,255,.92)',
            border: `1px solid ${livePulse ? 'rgba(255,65,65,.8)' : facade.border}`,
            boxShadow: livePulse
              ? '0 0 16px rgba(255,45,45,.4)'
              : '0 5px 12px rgba(0,0,0,.22)',
          }}
        >
          {building.label}
        </div>

        {/* Foundation / sidewalk contact */}
        <div
          className="absolute -bottom-[1px] left-0 right-0 h-2"
          style={{
            background: `linear-gradient(to bottom, ${facade.trim}, rgba(0,0,0,.25))`,
            borderTop: `1px solid ${facade.border}`,
          }}
        />
      </div>
    </button>
  )
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
  pedestrian: {
    variant: 'male' | 'female'
    phase: number
    hasPhone: boolean
    clothes: {
      shirt: string
      pants: string
      hair: string
      shoe: string
      skirt: boolean
      skirtColor: string
    }
  },
) {
  const cycle =
    Math.sin(time * 7 + pedestrian.phase)

  const skin = pedestrian.variant === 'female'
    ? '#f0c9a0'
    : '#d4a574'

  const shirt = pedestrian.clothes.shirt
  const pants = pedestrian.clothes.pants
  const hair = pedestrian.clothes.hair
  const shoe = pedestrian.clothes.shoe
  const skirt = pedestrian.clothes.skirt
  const skirtColor = pedestrian.clothes.skirtColor
  const hasPhone = pedestrian.hasPhone

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

  /* skirt for females */
  if (skirt) {
    ctx.fillStyle = skirtColor
    ctx.beginPath()
    ctx.moveTo(-8, -4)
    ctx.lineTo(8, -4)
    ctx.lineTo(6, 14)
    ctx.lineTo(-6, 14)
    ctx.closePath()
    ctx.fill()
  }

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

  /* phone in front hand with flash */
  if (hasPhone) {
    const phoneW = 7
    const phoneH = 13
    const phoneX = fhandX - phoneW / 2 + 1
    const phoneY = fhandY - phoneH / 2 - 2

    // Phone body
    ctx.fillStyle = '#1a1a2e'
    ctx.strokeStyle = '#0a0a14'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(phoneX, phoneY, phoneW, phoneH)
    ctx.fill()
    ctx.stroke()

    // Phone screen
    ctx.fillStyle = '#0d1b2a'
    ctx.fillRect(phoneX + 0.8, phoneY + 1, phoneW - 1.6, phoneH - 2.5)

    // Flash pointing at the person (toward their face)
    const flashX = phoneX + phoneW / 2 - 1
    const flashY = phoneY + 2
    const flashPulse = 0.5 + Math.sin(time * 12 + pedestrian.phase) * 0.5
    const flashR = 2 + flashPulse * 2

    ctx.save()
    ctx.translate(flashX, flashY)
    ctx.rotate(-0.6)

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR * 3)
    grad.addColorStop(0, `rgba(255,255,220,${0.9 * flashPulse})`)
    grad.addColorStop(0.4, `rgba(255,240,150,${0.5 * flashPulse})`)
    grad.addColorStop(1, 'rgba(255,240,150,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(0, 0, flashR * 3, 0, Math.PI * 2)
    ctx.fill()

    // Bright flash core
    ctx.fillStyle = `rgba(255,255,240,${flashPulse})`
    ctx.beginPath()
    ctx.arc(0, 0, flashR, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

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
  walkerCount = 1,
  buildings: buildingMetas = DEFAULT_BUILDINGS,
  onBuildingClick,
}: {
  isDark?: boolean
  showWalker?: boolean
  walkerCount?: number
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

  const [renderedBuildings, setRenderedBuildings] =
    useState<Building[]>([])

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

  const walkersRef = useRef<{
    x: number
    active: boolean
    speed: number
    variant: 'male' | 'female'
    phase: number
    hasPhone: boolean
    clothes: {
      shirt: string
      pants: string
      hair: string
      shoe: string
      skirt: boolean
      skirtColor: string
    }
  }[]>([])

  const showWalkerRef =
    useRef(showWalker)

  const walkerCountRef =
    useRef(walkerCount)

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

  useEffect(() => {
    walkerCountRef.current =
      walkerCount
  }, [walkerCount])

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

      const nextBuildings =
        generateBuildings(
          buildingMetasRef.current,
          cityCanvas.width,
        )

      buildingsRef.current = nextBuildings
      setRenderedBuildings(nextBuildings)

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
      /* Halloween atmosphere                                           */
      /* -------------------------------------------------------------- */

      const halloweenGroundY =
        cityCanvas.height - 80

      drawHalloweenAtmosphere(
        cityCtx,
        cityCanvas.width,
        cityCanvas.height,
        halloweenGroundY,
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

      /* Halloween road glow and scattered candles */
      const halloweenRoad = cityCtx.createLinearGradient(
        0,
        groundY + SIDEWALK_HEIGHT + CURB_HEIGHT,
        0,
        cityCanvas.height,
      )
      halloweenRoad.addColorStop(0, 'rgba(126,34,206,0.035)')
      halloweenRoad.addColorStop(0.5, 'rgba(255,100,0,0.02)')
      halloweenRoad.addColorStop(1, 'rgba(15,5,25,0.08)')
      cityCtx.fillStyle = halloweenRoad
      cityCtx.fillRect(
        0,
        groundY + SIDEWALK_HEIGHT + CURB_HEIGHT,
        cityCanvas.width,
        cityCanvas.height - (groundY + SIDEWALK_HEIGHT + CURB_HEIGHT),
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
        const count = Math.max(1, walkerCountRef.current)

        // Ensure we have enough walkers
        while (walkersRef.current.length < count) {
          const isFemale = walkersRef.current.length % 2 === 1
          const clothes = isFemale
            ? {
                shirt: '#ec4899',
                pants: '#1e293b',
                hair: '#fde68a',
                shoe: '#1f2937',
                skirt: true,
                skirtColor: '#fb7185',
              }
            : {
                shirt: ['#2563eb', '#16a34a', '#dc2626', '#7c3aed'][walkersRef.current.length % 4],
                pants: '#1e293b',
                hair: ['#3e2723', '#4a3728', '#6b4423'][walkersRef.current.length % 3],
                shoe: '#0f172a',
                skirt: false,
                skirtColor: '#000000',
              }
          walkersRef.current.push({
            x: -60 - walkersRef.current.length * 30,
            active: false,
            speed: 0.9 + Math.random() * 0.5,
            variant: isFemale ? 'female' : 'male',
            phase: walkersRef.current.length * 1.5,
            hasPhone: walkersRef.current.length % 3 === 0,
            clothes,
          })
        }

        // Trim extra walkers
        walkersRef.current = walkersRef.current.slice(0, count)

        const width = cityCanvas.width

        for (const walker of walkersRef.current) {
          if (!walker.active) {
            walker.active = true
            walker.x = -60 - Math.random() * 200
          }

          walker.x += walker.speed

          if (walker.x > width + 80) {
            walker.x = -60 - Math.random() * 300
          }

          drawWalkingPerson(
            cityCtx,
            walker.x,
            groundY,
            time,
            walker,
          )
        }
      } else {
        for (const walker of walkersRef.current) {
          walker.active = false
        }
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
    buildingMetas,
  ])

  /* ------------------------------------------------------------------------ */
  /* Building navigation                                                       */
  /* ------------------------------------------------------------------------ */

  const handleBuildingClick = (to: string) => {
    if (onBuildingClickRef.current) {
      onBuildingClickRef.current(to)
    } else {
      navigate(to)
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
            'linear-gradient(to bottom, #12071f 0%, #261034 48%, #3a1828 100%)',
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
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={skyStyle}
    >
      {/* Halloween color wash — weather colors remain underneath. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: isNight
            ? 'radial-gradient(circle at 78% 12%, rgba(220,190,255,.10), transparent 18%), linear-gradient(180deg, rgba(34,8,55,.28), rgba(75,12,45,.10) 55%, rgba(255,82,0,.045))'
            : 'linear-gradient(180deg, rgba(95,20,105,.08), rgba(255,100,0,.025) 70%, rgba(126,34,206,.08))',
          mixBlendMode: 'screen',
        }}
      />
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

      <div className="absolute inset-x-0 bottom-0 z-[2] h-[840px]">
        {/* Animated canvas world: trees, street, sky objects, weather, walkers */}
        <canvas
          ref={cityCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{
            pointerEvents: 'none',
          }}
        />

        {/* Realistic buildings sit above the canvas so they can be true interactive UI */}
        <div
          className="absolute inset-0 overflow-visible"
          style={{
            pointerEvents: 'none',
          }}
        >
          {renderedBuildings.map((building) => (
            <RealisticBuilding
              key={`${building.label}-${building.to}`}
              building={building}
              isDark={isDark}
              isNight={isNight}
              onClick={handleBuildingClick}
            />
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
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