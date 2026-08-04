import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Radio, Users, Wifi, Activity } from 'lucide-react'

const MAX_CONCURRENT_CONNECTIONS = 675

const glassPanel =
  'rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]'

interface CapacityData {
  activeBroadcasters: number
  activeViewers: number
  activeConnections: number
  maxViewersPerStream: number
}

function getStatusColor(current: number, max: number): string {
  if (max === 0) return 'text-emerald-400'
  const ratio = current / max
  if (ratio >= 1) return 'text-red-400'
  if (ratio >= 0.8) return 'text-yellow-400'
  return 'text-emerald-400'
}

function getBgColor(current: number, max: number): string {
  if (max === 0) return 'bg-emerald-500/10 border-emerald-500/30'
  const ratio = current / max
  if (ratio >= 1) return 'bg-red-500/10 border-red-500/30'
  if (ratio >= 0.8) return 'bg-yellow-500/10 border-yellow-500/30'
  return 'bg-emerald-500/10 border-emerald-500/30'
}

function getBarColor(current: number, max: number): string {
  if (max === 0) return 'bg-cyan-500'
  const ratio = current / max
  if (ratio >= 1) return 'bg-red-500'
  if (ratio >= 0.8) return 'bg-yellow-500'
  return 'bg-cyan-500'
}

