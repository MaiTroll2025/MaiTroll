import React, { useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  ZoomControl,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Badge } from '@/components/ui/badge'
import { BriefcaseBusiness, CalendarDays, CheckCircle2, Coins, MapPin } from 'lucide-react'

type Coordinates = [number, number]

interface NeighborEvent {
  id: string | number
  title?: string
  description?: string
  category?: string
  reward_coins?: number
  latitude?: number | null
  longitude?: number | null
}

interface NeighborBusiness {
  id: string | number
  business_name?: string
  description?: string
  category?: string
  verified?: boolean
  latitude?: number | null
  longitude?: number | null
}

interface NeighborMapProps {
  events?: NeighborEvent[]
  businesses?: NeighborBusiness[]
  mapCenter?: Coordinates
  zoom?: number
  className?: string
}

interface PopupCardProps {
  title: string
  description?: string
  badges?: Array<string | undefined | null>
  type: 'event' | 'business'
  verified?: boolean
}

const DEFAULT_CENTER: Coordinates = [39.7392, -104.9903]

const isValidCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const getPosition = (
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  fallback: Coordinates,
): Coordinates => {
  if (isValidCoordinate(latitude) && isValidCoordinate(longitude)) {
    return [latitude, longitude]
  }

  return fallback
}

function PopupCard({
  title,
  description,
  badges = [],
  type,
  verified,
}: PopupCardProps) {
  const visibleBadges = badges.filter(
    (badge): badge is string => Boolean(badge && badge.trim()),
  )

  const isEvent = type === 'event'

  return (
    <article className="w-[230px] overflow-hidden rounded-2xl border border-white/10 bg-[#07111f] text-white shadow-2xl">
      <div
        className={[
          'h-1 w-full',
          isEvent
            ? 'bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400'
            : verified
              ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400'
              : 'bg-gradient-to-r from-amber-400 via-orange-400 to-red-400',
        ].join(' ')}
      />

      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div
            className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              isEvent
                ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-200'
                : 'border-violet-300/20 bg-violet-400/10 text-violet-200',
            ].join(' ')}
          >
            {isEvent ? (
              <CalendarDays className="h-4.5 w-4.5" />
            ) : (
              <BriefcaseBusiness className="h-4.5 w-4.5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="line-clamp-2 text-sm font-black leading-5 text-white">
                {title}
              </h4>

              {!isEvent && verified && (
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                  aria-label="Verified business"
                />
              )}
            </div>

            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {isEvent ? 'Neighborhood Event' : 'Local Business'}
            </p>
          </div>
        </div>

        {description && (
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-300">
            {description}
          </p>
        )}

        {visibleBadges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleBadges.map((badge) => (
              <Badge
                key={badge}
                className="border border-cyan-300/15 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-100"
              >
                {badge}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

export default function NeighborMap({
  events = [],
  businesses = [],
  mapCenter = DEFAULT_CENTER,
  zoom = 12,
  className = '',
}: NeighborMapProps) {
  const safeCenter = useMemo<Coordinates>(() => {
    if (
      Array.isArray(mapCenter) &&
      mapCenter.length === 2 &&
      isValidCoordinate(mapCenter[0]) &&
      isValidCoordinate(mapCenter[1])
    ) {
      return mapCenter
    }

    return DEFAULT_CENTER
  }, [mapCenter])

  return (
    <div
      className={[
        'relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950',
        className,
      ].join(' ')}
    >
      <MapContainer
        center={safeCenter}
        zoom={zoom}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ZoomControl position="bottomright" />

        {events.map((event) => {
          const position = getPosition(
            event.latitude,
            event.longitude,
            safeCenter,
          )

          return (
            <CircleMarker
              key={`event-${event.id}`}
              center={position}
              radius={9}
              pathOptions={{
                color: '#67e8f9',
                fillColor: '#0891b2',
                fillOpacity: 0.9,
                weight: 3,
              }}
              eventHandlers={{
                mouseover: (event) => event.target.openPopup(),
                mouseout: (event) => event.target.closePopup(),
              }}
            >
              <Popup closeButton={false} offset={[0, -8]}>
                <PopupCard
                  type="event"
                  title={event.title?.trim() || 'Neighborhood Event'}
                  description={event.description}
                  badges={[
                    event.category,
                    `${event.reward_coins ?? 0} coins`,
                  ]}
                />
              </Popup>
            </CircleMarker>
          )
        })}

        {businesses.map((business) => {
          const position = getPosition(
            business.latitude,
            business.longitude,
            safeCenter,
          )

          return (
            <CircleMarker
              key={`business-${business.id}`}
              center={position}
              radius={9}
              pathOptions={{
                color: business.verified ? '#6ee7b7' : '#fbbf24',
                fillColor: business.verified ? '#059669' : '#d97706',
                fillOpacity: 0.9,
                weight: 3,
              }}
              eventHandlers={{
                mouseover: (event) => event.target.openPopup(),
                mouseout: (event) => event.target.closePopup(),
              }}
            >
              <Popup closeButton={false} offset={[0, -8]}>
                <PopupCard
                  type="business"
                  title={
                    business.business_name?.trim() || 'Neighborhood Business'
                  }
                  description={business.description}
                  verified={business.verified}
                  badges={[
                    business.category,
                    business.verified ? 'Verified' : 'Pending',
                  ]}
                />
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200 shadow-xl backdrop-blur">
        <MapPin className="h-3.5 w-3.5 text-cyan-300" />
        Community Map
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold text-cyan-100 backdrop-blur">
          <CalendarDays className="h-3 w-3" />
          {events.length} events
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-violet-300/15 bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold text-violet-100 backdrop-blur">
          <BriefcaseBusiness className="h-3 w-3" />
          {businesses.length} businesses
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-amber-300/15 bg-slate-950/85 px-2.5 py-1 text-[10px] font-bold text-amber-100 backdrop-blur">
          <Coins className="h-3 w-3" />
          Live listings
        </div>
      </div>
    </div>
  )
}
