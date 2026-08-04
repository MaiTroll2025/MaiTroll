import * as THREE from 'three'

// ============================================================================
// Mai Troll road network
// ----------------------------------------------------------------------------
// The city is laid out as a connected, node-based street grid (not a random
// spiderweb of diagonal segments). Every road connects NODE TO NODE so that
// intersections share exact coordinates and there are no floating endpoints.
//
// The network is data-driven:
//   - roadNodes:       named anchor points in the XZ plane
//   - roadLines:       roads defined by a fixed axis coordinate + start/end
//   - segments:        concrete road pieces derived from the lines/nodes
//   - intersections:   classified crossing pads (four-way / T / corner / cul-de-sac)
//   - blocks:          buildable city blocks bounded by the roads
//   - lamps:           street-light positions that follow the roads
//
// Districts (center / neighborhood / entertainment / commercial) reuse the same
// avenue skeleton but vary block size, road type and density. Future districts
// can be added by appending to `districts` and reusing the shared avenues.
// ============================================================================

export type RoadType = 'avenue' | 'street' | 'neighborhood'

export type DistrictId =
  | 'center'
  | 'neighborhood'
  | 'entertainment'
  | 'commercial'

export interface RoadNode {
  id: string
  x: number
  z: number
}

export type IntersectionKind = 'fourway' | 'tee' | 'corner' | 'culdesac'

export interface RoadSegmentGeo {
  id: string
  type: RoadType
  width: number
  lanes: 2 | 4
  centerLine: boolean
  laneLines: boolean
  center: [number, number]
  length: number
  rotationY: number
  axis: 'v' | 'h'
  startId: string
  endId: string
}

export interface IntersectionGeo {
  id: string
  x: number
  z: number
  kind: IntersectionKind
  size: number
  width: number
  type: RoadType
  sides: {
    north: boolean
    south: boolean
    east: boolean
    west: boolean
  }
}

export interface BlockBounds {
  district: DistrictId
  cx: number
  cz: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  width: number
  depth: number
}

export interface StreetLamp {
  position: [number, number, number]
  side: -1 | 1
  lit: boolean
}

export interface CityRoadNetwork {
  nodes: RoadNode[]
  segments: RoadSegmentGeo[]
  intersections: IntersectionGeo[]
  blocks: BlockBounds[]
  lamps: StreetLamp[]
}

// ---------------------------------------------------------------------------
// Road type definitions
// ---------------------------------------------------------------------------

const ROAD_SPECS: Record<
  RoadType,
  { width: number; lanes: 2 | 4; centerLine: boolean; laneLines: boolean }
> = {
  avenue: { width: 12, lanes: 4, centerLine: true, laneLines: true },
  street: { width: 8, lanes: 2, centerLine: true, laneLines: false },
  neighborhood: { width: 6, lanes: 2, centerLine: false, laneLines: false },
}

// ---------------------------------------------------------------------------
// Named road nodes (anchor points used to size the city)
// ---------------------------------------------------------------------------

export const roadNodes: Record<string, [number, number]> = {
  center: [0, 0],

  // Shared avenue skeleton (forms the connected city grid)
  vAvenueWest: [-64, 0],
  vAvenueW1: [-32, 0],
  vAvenueMid: [0, 0],
  vAvenueE1: [32, 0],
  vAvenueEast: [64, 0],

  hAvenueSouth: [0, -56],
  hAvenueS1: [0, -28],
  hAvenueMid: [0, 0],
  hAvenueN1: [0, 28],
  hAvenueNorth: [0, 56],

  // A few memorable district anchors
  centerPlaza: [0, 0],
  broadcastHub: [40, 36],
  auctionSquare: [44, -40],
  suburbGreen: [-44, -40],
}

// ---------------------------------------------------------------------------
// Avenue skeleton
// ---------------------------------------------------------------------------

// Vertical avenues run along Z. Horizontal avenues run along X.
const AVENUE_X = [-64, -32, 0, 32, 64]
const AVENUE_Z = [-56, -28, 0, 28, 56]