function MetricCard({
  icon: Icon,
  label,
  current,
  max,
  unit = '',
}: {
  icon: React.ElementType
  label: string
  current: number
  max: number
  unit?: string
}) {
  const remaining = max > 0 ? Math.max(0, max - current) : 0
  const statusColor = getStatusColor(current, max)
  const bgColor = getBgColor(current, max)
  const barColor = getBarColor(current, max)
  const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0

  return (
    <div className={`${glassPanel} p-5 flex-1`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${bgColor}`}>
          <Icon className={`h-5 w-5 ${statusColor}`} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="text-2xl font-black text-white">
            {current}
            {max > 0 && (
              <span className="text-sm text-slate-500">
                /{max}{unit}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        {max > 0 && (
          <span className="text-xs text-slate-500">
            Remaining: <span className={`font-black ${statusColor}`}>{remaining}</span>
          </span>
        )}
        <span className={`text-xs font-black ${statusColor}`}>
          {max === 0 ? 'NO LIMIT' : current >= max ? 'AT CAPACITY' : current >= max * 0.8 ? 'NEAR LIMIT' : 'OK'}
        </span>
      </div>
      {max > 0 && (
        <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function BetaCapacityMonitor() {
  const [data, setData] = useState<CapacityData>({
    activeBroadcasters: 0,
    activeViewers: 0,
    activeConnections: 0,
    maxViewersPerStream: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caps, setCaps] = useState<{ broadcasterCap: number | null; viewerCap: number | null }>({
    broadcasterCap: null,
    viewerCap: null,
  })

  const fetchCaps = useCallback(async () => {
    try {
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'broadcast_start_cap_max',
          'broadcast_viewer_cap_max',
        ])

      const map: Record<string, number> = {}
      settings?.forEach((row: any) => {
        const parsed = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value
        if (parsed?.value && Number.isFinite(parsed.value)) {
          map[row.setting_key] = Number(parsed.value)
        }
      })

      setCaps({
        broadcasterCap: map.broadcast_start_cap_max ?? null,
        viewerCap: map.broadcast_viewer_cap_max ?? null,
      })
    } catch {
      // non-critical
    }
  }, [])

  const fetchStreamsData = useCallback(async () => {
    try {
      const { data: streams, error } = await supabase
        .from('streams')
        .select('current_viewers, is_live, status')
        .eq('is_live', true)
        .eq('status', 'live')

      if (error) throw error

      const activeBroadcasters = streams?.length || 0
      const totalViewers = streams?.reduce((sum, s) => sum + (s.current_viewers || 0), 0) || 0
      const maxViewersPerStream = streams?.length > 0 ? Math.max(...streams.map(s => s.current_viewers || 0)) : 0

      setData(prev => ({
        ...prev,
        activeBroadcasters,
        activeViewers: totalViewers,
        maxViewersPerStream,
      }))
      setLoading(false)
    } catch (err) {
      console.error('Error fetching streams data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load streams data')
      setLoading(false)
    }
  }, [])

  const fetchConnectionData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/capacity')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      setData(prev => ({
        ...prev,
        activeConnections: json.activeConnections || 0,
      }))
    } catch (err) {
      console.error('Error fetching connection data:', err)
    }
  }, [])

  useEffect(() => {
    fetchStreamsData()
    fetchConnectionData()
    fetchCaps()

    const streamsChannel = supabase
      .channel('beta-capacity-streams')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'streams',
      }, () => {
        fetchStreamsData()
      })
      .subscribe()

    const connectionInterval = setInterval(fetchConnectionData, 5000)

    const capsChannel = supabase
      .channel('beta-capacity-settings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'admin_settings',
        filter: 'setting_key=in.(broadcast_start_cap_max,broadcast_viewer_cap_max)',
      }, () => {
        fetchCaps()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(streamsChannel)
      supabase.removeChannel(capsChannel)
      clearInterval(connectionInterval)
    }
  }, [fetchStreamsData, fetchConnectionData, fetchCaps])

  if (error && !loading) {
    return (
      <section className={glassPanel}>
        <div className="border-b border-cyan-400/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-300/20 bg-red-400/10">
              <Activity className="h-5 w-5 text-red-200" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Beta Capacity Monitor</h2>
              <p className="text-sm text-red-400">Failed to load capacity metrics</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const viewerTotalCap = caps.viewerCap && caps.broadcasterCap ? caps.viewerCap * caps.broadcasterCap : null

  return (
    <section className={glassPanel}>
      <div className="border-b border-cyan-400/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
            <Activity className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Beta Capacity Monitor</h2>
            <p className="text-sm text-slate-400">Real-time platform capacity metrics</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col md:flex-row gap-4">
          <MetricCard
            icon={Radio}
            label="Active Broadcasters"
            current={data.activeBroadcasters}
            max={caps.broadcasterCap ?? 0}
          />
          <MetricCard
            icon={Users}
            label="Active Viewers"
            current={data.activeViewers}
            max={viewerTotalCap ?? 0}
          />
          <MetricCard
            icon={Wifi}
            label="Concurrent Connections"
            current={data.activeConnections}
            max={MAX_CONCURRENT_CONNECTIONS}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`rounded-2xl border ${getBgColor(data.activeBroadcasters, caps.broadcasterCap ?? 0)} p-4 text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Remaining Broadcasters</p>
            <p className={`text-3xl font-black ${getStatusColor(data.activeBroadcasters, caps.broadcasterCap ?? 0)}`}>
              {caps.broadcasterCap ? caps.broadcasterCap - data.activeBroadcasters : '—'}
            </p>
          </div>
          <div className={`rounded-2xl border ${getBgColor(data.maxViewersPerStream, caps.viewerCap ?? 0)} p-4 text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Remaining Viewer Capacity</p>
            <p className={`text-3xl font-black ${getStatusColor(data.maxViewersPerStream, caps.viewerCap ?? 0)}`}>
              {caps.viewerCap ? caps.viewerCap - data.maxViewersPerStream : '—'}
            </p>
          </div>
          <div className={`rounded-2xl border ${getBgColor(data.activeConnections, MAX_CONCURRENT_CONNECTIONS)} p-4 text-center`}>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Remaining Connections</p>
            <p className={`text-3xl font-black ${getStatusColor(data.activeConnections, MAX_CONCURRENT_CONNECTIONS)}`}>
              {MAX_CONCURRENT_CONNECTIONS - data.activeConnections}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
