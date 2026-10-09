import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import TCNNVirtualStudio from '@/components/tcnn/TCNNVirtualStudio';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Radio, Video, Mic, Settings, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TCNNSetupPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStudioReady, setIsStudioReady] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [studioMode, setStudioMode] = useState<'full' | 'simple'>('full');
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const studioRef = useRef<any>(null);
  const _studioInitializedRef = useRef(false);

  // Access check
  useEffect(() => {
    if (!user || !profile) {
      navigate('/auth?mode=signup');
      return;
    }
    if (!isNewsCaster && !isChiefNewsCaster && !(profile.role === 'admin' || profile.is_admin)) {
      toast.error('Access denied: TCNN broadcast requires News Caster role');
      navigate('/tcnn');
    }
  }, [user, profile, isNewsCaster, isChiefNewsCaster, navigate]);

  // Default title
  useEffect(() => {
    if (!title.trim() && profile?.username) {
      setTitle(`${profile.username} - TCNN Live Broadcast`);
    }
  }, [profile?.username, title]);

  // Start the virtual studio when component mounts
  useEffect(() => {
    const startStudio = async () => {
      setIsInitializing(true);
      try {
        await studioRef.current?.start();
      } catch (error) {
        console.error('Failed to start studio:', error);
        setStudioError('Failed to start studio');
        setIsInitializing(false);
      }
    };

    startStudio();
  }, []);

  const handleStudioReady = () => {
    setIsStudioReady(true);
    setStudioError(null);
    setIsInitializing(false);
    toast.success('Virtual studio initialized');
  };

  const handleStudioError = (error: string) => {
    console.error('Studio error:', error);
    setIsStudioReady(false);
    setStudioError(error);
    setIsInitializing(false);
    toast.error('Failed to initialize camera: ' + error);
  };

  const handleModeChange = (mode: 'full' | 'simple') => {
    setStudioMode(mode);
  };

  const retryStudio = async () => {
    setIsInitializing(true);
    setStudioError(null);
    try {
      await studioRef.current?.start();
    } catch (error) {
      console.error('Retry failed:', error);
      setStudioError('Failed to restart studio');
      setIsInitializing(false);
    }
  };

  const handleGoLive = async () => {
    if (!user || !title.trim()) return;
    if (profile?.drivers_license_status === 'suspended') {
      toast.error('Your driver license is currently suspended. You cannot go live.');
      return;
    }
    setIsLoading(true);

    try {
      const streamId = crypto.randomUUID();

      // Create stream record
      const { error: insertError } = await supabase.from('streams').insert({
        id: streamId,
        user_id: user.id,
        broadcaster_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category: 'tcnn',
        status: 'setup',
        is_live: false,
        started_at: null,
        agora_channel: streamId,
        box_count: 1,
        layout_mode: 'grid',
        is_protected: false,
        battle_enabled: false,
      });

      if (insertError) throw insertError;

      // Navigate to broadcaster with streamId
      navigate(`/tcnn/broadcaster/${streamId}`);
    } catch (err: any) {
      console.error('Setup error:', err);
      toast.error(err?.message || 'Failed to create broadcast setup');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMic = () => {
    setMicEnabled(!micEnabled);
    // Note: Actual mic control happens in broadcaster page
  };

  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
    // Note: Actual camera control happens in broadcaster page
  };

  if (!user || (!isNewsCaster && !isChiefNewsCaster && !(profile?.role === 'admin' || profile?.is_admin))) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tcnn')}
            className="text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to TCNN
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">TCNN Broadcast Setup</h1>
              <p className="text-white/60">Configure your live broadcast</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera Preview */}
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Video className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Camera Preview</h2>
            </div>

            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              <TCNNVirtualStudio
                ref={studioRef}
                width={640}
                height={360}
                onReady={handleStudioReady}
                onError={handleStudioError}
                onModeChange={handleModeChange}
                showLoadingOverlay={isInitializing}
                className="w-full h-full"
              />

              {/* Overlay controls */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={micEnabled ? "default" : "destructive"}
                    onClick={toggleMic}
                    className="h-8"
                  >
                    <Mic className="w-3 h-3 mr-1" />
                    {micEnabled ? 'Mic' : 'Muted'}
                  </Button>
                  <Button
                    size="sm"
                    variant={cameraEnabled ? "default" : "destructive"}
                    onClick={toggleCamera}
                    className="h-8"
                  >
                    <Video className="w-3 h-3 mr-1" />
                    {cameraEnabled ? 'Cam' : 'Off'}
                  </Button>
                </div>

                {isStudioReady && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Studio Ready
                    {studioMode === 'simple' && (
                      <span className="text-yellow-400 text-xs">(Simple Mode)</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!isStudioReady && (
              <div className="text-center py-8">
                {isInitializing ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
                    <p className="text-white/60">Initializing virtual studio...</p>
                    <p className="text-white/40 text-sm mt-1">This may take a few seconds</p>
                  </>
                ) : studioError ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-white/60 mb-4">Failed to initialize studio</p>
                    <p className="text-white/40 text-sm mb-4">{studioError}</p>
                    <Button
                      onClick={retryStudio}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white/80 hover:bg-white/10"
                    >
                      Try Again
                    </Button>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-white/60">Studio not ready</p>
                    <Button
                      onClick={retryStudio}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white/80 hover:bg-white/10 mt-2"
                    >
                      Initialize Studio
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* Broadcast Settings */}
          <Card className="bg-slate-800/50 border-white/10 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">Broadcast Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-white/80">Broadcast Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter your broadcast title"
                  className="mt-1 bg-slate-700/50 border-white/20 text-white placeholder:text-white/40"
                  maxLength={100}
                />
                <p className="text-white/40 text-xs mt-1">{title.length}/100 characters</p>
              </div>

              <div>
                <Label htmlFor="description" className="text-white/80">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you'll be broadcasting..."
                  className="mt-1 bg-slate-700/50 border-white/20 text-white placeholder:text-white/40 min-h-[80px]"
                  maxLength={500}
                />
                <p className="text-white/40 text-xs mt-1">{description.length}/500 characters</p>
              </div>

              {/* Broadcast Info */}
              <div className="bg-slate-700/30 rounded-lg p-4 mt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-white/80">
                    <p className="font-medium mb-1">TCNN Broadcasting Guidelines</p>
                    <ul className="text-white/60 space-y-1 text-xs">
                      <li>• Your stream will appear on the TCNN widget</li>
                      <li>• Official TCNN branding will be applied</li>
                      <li>• Follow editorial guidelines and community standards</li>
                      <li>• Broadcast will be recorded for moderation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Go Live Button */}
        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleGoLive}
            disabled={!isStudioReady || !title.trim() || isLoading}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg shadow-red-500/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Setting up broadcast...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2 fill-current" />
                Go Live on TCNN
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}