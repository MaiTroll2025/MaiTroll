import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { MaiCamConnectionManager } from '@/lib/maicam/MaiCamConnectionManager';
import PhoneMaiCamCamera from './MaiCamCamera';

export default function PhoneMaiCamEntry() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const managerRef = useRef<MaiCamConnectionManager | null>(null);
  const [stage, setStage] = useState<'intro' | 'pairing' | 'connected' | 'camera'>('intro');
  const [code, setCode] = useState('');
  const [_generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [_codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) {
      navigate('/auth', { replace: true });
      return;
    }

    const mgr = new MaiCamConnectionManager({
      userId: user.id,
      role: 'phone',
      deviceName: `${profile?.display_name || profile?.username || 'User'}'s iPhone`,
      onStateChange: (s) => {
        if (s === 'connected') setStage('connected');
        else if (s === 'disconnected' || s === 'connection-failed') setStage('intro');
      },
      onLocalStream: (stream) => {
        if (stream) setStage('camera');
      },
      onError: (err) => setError(err),
    });
    managerRef.current = mgr;

    return () => {
      mgr.destroy();
      managerRef.current = null;
    };
  }, [user?.id, profile?.display_name, profile?.username, navigate]);

  const _handleGenerate = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await managerRef.current?.generateCode();
      if (result?.success && result.code) {
        setGeneratedCode(result.code);
        setCodeExpiresAt(result.expires_at || null);
        setStage('pairing');
        // Remember preference
        try { localStorage.setItem('maicam_entry_preference', 'maicam'); } catch {}
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
    if (!user?.id || !code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await managerRef.current?.consumeCode(code.trim());
      if (result?.success) {
        setStage('connected');
        try { localStorage.setItem('maicam_entry_preference', 'maicam'); } catch {}
      } else {
        setError(result?.error || 'Invalid or expired code');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }, [code, user?.id]);

  const handleDisconnect = useCallback(() => {
    managerRef.current?.disconnect();
    setGeneratedCode(null);
    setStage('intro');
  }, []);

  if (!user?.id) return null;

  return (
    <div className="min-h-[100dvh] bg-[#09070E] text-white">
      <div className="px-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="flex items-center gap-1 text-[#00BFFF] text-sm font-bold">
            <ArrowLeft size={16}/> Back
          </button>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <div className="h-2 w-2 rounded-full bg-[#39FF14] animate-pulse"/> Connected to MaiTroll
          </div>
        </div>

        {stage === 'intro' && (
          <section className="mb-4 rounded-2xl border border-[#BF00FF]/55 bg-[#100818]/90 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#39FF14]/40 bg-[#39FF14]/10 mb-3 text-[#39FF14]"><Camera size={24}/></div>
            <h2 className="text-xl font-black text-white mb-1">MaiCam Connect</h2>
            <p className="text-sm text-slate-300 mb-4">
              Turn your phone into a wireless camera and microphone for MaiTroll on your computer.
            </p>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-300 mb-1">Enter your PC&apos;s pairing code</label>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
                placeholder="ABC123"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-2xl font-black text-white outline-none focus:border-[#39FF14] uppercase"
              />
              <button onClick={handleConsume} disabled={loading || code.length !== 6} className="w-full rounded-xl border border-[#39FF14]/70 bg-[#39FF14]/10 py-3 text-[#39FF14] font-black text-center active:scale-95 transition disabled:opacity-40">
                {loading ? 'Pairing...' : 'Connect to Computer'}
              </button>
            </div>
            <p className="mt-2 text-[9px] text-slate-500 text-center">
              Your PC must generate a code first (More → MaiCam Connect → Generate Pairing Code).
            </p>
          </section>
        )}

        {stage === 'connected' && (
          <section className="mb-4 rounded-2xl border border-[#39FF14]/55 bg-[#0B1709]/90 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#39FF14] animate-pulse"/> Connected to computer
              </div>
              <button onClick={handleDisconnect} className="text-[10px] text-[#BF00FF] font-bold">Disconnect</button>
            </div>
            <p className="text-sm text-slate-300 mb-3">Grant camera &amp; microphone access to start transmitting.</p>
            <button onClick={() => setStage('camera')} className="w-full rounded-xl border border-[#39FF14]/70 bg-[#39FF14]/10 py-4 text-[#39FF14] font-black text-center active:scale-95 transition">
              <Camera size={20}/> Start Camera
            </button>
          </section>
        )}

        {stage === 'camera' && (
          <PhoneMaiCamCamera manager={managerRef.current!} onDisconnect={handleDisconnect} />
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-sm font-bold">{error}</div>
        )}

        <p className="mt-4 text-[9px] text-slate-500 text-center">
          Locking your phone or backgrounding the browser may interrupt transmission (especially on iOS).
        </p>
      </div>
    </div>
  );
}
