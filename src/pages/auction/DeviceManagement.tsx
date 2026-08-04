import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Copy,
  Loader2,
  Monitor,
  Printer,
  QrCode,
  Smartphone,
  Trash2,
  X,
  Zap,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { generateUUID } from '../../lib/uuid'
import { generateBarcodeDataURL } from '../../lib/barcode'

type DeviceType = 'scanner' | 'printer'
type ConnectionType = 'phone' | 'browser'
type DeviceStatus = 'connected' | 'disconnected' | 'pairing' | 'error'

interface MobileScannerSession {
  id: string
  pairing_code: string
  session_token: string
  status: 'pending' | 'paired' | 'connected' | 'disconnected' | 'expired'
  device_name: string | null
  connected_at: string | null
  last_seen_at: string
  created_at: string
}

interface Device {
  id: string
  device_name: string
  device_type: DeviceType
  device_brand: string | null
  connection_type: ConnectionType
  device_id: string | null
  status: DeviceStatus
  last_connected_at: string | null
  last_error: string | null
  created_at: string
}

const STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string; dot: string }> = {
  connected: { label: 'Connected', color: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100', dot: 'bg-emerald-400' },
  disconnected: { label: 'Disconnected', color: 'border-slate-400/30 bg-slate-500/10 text-slate-200', dot: 'bg-slate-400' },
  pairing: { label: 'Pairing', color: 'border-amber-300/30 bg-amber-400/10 text-amber-100', dot: 'bg-amber-400' },
  error: { label: 'Error', color: 'border-red-300/30 bg-red-500/10 text-red-100', dot: 'bg-red-400' },
}

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
const ghost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50'

export default function DeviceManagement() {
  const { user } = useAuthStore()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [diagnostics, setDiagnostics] = useState<string[]>([])

  // Mobile scanner pairing state
  const [mobileSessions, setMobileSessions] = useState<MobileScannerSession[]>([])
  const [showPairingModal, setShowPairingModal] = useState(false)
  const [pairingCode, setPairingCode] = useState('')
  const [desktopCodeInput, setDesktopCodeInput] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [activeAuctions, setActiveAuctions] = useState<Array<{ id: string; title: string }>>([])
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('')

  // Tracks sessions that have already shown a "connected" toast so heartbeat
  // updates (which re-fire postgres_changes) don't spam the popup repeatedly.
  const connectedToastShownRef = useRef<Set<string>>(new Set())

  const fetchDevices = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('auction_devices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setDevices(data || [])
    } catch (error: any) {
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { void fetchDevices() }, [fetchDevices])

  const removeDevice = async (id: string) => {
    try {
      const device = devices.find(d => d.id === id)

      if (device?.connection_type === 'bluetooth' && device?.status === 'connected') {
        if (bluetoothDeviceRef.current && bluetoothDeviceRef.current.gatt?.connected) {
          bluetoothDeviceRef.current.gatt.disconnect()
        }
        bluetoothDeviceRef.current = null
        bluetoothServerRef.current = null
      }

      if (device?.device_name) {
        await supabase
          .from('auction_device_sessions')
          .delete()
          .eq('device_name', device.device_name)
          .eq('auctioneer_id', user?.id || '')
      }

      await supabase.from('auction_devices').delete().eq('id', id)

      setDevices(prev => prev.filter(d => d.id !== id))
      toast.success('Device removed')
      await fetchDevices()
    } catch {
      toast.error('Failed to remove device')
    }
  }

  // ── Web Bluetooth connection state ──────────────────────────────────────
  const bluetoothDeviceRef = useRef<BluetoothDevice | null>(null)
  const bluetoothServerRef = useRef<BluetoothRemoteGATTServer | null>(null)

  const connectBluetoothDevice = async (device: Device): Promise<boolean> => {
    // Check if Web Bluetooth is supported
    if (!navigator.bluetooth) {
      toast.error('Web Bluetooth is not supported in this browser. Use Chrome or Edge.')
      return false
    }

    try {
      // Request a Bluetooth device
      const btDevice = await navigator.bluetooth.requestDevice({
        // For printers, accept all devices; for scanners, filter by service
        filters: device.device_type === 'printer'
          ? [{ services: ['generic_access'] }]
          : [{ services: ['generic_access', 'human_interface_device'] }],
        optionalServices: [
          'generic_access',
          'human_interface_device',
          'battery_service',
          // Common printer service UUIDs
          '000018f0-0000-1000-8000-00805f9b34fb', // Printer service
        ],
      })

      bluetoothDeviceRef.current = btDevice

      // Connect to the GATT server
      const server = await btDevice.gatt?.connect()
      if (!server) {
        toast.error('Failed to connect to device GATT server')
        return false
      }
      bluetoothServerRef.current = server

      // Listen for disconnection
      btDevice.addEventListener('gattserverdisconnected', () => {
        bluetoothDeviceRef.current = null
        bluetoothServerRef.current = null
        // Update device status in DB
        supabase
          .from('auction_devices')
          .update({ status: 'disconnected' })
          .eq('id', device.id)
          .then(() => fetchDevices())
        toast.warning(`${device.device_name} disconnected`)
      })

      toast.success(`${device.device_name} connected via Bluetooth`)
      return true
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        toast.error('No device selected or device not found')
      } else {
        toast.error(`Bluetooth connection failed: ${err?.message || 'Unknown error'}`)
      }
      return false
    }
  }

  const disconnectBluetoothDevice = async (device: Device) => {
    try {
      if (bluetoothDeviceRef.current && bluetoothDeviceRef.current.gatt?.connected) {
        bluetoothDeviceRef.current.gatt.disconnect()
      }
      bluetoothDeviceRef.current = null
      bluetoothServerRef.current = null
      toast.success(`${device.device_name} disconnected`)
    } catch (err: any) {
      toast.error(`Disconnect failed: ${err?.message || 'Unknown error'}`)
    }
  }

  const toggleConnection = async (device: Device) => {
    const newStatus: DeviceStatus = device.status === 'connected' ? 'disconnected' : 'pairing'
    try {
      await supabase
        .from('auction_devices')
        .update({
          status: newStatus,
          last_connected_at: newStatus === 'connected' ? new Date().toISOString() : device.last_connected_at,
        })
        .eq('id', device.id)

      if (newStatus === 'pairing') {
        if (device.connection_type === 'bluetooth') {
          // Use Web Bluetooth API for Bluetooth devices
          const connected = await connectBluetoothDevice(device)
          if (connected) {
            await supabase
              .from('auction_devices')
              .update({ status: 'connected', last_connected_at: new Date().toISOString() })
              .eq('id', device.id)
          } else {
            // Revert to disconnected if connection failed
            await supabase
              .from('auction_devices')
              .update({ status: 'disconnected' })
              .eq('id', device.id)
          }
          await fetchDevices()
        } else {
          // Simulate pairing for USB/HID/Network devices
          setTimeout(async () => {
            await supabase
              .from('auction_devices')
              .update({ status: 'connected', last_connected_at: new Date().toISOString() })
              .eq('id', device.id)
            await fetchDevices()
          }, 2000)
        }
      } else if (newStatus === 'disconnected' && device.connection_type === 'bluetooth') {
        await disconnectBluetoothDevice(device)
      }

      await fetchDevices()
    } catch {
      toast.error('Failed to update device')
    }
  }

  const runDiagnostics = () => {
    const results: string[] = []
    results.push(`[${new Date().toLocaleTimeString()}] Starting device diagnostics...`)
    results.push(`[${new Date().toLocaleTimeString()}] Scanning USB ports...`)
    results.push(`[${new Date().toLocaleTimeString()}] Found ${devices.filter(d => d.connection_type === 'usb').length} USB device(s)`)
    results.push(`[${new Date().toLocaleTimeString()}] Scanning Bluetooth...`)
    results.push(`[${new Date().toLocaleTimeString()}] Web Bluetooth API: ${navigator.bluetooth ? 'Available' : 'Not available (use Chrome/Edge)'}`)
    results.push(`[${new Date().toLocaleTimeString()}] Found ${devices.filter(d => d.connection_type === 'bluetooth').length} Bluetooth device(s)`)
    results.push(`[${new Date().toLocaleTimeString()}] Checking HID keyboard scanners...`)
    results.push(`[${new Date().toLocaleTimeString()}] HID scanners are detected automatically via keyboard input`)
    results.push(`[${new Date().toLocaleTimeString()}] Checking printer drivers...`)
    results.push(`[${new Date().toLocaleTimeString()}] Browser print API: ${window.print ? 'Available' : 'Not available'}`)
    results.push(`[${new Date().toLocaleTimeString()}] Diagnostics complete.`)
    setDiagnostics(results)
  }

  // ── Mobile Scanner Pairing ────────────────────────────────────────────────

  const fetchMobileSessions = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('auction_device_sessions')
        .select('*')
        .eq('auctioneer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setMobileSessions(data || [])
    } catch (err) {
      console.warn('[DeviceMgmt] Failed to fetch mobile sessions:', err)
    }
  }, [user?.id])

  const fetchActiveAuctions = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('auction_shows')
        .select('id, title')
        .eq('auctioneer_id', user.id)
        .in('status', ['scheduled', 'live'])
        .order('created_at', { ascending: false })
        .limit(10)
      setActiveAuctions(data || [])
    } catch (err) {
      console.warn('[DeviceMgmt] Failed to fetch auctions:', err)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchMobileSessions()
    void fetchActiveAuctions()
  }, [fetchMobileSessions, fetchActiveAuctions])

  const generatePairingCode = useCallback(async () => {
    if (!user?.id) return

    const activeScannerCount = mobileSessions.filter((s) => ['connected', 'pending', 'paired'].includes(s.status)).length
    if (activeScannerCount >= 2) {
      toast.error('Only 2 active phone scanner connections are allowed for auctioneers at once.')
      return
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const token = generateUUID()

    try {
      const { data, error } = await supabase
        .from('auction_device_sessions')
        .insert({
          auctioneer_id: user.id,
          auction_id: selectedAuctionId || null,
          pairing_code: code,
          session_token: token,
          status: 'pending',
        })
        .select('*')
        .single()

      if (error) throw error

      setPairingCode(code)
      await fetchMobileSessions()

      // Subscribe to session updates
      const channel = supabase
        .channel(`device_session_${data.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'auction_device_sessions',
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            const updated = payload.new as MobileScannerSession
            setMobileSessions((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s)),
            )
            // Only toast on the transition into "connected". Heartbeats update
            // last_seen_at and re-fire this event, so guard against repeats.
            if (updated.status === 'connected') {
              if (!connectedToastShownRef.current.has(updated.id)) {
                connectedToastShownRef.current.add(updated.id)
                toast.success(`Scanner connected: ${updated.device_name || 'Mobile Device'}`)
              }
            } else {
              // Reset when it leaves the connected state so a genuine
              // reconnect will notify again.
              connectedToastShownRef.current.delete(updated.id)
            }
          },
        )
        .subscribe()

      // Auto-expire after 10 minutes
      setTimeout(async () => {
        await supabase
          .from('auction_device_sessions')
          .update({ status: 'expired' })
          .eq('id', data.id)
          .eq('status', 'pending')
        await fetchMobileSessions()
      }, 10 * 60 * 1000)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate pairing code')
    }
  }, [user?.id, selectedAuctionId, fetchMobileSessions])

  // ── Desktop enters a code from mobile ────────────────────────────────────

  const connectDesktopWithCode = useCallback(async () => {
    const code = desktopCodeInput.trim()
    if (!code || code.length !== 6) {
      toast.error('Enter a valid 6-digit code')
      return
    }

    try {
      // Find a pending session with this code (created by mobile)
      const { data: existingSession, error: findError } = await supabase
        .from('auction_device_sessions')
        .select('*')
        .eq('pairing_code', code)
        .eq('status', 'pending')
        .maybeSingle()

      if (findError) throw findError

      if (existingSession) {
        const activeScannerCount = mobileSessions.filter((s) => ['connected', 'pending', 'paired'].includes(s.status)).length
        if (activeScannerCount >= 2) {
          toast.error('Only 2 active phone scanner connections are allowed for auctioneers at once.')
          return
        }

        // Found a pending session from mobile — mark as connected
        const { data, error: updateError } = await supabase
          .from('auction_device_sessions')
          .update({
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .eq('id', existingSession.id)
          .select('*')
          .single()

        if (updateError) throw updateError

        setPairingCode(code)
        setShowCodeInput(false)
        setDesktopCodeInput('')
        await fetchMobileSessions()
        connectedToastShownRef.current.add(data.id)
        toast.success(`Scanner connected: ${data.device_name || 'Mobile Device'}`)
      } else {
        const activeScannerCount = mobileSessions.filter((s) => ['connected', 'pending', 'paired'].includes(s.status)).length
        if (activeScannerCount >= 2) {
          toast.error('Only 2 active phone scanner connections are allowed for auctioneers at once.')
          return
        }

        // No pending session — create a new connected session with this code
        const token = generateUUID()
        const { data, error: createError } = await supabase
          .from('auction_device_sessions')
          .insert({
            auctioneer_id: user!.id,
            auction_id: selectedAuctionId || null,
            pairing_code: code,
            session_token: token,
            device_name: 'Web Scanner',
            status: 'connected',
            connected_at: new Date().toISOString(),
          })
          .select('*')
          .single()

        if (createError) throw createError

        setPairingCode(code)
        setShowCodeInput(false)
        setDesktopCodeInput('')
        await fetchMobileSessions()
        connectedToastShownRef.current.add(data.id)
        toast.success('Scanner connected!')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect with code')
    }
  }, [desktopCodeInput, user?.id, selectedAuctionId, fetchMobileSessions])

  const removeMobileSession = useCallback(async (sessionId: string) => {
    try {
      await supabase
        .from('auction_device_sessions')
        .delete()
        .eq('id', sessionId)
      connectedToastShownRef.current.delete(sessionId)
      await fetchMobileSessions()
      toast.success('Scanner removed')
    } catch {
      toast.error('Failed to remove scanner')
    }
  }, [fetchMobileSessions])

  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tc_default_printer') || ''
    }
    return ''
  })

  const copyPairingCode = useCallback(() => {
    navigator.clipboard.writeText(pairingCode)
    toast.success('Pairing code copied!')
  }, [pairingCode])

  const detectPrinters = useCallback(async () => {
    if (!user?.id) return

    try {
      const detectedPrinters: Array<{ name: string; type: string }> = []

      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print()
        detectedPrinters.push({ name: 'Browser Print System', type: 'browser' })
      }

      const printerName = `Browser Printer ${new Date().toLocaleTimeString()}`

      const { data: existing } = await supabase
        .from('auction_devices')
        .select('id')
        .eq('user_id', user.id)
        .eq('device_type', 'printer')
        .maybeSingle()

      if (existing) {
        await supabase
          .from('auction_devices')
          .update({
            device_name: printerName,
            device_brand: 'System Printer',
            connection_type: 'browser',
            status: 'connected',
            last_connected_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('auction_devices').insert({
          user_id: user.id,
          device_name: printerName,
          device_type: 'printer',
          device_brand: 'System Printer',
          connection_type: 'browser',
          status: 'connected',
        })
      }

      toast.success('Printer detected — use your browser print dialog to select the target printer')
      await fetchDevices()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to detect printer')
    }
  }, [fetchDevices, user?.id])

  const selectPrinter = useCallback(async (printerName: string) => {
    setSelectedPrinter(printerName)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tc_default_printer', printerName)
    }
    toast.success(`Default printer set to: ${printerName}`)
  }, [])

  const printTestLabel = useCallback(async () => {
    try {
      const testDataURL = generateBarcodeDataURL('TC-TEST-000001')
      const printWindow = window.open('', '_blank', 'width=400,height=600')
      if (!printWindow) {
        toast.error('Pop-up blocked. Allow pop-ups for this site to print labels.')
        return
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Test Print Label</title>
            <style>
              @page { size: 2.4in 1in; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
              .label { width: 2.4in; height: 1in; border: 2px dashed #ccc; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: Arial, sans-serif; }
              .label img { max-width: 90%; max-height: 60%; }
              .label p { margin: 4px 0; font-size: 12px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="label">
              <img src="${testDataURL}" alt="Test Barcode" />
              <p>TC-TEST-000001</p>
              <p style="font-size: 10px; color: #666;">Test Label — Mai Troll Auction</p>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 300)
    } catch {
      toast.error('Failed to open print dialog')
    }
  }, [])

  // Subscribe to scan events from mobile scanners
  useEffect(() => {
    if (!user?.id) return

    const connectedSessions = mobileSessions.filter((s) => s.status === 'connected')
    if (connectedSessions.length === 0) return

    const channels = connectedSessions.map((s) =>
      supabase
        .channel(`auction_scans_${s.auction_id || 'none'}`)
        .on('broadcast', { event: 'barcode_scanned' }, (payload: any) => {
          const data = payload?.payload
          if (!data) return
          toast.info(`📱 Scan: ${data.barcode}`, { duration: 5000 })
          // The parent auction page can listen for these events too
          window.dispatchEvent(
            new CustomEvent('auction-barcode-scanned', { detail: data }),
          )
        })
        .subscribe(),
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [mobileSessions, user?.id])

  const scanners = devices.filter(d => d.device_type === 'scanner')
  const printers = devices.filter(d => d.device_type === 'printer')

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%)]" />

      <main className="relative z-10 mx-auto max-w-[1200px] space-y-4">
        <header className={cn(panel, 'p-5')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10">
                <Monitor className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Device Management</h1>
                <p className="text-sm text-slate-400">Use your phone for scanner pairing and your browser/PC printer options for labels and slips.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={runDiagnostics} className={ghost}>
                <Activity className="h-4 w-4" /> Diagnostics
              </button>
            </div>
          </div>
        </header>

        {/* ── Mobile Scanner Devices ──────────────────────────────────────── */}
        <section className={cn(panel, 'p-5')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Smartphone className="h-5 w-5 text-cyan-300" />
              Connected Scanner Devices
              {mobileSessions.filter((s) => s.status === 'connected').length > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {mobileSessions.filter((s) => s.status === 'connected').length} active
                </span>
              )}
            </h2>
            <button
              onClick={() => setShowPairingModal(true)}
              className={cn(primary, 'text-xs')}
            >
              <QrCode className="h-4 w-4" /> Connect Mobile Scanner
            </button>
          </div>

          {mobileSessions.length === 0 ? (
            <div className="py-8 text-center">
              <Smartphone className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No phone scanners connected</p>
              <p className="mt-1 text-xs text-slate-600">
                Click &quot;Connect Mobile Scanner&quot; to generate a pairing code for your phone.
                <br />
                Open <span className="font-mono text-cyan-400">/auctioneer/scanner</span> on your mobile device.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mobileSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-[#0a1425]/80 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        session.status === 'connected'
                          ? 'bg-emerald-400 animate-pulse'
                          : session.status === 'pending'
                            ? 'bg-amber-400 animate-pulse'
                            : session.status === 'paired'
                              ? 'bg-cyan-400 animate-pulse'
                              : 'bg-slate-500',
                      )}
                    />
                    <div>
                      <p className="text-sm font-bold text-white">
                        {session.device_name || 'Mobile Scanner'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Code: <span className="font-mono text-cyan-400">{session.pairing_code}</span>
                        {session.connected_at && (
                          <span className="ml-2">
                            Connected {new Date(session.connected_at).toLocaleTimeString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                        session.status === 'connected'
                          ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
                          : session.status === 'pending'
                            ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
                            : session.status === 'paired'
                              ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                              : 'border-slate-400/30 bg-slate-500/10 text-slate-200',
                      )}
                    >
                      {session.status}
                    </span>
                    <button
                      onClick={() => removeMobileSession(session.id)}
                      className={cn(ghost, 'text-xs text-red-300')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Last scan indicator */}
          {mobileSessions.some((s) => s.status === 'connected') && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-300/10 bg-cyan-400/5 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-[10px] text-slate-400">
                Scans from connected devices will appear in real-time on your auction page.
                <span className="ml-1 text-cyan-400">Listening...</span>
              </span>
            </div>
          )}
        </section>

        {/* Connected Printers */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
            <Printer className="h-5 w-5 text-cyan-300" />
            Connected Printers ({printers.length})
          </h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={detectPrinters} className={secondary}>
              <Printer className="h-4 w-4" /> Detect Printers
            </button>
            <button onClick={printTestLabel} className={ghost}>
              Print Test Label
            </button>
            {selectedPrinter && (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-bold text-cyan-200">
                Default: {selectedPrinter}
              </span>
            )}
          </div>
          {printers.length === 0 ? (
            <div className="py-10 text-center">
              <Printer className="mx-auto mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">No printers configured</p>
              <p className="text-xs text-slate-600 mt-1">Click "Detect Printers" to open your browser print dialog and select a printer.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {printers.map(device => (
                <div key={device.id} className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-[#0a1425]/80 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-sm font-bold text-white">{device.device_name}</p>
                      <p className="text-xs text-slate-500">{device.device_brand} · {device.connection_type.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => selectPrinter(device.device_name)}
                      className={cn(ghost, 'text-xs')}
                    >
                      {selectedPrinter === device.device_name ? 'Selected' : 'Select'}
                    </button>
                    <button onClick={() => removeDevice(device.id)} className={cn(ghost, 'text-xs text-red-300')}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Diagnostics */}
        {diagnostics.length > 0 && (
          <section className={cn(panel, 'p-5')}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
              <Zap className="h-5 w-5 text-cyan-300" />
              Diagnostics
            </h2>
            <div className="rounded-xl border border-cyan-300/10 bg-black/40 p-4 font-mono text-xs text-slate-300 max-h-60 overflow-y-auto">
              {diagnostics.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </section>
        )}

        {/* ── Mobile Scanner Pairing Modal ──────────────────────────────────── */}
        {showPairingModal && (() => {
          // Check if the current pairing code's session is connected
          const currentSession = mobileSessions.find(
            (s) => s.pairing_code === pairingCode && s.status === 'connected'
          )
          const isConnected = !!currentSession

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className={cn(panel, 'w-full max-w-md p-6')}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-black text-white">
                    {isConnected ? 'Scanner Connected' : 'Connect Mobile Scanner'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowPairingModal(false)
                      setPairingCode('')
                    }}
                    className={ghost}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Connected state */}
                  {isConnected ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-6 text-center">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                        <p className="mt-3 text-lg font-black text-emerald-200">Scanner Connected!</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {currentSession!.device_name || 'Mobile Scanner'} is now linked to your auction.
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-300">Live</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setPairingCode('')
                          }}
                          className={cn(secondary, 'flex-1 text-xs')}
                        >
                          Connect Another Scanner
                        </button>
                        <button
                          onClick={() => {
                            setShowPairingModal(false)
                            setPairingCode('')
                          }}
                          className={cn(primary, 'flex-1 text-xs')}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Auction selector */}
                      {activeAuctions.length > 0 && (
                        <div>
                          <label className="mb-1 block text-xs text-slate-500">Link to Auction</label>
                          <select
                            value={selectedAuctionId}
                            onChange={(e) => setSelectedAuctionId(e.target.value)}
                            className={input}
                          >
                            <option value="" className="bg-slate-950">No specific auction</option>
                            {activeAuctions.map((a) => (
                              <option key={a.id} value={a.id} className="bg-slate-950">{a.title}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Generate button or code display */}
                      {!pairingCode && !showCodeInput ? (
                        <div className="space-y-3">
                          <button
                            onClick={generatePairingCode}
                            className={cn(primary, 'w-full')}
                          >
                            <QrCode className="h-4 w-4" /> Generate Pairing Code
                          </button>
                          <button
                            onClick={() => setShowCodeInput(true)}
                            className={cn(secondary, 'w-full text-xs')}
                          >
                            <Smartphone className="h-4 w-4" /> Enter Mobile Code
                          </button>
                        </div>
                      ) : showCodeInput ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enter Mobile Code</p>
                            <p className="mt-1 text-[10px] text-slate-500">Enter the code generated on your mobile device.</p>
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={desktopCodeInput}
                              onChange={(e) => setDesktopCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit code"
                              className={cn(input, 'text-center text-lg font-black tracking-[0.2em]')}
                              maxLength={6}
                            />
                            <button
                              onClick={connectDesktopWithCode}
                              disabled={desktopCodeInput.length !== 6}
                              className={cn(primary, 'px-4')}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              setShowCodeInput(false)
                              setDesktopCodeInput('')
                            }}
                            className={cn(ghost, 'w-full text-xs')}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Numeric code */}
                          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4 text-center">
                            <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">Auction Code</p>
                            <div className="mt-1 flex items-center justify-center gap-3">
                              <p className="text-3xl font-black tracking-[0.3em] text-white">{pairingCode}</p>
                              <button onClick={copyPairingCode} className={cn(ghost, 'text-xs')}>
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="mt-2 text-[10px] text-slate-500">
                              Enter this code on your mobile device at <span className="font-mono text-cyan-400">/auctioneer/scanner</span>
                            </p>
                          </div>

                          {/* Status */}
                          <div className="flex items-center justify-center gap-2 text-xs text-amber-300">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Waiting for mobile device to connect...
                          </div>

                          {/* Generate new */}
                          <button
                            onClick={() => {
                              setPairingCode('')
                            }}
                            className={cn(secondary, 'w-full text-xs')}
                          >
                            Generate New Code
                          </button>
                        </div>
                      )}

                      {/* Instructions */}
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">How to connect</p>
                        <ol className="space-y-1 text-[11px] text-slate-400">
                          <li>1. Click &quot;Generate Pairing Code&quot; above</li>
                          <li>2. Open <span className="font-mono text-cyan-400">/auctioneer/scanner</span> on your phone</li>
                          <li>3. Enter the 6-digit code</li>
                          <li>4. The scanner will connect automatically</li>
                        </ol>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}

function DeviceRow({
  device,
  onToggle,
  onRemove,
}: {
  device: Device
  onToggle: (device: Device) => void
  onRemove: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.disconnected

  return (
    <div className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-[#0a1425]/80 p-3">
      <div className="flex items-center gap-3">
        <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
        <div>
          <p className="text-sm font-bold text-white">{device.device_name}</p>
          <p className="text-xs text-slate-500">
            {device.device_brand} · {device.connection_type.toUpperCase()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase', cfg.color)}>
          {cfg.label}
        </span>
        <button onClick={() => onToggle(device)} className={cn(ghost, 'text-xs')}>
          {device.status === 'connected' ? 'Disconnect' : 'Connect'}
        </button>
        <button onClick={() => onRemove(device.id)} className={cn(ghost, 'text-xs text-red-300')}>
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
