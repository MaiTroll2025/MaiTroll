import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Car,
  ChevronDown,
  ChevronUp,
  Coins,
  Crown,
  Home,
  Lock,
  MapPin,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useSEO from '@/hooks/useSEO'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import ThreeNeighborhoodMap from '../components/neighborhood-map/ThreeNeighborhoodMap'
import { useHouseRaids, useNeighborhood } from '../lib/hooks/useNeighborhood'
import { useVehicleSystem } from '../lib/hooks/useVehicleSystem'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

type PropertyStatus = 'owned' | 'available' | 'raided' | 'locked'
type PropertyKind = 'house' | 'mansion' | 'tower'
type MapFilter = 'all' | 'owned' | 'raided' | 'locked'

interface HouseRecord {
  id: string
  neighborhood_id: string | null
  owner_user_id: string | null
  upgrade_level: number | null
  condition: number | null
  is_reposessed: boolean | null
  electric_on: boolean | null
  water_on: boolean | null
  internet_on: boolean | null
  created_at: string
}

interface OwnerRecord {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  is_admin?: boolean | null
  is_superadmin?: boolean | null
  vehicle_id?: string | null
  license_plate?: string | null
}

interface StreamRecord {
  id: string
  broadcaster_id: string | null
  is_live: boolean | null
  status?: string | null
  current_viewers?: number | null
  viewer_count?: number | null
}

interface SeatRecord {
  id: string
  stream_id: string
  user_id: string | null
  slot?: number | null
  is_active: boolean | null
}

interface InsuranceRecord {
  user_id: string
  house_id?: string | null
  expires_at?: string | null
}

interface PropertyCard {
  id: string
  address: string
  owner?: string
  ownerId?: string | null
  status: PropertyStatus
  label: string
  x: number
  y: number
  isAdmin?: boolean
  kind: PropertyKind
  house: HouseRecord
  ownerUser?: OwnerRecord
  isLive?: boolean
  inSeat?: boolean
  seatIndex?: number | null
  viewerCount?: number
  licenseStatus?: string
  hasHomeInsurance?: boolean
  insuranceExpiry?: string | null
}

const RAID_COST = 100
const BOTTOM_NAV_FALLBACK_PX = 72

function deterministicPosition(index: number, total: number) {
  const columns = Math.max(4, Math.ceil(Math.sqrt(Math.max(total, 1) * 1.45)))
  const rows = Math.max(1, Math.ceil(total / columns))
  const column = index % columns
  const row = Math.floor(index / columns)

  const xBase = 12 + (column / Math.max(columns - 1, 1)) * 76
  const yBase = 15 + (row / Math.max(rows - 1, 1)) * 68
  const xJitter = ((index * 17) % 9) - 4
  const yJitter = ((index * 13) % 7) - 3

  return {
    x: Math.min(92, Math.max(8, xBase + xJitter)),
    y: Math.min(88, Math.max(10, yBase + yJitter)),
  }
}

