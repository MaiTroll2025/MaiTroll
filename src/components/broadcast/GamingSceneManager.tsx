import React, { useState, useCallback, useRef } from 'react';
import { ImageIcon, Layout, Plus, Trash2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * GamingSceneManager
 *
 * OBS-like scene creation and customization for HytroGaming.
 *
 * Scenes allow streamers to:
 * - Create multiple scenes (Gaming, Paused, Starting Soon, etc.)
 * - Add text overlays, images, and audio to each scene
 * - Switch between scenes during broadcast
 * - A "Pause" scene automatically shows when stream is paused
 *
 * Each scene contains:
 * - Name
 * - Background color/image
 * - Text overlays
 * - Audio track (optional)
 * - Active state
 */

export interface SceneTextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
}

export interface SceneConfig {
  id: string;
  name: string;
  backgroundColor: string;
  backgroundImage: string | null;
  textOverlays: SceneTextOverlay[];
  audioUrl: string | null;
  audioVolume: number;
  audioMuted: boolean;
}

interface GamingSceneManagerProps {
  scenes: SceneConfig[];
  activeSceneId: string | null;
  isSharing: boolean;
  isPaused: boolean;
  onCreateScene: (name: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onSwitchScene: (sceneId: string) => void;
  onUpdateScene: (sceneId: string, updates: Partial<SceneConfig>) => void;
  onAddTextOverlay: (sceneId: string) => void;
  onUpdateTextOverlay: (sceneId: string, overlayId: string, updates: Partial<SceneTextOverlay>) => void;
  onDeleteTextOverlay: (sceneId: string, overlayId: string) => void;
  onSetBackgroundImage: (sceneId: string, imageUrl: string | null) => void;
}

const DEFAULT_SCENES: SceneConfig[] = [
  {
    id: 'scene-gaming',
    name: 'Gaming',
    backgroundColor: '#02040a',
    backgroundImage: null,
    textOverlays: [],
    audioUrl: null,
    audioVolume: 0.5,
    audioMuted: false,
  },
  {
    id: 'scene-paused',
    name: 'Paused',
    backgroundColor: '#0f172a',
    backgroundImage: null,
    textOverlays: [
      {
        id: 'pause-text-1',
        text: 'Stream Paused',
        x: 50,
        y: 40,
        fontSize: 48,
        color: '#22d3ee',
        bold: true,
      },
      {
        id: 'pause-text-2',
        text: 'Be right back!',
        x: 50,
        y: 55,
        fontSize: 24,
        color: '#94a3b8',
        bold: false,
      },
    ],
    audioUrl: null,
    audioVolume: 0.3,
    audioMuted: false,
  },
  {
    id: 'scene-starting',
    name: 'Starting Soon',
    backgroundColor: '#0c0a1d',
    backgroundImage: null,
    textOverlays: [
      {
        id: 'start-text-1',
        text: 'Starting Soon...',
        x: 50,
        y: 45,
        fontSize: 42,
        color: '#a78bfa',
        bold: true,
      },
    ],
    audioUrl: null,
    audioVolume: 0.3,
    audioMuted: false,
  },
];

export { DEFAULT_SCENES };

export default function GamingSceneManager({
  scenes,
  activeSceneId,
  isSharing,
  isPaused: _isPaused,
  onCreateScene,
  onDeleteScene,
  onSwitchScene,
  onUpdateScene,
  onAddTextOverlay,
  onUpdateTextOverlay,
  onDeleteTextOverlay,
  onSetBackgroundImage,
}: GamingSceneManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId);

  const handleCreateScene = useCallback(() => {
    if (!newSceneName.trim()) return;
    onCreateScene(newSceneName.trim());
    setNewSceneName('');
  }, [newSceneName, onCreateScene]);

