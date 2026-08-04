import React, { useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import { supabase } from '../../lib/supabase';
import { Stream } from '../../types/broadcast';
import {
  Play,
  Calendar,
  Eye,
  Loader2,
  Bookmark,
  Trash2,
  Shield,
  Video,
  X,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { MaiTrollTheme } from '../../styles/trollCityTheme';
import { useAuthStore } from '../../lib/store';

interface SavedBroadcastsProps {
  userId: string;
}

type SavedStream = Stream & {
  saved_at: string;
  saved_source?: string;
  source?: string;
  hls_url?: string | null;
  recording_url?: string | null;
};

function getPlayableUrl(stream: any): string | null {
  if (!stream) return null;

  if (stream.hls_url) return stream.hls_url;

  if (stream.recording_url) return stream.recording_url;

  return null;
}

function WebVideoPlayer({ stream }: { stream: SavedStream }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const src = getPlayableUrl(stream);
    if (!src) {
      setPlayerError('No playable recording URL found.');
      return;
    }

    let hls: Hls | null = null;
    setPlayerError(null);

    video.pause();
    video.removeAttribute('src');
    video.load();

    if (src.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      } else if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          console.error('[SavedBroadcasts] HLS player error:', data);
          if (data.fatal) {
            setPlayerError('This recording could not be loaded.');
          }
        });

        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        setPlayerError('HLS video is not supported in this browser.');
      }
    } else {
      video.src = src;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-black">
      {playerError ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center p-6">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-300 font-semibold">Unable to play recording</p>
            <p className="text-gray-500 text-sm mt-1">{playerError}</p>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black"
          poster={stream.thumbnail_url || undefined}
        />
      )}
    </div>
  );
}