interface RoadLine {
  id: string
  axis: 'v' | 'h'
  /** Fixed coordinate: x for 'v' (runs along z), z for 'h' (runs along x). */
  fixed: number
  /** Start along the running axis. */
  start: number
  /** End along the running axis. */
  end: number
  type: RoadType
}

function makeAvenues(): RoadLine[] {
  const lines: RoadLine[] = []

  for (const x of AVENUE_X) {
    lines.push({
      id: `ave-v-${x}`,
      axis: 'v',
      fixed: x,
      start: AVENUE_Z[0],
      end: AVENUE_Z[AVENUE_Z.length - 1],
      type: 'avenue',
    })
  }

  for (const z of AVENUE_Z) {
    lines.push({
      id: `ave-h-${z}`,
      axis: 'h',
      fixed: z,
      start: AVENUE_X[0],
      end: AVENUE_X[AVENUE_X.length - 1],
      type: 'avenue',
    })
  }

  return lines
}

// ---------------------------------------------------------------------------
// District grid (cells bounded by avenues, optionally subdivided by streets)
// ---------------------------------------------------------------------------

interface DistrictDef {
  id: DistrictId
  /** number of internal vertical streets (splits the cell into nv+1 columns). */
  nv: number
  /** number of internal horizontal streets (splits the cell into nh+1 rows). */
  nh: number
  streetType: RoadType
  /** additional short dead-end (cul-de-sac) stubs, in local cell coords. */
  stubs?: Array<{ x: number; z: number; dir: 'n' | 's' | 'e' | 'w'; length: number }>
}

function districtForCell(ci: number, rj: number): DistrictDef {
  // Central dense core: the middle 2x2 avenue cells (+ NW quadrant extends it).
  if (ci >= 1 && ci <= 2 && rj >= 1 && rj <= 2) {
    return { id: 'center', nv: 1, nh: 1, streetType: 'street' }
  }
  if (ci <= 1 && rj >= 2) {
    // NW quadrant -> dense city core
    return { id: 'center', nv: 1, nh: 1, streetType: 'street' }
  }
  if (ci >= 2 && rj >= 2) {
    // NE quadrant -> entertainment / broadcast district (medium density)
    return {
      id: 'entertainment',
      nv: 1,
      nh: 1,
      streetType: 'street',
      stubs: [{ x: 48, z: 42, dir: 'e', length: 8 }],
    }
  }
  if (ci >= 2 && rj <= 1) {
    // SE quadrant -> auction / commercial district (wide roads, large lots)
    return { id: 'commercial', nv: 0, nh: 0, streetType: 'street' }
  }
  // SW quadrant -> residential neighborhood (larger blocks, smaller streets)
  return {
    id: 'neighborhood',
    nv: 1,
    nh: 0,
    streetType: 'neighborhood',
    stubs: [
      { x: -48, z: -42, dir: 'e', length: 9 },
      { x: -16, z: -14, dir: 'w', length: 9 },
    ],
  }
}