  const handleFileUpload = useCallback(
    (sceneId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onSetBackgroundImage(sceneId, dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [onSetBackgroundImage],
  );

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-[#07111d]/82 shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between border-b border-cyan-400/15 px-4 py-3"
      >
        <div className="flex items-center gap-2 text-cyan-300">
          <Layout className="h-4 w-4" />
          <h3 className="text-sm font-black uppercase tracking-wide">Scenes</h3>
          {activeScene && (
            <span className="rounded-lg bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
              {activeScene.name}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="p-4">
          {/* Scene List */}
          <div className="space-y-2">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3 transition-all',
                  scene.id === activeSceneId
                    ? 'border-cyan-300/40 bg-cyan-400/10'
                    : 'border-white/10 bg-black/20 hover:border-white/20',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg border border-white/20"
                    style={{ backgroundColor: scene.backgroundColor }}
                  />
                  <div>
                    <p className="text-sm font-bold text-white">{scene.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {scene.textOverlays.length} overlays
                      {scene.audioUrl && ' • Audio'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {scene.id === activeSceneId ? (
                    <span className="rounded-lg bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300">
                      ACTIVE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchScene(scene.id)}
                      disabled={!isSharing}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-40"
                    >
                      Switch
                    </button>
                  )}
                  {scenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteScene(scene.id)}
                      className="rounded-lg p-1 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSceneId(editingSceneId === scene.id ? null : scene.id)
                    }
                    className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                  >
                    <Layout className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Scene Editor */}
          {editingSceneId && (
            <SceneEditor
              scene={scenes.find((s) => s.id === editingSceneId)}
              onUpdate={(updates) => onUpdateScene(editingSceneId, updates)}
              onAddText={() => onAddTextOverlay(editingSceneId)}
              onUpdateText={(overlayId, updates) =>
                onUpdateTextOverlay(editingSceneId, overlayId, updates)
              }
              onDeleteText={(overlayId) => onDeleteTextOverlay(editingSceneId, overlayId)}
              onFileUpload={(e) => handleFileUpload(editingSceneId, e)}
              fileInputRef={fileInputRef}
            />
          )}

          {/* Create New Scene */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateScene()}
              placeholder="New scene name..."
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/40"
            />
            <button
              type="button"
              onClick={handleCreateScene}
              disabled={!newSceneName.trim()}
              className="flex items-center gap-1 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/15 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Quick Scene Switch (when sharing) */}
          {isSharing && (
            <div className="mt-3 flex flex-wrap gap-2">
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => onSwitchScene(scene.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[11px] font-bold transition',
                    scene.id === activeSceneId
                      ? 'border border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
                      : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white',
                  )}
                >
                  {scene.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scene Editor Sub-component ──────────────────────────────────────────────

interface SceneEditorProps {
  scene: SceneConfig | undefined;
  onUpdate: (updates: Partial<SceneConfig>) => void;
  onAddText: () => void;
  onUpdateText: (overlayId: string, updates: Partial<SceneTextOverlay>) => void;
  onDeleteText: (overlayId: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function SceneEditor({
  scene,
  onUpdate,
  onAddText,
  onUpdateText,
  onDeleteText,
  onFileUpload,
  fileInputRef,
}: SceneEditorProps) {
  if (!scene) return null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <h4 className="text-xs font-bold text-slate-300">Editing: {scene.name}</h4>

      {/* Background Color */}
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-500">
          Background Color
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={scene.backgroundColor}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
          />
          <span className="text-xs text-slate-400">{scene.backgroundColor}</span>
        </div>
      </div>

      {/* Background Image */}
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-500">
          Background Image
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.08]"
          >
            <ImageIcon className="h-3 w-3" />
            Upload
          </button>
          {scene.backgroundImage && (
            <button
              type="button"
              onClick={() => onUpdate({ backgroundImage: null })}
              className="text-[10px] text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Text Overlays */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Text Overlays
          </label>
          <button
            type="button"
            onClick={onAddText}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-white/[0.08]"
          >
            <Type className="h-3 w-3" />
            Add Text
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {scene.textOverlays.map((overlay) => (
            <div
              key={overlay.id}
              className="rounded-lg border border-white/10 bg-black/30 p-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={overlay.text}
                  onChange={(e) => onUpdateText(overlay.id, { text: e.target.value })}
                  className="flex-1 rounded bg-transparent px-2 py-1 text-xs text-white outline-none"
                  placeholder="Enter text..."
                />
                <input
                  type="color"
                  value={overlay.color}
                  onChange={(e) => onUpdateText(overlay.id, { color: e.target.value })}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => onDeleteText(overlay.id)}
                  className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <label className="text-[9px] text-slate-500">Size</label>
                <input
                  type="range"
                  min="12"
                  max="96"
                  value={overlay.fontSize}
                  onChange={(e) =>
                    onUpdateText(overlay.id, { fontSize: Number(e.target.value) })
                  }
                  className="flex-1"
                />
                <span className="text-[9px] text-slate-500">{overlay.fontSize}px</span>
                <button
                  type="button"
                  onClick={() => onUpdateText(overlay.id, { bold: !overlay.bold })}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-bold',
                    overlay.bold
                      ? 'bg-cyan-400/20 text-cyan-200'
                      : 'bg-white/5 text-slate-500',
                  )}
                >
                  B
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
