import React, { useEffect, useState } from 'react';
import { loadLeaflet } from '../lib/leafletLoader';

export function LazyMapContainer({
  children,
  center,
  zoom,
  style,
  className,
  ...props
}: {
  children: (L: typeof import('leaflet'), RL: typeof import('react-leaflet')) => React.ReactNode
  center: [number, number]
  zoom: number
  style?: React.CSSProperties
  className?: string
  [key: string]: any
}) {
  const [libs, setLibs] = useState<{ L: typeof import('leaflet'); RL: typeof import('react-leaflet') } | null>(null)

  useEffect(() => {
    loadLeaflet().then(setLibs)
  }, [])

  if (!libs) {
    return (
      <div className={`flex items-center justify-center bg-slate-900/30 rounded-xl border border-slate-700/50 ${className || ''}`} style={style || { height: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading map...</span>
        </div>
      </div>
    )
  }

  const { MapContainer, TileLayer: _TileLayer, Marker: _Marker, Popup: _Popup, useMap: _useMap } = libs.RL
  const L = libs.L

  return (
    <MapContainer center={center} zoom={zoom} style={style} className={className} {...props}>
      {children(L, libs.RL)}
    </MapContainer>
  )
}