function makeDistrictLines(): RoadLine[] {
  const lines: RoadLine[] = []

  for (let ci = 0; ci < AVENUE_X.length - 1; ci += 1) {
    for (let rj = 0; rj < AVENUE_Z.length - 1; rj += 1) {
      const xa = AVENUE_X[ci]
      const xb = AVENUE_X[ci + 1]
      const za = AVENUE_Z[rj]
      const zb = AVENUE_Z[rj + 1]
      const def = districtForCell(ci, rj)

      // Internal vertical streets (run along z), snapped to cell bounds.
      for (let k = 1; k <= def.nv; k += 1) {
        const x = xa + ((xb - xa) * k) / (def.nv + 1)
        lines.push({
          id: `st-v-${ci}-${rj}-${k}`.replace('.', '_'),
          axis: 'v',
          fixed: x,
          start: za,
          end: zb,
          type: def.streetType,
        })
      }

      // Internal horizontal streets (run along x), snapped to cell bounds.
      for (let k = 1; k <= def.nh; k += 1) {
        const z = za + ((zb - za) * k) / (def.nh + 1)
        lines.push({
          id: `st-h-${ci}-${rj}-${k}`.replace('.', '_'),
          axis: 'h',
          fixed: z,
          start: xa,
          end: xb,
          type: def.streetType,
        })
      }

      // Cul-de-sac stubs (short dead-end streets branching off the grid).
      for (const stub of def.stubs ?? []) {
        const base = `${stub.x},${stub.z}`
        if (stub.dir === 'n' || stub.dir === 's') {
          const z0 = stub.z
          const z1 = stub.z + (stub.dir === 'n' ? stub.length : -stub.length)
          lines.push({
            id: `stub-v-${base}-${stub.dir}`,
            axis: 'v',
            fixed: stub.x,
            start: Math.min(z0, z1),
            end: Math.max(z0, z1),
            type: def.streetType,
          })
        } else {
          const x0 = stub.x
          const x1 = stub.x + (stub.dir === 'e' ? stub.length : -stub.length)
          lines.push({
            id: `stub-h-${base}-${stub.dir}`,
            axis: 'h',
            fixed: stub.z,
            start: Math.min(x0, x1),
            end: Math.max(x0, x1),
            type: def.streetType,
          })
        }
      }
    }
  }

  return lines
}

// ---------------------------------------------------------------------------
// Network builder
// ---------------------------------------------------------------------------

const round = (v: number) => Math.round(v * 100) / 100
const key = (x: number, z: number) => `n_${round(x)}_${round(z)}`

