import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, CameraOff, CheckCircle2, ChevronDown, Clipboard, Flashlight, FlashlightOff, Loader2, Monitor, RefreshCw, Scan, Send, Settings, Smartphone, Unlink, Wifi, X } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { generateUUID } from '@/lib/uuid'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useZxingScanner } from '@/hooks/useZxingScanner'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionState = 'disconnected' | 'pairing' | 'connecting' | 'connected' | 'error'

interface DeviceSession {
  id: string
  auction_id: string | null
  pairing_code: string
  session_token: string
  status: 'pending' | 'paired' | 'connected' | 'disconnected' | 'expired'
  connected_at: string | null
  last_seen_at: string
  device_name?: string | null
  device_info?: Record<string, any> | null
}

interface ScanResult {
  id: string
  barcode: string
  barcodeType: string
  timestamp: number
  synced: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _generateSessionToken(): string {
  return generateUUID()
}

// ─── Component ───────────────────────────────────────────────────────────────

function getIsMobileBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  // Check touch capability
  const hasTouch = (navigator.maxTouchPoints ?? 0) > 0
  // Check user agent for mobile keywords
  const ua = navigator.userAgent.toLowerCase()
  const isMobileUA = /android|iphone|ipad|ipod|blackberry|windows phone|mobile|tablet/i.test(ua)
  // Check screen width
  const isNarrowScreen = (window.visualViewport?.width ?? window.innerWidth) < 768
  // Consider it mobile if: narrow screen OR (mobile UA with touch)
  return isNarrowScreen || (isMobileUA && hasTouch)
}

