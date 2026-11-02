import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Mic,
  Phone,
  RefreshCw,
  Smartphone,
  Trash2,
  Video,
  VideoOff,
  X,
  ShieldCheck,
  Gamepad2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import { MaiCamConnectionManager } from '@/lib/maicam/MaiCamConnectionManager';
import { maicamSessionService } from '@/lib/maicam/MaiCamSessionService';
import { useMaiCamMedia } from '@/lib/maicam/maiCamMediaStore';
export default function MaiCamDesktopPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { setRole, setConnectionState, setRemoteStream, setLocalStream, connectionState, remoteStream } = useMaiCamMedia();

  const managerRef = useRef<MaiCamConnectionManager | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stage, setStage] = useState<'pairing' | 'connected'>('pairing');
  const [enterCode, setEnterCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    if (!user?.id) {
      navigate('/auth', { replace: true });
      return;
    }
    setRole('desktop');

    const mgr = new MaiCamConnectionManager({
      userId: user.id,
      role: 'desktop',
      deviceName: `${profile?.display_name || profile?.username || 'User'}'s Computer`,
      onStateChange: (s) => {
        setConnectionState(s as any);
        if (s === 'connected') setStage('connected');
        else if (s === 'disconnected' || s === 'connection-failed') setStage('pairing');
      },
      onLocalStream: (stream) => {
        setLocalStream(stream);
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (stream) setStage('connected');
      },
      onError: (err) => {
        setError(err);
      },
    });
    managerRef.current = mgr;

    const load = async () => {
      const devList = await mgr.listDevices();
      setDevices((devList || []).filter((d: any) => !d.revoked_at));
    };
    load();

    return () => {
      mgr.destroy();
      managerRef.current = null;
      setConnectionState('disconnected');
      setRemoteStream(null);
      setLocalStream(null);
    };
  }, [user?.id, setRole, setConnectionState, setRemoteStream, setLocalStream, navigate]);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      try { videoRef.current.play().catch(() => {}); } catch {}
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  const handleGenerate = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await managerRef.current?.generateCode();
      if (result?.success && result.code) {
        setGeneratedCode(result.code);
        setExpiresAt(result.expires_at || null);
        setStage('pairing');
        const devList = await managerRef.current?.listDevices();
        setDevices((devList || []).filter((d: any) => !d.revoked_at));
      } else {
        setError(result?.error || 'Failed to generate code');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleConsume = useCallback(async () => {
    if (!user?.id || !enterCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await managerRef.current?.consumeCode(enterCode.trim());
      if (result?.success) {
        setStage('connected');
      } else {
        setError(result?.error || 'Invalid or expired code');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }, [enterCode, user?.id]);

  const handleDisconnect = useCallback(() => {
    managerRef.current?.disconnect();
    setGeneratedCode(null);
    setStage('pairing');
    setRemoteStream(null);
    setLocalStream(null);
  }, [setRemoteStream, setLocalStream]);

  const handleReconnect = useCallback(async () => {
    await managerRef.current?.reconnect();
  }, []);

  const isConnected = connectionState === 'connected';

  const handleRevokeDevice = useCallback(async (id: string) => {
    const ok = await maicamSessionService.deleteDevice(id);
    if (ok) {
      toast.success('Device removed');
      const devList = await managerRef.current?.listDevices();
      setDevices((devList || []).filter((d: any) => !d.revoked_at));
      if (isConnected) {
        managerRef.current?.disconnect();
        setStage('pairing');
        setRemoteStream(null);
        setLocalStream(null);
        setGeneratedCode(null);
      }
    } else {
      toast.error('Failed to remove device');
    }
  }, [isConnected, setRemoteStream, setLocalStream]);

  if (!user?.id) return null;

  const expiresIn = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0;

  return (
    <div className="min-h-screen bg-[#0a080f] text-white">
      <nav className="border-b border-white/5 bg-[#0a080f]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-[#BF00FF] font-black text-sm tracking-tighter">
            <Video size={18}/> MaiCam Connect
          </Link>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isConnected ? 'text-[#39FF14]' : 'text-slate-400'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">Back</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: pairing + devices */}
          <div className="lg:col-span-4 space-y-5">
            <section className="rounded-2xl border border-white/10 bg-[#100818]/60 p-4">
              <h2 className="text-xs font-black text-slate-300 tracking-wider mb-3 uppercase">Pairing</h2>
              <div className="space-y-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading || isConnected}
                  className={`w-full rounded-xl border py-3 text-left font-bold transition active:scale-95
                    ${loading || isConnected ? 'opacity-50' : 'border-[#39FF14]/50 bg-[#39FF14]/10 text-[#39FF14]'}`}
                >
                  {loading ? 'Generating...' : 'Generate Pairing Code'}
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400">Or enter phone code</label>
                  <input
                    value={enterCode}
                    onChange={(e) => setEnterCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    maxLength={6}
                    placeholder="ABC123"
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center text-lg font-black text-white uppercase outline-none focus:border-[#39FF14]"
                  />
                  <button onClick={handleConsume} disabled={loading || enterCode.length !== 6} className="ml-2 rounded-xl border border-[#39FF14]/60 bg-[#39FF14]/10 px-3 py-2 text-[#39FF14] font-bold active:scale-95 disabled:opacity-40">
                    Connect
                  </button>
                </div>
              </div>

              {generatedCode && (
                <div className="rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[#39FF14]">Your pairing code</span>
                    <span className="text-[10px] font-bold text-slate-500">Single-use • 5 min</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="mono text-xl font-black text-[#39FF14] tracking-tighter">{generatedCode}</span>
                    <span className="text-xs text-slate-500">{expiresIn > 0 ? `${expiresIn}s` : 'expired'}</span>
                  </div>
                  <p className="text-[9px] text-slate-500">Show this code on your phone&apos;s MaiCam Connect.</p>
                </div>
              )}

              {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-sm font-bold">{error}</div>}

              <div className="flex items-center justify-between gap-2 mt-3">
                <button onClick={handleReconnect} disabled={!isConnected} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 active:scale-95 disabled:opacity-40">
                  <RefreshCw size={16}/> Reconnect
                </button>
                <button onClick={handleDisconnect} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 active:scale-95">
                  <X size={16}/> Disconnect
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#100818]/60 p-4">
              <h2 className="text-xs font-black text-slate-300 tracking-wider mb-3 uppercase">Devices</h2>
              <div className="space-y-2">
                {devices.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-3">No paired devices</p>
                ) : (
                  devices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/3 p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#39FF14]"/>
                        <div>
                          <div className="text-xs font-bold text-white">{d.device_name}</div>
                          <div className="text-[9px] text-slate-400">{d.device_type} • {d.browser_name || 'browser'}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeDevice(d.id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"
                        title="Remove device"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Center: camera preview */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative w-full max-w-md aspect-video rounded-2xl border border-white/10 bg-black overflow-hidden shadow-[0_0_30px_rgba(0,0,0,.8)]">
              {remoteStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain object-center"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <Smartphone size={48} className="mb-3 text-slate-600"/>
                  <h3 className="font-bold text-white mb-1">No phone connected</h3>
                  <p className="text-sm text-slate-400">Generate a code and pair your phone to see the live camera feed.</p>
                </div>
              )}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2 py-1">
                <span className="h-2 w-2 rounded-full bg-[#39FF14] animate-pulse"/>
                <span className="text-[10px] font-bold text-white">{connectionState}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 text-center">
              {remoteStream ? 'Live phone camera feed' : 'Pair a phone to begin'}
            </p>
          </div>

          {/* Right: settings + info */}
          <div className="lg:col-span-2 space-y-5">
            <section className="rounded-2xl border border-white/10 bg-[#100818]/60 p-4">
              <h2 className="text-xs font-black text-slate-300 tracking-wider mb-3 uppercase">Camera</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Resolution</span>
                  <span className="text-xs text-white">720p HD</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Frame rate</span>
                  <span className="text-xs text-white">30 FPS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Source</span>
                  <span className="text-xs text-white">MaiCam Phone</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Camera</span>
                  <button
                    onClick={() => {
                      const next = cameraFacingMode === 'user' ? 'environment' : 'user';
                      setCameraFacingMode(next);
                      managerRef.current?.requestCameraSwitch(next);
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white active:scale-95"
                  >
                    {cameraFacingMode === 'user' ? 'Front' : 'Rear'}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#100818]/60 p-4">
              <h2 className="text-xs font-black text-slate-300 tracking-wider mb-3 uppercase">Microphone</h2>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between rounded-xl border border-[#39FF14]/50 bg-[#39FF14]/10 px-3 py-2 text-[#39FF14] font-bold text-left active:scale-95">
                  <Mic size={16}/> Phone microphone active
                </button>
                <p className="text-[9px] text-slate-500">Use phone mic or PC mic in broadcasts.</p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#100818]/60 p-4">
              <h2 className="text-xs font-black text-slate-300 tracking-wider mb-3 uppercase">Quality</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Connection</span>
                  <span className={`font-bold ${isConnected ? 'text-[#39FF14]' : 'text-slate-500'}`}>{isConnected ? 'Good' : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Latency</span>
                  <span className="font-bold text-slate-400">— ms</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#100818]/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-slate-300 tracking-wider uppercase">Use MaiCam in</h2>
            <span className="text-[10px] font-bold text-[#39FF14]">Wireless</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: 'Web Broadcast', icon: <Phone size={18} className="text-[#00BFFF]"/> },
              { name: 'HytroGame', icon: <Gamepad2 size={18} className="text-[#00BFFF]"/> },
              { name: 'Podcast', icon: <ShieldCheck size={18} className="text-[#00BFFF]"/> },
            ].map((item) => (
              <div key={item.name} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 mx-auto mb-2">{item.icon}</div>
                <div className="text-xs font-bold text-white">{item.name}</div>
                <div className="text-[9px] text-slate-400">Select MaiCam as camera source</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