function buildNetwork(): CityRoadNetwork {
  const lines: RoadLine[] = [...makeAvenues(), ...makeDistrictLines()]

  interface NodeData {
    x: number
    z: number
    lines: Array<{ line: RoadLine; terminal: 'start' | 'end' | 'mid' }>
  }

  const nodeMap = new Map<string, NodeData>()
  const ensure = (x: number, z: number): NodeData => {
    const id = key(x, z)
    let node = nodeMap.get(id)
    if (!node) {
      node = { x: round(x), z: round(z), lines: [] }
      nodeMap.set(id, node)
    }
    return node
  }

  const segments: RoadSegmentGeo[] = []

  for (const line of lines) {
    // Collect breakpoints along the running axis.
    const breaks = new Set<number>()
    breaks.add(line.start)
    breaks.add(line.end)

    if (line.axis === 'v') {
      for (const other of lines) {
        if (other.axis !== 'h') continue
        if (other.start <= line.fixed && line.fixed <= other.end) {
          if (line.start <= other.fixed && other.fixed <= line.end) {
            breaks.add(other.fixed)
          }
        }
      }
    } else {
      for (const other of lines) {
        if (other.axis !== 'v') continue
        if (other.start <= line.fixed && line.fixed <= other.end) {
          if (line.start <= other.fixed && other.fixed <= line.end) {
            breaks.add(other.fixed)
          }
        }
      }
    }

    const sorted = Array.from(breaks)
      .map(round)
      .sort((a, b) => a - b)

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (Math.abs(b - a) < 0.01) continue

      const spec = ROAD_SPECS[line.type]
      const centerCoord = (a + b) / 2
      const length = Math.abs(b - a)

      const startNode = ensure(
        line.axis === 'v' ? line.fixed : a,
        line.axis === 'v' ? a : line.fixed,
      )
      const endNode = ensure(
        line.axis === 'v' ? line.fixed : b,
        line.axis === 'v' ? b : line.fixed,
      )

      const startTerminal: 'start' | 'end' | 'mid' =
        Math.abs(a - line.start) < 0.01
          ? 'start'
          : Math.abs(a - line.end) < 0.01
            ? 'end'
            : 'mid'
      const endTerminal: 'start' | 'end' | 'mid' =
        Math.abs(b - line.start) < 0.01
          ? 'start'
          : Math.abs(b - line.end) < 0.01
            ? 'end'
            : 'mid'

      startNode.lines.push({ line, terminal: startTerminal })
      endNode.lines.push({ line, terminal: endTerminal })

      const center: [number, number] =
        line.axis === 'v'
          ? [round(line.fixed), round(centerCoord)]
          : [round(centerCoord), round(line.fixed)]

      const rotationY = line.axis === 'v' ? 0 : Math.PI / 2

      segments.push({
        id: `${line.id}__${i}`,
        type: line.type,
        width: spec.width,
        lanes: spec.lanes,
        centerLine: spec.centerLine,
        laneLines: spec.laneLines,
        center,
        length: round(length),
        rotationY,
        axis: line.axis,
        startId: key(startNode.x, startNode.z),
        endId: key(endNode.x, endNode.z),
      })
    }
  }

  // -------------------------------------------------------------------------
  // Intersections (derived from every node where roads meet)
  // -------------------------------------------------------------------------

  const intersections: IntersectionGeo[] = []

  for (const [id, node] of nodeMap) {
    if (node.lines.length === 0) continue

    const dirs = new Set<string>()

    for (const entry of node.lines) {
      const { line, terminal } = entry
      if (line.axis === 'v') {
        // Road runs along z. Node coordinate is node.z.
        if (terminal === 'start') {
          dirs.add(line.end > node.z ? 's' : 'n')
        } else if (terminal === 'end') {
          dirs.add(line.start > node.z ? 'n' : 's')
        } else {
          dirs.add('n')
          dirs.add('s')
        }
      } else {
        if (terminal === 'start') {
          dirs.add(line.end > node.x ? 'e' : 'w')
        } else if (terminal === 'end') {
          dirs.add(line.start > node.x ? 'w' : 'e')
        } else {
          dirs.add('e')
          dirs.add('w')
        }
      }
    }

    const size = Math.max(...node.lines.map((l) => ROAD_SPECS[l.line.type].width))
    const type = node.lines.reduce<RoadType>((best, l) => {
      const order: RoadType[] = ['neighborhood', 'street', 'avenue']
      return order.indexOf(l.line.type) > order.indexOf(best) ? l.line.type : best
    }, 'neighborhood')

    let kind: IntersectionKind
    if (dirs.size >= 4) kind = 'fourway'
    else if (dirs.size === 3) kind = 'tee'
    else if (dirs.size === 2) kind = 'corner'
    else kind = 'culdesac'

    // Cul-de-sacs use a smaller pad.
    const padSize = kind === 'culdesac' ? size + 2.2 : size + 3.4

    intersections.push({
      id,
      x: node.x,
      z: node.z,
      kind,
      size: round(padSize),
      width: size,
      type,
      sides: {
        north: dirs.has('n'),
        south: dirs.has('s'),
        east: dirs.has('e'),
        west: dirs.has('w'),
      },
    })
  }

  const intersectionHalf = new Map<string, number>()
  for (const inter of intersections) {
    intersectionHalf.set(key(inter.x, inter.z), inter.size / 2)
  }

  // -------------------------------------------------------------------------
  // City blocks (bounded rectangles inside each district cell)
  // -------------------------------------------------------------------------

  const blocks: BlockBounds[] = []

  for (let ci = 0; ci < AVENUE_X.length - 1; ci += 1) {
    for (let rj = 0; rj < AVENUE_Z.length - 1; rj += 1) {
      const xa = AVENUE_X[ci]
      const xb = AVENUE_X[ci + 1]
      const za = AVENUE_Z[rj]
      const zb = AVENUE_Z[rj + 1]
      const def = districtForCell(ci, rj)

      const colW = (xb - xa) / (def.nv + 1)
      const rowW = (zb - za) / (def.nh + 1)

      for (let c = 0; c <= def.nv; c += 1) {
        for (let r = 0; r <= def.nh; r += 1) {
          const minX = xa + c * colW
          const maxX = xa + (c + 1) * colW
          const minZ = za + r * rowW
          const maxZ = za + (r + 1) * rowW

          blocks.push({
            district: def.id,
            cx: (minX + maxX) / 2,
            cz: (minZ + maxZ) / 2,
            minX: round(minX),
            maxX: round(maxX),
            minZ: round(minZ),
            maxZ: round(maxZ),
            width: round(maxX - minX),
            depth: round(maxZ - minZ),
          })
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Street lamps (follow roads, never inside intersections)
  // -------------------------------------------------------------------------

  const lamps: StreetLamp[] = []
  const LAMP_OFFSET = 1.7

  for (const seg of segments) {
    const halfA = intersectionHalf.get(seg.startId) ?? seg.width / 2 + 1
    const halfB = intersectionHalf.get(seg.endId) ?? seg.width / 2 + 1

    const usableStart = -seg.length / 2 + halfA + 1.6
    const usableEnd = seg.length / 2 - halfB - 1.6
    if (usableEnd - usableStart < 4) continue

    const spacing = seg.type === 'avenue' ? 20 : seg.type === 'street' ? 22 : 24
    const count = Math.floor((usableEnd - usableStart) / spacing)
    if (count <= 0) continue

    // Avenues get lamps on both sides; smaller streets alternate one side.
    const sides: Array<-1 | 1> =
      seg.type === 'avenue' ? [-1, 1] : [((seg.center[0] + seg.center[1]) % 2 === 0 ? -1 : 1) as -1 | 1]

    for (const side of sides) {
      for (let k = 0; k < count; k += 1) {
        const t = usableStart + (k + 0.5) * spacing
        const perp = side * (seg.width / 2 + LAMP_OFFSET)

        const position: [number, number, number] =
          seg.axis === 'v'
            ? [round(seg.center[0] + perp), 0, round(seg.center[1] + t)]
            : [round(seg.center[0] + t), 0, round(seg.center[1] + perp)]

        lamps.push({ position, side, lit: seg.type === 'avenue' })
      }
    }
  }

  const nodes: RoadNode[] = Array.from(nodeMap.entries()).map(([id, n]) => ({
    id,
    x: n.x,
    z: n.z,
  }))

  return { nodes, segments, intersections, blocks, lamps }
}

/** Map of node id -> half-size of the intersection pad at that node. */
export function getIntersectionClearMap(): Map<string, number> {
  const network = getCityRoadNetwork()
  const map = new Map<string, number>()
  for (const inter of network.intersections) {
    map.set(key(inter.x, inter.z), inter.size / 2)
  }
  return map
}

// Cached singleton network.
let cached: CityRoadNetwork | null = null

export function getCityRoadNetwork(): CityRoadNetwork {
  if (!cached) cached = buildNetwork()
  return cached
}

// ---------------------------------------------------------------------------
// Helpers for consumers (buildings, future districts, etc.)
// ---------------------------------------------------------------------------

/** Returns the buildable block that contains the given world point, if any. */
export function findBlockAt(
  network: CityRoadNetwork,
  x: number,
  z: number,
): BlockBounds | null {
  for (const b of network.blocks) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return b
  }
  return null
}

/** Nearest block center to a point (used to keep properties off the roads). */
export function nearestBlockCenter(
  network: CityRoadNetwork,
  x: number,
  z: number,
): [number, number] {
  let best: BlockBounds | null = null
  let bestDist = Infinity
  for (const b of network.blocks) {
    const d = (b.cx - x) ** 2 + (b.cz - z) ** 2
    if (d < bestDist) {
      bestDist = d
      best = b
    }
  }
  return best ? [best.cx, best.cz] : [x, z]
}

export const CITY_BOUNDS = {
  minX: AVENUE_X[0],
  maxX: AVENUE_X[AVENUE_X.length - 1],
  minZ: AVENUE_Z[0],
  maxZ: AVENUE_Z[AVENUE_Z.length - 1],
}

export { ROAD_SPECS }