export default function SavedBroadcasts({ userId }: SavedBroadcastsProps) {
  const { profile: currentUser } = useAuthStore();

  const [savedItems, setSavedItems] = useState<SavedStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<SavedStream | null>(null);
  const [evidenceModal, setEvidenceModal] = useState<{
    show: boolean;
    stream: SavedStream | null;
  }>({ show: false, stream: null });

  const [caseTitle, setCaseTitle] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [savingEvidence, setSavingEvidence] = useState(false);

  const isStaff =
    !!currentUser &&
    ([
      'admin',
      'secretary',
      'lead_troll_officer',
      'troll_officer',
      'prosecutor',
      'attorney',
      'chief_news_caster',
    ].includes(currentUser.role) ||
      currentUser.is_admin === true ||
      currentUser.is_lead_troll_officer === true ||
      currentUser.is_troll_officer === true);

  const fetchSavedStreams = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('saved_streams')
        .select(`
          saved_at,
          source,
          stream_id,
          streams (
            id,
            title,
            category,
            started_at,
            ended_at,
            current_viewers,
            thumbnail_url,
            recording_url,
            hls_url,
            status,
            broadcaster_id
          )
        `)
        .eq('user_id', userId)
        .order('saved_at', { ascending: false })
        .limit(24);

      if (error) throw error;

      const transformed = (data || [])
        .map((item: any) => {
          if (!item.streams) return null;

          return {
            ...item.streams,
            saved_at: item.saved_at,
            saved_source: item.source,
          };
        })
        .filter(Boolean);

      setSavedItems(transformed as SavedStream[]);
    } catch (err) {
      console.error('[SavedBroadcasts] Error fetching saved streams:', err);
      toast.error('Failed to load saved streams');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchSavedStreams();
  }, [userId, fetchSavedStreams]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Unknown';

    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (started: string | null | undefined, ended: string | null | undefined) => {
    if (!started || !ended) return '0m';

    const start = new Date(started).getTime();
    const end = new Date(ended).getTime();
    const diffMs = end - start;

    if (diffMs <= 0) return '0m';

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }

    return `${minutes}m`;
  };

  const handleRemoveSaved = async (streamId: string) => {
    try {
      const { error } = await supabase
        .from('saved_streams')
        .delete()
        .eq('user_id', userId)
        .eq('stream_id', streamId);

      if (error) throw error;

      setSavedItems((prev) => prev.filter((item) => item.id !== streamId));
      toast.success('Removed from saved streams');
    } catch (err) {
      console.error('[SavedBroadcasts] Error removing saved stream:', err);
      toast.error('Failed to remove');
    }
  };

  const handleSaveAsEvidence = async () => {
    if (!evidenceModal.stream || !currentUser) return;

    const stream = evidenceModal.stream;
    const playableUrl = getPlayableUrl(stream);

    setSavingEvidence(true);

    try {
      await supabase
        .from('saved_streams')
        .upsert(
          {
            user_id: currentUser.id,
            stream_id: stream.id,
            source: 'troll_court_evidence',
          },
          {
            onConflict: 'saved_streams_user_id_stream_id_key',
          }
        );

      const { error: evidenceError } = await supabase.from('troll_court_evidence').insert({
        stream_id: stream.id,
        saved_by: currentUser.id,
        case_title: caseTitle || `Evidence: ${stream.title}`,
        case_description:
          caseDescription || `Recording saved as evidence from broadcast: ${stream.title}`,
        evidence_type: 'broadcast',
        video_url: playableUrl,
        metadata: {
          title: stream.title,
          category: stream.category,
          started_at: stream.started_at,
          ended_at: stream.ended_at,
          viewer_count: stream.current_viewers,
          recording_url: stream.recording_url,
          hls_url: stream.hls_url,
          saved_at: new Date().toISOString(),
        },
      });

      if (evidenceError) throw evidenceError;

      toast.success('Saved to Troll Court Evidence');
      setEvidenceModal({ show: false, stream: null });
      setCaseTitle('');
      setCaseDescription('');
      fetchSavedStreams();
    } catch (err: any) {
      console.error('[SavedBroadcasts] Error saving evidence:', err);
      toast.error(err.message || 'Failed to save evidence');
    } finally {
      setSavingEvidence(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading saved streams...</span>
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <div
        className={`text-center py-12 ${MaiTrollTheme.backgrounds.card} rounded-xl border border-white/10`}
      >
        <div className="text-4xl mb-3">🔖</div>
        <h3 className="text-lg font-bold text-white mb-2">No Saved Streams</h3>
        <p className="text-gray-400">Save broadcasts to revisit them later!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {savedItems.map((item) => {
          const playableUrl = getPlayableUrl(item);
          const hasRecording = !!playableUrl;

          return (
            <div
              key={`${item.id}-${item.saved_at}`}
              className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group cursor-pointer relative`}
              onClick={() => {
                if (hasRecording) {
                  setSelectedStream(item);
                } else {
                  toast.error('No playable recording available yet');
                }
              }}
            >
              <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-blue-900 overflow-hidden">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title || 'Saved broadcast'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40">
                    <Play size={48} />
                  </div>
                )}

                <div
                  className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                    hasRecording ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                  }`}
                >
                  {hasRecording ? (
                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
                      <Play className="w-7 h-7 text-white ml-1" />
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <Eye className="w-12 h-12 text-white/50 mx-auto mb-2" />
                      <p className="text-white text-sm">No recording available</p>
                    </div>
                  )}
                </div>

                <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded font-bold flex items-center gap-1">
                  <Bookmark className="w-3 h-3 fill-current" />
                  Saved
                </div>

                {item.status === 'ended' && item.ended_at && (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    {formatDuration(item.started_at, item.ended_at)}
                  </div>
                )}
              </div>

              <div className="p-3">
                <h3 className="font-bold text-white text-sm line-clamp-2 mb-2" title={item.title}>
                  {item.title || 'Untitled Broadcast'}
                </h3>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    Saved {new Date(item.saved_at).toLocaleDateString()}
                  </span>

                  {item.saved_source === 'troll_court_evidence' && (
                    <span className="text-xs px-2 py-0.5 bg-amber-600/80 text-amber-100 rounded flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Evidence
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSaved(item.id);
                    }}
                    className="flex-1 px-2 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs rounded transition-colors flex items-center justify-center gap-1"
                    title="Remove from saved"
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>

                  {isStaff && hasRecording && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEvidenceModal({ show: true, stream: item });
                      }}
                      className="flex-1 px-2 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-xs rounded transition-colors flex items-center justify-center gap-1"
                      title="Save to Troll Court as evidence"
                    >
                      <Shield className="w-3 h-3" />
                      Evidence
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedStream && getPlayableUrl(selectedStream) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setSelectedStream(null)}
        >
          <div
            className="relative w-full max-w-5xl bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedStream(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
              aria-label="Close player"
            >
              <X size={24} />
            </button>

            <div className="aspect-video bg-black">
              <WebVideoPlayer stream={selectedStream} />
            </div>

            <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800">
              <h2 className="text-lg font-bold text-white mb-1">
                {selectedStream.title || 'Untitled Broadcast'}
              </h2>

              <div className="flex items-center gap-4 text-sm text-gray-300 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(selectedStream.ended_at)}
                </span>

                {selectedStream.category && (
                  <span className="px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded text-xs">
                    {selectedStream.category}
                  </span>
                )}

                {isStaff && (
                  <button
                    onClick={() => setEvidenceModal({ show: true, stream: selectedStream })}
                    className="px-2 py-0.5 bg-amber-600/30 text-amber-300 rounded text-xs hover:bg-amber-600/50 transition-colors flex items-center gap-1"
                  >
                    <Shield size={12} />
                    Save to Troll Court
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {evidenceModal.show && evidenceModal.stream && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setEvidenceModal({ show: false, stream: null })}
        >
          <div
            className="relative w-full max-w-5xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-amber-900 to-red-900 border-b border-amber-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-8 h-8 text-amber-400" />
                  <div>
                    <h2 className="text-lg font-bold text-white">Troll Court Evidence</h2>
                    <p className="text-sm text-amber-200/70">
                      Submit broadcast as legal evidence
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEvidenceModal({ show: false, stream: null })}
                  className="p-2 hover:bg-black/30 rounded-full text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <div className="aspect-video bg-black">
                {getPlayableUrl(evidenceModal.stream) ? (
                  <WebVideoPlayer stream={evidenceModal.stream} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No recording available</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[600px]">
                <div>
                  <h3 className="font-bold text-white mb-2">Broadcast Details</h3>

                  <div className="space-y-2 text-sm text-gray-300">
                    <p>
                      <span className="text-gray-500">Title:</span>{' '}
                      {evidenceModal.stream.title}
                    </p>
                    <p>
                      <span className="text-gray-500">Category:</span>{' '}
                      {evidenceModal.stream.category}
                    </p>
                    <p>
                      <span className="text-gray-500">Started:</span>{' '}
                      {formatDate(evidenceModal.stream.started_at)}
                    </p>
                    <p>
                      <span className="text-gray-500">Ended:</span>{' '}
                      {formatDate(evidenceModal.stream.ended_at)}
                    </p>

                    {evidenceModal.stream.current_viewers !== undefined && (
                      <p>
                        <span className="text-gray-500">Viewers:</span>{' '}
                        {evidenceModal.stream.current_viewers.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-white mb-2">Evidence Details</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Case Title
                      </label>
                      <input
                        type="text"
                        value={caseTitle}
                        onChange={(e) => setCaseTitle(e.target.value)}
                        placeholder="e.g., inappropriate behavior - March 15"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Case Description
                      </label>
                      <textarea
                        value={caseDescription}
                        onChange={(e) => setCaseDescription(e.target.value)}
                        placeholder="Describe the violation or evidence details..."
                        rows={4}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSaveAsEvidence}
                    disabled={savingEvidence || !getPlayableUrl(evidenceModal.stream)}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    {savingEvidence ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save to Evidence
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setEvidenceModal({ show: false, stream: null })}
                    className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {evidenceModal.stream.saved_source === 'troll_court_evidence' && (
                  <div className="p-3 bg-amber-600/20 border border-amber-600/30 rounded-lg">
                    <p className="text-amber-300 text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      This broadcast is already saved as evidence.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}