/**
 * MaiTroll city: architectural realism edition. Original interactive city,
 * weather animation, route mapping and ambient effects preserved.
 * Detailed 2.5D facades replace the former generic rectangular storefronts.
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Video, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  fetchUserWeather,
  getSolarPhase,
  getSkyColors,
  type WeatherData,
} from '@/lib/weatherService'

/* -------------------------------------------------------------------------- */
/* Street / city dimensions                                                    */
/* -------------------------------------------------------------------------- */

const SIDEWALK_HEIGHT = 20
const CURB_HEIGHT = 40
const CITY_HEIGHT = 420
const BASE_BUILDING_COUNT = 8

export interface BuildingMeta {
  label: string
  to: string
  type?: 'home' | 'arcade' | 'bank' | 'court' | 'townHall' | 'jail' | 'church' | 'standard' | 'achievement' | 'broadcast'
}

type BuildingMetaExtended = BuildingMeta

const DEFAULT_BUILDINGS: BuildingMetaExtended[] = [
  { label: 'City Post Office', to: '/utromail', type: 'standard' },
  
  { label: 'Treelz Cinema', to: '/treelz', type: 'standard' },
  { label: 'Broadcast Tower', to: '/broadcast/setup', type: 'broadcast' },
  { label: 'Municipal Court', to: '/troll-court', type: 'court' },
  { label: 'Town Meeting Hall', to: '/town-meeting', type: 'townHall' },
  { label: 'City Jail & Inmates', to: '/inmates', type: 'jail' },
  { label: 'City Church', to: '/church', type: 'church' },
  { label: 'Game Center', to: '/hytrogaming', type: 'arcade' },
  { label: 'City Treasury', to: '/mai-pay', type: 'bank' },
  { label: 'Employment Office', to: '/careers', type: 'standard' },
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

function _roundRectPath(
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
  buildingType: 'home' | 'arcade' | 'bank' | 'court' | 'townHall' | 'jail' | 'church' | 'standard' | 'achievement' | 'broadcast'
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
    } else if (buildingType === 'broadcast') {
      width = segmentWidth * 0.96
      height = 110
    } else if (buildingType === 'townHall' || buildingType === 'jail' || buildingType === 'church') {
      width = segmentWidth * (0.76 + Math.random() * 0.12)
      height = buildingType === 'church' ? 155 + Math.random() * 45 : 145 + Math.random() * 55
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
    } else if (buildingType === 'townHall') {
      material = 'stone'
    } else if (buildingType === 'jail') {
      material = 'concrete'
    } else if (buildingType === 'church') {
      material = 'stone'
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

interface _Leaf {
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
  _groundY: number,
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

  const _trunkHighlight = isDark
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

function _drawBuildingDecorations(
  ctx: CanvasRenderingContext2D,
  building: Building,
  top: number,
  groundY: number,
  isDark: boolean,
  _mc: MaterialColors,
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
/* City                                                                       */
/* -------------------------------------------------------------------------- */

function drawCity(
  ctx: CanvasRenderingContext2D,
  _buildings: Building[],
  groundY: number,
  _isNight: boolean,
  time: number,
  isDark: boolean,
) {
}

/* -------------------------------------------------------------------------- */
/* Realistic HTML buildings                                                     */
/* -------------------------------------------------------------------------- */

interface RealisticBuildingProps {
  building: Building
  isDark: boolean
  isNight: boolean
  onClick: (to: string) => void
  onJoinRandomSeat?: () => void
  isJoiningRandomSeat?: boolean
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
    case 'townHall':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #77766c 0%, #aaa897 50%, #5b5b54 100%)'
          : 'linear-gradient(135deg, #c8c4b4 0%, #eee9d9 50%, #aaa696 100%)',
        border: isDark ? 'rgba(40,40,36,.9)' : 'rgba(95,90,75,.7)',
        trim: isDark ? '#e5dfc9' : '#fff9e8',
        shadow: 'rgba(30,28,22,.48)',
        windowFrame: '#46443d',
      }
    case 'jail':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #303843 0%, #4b5663 50%, #252d37 100%)'
          : 'linear-gradient(135deg, #687381 0%, #909ba7 50%, #515b67 100%)',
        border: isDark ? 'rgba(12,17,24,.95)' : 'rgba(45,53,62,.8)',
        trim: isDark ? '#9ba6b2' : '#d7dee5',
        shadow: 'rgba(10,14,20,.62)',
        windowFrame: '#1d2630',
      }
    case 'church':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #777286 0%, #aaa2b5 50%, #5d586c 100%)'
          : 'linear-gradient(135deg, #c8c0d0 0%, #eee8f2 50%, #a9a0b6 100%)',
        border: isDark ? 'rgba(39,34,50,.9)' : 'rgba(92,78,105,.7)',
        trim: isDark ? '#eee5d2' : '#fffaf0',
        shadow: 'rgba(25,20,35,.5)',
        windowFrame: '#393344',
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

/**
 * Architecture-first street scene. Each landmark uses its own elevations,
 * trim, roofline, glazing, street-level fittings and lighting.  All buildings
 * remain real buttons so original routing, keyboard interaction and external
 * click interception are preserved.
 */
function BuildingWindow({
  lit, night, frame, tall = false, arched = false, bars = false, glass = false,
}: {
  lit: boolean; night: boolean; frame: string; tall?: boolean; arched?: boolean;
  bars?: boolean; glass?: boolean
}) {
  const glow = night && lit
  return (
    <span className="relative block h-full w-full overflow-hidden" style={{
      border: `2px solid ${frame}`,
      borderTopLeftRadius: arched ? '48% 26%' : 2,
      borderTopRightRadius: arched ? '48% 26%' : 2,
      background: glow
        ? 'linear-gradient(125deg,#f5d5a0 0%,#d7a35f 48%,#594735 100%)'
        : glass
          ? night ? 'linear-gradient(135deg,#172635,#263d51 45%,#101b28)' : 'linear-gradient(130deg,#7798ac,#b2c6ca 42%,#4c7186 70%,#293e4c)'
          : night ? 'linear-gradient(135deg,#192733,#101a25 60%,#283744)' : 'linear-gradient(125deg,#506c79,#82939a 50%,#364c59)',
      boxShadow: glow ? '0 0 12px rgba(241,173,90,.46), inset 0 0 8px rgba(255,231,159,.25)' : 'inset 2px 3px 6px rgba(0,0,0,.35)',
    }}>
      <span className="absolute inset-y-0 left-[48%] w-[3%] bg-black/25" />
      {tall && <span className="absolute inset-x-0 top-[48%] h-[3%] bg-black/25" />}
      <span className="absolute -left-[12%] top-0 h-full w-[27%] -skew-x-[18deg] bg-white/15" />
      <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/25" />
      {bars && <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0%,transparent_17%,rgba(15,22,28,.92)_18%,rgba(15,22,28,.92)_21%)]" />}
    </span>
  )
}

function BuildingSign({ children, night, kind = 'stone' }: {
  children: React.ReactNode; night: boolean; kind?: 'stone' | 'neon' | 'dark'
}) {
  return (
    <div className="absolute left-[7%] right-[7%] top-[8%] z-20 flex min-h-[22px] items-center justify-center overflow-hidden rounded-[2px] border px-1 text-center text-[clamp(7px,.6vw,11px)] font-black uppercase tracking-[.06em]" style={{
      color: kind === 'neon' ? '#d8f9ff' : kind === 'dark' ? '#e3e7eb' : '#27313c',
      background: kind === 'neon' ? 'linear-gradient(115deg,#07152a,#182d47,#080e21)' : kind === 'dark' ? 'linear-gradient(#29343d,#151f2b)' : 'linear-gradient(#ebe8df,#bdb9ab)',
      borderColor: kind === 'neon' ? '#3acbe8' : 'rgba(38,41,45,.45)',
      textShadow: kind === 'neon' ? '0 0 9px #5ceafa' : '0 1px 1px rgba(255,255,255,.24)',
      boxShadow: kind === 'neon' && night ? '0 0 17px rgba(25,195,230,.75)' : '0 3px 5px rgba(0,0,0,.25)',
    }}>{children}</div>
  )
}

function ArchitecturalColumn({ left, dark }: { left: number; dark: boolean }) {
  return (
    <span className="absolute bottom-[8%] top-[25%] z-10 w-[5.5%]" style={{
      left: `${left}%`,
      background: dark ? 'linear-gradient(90deg,#676d70,#d2d0c4 35%,#a9adae 65%,#525a5d)' : 'linear-gradient(90deg,#9e9e92,#f6f1df 35%,#d9d6c9 65%,#9b9b91)',
      boxShadow: '3px 1px 4px rgba(0,0,0,.28)',
    }}>
      <span className="absolute -left-[23%] -right-[23%] -top-[3px] h-[6px] bg-[#d6d3c6] shadow-sm" />
      <span className="absolute -left-[23%] -right-[23%] -bottom-[4px] h-[7px] bg-[#bab8ad]" />
    </span>
  )
}

function RealisticBuilding({
  building,
  isDark,
  isNight,
  onClick,
  onJoinRandomSeat,
  isJoiningRandomSeat,
}: RealisticBuildingProps) {
  const type = building.buildingType
  const facade = getBuildingFacade(building, isDark)
  const civic = type === 'court' || type === 'townHall' || type === 'bank'
  const house = type === 'home'
  const church = type === 'church'
  const prison = type === 'jail'
  const arcade = type === 'arcade'
  const postOffice = building.label.toLowerCase().includes('post office')
  const cinema = building.label.toLowerCase().includes('cinema')
  const tower = type === 'broadcast'
  const isGlass = building.material === 'glass' || building.material === 'darkGlass'
  const upper = church ? 78 : house ? 46 : civic ? 42 : cinema ? 28 : 24
  const width = building.width
  const height = building.height
  // Restrict windows to the available facade; civic buildings reserve their
  // central elevations for columns, signage and a larger entrance.
  const cols = house ? 3 : civic ? 4 : prison ? 5 : arcade ? 4 : Math.min(7, Math.max(3, building.cols))
  const rows = house ? 2 : civic ? 2 : church ? 2 : prison ? 3 : Math.min(8, Math.max(3, Math.floor(height / 38)))
  const name = building.label
  const captionStyle: React.CSSProperties = {
    color: isDark ? '#f8fafc' : '#1d2a34',
    background: isDark ? 'rgba(10,17,26,.94)' : 'rgba(246,244,237,.96)',
    border: `1px solid ${isDark ? 'rgba(174,188,200,.42)' : 'rgba(69,78,88,.36)'}`,
    boxShadow: '0 5px 17px rgba(0,0,0,.34)',
  }

  // Broadcast tower is the only dual-purpose landmark: retain BOTH original
  // Go Live and Random Seat destinations and their disabled/loading behavior.
  if (tower) {
    return (
      <div className="absolute" style={{ left: building.x, bottom: 80, width, height: 280, zIndex: 8, pointerEvents: 'none' }}>
        <div className="absolute bottom-[66px] left-1/2 h-[190px] w-[12%] -translate-x-1/2 border-x-[3px] border-slate-400/80 bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_19px,#647482_20px,#647482_22px)] shadow-[0_0_12px_rgba(50,60,70,.35)]" />
        <div className="absolute bottom-[245px] left-1/2 h-7 w-[3px] -translate-x-1/2 bg-slate-200" />
        <div className="absolute bottom-[266px] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-red-500 shadow-[0_0_13px_#ef4444]" />
        <div className="absolute bottom-[145px] left-[20%] h-[3px] w-[60%] -rotate-[24deg] bg-slate-500/90" />
        <div className="absolute bottom-[145px] right-[20%] h-[3px] w-[60%] rotate-[24deg] bg-slate-500/90" />
        <div className="pointer-events-auto absolute bottom-0 z-20 grid h-[85px] w-full grid-cols-2 gap-1 rounded-t-md border-2 border-[#556372] bg-gradient-to-b from-[#5f7387] via-[#38495d] to-[#263342] p-2 shadow-[inset_4px_0_8px_#a9c1d244,0_12px_20px_#0006]">
          <button type="button" aria-label="Start your broadcast" onClick={() => onClick(building.to)} className="group flex min-w-0 flex-col items-center justify-center rounded border border-red-300/45 bg-[#4b1822] p-1 text-white hover:bg-[#692333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <Video className="h-5 w-5 text-red-200" />
            <span className="mt-1 text-[9px] font-bold">GO LIVE</span>
          </button>
          <button type="button" aria-label="Join a random free broadcast seat" onClick={onJoinRandomSeat} disabled={!onJoinRandomSeat || isJoiningRandomSeat} className="group flex min-w-0 flex-col items-center justify-center rounded border border-sky-300/40 bg-[#132b3c] p-1 text-white hover:bg-[#25475c] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <Users className="h-5 w-5 text-sky-200" />
            <span className="mt-1 text-[8px] font-bold">{isJoiningRandomSeat ? 'FINDING...' : 'RANDOM SEAT'}</span>
          </button>
        </div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[11px] font-bold" style={captionStyle}>{name}</div>
      </div>
    )
  }

  return (
    <button type="button" aria-label={`Open ${name}`} title={name} onClick={() => onClick(building.to)}
      className="group absolute cursor-pointer appearance-none border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
      style={{ left: building.x, bottom: 80, width, height: height + upper, pointerEvents: 'auto', zIndex: 7,
        filter: `drop-shadow(9px 12px 9px ${facade.shadow})` }}>
      <div className="absolute inset-x-0 bottom-0 transition-transform duration-300 group-hover:-translate-y-[3px]" style={{ height }}>
        {/* Structural volume, raked side-light and layered stone/brick textures */}
        <div className="absolute inset-0 overflow-hidden rounded-t-[2px]" style={{
          background: facade.background, border: `2px solid ${facade.border}`,
          boxShadow: 'inset 8px 0 13px rgba(255,255,255,.12),inset -12px 0 19px rgba(0,0,0,.33),inset 0 -16px 14px rgba(0,0,0,.24)',
        }}>
          <div className="pointer-events-none absolute inset-0" style={{ opacity: house || postOffice ? .38 : civic || church ? .22 : .17,
            backgroundImage: house || postOffice
              ? 'repeating-linear-gradient(0deg,transparent 0px,transparent 10px,#30231b66 11px,#30231b66 12px),repeating-linear-gradient(90deg,transparent 0px,transparent 28px,#38271d55 29px,#38271d55 30px)'
              : civic || church
                ? 'repeating-linear-gradient(0deg,transparent 0px,transparent 22px,#282c3066 23px,#282c3066 24px),repeating-linear-gradient(90deg,transparent 0px,transparent 41px,#202a3166 42px,#202a3166 43px)'
                : 'repeating-linear-gradient(0deg,transparent 0px,transparent 30px,#11182744 31px,#11182744 32px)',
          }} />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[8%] bg-gradient-to-r from-black/20 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[11%] bg-gradient-to-l from-black/30 to-transparent" />
          {/* Floor bands and limestone sill course */}
          {!church && !civic && Array.from({ length: rows - 1 }, (_, i) => <span key={`band-${i}`} className="absolute left-0 right-0 h-[2px] bg-white/10 shadow-[0_1px_2px_#0007]" style={{ top: `${(i+1) * (75 / rows) + 11}%` }} />)}
          <div className="absolute inset-x-0 bottom-0 h-[9%] border-t border-white/20 bg-black/20" />
          {/* Tall vertical mullions, recessed glass and warm room lighting */}
          <div className="absolute left-[9%] right-[9%] top-[16%] bottom-[22%] grid gap-x-[7%] gap-y-[9%]" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${rows},minmax(0,1fr))` }}>
            {Array.from({ length: cols * rows }, (_, i) => {
              const originalWindow = building.windows[i % building.windows.length]
              return <BuildingWindow key={i} night={isNight} lit={Boolean(originalWindow?.lit)} frame={facade.windowFrame} tall={civic || isGlass} arched={church} bars={prison} glass={isGlass} />
            })}
          </div>
          {/* Recessed central entry with door mullion, lintel and exterior light */}
          <div className="absolute bottom-0 left-1/2 z-10 h-[19%] w-[23%] -translate-x-1/2 border-x-[3px] border-t-[4px] border-[#242831] bg-[linear-gradient(90deg,#172535,#405567_50%,#152330)] shadow-[0_0_0_2px_#b4b0a755,inset_0_0_10px_#0009]">
            <span className="absolute bottom-0 left-1/2 h-full w-[2px] bg-[#c2c5c1]/50" />
            <span className="absolute left-[24%] top-[56%] h-[3px] w-[3px] rounded-full bg-[#dfc68c]" />
            <span className="absolute right-[24%] top-[56%] h-[3px] w-[3px] rounded-full bg-[#dfc68c]" />
          </div>
          <div className="absolute bottom-[19%] left-[31%] right-[31%] z-10 h-[4px] bg-[#c8c2b4] shadow-[0_3px_4px_#0007]" />
          {/* Entry sconces */}
          {isNight && [30, 70].map(x => <div key={x} className="absolute bottom-[15%] z-10 h-[6px] w-[4px] rounded-sm bg-[#ffdeb0] shadow-[0_0_12px_5px_#f4c47877]" style={{ left: `${x}%` }} />)}
          {/* Architecture-specific street fronts */}
          {cinema && <>
            <div className="absolute inset-x-[7%] top-[6%] z-20 h-[20%] rounded-t border-2 border-[#8d7974] bg-gradient-to-b from-[#4d1729] to-[#180f20] shadow-[0_6px_8px_#0008]" />
            <BuildingSign night={isNight} kind="neon">TREELZ CINEMA</BuildingSign>
            <div className="absolute inset-x-[4%] bottom-[16%] z-20 h-[12%] border-b-[5px] border-[#794235] bg-[repeating-linear-gradient(90deg,#7c2132_0px,#7c2132_16px,#d9c1a3_16px,#d9c1a3_31px)] shadow-[0_8px_12px_#0007]" />
            <div className="absolute left-[8%] right-[8%] bottom-[33%] h-3 bg-[#dcc5a1] opacity-90" />
          </>}
          {arcade && <>
            <BuildingSign night={isNight} kind="neon">HYTRO GAMING</BuildingSign>
            <div className="absolute bottom-[5%] left-[6%] right-[6%] h-[14%] border border-sky-300/55 bg-[linear-gradient(90deg,#071629,#22436b,#071629)] shadow-[0_0_13px_#25c6f766]" />
            <div className="absolute left-[5%] right-[5%] top-[30%] h-[3px] bg-cyan-300/60 shadow-[0_0_8px_#67e8f9]" />
          </>}
          {prison && <>
            <BuildingSign night={isNight} kind="dark">CITY JAIL</BuildingSign>
            <div className="absolute inset-x-0 bottom-[20%] h-[9%] border-y-[3px] border-[#2b323c] bg-[#5d6873]" />
          </>}
          {postOffice && <>
            <BuildingSign night={isNight}>CITY POST OFFICE</BuildingSign>
            <div className="absolute inset-x-[6%] bottom-[18%] h-[10%] border-b-[4px] border-[#7b8792] bg-gradient-to-b from-[#d2d9df] to-[#8697a5] shadow-[0_8px_9px_#0007]" />
          </>}
          {civic && <>
            <div className="absolute left-[6%] right-[6%] top-[24%] bottom-[6%] z-10 border-b-[6px] border-[#aaa99d]/60 bg-[#c0bfb0]/10" />
            {[13,34,57,78].map(x => <ArchitecturalColumn key={x} left={x} dark={isDark} />)}
            <BuildingSign night={isNight}>{type === 'bank' ? 'CITY TREASURY' : type === 'court' ? 'MUNICIPAL COURT' : 'TOWN HALL'}</BuildingSign>
            <div className="absolute left-[4%] right-[4%] top-[20%] h-[6px] bg-[#d1ccbb] shadow-[0_2px_5px_#0005]" />
          </>}
          {church && <>
            <div className="absolute left-[8%] right-[8%] top-[43%] h-[28%] rounded-t-full border-[3px] border-[#b7a99b] bg-[linear-gradient(135deg,#314b6b,#8e4365_52%,#d9a36c)] shadow-[inset_0_0_10px_#16152a]" />
            <span className="absolute left-[48%] top-[44%] h-[26%] w-[4%] bg-[#c7b6a0]" />
            <span className="absolute left-[23%] right-[23%] top-[55%] h-[4%] bg-[#c7b6a0]" />
            <div className="absolute bottom-0 left-[33%] right-[33%] h-[26%] rounded-t-full border-[4px] border-[#b2a394] bg-gradient-to-r from-[#36241e] via-[#704a34] to-[#2b1b17]" />
          </>}
          {house && <>
            <div className="absolute left-[26%] right-[26%] bottom-[17%] h-[8%] border-t-[5px] border-[#e7dbc6] bg-[#554239] shadow-[0_6px_4px_#0005]" />
            {[29,67].map(x => <span key={x} className="absolute bottom-0 z-10 h-[17%] w-[3%] bg-[#e6dbcb]" style={{ left: `${x}%` }} />)}
            <div className="absolute bottom-0 left-[22%] right-[22%] h-[5%] bg-[#c4b4a0]" />
          </>}
        </div>
        {/* Roofline and silhouette extending beyond the structural facade */}
        {house && <>
          <div className="absolute -left-[6%] -right-[6%] -top-[38px] h-[44px] bg-[linear-gradient(135deg,#3b3434,#756058_50%,#302b2b)] shadow-[0_5px_9px_#0008]" style={{ clipPath: 'polygon(50% 0%,100% 100%,0% 100%)' }} />
          <div className="absolute right-[20%] -top-[30px] h-[21px] w-[10%] border-x border-[#392c29] bg-[#8c5c4b] shadow-[2px_1px_3px_#0006]" />
          <div className="absolute inset-x-[-4%] top-0 h-[4px] bg-[#b4a69a]" />
        </>}
        {civic && <>
          <div className="absolute -left-[3%] -right-[3%] -top-[31px] h-[34px] bg-gradient-to-b from-[#eee9dc] to-[#aaa99c] shadow-[0_4px_6px_#0008]" style={{ clipPath: 'polygon(50% 0%,100% 96%,100% 100%,0 100%,0 96%)' }} />
          <div className="absolute -left-[4%] -right-[4%] top-0 h-[7px] border-b-2 border-[#867f70] bg-[#d2cfc4] shadow-md" />
        </>}
        {church && <>
          <div className="absolute left-[25%] right-[25%] -top-[48px] h-[52px] bg-gradient-to-r from-[#514d56] via-[#a89fa7] to-[#57505f]" style={{ clipPath: 'polygon(50% 0%,100% 100%,0 100%)' }} />
          <div className="absolute left-1/2 -top-[64px] h-[25px] w-[3px] -translate-x-1/2 bg-[#e5d3a1] shadow-[0_0_5px_#f5e3b8]" />
          <div className="absolute left-1/2 -top-[56px] h-[3px] w-[25px] -translate-x-1/2 bg-[#e5d3a1]" />
          <div className="absolute -left-[3%] -right-[3%] top-0 h-[5px] bg-[#e1d8c7]" />
        </>}
        {!house && !church && !civic && <>
          <div className="absolute -left-[1%] -right-[1%] -top-[7px] h-[9px] border-b-[3px] border-[#222b37]/60 bg-gradient-to-b from-[#bfc7cc] to-[#6b7884] shadow-[0_3px_6px_#0005]" />
          <div className="absolute -top-[17px] right-[12%] h-[12px] w-[19%] rounded-t border-x-2 border-[#525f69] bg-[#84909a]" />
        </>}
        {/* Building name is a stable readable street-level plaque. */}
        <div className="absolute -bottom-[34px] left-1/2 max-w-[160px] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap rounded px-2 py-1 text-center text-[11px] font-bold shadow-lg transition-transform group-hover:scale-105" style={captionStyle}>{name}</div>
        <div className="absolute -bottom-[2px] left-0 right-0 h-[5px] bg-gradient-to-b from-[#d4d1c8] to-[#59616c] shadow-[0_4px_4px_#0006]" />
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
  onJoinRandomSeat,
  isJoiningRandomSeat = false,
  showBuildings = true,
  showBuildingScrollButtons = false,
}: {
  isDark?: boolean
  showWalker?: boolean
  walkerCount?: number
  buildings?: BuildingMeta[]
  onBuildingClick?: (
    to: string,
  ) => void
  onJoinRandomSeat?: () => void
  isJoiningRandomSeat?: boolean
  showBuildings?: boolean
  showBuildingScrollButtons?: boolean
}) {
  const cityCanvasRef =
    useRef<HTMLCanvasElement>(null)

  const precipCanvasRef =
    useRef<HTMLCanvasElement>(null)

  const backgroundRef =
    useRef<HTMLDivElement>(null)

  const buildingsScrollRef =
    useRef<HTMLDivElement>(null)

  const navigate =
    useNavigate()

  const [weather, setWeather] =
    useState<WeatherData | null>(
      null,
    )
  const [solarClock, setSolarClock] = useState(() => Date.now())

  useEffect(() => {
    const intervalId = window.setInterval(() => setSolarClock(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const buildingsRef =
    useRef<Building[]>([])

  const [renderedBuildings, setRenderedBuildings] =
    useState<Building[]>([])

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

  const displayWeather = useMemo(() => {
    if (!weather) return null
    return {
      ...weather,
      ...getSolarPhase(solarClock, weather.sunriseAt, weather.sunsetAt),
    }
  }, [weather, solarClock])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const data =
          await fetchUserWeather()

        if (!cancelled) {
          setWeather(data)
        }
      } catch {
        const now = new Date()
        const sunriseAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6).getTime()
        const sunsetAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18).getTime()

        if (!cancelled) {
          setWeather({
            condition: 'clear',
            temperature: 72,
            windSpeed: 5,
            ...getSolarPhase(now.getTime(), sunriseAt, sunsetAt),
            sunriseAt,
            sunsetAt,
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

  const adjustedSky = skyColors

  const moonInfo =
    useMemo(
      () =>
        getMoonPhase(
          new Date(),
        ),
      [],
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
      const cityWrapper =
        cityCanvas.parentElement

      const width =
        cityWrapper?.clientWidth ??
        window.innerWidth

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

  const skyStyle = adjustedSky
    ? {
        background: `linear-gradient(to bottom, ${adjustedSky.top} 0%, ${adjustedSky.bottom} 100%)`,
        transition: 'background 60s linear',
      }
    : {
        background: 'linear-gradient(to bottom, #12071f 0%, #261034 48%, #3a1828 100%)',
        transition: 'background 60s linear',
      }

  const isNight =
    displayWeather?.time ===
    'night'

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      {/* Sky layer — decorative background painted behind main content */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={skyStyle}>
        {/* -------------------------------------------------------------- */}
        {/* Stars                                                           */}
        {/* -------------------------------------------------------------- */}

      {isNight && (
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
    </div>

    {/* Interactive city layer — clickable buildings stacked above main content (z-10) */}
    <div
      ref={backgroundRef}
      className="pointer-events-none fixed inset-0 overflow-hidden z-[20]"
    >
      <div
        ref={buildingsScrollRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[840px] overflow-x-auto overflow-y-hidden"
        role="region"
        aria-label="Scrollable city buildings"
        tabIndex={0}
      >
        {showBuildingScrollButtons && (
          <>
            <button
              onClick={() => {
                const el = buildingsScrollRef.current
                if (el) el.scrollBy({ left: -el.clientWidth * 0.75, behavior: 'smooth' })
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-r-xl border border-white/20 bg-black/60 text-white pointer-events-auto active:scale-95"
              aria-label="Scroll buildings left"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => {
                const el = buildingsScrollRef.current
                if (el) el.scrollBy({ left: el.clientWidth * 0.75, behavior: 'smooth' })
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-l-xl border border-white/20 bg-black/60 text-white pointer-events-auto active:scale-95"
              aria-label="Scroll buildings right"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
        <div
          className="absolute bottom-0 h-full lg:left-[248px]"
          style={{ width: `max(100vw, ${(buildingMetas.length / BASE_BUILDING_COUNT) * 100}vw)` }}
        >
          {/* Animated canvas world: trees, street, sky objects, weather, walkers */}
          <canvas
            ref={cityCanvasRef}
            className="absolute inset-0 h-full w-full z-[0]"
            style={{
              pointerEvents: 'none',
            }}
          />

          {/* Realistic buildings sit above the canvas so they can be true interactive UI */}
          {showBuildings && (
            <div
              className="pointer-events-none absolute inset-0 overflow-visible"
            >
              {renderedBuildings.map((building) => (
                <RealisticBuilding
                  key={`${building.label}-${building.to}`}
                  building={building}
                  isDark={isDark}
                  isNight={isNight}
                  onClick={handleBuildingClick}
                  onJoinRandomSeat={onJoinRandomSeat}
                  isJoiningRandomSeat={isJoiningRandomSeat}
                />
              ))}
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
            style={{
              background: isDark
                ? 'linear-gradient(to top, rgba(10,15,30,0.9), transparent)'
                : 'linear-gradient(to top, rgba(200,210,220,0.4), transparent)',
            }}
          />
        </div>
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
    </>
  )
}