export default function NeighborhoodMapHub() {
  const { house, loading } = useNeighborhood()
  const profile = useAuthStore((state) => state.profile)
  const { vehicles } = useVehicleSystem()
  const { raids, isRaided } = useHouseRaids(house?.id || null)
  const navigate = useNavigate()

  const [ownedHouses, setOwnedHouses] = useState<HouseRecord[]>([])
  const [houseOwners, setHouseOwners] = useState<Map<string, OwnerRecord>>(new Map())
  const [ownerStreams, setOwnerStreams] = useState<Map<string, StreamRecord>>(new Map())
  const [ownerSeatMap, setOwnerSeatMap] = useState<Map<string, SeatRecord>>(new Map())
  const [ownerLicenses, setOwnerLicenses] = useState<Map<string, string>>(new Map())
  const [ownerInsurances, setOwnerInsurances] = useState<Map<string, InsuranceRecord>>(new Map())
  const [neighborhoodNames, setNeighborhoodNames] = useState<Map<string, string>>(new Map())
  const [mapLoading, setMapLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<MapFilter>('all')
  const [detailsExpanded, setDetailsExpanded] = useState(true)
  const [legendOpen, setLegendOpen] = useState(false)

  useSEO({
    title: 'Neighborhoods | Online Digital Communities & Social Groups | Mai Troll',
    description:
      'Explore Mai Troll neighborhoods. Join digital communities, own virtual property, participate in house raids, and connect with neighbors in our social metaverse.',
    keywords: [
      'online neighborhoods',
      'digital communities',
      'social groups',
      'virtual property',
      'MaiTroll neighborhoods',
      'community map',
      'house raids',
      'virtual homes',
      'social metaverse',
      'digital society',
      'neighborhood map',
      'online community',
    ],
  })

  useEffect(() => {
    if (!loading && !profile?.neighborhood_id) {
      navigate('/neighborhood-setup', { replace: true })
    }
  }, [loading, navigate, profile?.neighborhood_id])

  // This page is a viewport experience. Prevent the app shell/body from creating a second scroll area.
  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyOverscroll = document.body.style.overscrollBehavior

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [])

  const fetchMapData = useCallback(async () => {
    try {
      setMapLoading(true)

      const { data: houses, error: housesError } = await supabase
        .from('houses')
        .select(`
          id,
          neighborhood_id,
          owner_user_id,
          upgrade_level,
          condition,
          is_reposessed,
          electric_on,
          water_on,
          internet_on,
          created_at
        `)
        .not('owner_user_id', 'is', null)
        .order('created_at', { ascending: true })

      if (housesError) throw housesError

      const filtered = ((houses || []) as HouseRecord[]).filter((item) => item.owner_user_id)
      setOwnedHouses(filtered)

      const ownerIds = [...new Set(filtered.map((item) => item.owner_user_id).filter(Boolean))] as string[]
      const neighborhoodIds = [
        ...new Set(filtered.map((item) => item.neighborhood_id).filter(Boolean)),
      ] as string[]

      const [neighborhoodResult, ownerResult, streamResult, seatResult, licenseResult, insuranceResult] =
        await Promise.all([
          neighborhoodIds.length
            ? supabase.from('neighborhoods').select('id, name').in('id', neighborhoodIds)
            : Promise.resolve({ data: [], error: null }),
          ownerIds.length
            ? supabase
                .from('user_profiles')
                .select(
                  'id, username, display_name, avatar_url, is_admin, is_superadmin, vehicle_id, license_plate',
                )
                .in('id', ownerIds)
            : Promise.resolve({ data: [], error: null }),
          ownerIds.length
            ? supabase
                .from('streams')
                .select('id, broadcaster_id, is_live, status, current_viewers')
                .in('broadcaster_id', ownerIds)
                .eq('is_live', true)
            : Promise.resolve({ data: [], error: null }),
          ownerIds.length
            ? supabase
                .from('stream_participants')
                .select('id, stream_id, user_id, slot, is_active')
                .in('user_id', ownerIds)
                .eq('is_active', true)
            : Promise.resolve({ data: [], error: null }),
          ownerIds.length
            ? supabase.from('user_licenses').select('user_id, status').in('user_id', ownerIds)
            : Promise.resolve({ data: [], error: null }),
          ownerIds.length
            ? supabase
                .from('homeowners_insurances')
                .select('user_id, house_id, expires_at')
                .in('user_id', ownerIds)
            : Promise.resolve({ data: [], error: null }),
        ])

      const firstError = [
        neighborhoodResult.error,
        ownerResult.error,
        streamResult.error,
        seatResult.error,
        licenseResult.error,
        insuranceResult.error,
      ].find(Boolean)

      if (firstError) throw firstError

      const neighborhoodMap = new Map<string, string>()
      ;(neighborhoodResult.data || []).forEach((item: any) => neighborhoodMap.set(item.id, item.name))
      setNeighborhoodNames(neighborhoodMap)

      const ownerMap = new Map<string, OwnerRecord>()
      ;(ownerResult.data || []).forEach((item: OwnerRecord) => ownerMap.set(item.id, item))
      setHouseOwners(ownerMap)

      const streamMap = new Map<string, StreamRecord>()
      ;(streamResult.data || []).forEach((item: StreamRecord) => {
        if (item.broadcaster_id) streamMap.set(item.broadcaster_id, item)
      })
      setOwnerStreams(streamMap)

      const seatMap = new Map<string, SeatRecord>()
      ;(seatResult.data || []).forEach((item: SeatRecord) => {
        if (item.user_id) seatMap.set(item.user_id, item)
      })
      setOwnerSeatMap(seatMap)

      const licenseMap = new Map<string, string>()
      ;(licenseResult.data || []).forEach((item: any) => {
        if (item.user_id) licenseMap.set(item.user_id, item.status || 'none')
      })
      setOwnerLicenses(licenseMap)

      const insuranceMap = new Map<string, InsuranceRecord>()
      ;(insuranceResult.data || []).forEach((item: InsuranceRecord) => {
        const previous = insuranceMap.get(item.user_id)
        const currentExpiry = item.expires_at ? new Date(item.expires_at).getTime() : 0
        const previousExpiry = previous?.expires_at ? new Date(previous.expires_at).getTime() : 0
        if (!previous || currentExpiry > previousExpiry) insuranceMap.set(item.user_id, item)
      })
      setOwnerInsurances(insuranceMap)
    } catch (error) {
      console.error('[NeighborhoodMapHub] Failed to load map data:', error)
    } finally {
      setMapLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMapData()

    const refresh = () => void fetchMapData()
    const channel = supabase
      .channel('neighborhood-map-hub-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'houses' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'neighborhoods' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_participants' }, refresh)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchMapData])

  const propertyCards = useMemo<PropertyCard[]>(() => {
    return ownedHouses.map((houseRecord, index) => {
      const owner = houseRecord.owner_user_id
        ? houseOwners.get(houseRecord.owner_user_id)
        : undefined
      const isCurrentUser = houseRecord.owner_user_id === profile?.id
      const isOwnerAdmin = Boolean(owner?.is_admin || owner?.is_superadmin)
      const neighborhoodName = houseRecord.neighborhood_id
        ? neighborhoodNames.get(houseRecord.neighborhood_id) || 'MaiTroll'
        : 'MaiTroll'

      let status: PropertyStatus = 'owned'
      if (houseRecord.is_reposessed) status = 'locked'
      else if (houseRecord.condition !== null && houseRecord.condition <= 0) status = 'raided'

      const ownerStream = houseRecord.owner_user_id
        ? ownerStreams.get(houseRecord.owner_user_id)
        : undefined
      const ownerSeat = houseRecord.owner_user_id
        ? ownerSeatMap.get(houseRecord.owner_user_id)
        : undefined
      const insurance = houseRecord.owner_user_id
        ? ownerInsurances.get(houseRecord.owner_user_id)
        : undefined
      const position = deterministicPosition(index, ownedHouses.length)

      const kind: PropertyKind =
        isCurrentUser && isOwnerAdmin
          ? 'tower'
          : isOwnerAdmin || (houseRecord.upgrade_level || 0) >= 3
            ? 'mansion'
            : 'house'

      return {
        id: houseRecord.id,
        address: neighborhoodName,
        owner: isCurrentUser ? profile?.username || 'You' : owner?.username || undefined,
        ownerId: houseRecord.owner_user_id,
        status,
        label: isCurrentUser
          ? isOwnerAdmin
            ? 'CEO Mansion'
            : 'Your House'
          : isOwnerAdmin
            ? 'Admin Property'
            : status === 'raided'
              ? 'Raided Property'
              : status === 'locked'
                ? 'Locked Property'
                : `${owner?.username || 'Owner'}'s House`,
        x: position.x,
        y: position.y,
        isAdmin: isOwnerAdmin,
        kind,
        house: houseRecord,
        ownerUser: owner,
        isLive: Boolean(ownerStream?.is_live),
        viewerCount: ownerStream?.current_viewers || ownerStream?.viewer_count || 0,
        inSeat: Boolean(ownerSeat),
        seatIndex: ownerSeat?.slot,
        licenseStatus: houseRecord.owner_user_id
          ? ownerLicenses.get(houseRecord.owner_user_id) || 'none'
          : 'none',
        hasHomeInsurance: Boolean(insurance),
        insuranceExpiry: insurance?.expires_at || null,
      }
    })
  }, [
    houseOwners,
    neighborhoodNames,
    ownedHouses,
    ownerInsurances,
    ownerLicenses,
    ownerSeatMap,
    ownerStreams,
    profile?.id,
    profile?.username,
  ])

  useEffect(() => {
    if (!propertyCards.length) {
      setSelectedProperty(null)
      return
    }

    if (!selectedProperty || !propertyCards.some((property) => property.id === selectedProperty)) {
      const ownProperty = propertyCards.find((property) => property.ownerId === profile?.id)
      setSelectedProperty(ownProperty?.id || propertyCards[0].id)
    }
  }, [profile?.id, propertyCards, selectedProperty])

  const visibleProperties = useMemo(() => {
    if (selectedFilter === 'all') return propertyCards
    return propertyCards.filter((property) => property.status === selectedFilter)
  }, [propertyCards, selectedFilter])

  const mapHouses = useMemo(
    () =>
      visibleProperties.map((property) => ({
        id: property.id,
        x: property.x,
        y: property.y,
        owner: property.owner,
        isLive: property.isLive,
        status: property.isAdmin
          ? ('admin' as const)
          : property.status === 'available'
            ? ('owned' as const)
            : property.status,
        badges: [
          property.kind === 'tower'
            ? 'CEO Landmark'
            : property.kind === 'mansion'
              ? 'Mansion'
              : 'Residence',
          property.address,
        ],
      })),
    [visibleProperties],
  )

  const mapCars = useMemo(() => {
    const routeIds = ['road-main', 'road-cross', 'waterfront-road']
    return vehicles.map((vehicle: any, index: number) => ({
      pathId: routeIds[index % routeIds.length],
      offset: (index * 23) % 100,
      color: vehicle?.color || vehicle?.paint_color || '#8b5cf6',
    }))
  }, [vehicles])

  const selectedPropertyData = useMemo(
    () => propertyCards.find((property) => property.id === selectedProperty) || null,
    [propertyCards, selectedProperty],
  )

  const raidWindowActive = false
  const loadingScreen = loading || mapLoading

  if (loadingScreen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#020617] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-300" />
          <p className="text-sm font-semibold text-cyan-100">Loading Mai Troll...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#020617] text-white">
      {/* Full-bleed 3D map. The selectors override the old rounded 620px component shell. */}
      <main className="absolute inset-0 overflow-hidden [&>div]:h-full [&>div]:min-h-full [&>div]:w-full [&>div]:rounded-none [&>div]:border-0">
        <ThreeNeighborhoodMap
          houses={mapHouses}
          cars={mapCars}
          onPropertyClick={(property) => setSelectedProperty(property.id)}
        />
      </main>

      {/* Subtle edge shading only—no dashboard grid over the city. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(2,6,23,0.52)_100%)]" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 p-3 md:p-4">
        <div className="pointer-events-auto mx-auto flex max-w-[1600px] flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/72 px-3 py-2.5 shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
                <MapPin className="mr-1 h-3.5 w-3.5" />
                Mai Troll
              </Badge>
              <Badge className="border border-red-300/25 bg-red-500/10 text-red-100">
                <Coins className="mr-1 h-3.5 w-3.5" />
                Raid {RAID_COST} TC
              </Badge>
              <Badge className="hidden border border-amber-300/25 bg-amber-400/10 text-amber-100 sm:inline-flex">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Live 3D City
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-slate-300">
              {ownedHouses.length} properties across {neighborhoodNames.size} neighborhoods
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['all', 'owned', 'raided', 'locked'] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant="outline"
                onClick={() => setSelectedFilter(filter)}
                className={
                  selectedFilter === filter
                    ? 'h-8 shrink-0 border-cyan-300 bg-cyan-400/20 px-3 text-xs capitalize text-cyan-50 hover:bg-cyan-400/30'
                    : 'h-8 shrink-0 border-white/10 bg-black/25 px-3 text-xs capitalize text-slate-300 hover:bg-white/10 hover:text-white'
                }
              >
                {filter}
              </Button>
            ))}

            <Button
              size="icon"
              variant="outline"
              aria-label="Toggle city legend"
              onClick={() => setLegendOpen((open) => !open)}
              className="h-8 w-8 shrink-0 border-white/10 bg-black/25 text-slate-200 hover:bg-white/10"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {legendOpen && (
        <aside className="absolute right-3 top-[112px] z-40 w-56 rounded-2xl border border-white/10 bg-slate-950/86 p-3 shadow-2xl backdrop-blur-xl md:right-4 md:top-[88px]">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-black">City Legend</p>
          </div>
          <MapLegend />
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Security</span>
              <span className={isRaided ? 'font-bold text-red-300' : 'font-bold text-emerald-300'}>
                {isRaided ? 'Raided' : 'Secure'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Vehicles</span>
              <span className="font-bold text-white">{vehicles.length}</span>
            </div>
          </div>
        </aside>
      )}

      {!selectedPropertyData && (
        <div
          className="absolute left-1/2 z-40 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/85 px-5 py-3 text-center shadow-2xl backdrop-blur-xl"
          style={{ bottom: `calc(${BOTTOM_NAV_FALLBACK_PX}px + env(safe-area-inset-bottom) + 16px)` }}
        >
          <Home className="mx-auto mb-1 h-5 w-5 text-cyan-200" />
          <p className="text-sm font-black">No properties found</p>
          <p className="text-xs text-slate-400">Properties will appear here when users own houses.</p>
        </div>
      )}

      {selectedPropertyData && (
        <section
          className="absolute left-3 z-40 w-[min(430px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/86 shadow-2xl shadow-black/50 backdrop-blur-xl md:left-4"
          style={{ bottom: `calc(var(--bottom-nav-height, ${BOTTOM_NAV_FALLBACK_PX}px) + env(safe-area-inset-bottom) + 16px)` }}
        >
          <button
            type="button"
            onClick={() => setDetailsExpanded((expanded) => !expanded)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                  selectedPropertyData.isAdmin
                    ? 'border-amber-300/30 bg-amber-400/10 text-amber-200'
                    : 'border-cyan-300/25 bg-cyan-400/10 text-cyan-200'
                }`}
              >
                {selectedPropertyData.isAdmin ? <Crown className="h-5 w-5" /> : <Home className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-black text-white md:text-base">
                    {selectedPropertyData.label}
                  </p>
                  {selectedPropertyData.isLive && (
                    <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                      Live
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">
                  {selectedPropertyData.address}
                  {selectedPropertyData.owner ? ` • ${selectedPropertyData.owner}` : ''}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={selectedPropertyData.status} />
              {detailsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </button>

          {detailsExpanded && (
            <div className="max-h-[46vh] overflow-y-auto border-t border-white/10 px-4 pb-4 pt-3 [scrollbar-width:thin]">
              <div className="grid grid-cols-3 gap-2">
                <InfoPill icon={<Home className="h-4 w-4" />} label="Properties" value={ownedHouses.length} />
                <InfoPill icon={<Car className="h-4 w-4" />} label="Cars" value={vehicles.length} />
                <InfoPill icon={<Shield className="h-4 w-4" />} label="Raids" value={raids.length} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <DetailRow
                  label="Property type"
                  value={
                    selectedPropertyData.kind === 'tower'
                      ? 'CEO Landmark'
                      : selectedPropertyData.kind === 'mansion'
                        ? 'Mansion'
                        : 'Residence'
                  }
                />
                <DetailRow
                  label="Security"
                  value={isRaided ? 'Compromised' : 'Secure'}
                  valueClassName={isRaided ? 'text-red-300' : 'text-emerald-300'}
                />
                <DetailRow
                  label="Insurance"
                  value={selectedPropertyData.hasHomeInsurance ? 'Active' : 'None'}
                />
                <DetailRow
                  label="License"
                  value={selectedPropertyData.licenseStatus || 'None'}
                />
              </div>

              {selectedPropertyData.isLive && (
                <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Live now • {selectedPropertyData.viewerCount || 0} viewers
                </div>
              )}

              {selectedPropertyData.inSeat && (
                <div className="mt-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
                  Currently on a live seat
                  {selectedPropertyData.seatIndex != null ? ` • Seat ${selectedPropertyData.seatIndex}` : ''}
                </div>
              )}

              <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-red-100">Raid action</p>
                    <p className="text-[11px] text-red-100/60">Cost: {RAID_COST} TC</p>
                  </div>
                  <Badge className="bg-red-500/20 text-red-100 ring-1 ring-red-300/20">
                    {RAID_COST} TC
                  </Badge>
                </div>
                <Button
                  disabled={!raidWindowActive || selectedPropertyData.ownerId === profile?.id}
                  className="mt-3 h-9 w-full bg-slate-800 text-xs text-slate-400 disabled:cursor-not-allowed disabled:opacity-100"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  {!raidWindowActive
                    ? 'Raids Locked'
                    : selectedPropertyData.ownerId === profile?.id
                      ? 'Cannot Raid Your Property'
                      : 'Start Raid'}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <div
        className="pointer-events-none absolute right-3 z-30 hidden rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[11px] text-slate-300 backdrop-blur md:block"
        style={{ bottom: `calc(var(--bottom-nav-height, ${BOTTOM_NAV_FALLBACK_PX}px) + env(safe-area-inset-bottom) + 16px)` }}
      >
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-cyan-300" />
          Drag to explore • Scroll to zoom • Click a building
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: PropertyStatus }) {
  const classes: Record<PropertyStatus, string> = {
    owned: 'bg-cyan-400/15 text-cyan-100 ring-cyan-300/25',
    available: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/25',
    raided: 'bg-red-500/15 text-red-100 ring-red-300/25',
    locked: 'bg-slate-400/15 text-slate-100 ring-slate-300/20',
  }

  return <Badge className={`${classes[status]} capitalize ring-1`}>{status}</Badge>
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      <div className="mb-1 text-cyan-200">{icon}</div>
      <p className="text-base font-black text-white">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function DetailRow({
  label,
  value,
  valueClassName = 'text-white',
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate font-bold capitalize ${valueClassName}`}>{value}</p>
    </div>
  )
}

function MapLegend() {
  const items = [
    { label: 'Owned', className: 'bg-cyan-400' },
    { label: 'Raided', className: 'bg-red-500' },
    { label: 'Locked', className: 'bg-slate-400' },
    { label: 'Admin / CEO', className: 'bg-amber-300' },
  ]

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
          <span className="text-xs font-bold text-slate-200">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