export default function AuctioneerScanner() {
  const { user, profile } = useAuthStore()
  const { isMobileWidth } = useIsMobile()
  const isMobileDevice = isMobileWidth || getIsMobileBrowser()

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [session, setSession] = useState<DeviceSession | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [activeAuctions, setActiveAuctions] = useState<Array<{ id: string; title: string }>>([])

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [barcodeSupported, setBarcodeSupported] = useState<boolean>(true)
  const [lastScan, setLastScan] = useState<ScanResult | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [scanCount, setScanCount] = useState(0)

  // UI state
  const [showPairingModal, setShowPairingModal] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const barcodeDetectorRef = useRef<any>(null)
  const scanChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastScanTimeRef = useRef(0)

  // ── Fetch active auctions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    const fetchAuctions = async () => {
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
        console.warn('[Scanner] Failed to fetch auctions:', err)
      }
    }
    void fetchAuctions()
  }, [user?.id])

  // ── Barcode Detection API support check ───────────────────────────────────

  useEffect(() => {
    // Check if BarcodeDetector is available (Chrome on Android, Edge).
    // When it is NOT supported (e.g. iOS Safari), we surface a clear notice
    // and fall back to manual / HID scanner entry instead of failing silently.
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
        setBarcodeSupported(true)
      } catch (err) {
        console.warn('[Scanner] BarcodeDetector init failed:', err)
        setBarcodeSupported(false)
      }
    } else {
      console.warn('[Scanner] BarcodeDetector API not available in this browser')
      setBarcodeSupported(false)
    }
  }, [])

  // ── Camera management ─────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.')
      setCameraActive(false)
      setCameraReady(false)
      return
    }

    try {
      setError(null)
      setCameraReady(false)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isMobileDevice ? { ideal: facingMode } : facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        videoRef.current.muted = true
        try {
          await videoRef.current.play()
        } catch (playError) {
          console.warn('[Scanner] Video playback failed, continuing with stream:', playError)
        }
      }
      setCameraActive(true)
      setCameraReady(true)
    } catch (err: any) {
      console.error('[Scanner] Camera error:', err)
      setError(err?.message || 'Camera access denied. Please allow camera permissions.')
      setCameraActive(false)
      setCameraReady(false)
    }
  }, [facingMode, isMobileDevice])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraReady(false)
  }, [])

  const toggleCamera = useCallback(() => {
    stopCamera()
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }, [stopCamera])

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraActive) {
      stopCamera()
      setTimeout(() => startCamera(), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (scanChannelRef.current) supabase.removeChannel(scanChannelRef.current)
    }
  }, [stopCamera])

  // ── Barcode scanning loop ─────────────────────────────────────────────────

  useEffect(() => {
    if (!cameraActive || !cameraReady || !barcodeDetectorRef.current) return

    let animFrame: number
    const detectFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrame = requestAnimationFrame(detectFrame)
        return
      }

      try {
        const barcodes = await barcodeDetectorRef.current.detect(videoRef.current)
        if (barcodes && barcodes.length > 0) {
          const now = Date.now()
          // Debounce: ignore scans within 2 seconds of last scan
          if (now - lastScanTimeRef.current < 2000) {
            animFrame = requestAnimationFrame(detectFrame)
            return
          }
          lastScanTimeRef.current = now

          const barcode = barcodes[0]
          const result: ScanResult = {
            id: generateUUID(),
            barcode: barcode.rawValue || '',
            barcodeType: barcode.format || 'unknown',
            timestamp: now,
            synced: false,
          }

          setLastScan(result)
          setScanHistory((prev) => [result, ...prev].slice(0, 50))
          setScanCount((c) => c + 1)

          // Send to desktop if connected
          if (connectionState === 'connected' && session) {
            await sendScanToDesktop(result)
          }

          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(100)
        }
      } catch {
        // Detection failed silently
      }

      animFrame = requestAnimationFrame(detectFrame)
    }

    animFrame = requestAnimationFrame(detectFrame)
    return () => cancelAnimationFrame(animFrame)
  }, [cameraActive, cameraReady, connectionState, session])

  // ── Fallback decoder (ZXing) when the native BarcodeDetector is unavailable ──
  // Runs only when the native API is not supported (e.g. iOS Safari) so iPhone
  // camera scanning still works. Debounces like the native loop above.
  useZxingScanner({
    enabled: cameraActive && cameraReady && !barcodeSupported,
    videoRef,
    onDetect: (code, format) => {
      const now = Date.now()
      if (now - lastScanTimeRef.current < 2000) return
      lastScanTimeRef.current = now

      const result: ScanResult = {
        id: generateUUID(),
        barcode: code,
        barcodeType: format,
        timestamp: now,
        synced: false,
      }
      setLastScan(result)
      setScanHistory((prev) => [result, ...prev].slice(0, 50))
      setScanCount((c) => c + 1)
      if (connectionState === 'connected' && session) {
        void sendScanToDesktop(result)
      }
      if (navigator.vibrate) navigator.vibrate(100)
    },
  })

  // ── Send scan to desktop via Supabase realtime ────────────────────────────

  const sendScanToDesktop = useCallback(
    async (scan: ScanResult) => {
      if (!session) return

      try {
        // Send via realtime broadcast
        const channel = supabase.channel(`auction_scans:${session.auction_id || 'none'}`)
        await channel.send({
          type: 'broadcast',
          event: 'barcode_scanned',
          payload: {
            auctionId: session.auction_id,
            deviceId: session.id,
            barcode: scan.barcode,
            barcodeType: scan.barcodeType,
            timestamp: new Date(scan.timestamp).toISOString(),
          },
        })

        // Also persist to DB
        await supabase.from('auction_scan_events').insert({
          auction_id: session.auction_id,
          device_session_id: session.id,
          barcode: scan.barcode,
          barcode_type: scan.barcodeType,
          payload: { source: 'mobile_scanner' },
        })

        // Mark as synced
        setLastScan((prev) => (prev?.id === scan.id ? { ...prev, synced: true } : prev))
        setScanHistory((prev) =>
          prev.map((s) => (s.id === scan.id ? { ...s, synced: true } : s)),
        )
      } catch (err) {
        console.warn('[Scanner] Failed to send scan:', err)
      }
    },
    [session],
  )

  // ── Manual barcode entry ──────────────────────────────────────────────────

  const handleManualEntry = useCallback(async () => {
    const code = manualCode.trim()
    if (!code) return

    const result: ScanResult = {
      id: generateUUID(),
      barcode: code,
      barcodeType: 'manual',
      timestamp: Date.now(),
      synced: false,
    }

    setLastScan(result)
    setScanHistory((prev) => [result, ...prev].slice(0, 50))
    setScanCount((c) => c + 1)
    setManualCode('')
    setShowManualEntry(false)

    if (connectionState === 'connected' && session) {
      await sendScanToDesktop(result)
    }

    if (navigator.vibrate) navigator.vibrate(50)
  }, [manualCode, connectionState, session, sendScanToDesktop])

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  const startHeartbeat = useCallback((sessionId?: string) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(async () => {
      const activeSessionId = sessionId ?? session?.id
      if (activeSessionId) {
        await supabase
          .from('auction_device_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', activeSessionId)
      }
    }, 15000)
  }, [session?.id])

  // ── Pairing: connect with manual code ─────────────────────────────────────

  const connectWithCode = useCallback(async () => {
    const code = manualCode.trim()
    if (!code || code.length !== 6) {
      toast.error('Enter a valid 6-digit pairing code')
      return
    }

    setConnectionState('connecting')
    setError(null)

    try {
      const { data: existingSession, error: findError } = await supabase
        .from('auction_device_sessions')
        .select('*')
        .eq('pairing_code', code)
        .eq('status', 'pending')
        .maybeSingle()

      if (findError) throw findError

      if (!existingSession) {
        setConnectionState('error')
        setError('Invalid or expired pairing code.')
        toast.error('Invalid or expired pairing code.')
        setManualCode('')
        return
      }

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

      setSession(data as DeviceSession)
      setConnectionState('connected')
      setShowPairingModal(false)
      toast.success('Connected to auction!')
      if (data?.id) {
        startHeartbeat(data.id)
      }
    } catch (err: any) {
      console.error('[Scanner] Connect failed:', err)
      setError(err?.message || 'Failed to connect')
      setConnectionState('error')
    }

    setManualCode('')
  }, [manualCode, startHeartbeat])

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    if (session?.id) {
      // Delete the session from DB so desktop device list removes this scanner
      await supabase
        .from('auction_device_sessions')
        .delete()
        .eq('id', session.id)
    }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (scanChannelRef.current) supabase.removeChannel(scanChannelRef.current)
    setSession(null)
    setConnectionState('disconnected')
    stopCamera()
  }, [session?.id, stopCamera])

  // ── Auto-close modal when connected ──────────────────────────────────────

  useEffect(() => {
    if (connectionState === 'connected' && showPairingModal) {
      const timer = setTimeout(() => {
        setShowPairingModal(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [connectionState, showPairingModal])

  // ── Cross-device realtime sync ────────────────────────────────────────────
  // When the same account is used on two devices, this listens for session
  // updates so both devices reflect the connection state instantly.

  useEffect(() => {
    if (!user?.id) return

    // Listen for any session updates for this auctioneer
    const channel = supabase
      .channel(`scanner_sync_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_device_sessions',
          filter: `auctioneer_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as DeviceSession

          // If another device connected this session, update local state
          if (updated.status === 'connected' && session?.id === updated.id) {
            setSession(updated)
            if (connectionState !== 'connected') {
              setConnectionState('connected')
              toast.success(`Scanner connected: ${updated.device_name || 'Device'}`)
              startHeartbeat()
            }
          }

          // If the session was disconnected/expired from another device
          if ((updated.status === 'disconnected' || updated.status === 'expired') && session?.id === updated.id) {
            setSession(null)
            setConnectionState('disconnected')
            stopCamera()
            toast.warning('Scanner disconnected from other device')
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, session?.id, connectionState, startHeartbeat, stopCamera])

  // ── Render ─────────────────────────────────────────────────────────────────

  const isAuctioneer =
    (profile?.role as string) === 'auctioneer' ||
    profile?.role === 'admin'

  if (!isAuctioneer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07101f] p-6 text-white">
        <div className="text-center">
          <Smartphone className="mx-auto h-16 w-16 text-slate-600" />
          <h1 className="mt-4 text-xl font-black">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-400">Only authorized auctioneers can use the mobile scanner.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#07101f] text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-cyan-300/10 bg-[#0b1628]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10">
            <Scan className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-sm font-black">Auction Scanner</h1>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  connectionState === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionState === 'connecting' || connectionState === 'pairing'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500',
                )}
              />
              <span className="text-[10px] font-bold text-slate-400">
                {connectionState === 'connected'
                  ? 'Connected'
                  : connectionState === 'connecting'
                    ? 'Connecting...'
                    : connectionState === 'pairing'
                      ? 'Pairing...'
                      : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connectionState === 'connected' && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              <Wifi className="h-3 w-3" /> Live
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          >
            <Clipboard className="h-4 w-4" />
            {scanCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-cyan-500 text-[8px] font-black text-white">
                {scanCount > 99 ? '99+' : scanCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Camera Preview ────────────────────────────────────────────────── */}
      <div className="relative flex-1">
        {/* Scanner is only available after pairing connection */}
        {connectionState !== 'connected' ? (
          /* ── Not connected: show pairing prompt ── */
          <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
            <div className="grid h-24 w-24 place-items-center rounded-3xl border border-cyan-300/20 bg-cyan-400/10">
              {isMobileDevice ? (
                <Smartphone className="h-12 w-12 text-cyan-300/60" />
              ) : (
                <Monitor className="h-12 w-12 text-cyan-300/60" />
              )}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-black">
                {isMobileDevice ? 'Mobile Scanner' : 'Web Scanner'}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {isMobileDevice
                  ? 'Connect to your auction to start scanning barcodes'
                  : 'Connect to start using your camera as a barcode scanner'}
              </p>
            </div>

            {/* Connection status indicator */}
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <span className={cn(
                'h-2 w-2 rounded-full',
                connectionState === 'connecting' || connectionState === 'pairing'
                  ? 'bg-amber-400 animate-pulse'
                  : connectionState === 'error'
                    ? 'bg-red-400'
                    : 'bg-slate-500',
              )} />
              <span className="text-xs font-bold text-slate-400">
                {connectionState === 'connecting'
                  ? 'Connecting...'
                  : connectionState === 'pairing'
                    ? 'Pairing...'
                    : connectionState === 'error'
                      ? 'Connection error'
                      : 'Not connected'}
              </span>
            </div>

            <button
              onClick={() => setShowPairingModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200"
            >
              {isMobileDevice ? (
                <><Smartphone className="h-5 w-5" /> Connect Scanner</>
              ) : (
                <><Scan className="h-5 w-5" /> Connect & Start Scanner</>
              )}
            </button>

            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            {/* Info for cross-device usage */}
            <div className="mt-2 max-w-xs rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] text-slate-500">
                {isMobileDevice
                  ? 'Generate a code on your desktop auction device, then enter it here to connect.'
                  : 'Generate a code here, then enter it on your mobile device at /auctioneer/scanner'}
              </p>
            </div>
          </div>
        ) : cameraActive ? (
          /* ── Connected + camera active: show scanner ── */
          <div className="relative h-full w-full overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.3)_55%,rgba(0,0,0,0.72)_100%)]" />

              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6">
                <div className="w-full max-w-[440px]">
                  {/* Wide horizontal barcode capture target */}
                  <div className="relative mx-auto w-full max-w-[420px] rounded-[1.4rem] border border-white/15 bg-black/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
                    <div className="relative mx-auto h-[150px] w-[88%] translate-y-[18px] rounded-xl border-[2px] border-cyan-400/90 shadow-[0_0_28px_rgba(34,211,238,0.3)]">
                      {/* Corner brackets */}
                      <span className="absolute left-2 top-2 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-cyan-400" />
                      <span className="absolute right-2 top-2 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-cyan-400" />
                      <span className="absolute bottom-2 left-2 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-cyan-400" />
                      <span className="absolute bottom-2 right-2 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-cyan-400" />
                      {/* Thin scan line moving vertically inside the rectangle */}
                      <span className="barcode-scanner-line absolute left-2 right-2 top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                    </div>
                    <p className="mx-auto pb-3 pt-[34px] text-center text-[11px] font-black uppercase tracking-[0.3em] text-cyan-100/90">
                      Align barcode inside frame
                    </p>
                  </div>
                  <p className="mt-4 text-center text-[11px] font-black uppercase tracking-[0.35em] text-cyan-100/90">
                    Scanning…
                  </p>
                </div>
              </div>

            <div className="absolute left-4 top-4 z-30 rounded-full border border-cyan-400/30 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200 backdrop-blur-xl">
              {cameraReady ? 'Live Camera' : 'Starting Camera'}
            </div>

            {/* Camera controls overlay */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
              {!isMobileDevice && (
                <button
                  onClick={toggleCamera}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white/70 backdrop-blur-sm"
                  title="Toggle camera"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              )}
              {isMobileDevice && (
                <button
                  onClick={() => setFlashOn(!flashOn)}
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-full border backdrop-blur-sm transition',
                    flashOn
                      ? 'border-amber-400/40 bg-amber-400/20 text-amber-200'
                      : 'border-white/20 bg-black/40 text-white/70',
                  )}
                >
                  {flashOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
                </button>
              )}
              <button
                onClick={stopCamera}
                className="grid h-14 w-14 place-items-center rounded-full border-2 border-red-400/60 bg-red-500/20 text-red-200 backdrop-blur-sm"
              >
                <CameraOff className="h-6 w-6" />
              </button>
              {isMobileDevice && (
                <button
                  onClick={toggleCamera}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white/70 backdrop-blur-sm"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              )}
              {!isMobileDevice && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="relative grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/40 text-white/70 backdrop-blur-sm"
                >
                  <Clipboard className="h-5 w-5" />
                  {scanCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-cyan-500 text-[8px] font-black text-white">
                      {scanCount > 99 ? '99+' : scanCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Connected but camera off: show start button ── */
          <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
            <div className="grid h-24 w-24 place-items-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10">
              <Camera className="h-12 w-12 text-emerald-300/60" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-black">Scanner Ready</h2>
              <p className="mt-1 text-sm text-slate-400">
                {isMobileDevice
                  ? 'Camera scanner — point at a barcode or QR code'
                  : 'Click below to start your camera and scan barcodes'}
              </p>
              {session?.device_name && (
                <p className="mt-2 text-xs text-emerald-400">
                  Connected: {session.device_name}
                </p>
              )}
            </div>
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200/40 bg-emerald-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(52,211,153,0.28)] transition hover:bg-emerald-200"
            >
              <Camera className="h-5 w-5" />
              Start Camera
            </button>
            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Last scan toast */}
        {lastScan && (
          <div
            className={cn(
              'absolute left-4 right-4 top-4 z-20 rounded-2xl border px-4 py-3 backdrop-blur-xl transition-all',
              lastScan.synced
                ? 'border-emerald-400/30 bg-emerald-950/90'
                : 'border-amber-400/30 bg-amber-950/90',
            )}
          >
            <div className="flex items-center gap-3">
              {lastScan.synced ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white">
                  {lastScan.barcodeType === 'qr_code' ? 'QR Code' : lastScan.barcodeType.toUpperCase()}
                </p>
                <p className="truncate text-[11px] font-mono text-slate-300">{lastScan.barcode}</p>
              </div>
              <span className="text-[9px] font-bold text-slate-500">
                {lastScan.synced ? 'Synced' : 'Pending'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Controls ───────────────────────────────────────────────── */}
      <div className="border-t border-cyan-300/10 bg-[#0b1628]/90 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Connection button */}
          {connectionState === 'connected' ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-200"
            >
              <Unlink className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowPairingModal(true)}
              disabled={connectionState === 'pairing' || connectionState === 'connecting'}
              className="flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"
            >
              {connectionState === 'pairing' || connectionState === 'connecting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {connectionState === 'pairing' ? 'Pairing...' : connectionState === 'connecting' ? 'Connecting...' : 'Connect Scanner'}
            </button>
          )}

          {/* Manual entry */}
          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-200"
          >
            <Settings className="h-4 w-4" />
            Manual
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Scan count */}
          <span className="text-[10px] font-bold text-slate-500">
            {scanCount} scan{scanCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Pairing Modal ─────────────────────────────────────────────────── */}
      {showPairingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Connect Scanner</h2>
              <button
                onClick={async () => {
                  setShowPairingModal(false)
                  // Delete the session from DB so desktop device list removes this scanner
                  if (session?.id) {
                    try {
                      await supabase
                        .from('auction_device_sessions')
                        .delete()
                        .eq('id', session.id)
                    } catch (err) {
                      console.warn('[Scanner] Failed to delete session:', err)
                    }
                  }
                  setConnectionState('disconnected')
                  setSession(null)
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!session || connectionState !== 'connected' ? (
              <div className="mt-4 space-y-4">
                {isMobileDevice ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Enter Desktop Code</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Enter the 6-digit code shown on your desktop Auction Studio.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        className="flex-1 rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-3 text-center text-lg font-black tracking-[0.2em] text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50"
                        maxLength={6}
                      />
                      <button
                        onClick={connectWithCode}
                        disabled={manualCode.length !== 6}
                        className="rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pairing Code</p>
                    <p className="mt-1 text-[10px] text-slate-500">A 6-digit code will appear on your desktop scanner.</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        className="flex-1 rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-3 text-center text-lg font-black tracking-[0.2em] text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50"
                        maxLength={6}
                      />
                      <button
                        onClick={connectWithCode}
                        disabled={manualCode.length !== 6}
                        className="rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Active auction selector */}
                {activeAuctions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Auction</p>
                    <select
                      value={auctionId || ''}
                      onChange={(e) => setAuctionId(e.target.value || null)}
                      className="mt-2 w-full rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-300/50"
                    >
                      <option value="">Select auction...</option>
                      {activeAuctions.map((a) => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                )}

            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            {!barcodeSupported && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                Native camera barcode detection isn’t available in this browser — using the
                built-in decoder fallback (slightly slower). Manual entry and USB/Bluetooth HID
                scanners also work.
              </div>
            )}
              </div>
            ) : (
              <div className="mt-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="mt-2 text-sm font-black text-emerald-200">Connected!</p>
                <p className="mt-1 text-xs text-slate-400">Scanner is synced with your auction.</p>
                <p className="mt-2 text-[10px] text-emerald-400">Closing automatically...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Entry Modal ────────────────────────────────────────────── */}
      {showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/20 bg-[#0b1628] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Manual Entry</h2>
              <button
                onClick={() => setShowManualEntry(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Enter barcode or lot number manually</p>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode or lot number..."
              className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-[#07101f] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-300/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleManualEntry()}
            />
            <button
              onClick={handleManualEntry}
              disabled={!manualCode.trim()}
              className="mt-3 w-full rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {/* ── Scan History Sheet ────────────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setShowHistory(false)}>
          <div
            className="max-h-[70vh] rounded-t-3xl border-t border-cyan-300/10 bg-[#0b1628] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Scan History ({scanHistory.length})</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-slate-400"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
              {scanHistory.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">No scans yet</p>
              ) : (
                scanHistory.map((scan: { id: React.Key; synced: any; barcode: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal; barcodeType: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal; timestamp: string | number | Date }) => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    {scan.synced ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-mono text-white">{scan.barcode}</p>
                      <p className="text-[9px] text-slate-500">
                        {scan.barcodeType} • {new Date(scan.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
