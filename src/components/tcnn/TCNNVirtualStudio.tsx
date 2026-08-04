/**
 * TCNNVirtualStudio
 *
 * Core MediaPipe Selfie Segmentation compositor for TCNN broadcast.
 * Captures webcam, removes background in real-time, composites the
 * broadcaster onto a virtual TCNN newsroom scene.
 *
 * Rendering pipeline:
 * Camera → MediaPipe segmentation → mask → draw user → overlay onto newsroom → canvas → stream output
 */
import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';

export type BackgroundMode = 'newsroom' | 'cityscape' | 'blur' | 'simple';

export interface TCNNVirtualStudioHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getCompositeStream: () => MediaStream | null;
  setBackgroundMode: (mode: BackgroundMode) => void;
  start: () => Promise<void>;
  stop: () => void;
  isRunning: () => boolean;
}

interface TCNNVirtualStudioProps {
  width?: number;
  height?: number;
  backgroundMode?: BackgroundMode;
  onReady?: () => void;
  onError?: (error: string) => void;
  onFpsUpdate?: (fps: number) => void;
  onModeChange?: (mode: 'full' | 'simple') => void;
  showLoadingOverlay?: boolean;
  className?: string;
}

const TCNNVirtualStudio = forwardRef<TCNNVirtualStudioHandle, TCNNVirtualStudioProps>(
  ({ width = 1280, height = 720, backgroundMode = 'newsroom', onReady, onError, onFpsUpdate, onModeChange, showLoadingOverlay = true, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const segmentationRef = useRef<SelfieSegmentation | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number>(0);
    const runningRef = useRef(false);
    const bgModeRef = useRef<BackgroundMode>(backgroundMode);
    const fpsFramesRef = useRef<number[]>([]);
    const lastFpsReportRef = useRef<number>(0);

    // Pre-rendered background canvases
    const newsroomBgRef = useRef<HTMLCanvasElement | null>(null);
    const cityscapeBgRef = useRef<HTMLCanvasElement | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
  const [useSimpleMode, setUseSimpleMode] = useState(false);

  // Keep bgModeRef in sync
  useEffect(() => {
    bgModeRef.current = backgroundMode;
  }, [backgroundMode]);



    // Generate the virtual TCNN newsroom background on an offscreen canvas
    const generateNewsroomBackground = useCallback(() => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Dark studio gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0a0e1a');
      grad.addColorStop(0.3, '#0d1528');
      grad.addColorStop(0.6, '#101b36');
      grad.addColorStop(1, '#080c16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Floor - polished dark desk surface
      const floorY = height * 0.62;
      const floorGrad = ctx.createLinearGradient(0, floorY, 0, height);
      floorGrad.addColorStop(0, '#1a1a2e');
      floorGrad.addColorStop(0.5, '#12121f');
      floorGrad.addColorStop(1, '#0a0a14');
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(width, floorY);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Desk surface highlight
      ctx.strokeStyle = 'rgba(0, 162, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(width, floorY);
      ctx.stroke();

      // Back wall panels - subtle grid
      ctx.strokeStyle = 'rgba(0, 162, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += width / 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, floorY);
        ctx.stroke();
      }
      for (let y = 0; y < floorY; y += floorY / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Large screens on back wall (left and right)
      const drawScreen = (sx: number, sw: number, sh: number) => {
        // Screen bezel
        ctx.fillStyle = '#111827';
        ctx.fillRect(sx - 4, 20, sw + 8, sh + 8);

        // Screen content - blue glow
        const screenGrad = ctx.createLinearGradient(sx, 24, sx, 24 + sh);
        screenGrad.addColorStop(0, '#0c1929');
        screenGrad.addColorStop(0.5, '#0f2040');
        screenGrad.addColorStop(1, '#0a1525');
        ctx.fillStyle = screenGrad;
        ctx.fillRect(sx, 24, sw, sh);

        // Screen border glow
        ctx.shadowColor = 'rgba(0, 162, 255, 0.4)';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(0, 162, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, 24, sw, sh);
        ctx.shadowBlur = 0;

        // Fake content lines on screen
        ctx.fillStyle = 'rgba(0, 162, 255, 0.15)';
        for (let ly = 40; ly < 24 + sh - 10; ly += 18) {
          const lw = sw * (0.4 + Math.random() * 0.5);
          ctx.fillRect(sx + 10, ly, lw, 6);
        }

        // TCNN logo text on screen
        ctx.fillStyle = 'rgba(255, 40, 40, 0.6)';
        ctx.font = `bold ${Math.floor(sw * 0.1)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('TCNN', sx + sw / 2, 24 + sh / 2 + 5);
      };

      drawScreen(width * 0.04, width * 0.22, height * 0.28);
      drawScreen(width * 0.74, width * 0.22, height * 0.28);

      // Center screen (larger)
      const csx = width * 0.32;
      const csw = width * 0.36;
      const csh = height * 0.32;
      ctx.fillStyle = '#111827';
      ctx.fillRect(csx - 4, 10, csw + 8, csh + 8);
      const csGrad = ctx.createLinearGradient(csx, 14, csx, 14 + csh);
      csGrad.addColorStop(0, '#0c1929');
      csGrad.addColorStop(1, '#0a1525');
      ctx.fillStyle = csGrad;
      ctx.fillRect(csx, 14, csw, csh);
      ctx.shadowColor = 'rgba(0, 162, 255, 0.5)';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(0, 162, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(csx, 14, csw, csh);
      ctx.shadowBlur = 0;

      // City skyline silhouette in center screen
      ctx.fillStyle = 'rgba(0, 100, 200, 0.12)';
      const skylineY = 14 + csh * 0.3;
      for (let bx = csx + 10; bx < csx + csw - 10; bx += 15 + Math.random() * 20) {
        const bh = 20 + Math.random() * (csh * 0.5);
        const bw = 8 + Math.random() * 12;
        ctx.fillRect(bx, skylineY + csh * 0.5 - bh, bw, bh);
      }

      // TCNN branding on center screen
      ctx.fillStyle = 'rgba(255, 40, 40, 0.7)';
      ctx.font = `bold ${Math.floor(csw * 0.09)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('TCNN', csx + csw / 2, 14 + csh / 2);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = `${Math.floor(csw * 0.035)}px system-ui, sans-serif`;
      ctx.fillText('MaiTroll NEWS NETWORK', csx + csw / 2, 14 + csh / 2 + 20);

      // Accent lighting strips
      ctx.shadowColor = 'rgba(255, 0, 40, 0.6)';
      ctx.shadowBlur = 25;
      ctx.strokeStyle = 'rgba(255, 0, 40, 0.4)';
      ctx.lineWidth = 2;
      // Top strip
      ctx.beginPath();
      ctx.moveTo(width * 0.1, floorY - 2);
      ctx.lineTo(width * 0.9, floorY - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Ambient blue glow on left
      const leftGlow = ctx.createRadialGradient(0, height * 0.4, 0, 0, height * 0.4, width * 0.4);
      leftGlow.addColorStop(0, 'rgba(0, 100, 255, 0.08)');
      leftGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, width, height);

      // Ambient red glow on right
      const rightGlow = ctx.createRadialGradient(width, height * 0.4, 0, width, height * 0.4, width * 0.4);
      rightGlow.addColorStop(0, 'rgba(255, 0, 40, 0.06)');
      rightGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = rightGlow;
      ctx.fillRect(0, 0, width, height);

      // Desk lamp spots
      ctx.shadowColor = 'rgba(255, 200, 100, 0.3)';
      ctx.shadowBlur = 60;
      ctx.fillStyle = 'rgba(255, 200, 100, 0.04)';
      ctx.beginPath();
      ctx.ellipse(width * 0.35, floorY + 20, 120, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(width * 0.65, floorY + 20, 120, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      return canvas;
    }, [width, height]);

    // Generate the virtual city skyline background
    const generateCityscapeBackground = useCallback(() => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Night sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#020510');
      skyGrad.addColorStop(0.3, '#0a1628');
      skyGrad.addColorStop(0.6, '#0d1f3c');
      skyGrad.addColorStop(1, '#060e1c');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let i = 0; i < 100; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height * 0.5;
        const sr = Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant city glow
      const cityGlow = ctx.createRadialGradient(width * 0.5, height * 0.7, 0, width * 0.5, height * 0.7, width * 0.6);
      cityGlow.addColorStop(0, 'rgba(0, 100, 255, 0.1)');
      cityGlow.addColorStop(0.5, 'rgba(80, 0, 180, 0.05)');
      cityGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = cityGlow;
      ctx.fillRect(0, 0, width, height);

      // City skyline buildings
      const baseY = height * 0.55;
      const buildings: { x: number; w: number; h: number }[] = [];
      let bx = -10;
      while (bx < width + 10) {
        const bw = 15 + Math.random() * 40;
        const bh = 60 + Math.random() * (height * 0.4);
        buildings.push({ x: bx, w: bw, h: bh });
        bx += bw + 2 + Math.random() * 8;
      }

      // Draw buildings back to front
      buildings.sort((a, b) => b.h - a.h);
      buildings.forEach((b, i) => {
        const alpha = 0.3 + (i / buildings.length) * 0.5;
        ctx.fillStyle = `rgba(8, 15, 30, ${alpha})`;
        ctx.fillRect(b.x, baseY - b.h, b.w, b.h + height - baseY);

        // Window lights
        ctx.fillStyle = `rgba(0, 162, 255, ${0.2 + Math.random() * 0.3})`;
        for (let wy = baseY - b.h + 8; wy < baseY - 4; wy += 10) {
          for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 7) {
            if (Math.random() > 0.4) {
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }

        // Neon accent on some buildings
        if (Math.random() > 0.7) {
          ctx.shadowColor = 'rgba(255, 0, 40, 0.5)';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = 'rgba(255, 0, 40, 0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(b.x, baseY - b.h, b.w, b.h);
          ctx.shadowBlur = 0;
        }
      });

      // Ground reflection
      const groundGrad = ctx.createLinearGradient(0, baseY, 0, height);
      groundGrad.addColorStop(0, 'rgba(0, 60, 120, 0.2)');
      groundGrad.addColorStop(1, 'rgba(0, 10, 30, 0.8)');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, baseY, width, height - baseY);

      return canvas;
    }, [width, height]);

    // Apply blur effect to a video frame (blur background mode)
    const applyBlurBackground = useCallback((ctx: CanvasRenderingContext2D, video: HTMLVideoElement, mask: ImageData) => {
      // Draw blurred video as background
      ctx.filter = 'blur(20px)';
      ctx.drawImage(video, 0, 0, width, height);
      ctx.filter = 'none';

      // Create temp canvas for sharp foreground
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(video, 0, 0, width, height);

      // Apply mask: keep foreground pixels only
      const fgData = tempCtx.getImageData(0, 0, width, height);
      const pixels = fgData.data;
      const maskData = mask.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = maskData[i + 3] > 128 ? 255 : 0;
        pixels[i + 3] = alpha;
      }
      ctx.putImageData(fgData, 0, 0);
    }, [width, height]);

    // The main render loop callback for MediaPipe
    const onSegmentationResults = useCallback((results: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const now = performance.now();

      // FPS tracking
      fpsFramesRef.current.push(now);
      fpsFramesRef.current = fpsFramesRef.current.filter(t => now - t < 1000);
      if (now - lastFpsReportRef.current > 1000 && onFpsUpdate) {
        onFpsUpdate(fpsFramesRef.current.length);
        lastFpsReportRef.current = now;
      }

      const mode = bgModeRef.current;

      // Mirror the entire output so the host appears naturally centered (selfie-style)
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);

      // Simple mode is handled in processFrame loop, not here
      if (useSimpleMode) {
        ctx.restore();
        return;
      }

      if (mode === 'blur') {
        // Blur mode - draw blurred video then sharp foreground via mask
        if (videoRef.current && results.segmentationMask) {
          applyBlurBackground(ctx, videoRef.current, results.segmentationMask as any);
        }
        ctx.restore();
        return;
      }

      // Draw background (newsroom or cityscape)
      const bgCanvas = mode === 'cityscape' ? cityscapeBgRef.current : newsroomBgRef.current;
      if (bgCanvas) {
        ctx.drawImage(bgCanvas, 0, 0, width, height);
      }

      // Draw the video with mask applied - foreground only
      if (results.segmentationMask && videoRef.current) {
        // Zoom out 5% and center the person
        const scale = 0.95;
        const scaledW = width * scale;
        const scaledH = height * scale;
        const offsetX = (width - scaledW) / 2;
        const offsetY = (height - scaledH) / 2;

        // Create temp canvas for masked video
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d')!;

        // Draw the segmentation mask scaled and centered
        maskCtx.drawImage(results.segmentationMask as any, offsetX, offsetY, scaledW, scaledH);

        // Smooth edges with slight blur on the mask
        maskCtx.filter = 'blur(4px)';
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.drawImage(maskCanvas, 0, 0);
        maskCtx.filter = 'none';

        // Use the mask as alpha channel for the video (scaled and centered)
        maskCtx.globalCompositeOperation = 'source-in';
        maskCtx.drawImage(results.image as any, offsetX, offsetY, scaledW, scaledH);

        // Composite onto main canvas
        ctx.drawImage(maskCanvas, 0, 0, width, height);
      }

      ctx.restore();
    }, [width, height, applyBlurBackground]);

    // Initialize MediaPipe + webcam
    const start = useCallback(async () => {
      if (runningRef.current) return;

      // Overall timeout for the entire initialization
      const overallTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Virtual studio initialization timeout')), 20000);
      });

      const initPromise = (async () => {
        try {
          console.log('[TCNNVirtualStudio] Starting initialization...');

          // Generate backgrounds
          console.log('[TCNNVirtualStudio] Generating backgrounds...');
          newsroomBgRef.current = generateNewsroomBackground();
          cityscapeBgRef.current = generateCityscapeBackground();

          // Get webcam with timeout
          console.log('[TCNNVirtualStudio] Requesting camera access...');
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera/microphone access is not available in this browser or context. On iOS, open this page directly in Safari.');
          }
          const getMediaPromise = navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: 30, max: 60 },
              facingMode: 'user',
            },
            audio: true,
          });

          const mediaTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Camera access timeout')), 10000);
          });

          const stream = await Promise.race([getMediaPromise, mediaTimeout]);
          console.log('[TCNNVirtualStudio] Camera access granted');
          streamRef.current = stream as MediaStream;

          // Attach to hidden video element
          if (videoRef.current) {
            videoRef.current.srcObject = stream as MediaStream;
            videoRef.current.width = width;
            videoRef.current.height = height;
            await videoRef.current.play();
            console.log('[TCNNVirtualStudio] Video element playing');

            // Draw initial frame when video data is loaded to prevent black canvas
            videoRef.current.addEventListener('loadeddata', () => {
              const canvas = canvasRef.current;
              if (canvas && videoRef.current) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.save();
                  ctx.translate(width, 0);
                  ctx.scale(-1, 1);
                  ctx.drawImage(videoRef.current, 0, 0, width, height);
                  ctx.restore();
                }
              }
            }, { once: true });
          }

          // Try to initialize MediaPipe Selfie Segmentation
          console.log('[TCNNVirtualStudio] Initializing MediaPipe...');
          try {
            const selfieSegmentation = new SelfieSegmentation({
              locateFile: (file: string) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
              },
            });

            selfieSegmentation.setOptions({
              selfieMode: true,
              modelSelection: 1, // 1 = landscape (general) model - better quality
            });

            selfieSegmentation.onResults(onSegmentationResults);

            const initPromise = selfieSegmentation.initialize();
            const initTimeout = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('MediaPipe initialization timeout')), 10000);
            });

            await Promise.race([initPromise, initTimeout]);
            console.log('[TCNNVirtualStudio] MediaPipe initialized');
            segmentationRef.current = selfieSegmentation;
        } catch (mediaPipeErr) {
          console.warn('[TCNNVirtualStudio] MediaPipe failed, falling back to simple mode:', mediaPipeErr);
          setUseSimpleMode(true);
          console.log('[TCNNVirtualStudio] Setting isInitialized to true for simple mode');
          setIsInitialized(true);
          onModeChange?.('simple');
          onReady?.();
          console.log('[TCNNVirtualStudio] Simple mode ready, callbacks called');

          // Force a re-render by updating a dummy state
          setUseSimpleMode(prev => prev);
        }

        // Ensure we always complete initialization
        if (!segmentationRef.current && !useSimpleMode) {
          console.log('[TCNNVirtualStudio] No segmentation and not in simple mode - forcing simple mode');
          setUseSimpleMode(true);
          setIsInitialized(true);
          onModeChange?.('simple');
          onReady?.();
        }

        runningRef.current = true;
        console.log('[TCNNVirtualStudio] Setting isInitialized to true');
        setIsInitialized(true);
        console.log('[TCNNVirtualStudio] isInitialized set, calling callbacks');
        onModeChange?.('full');
        onReady?.();
        console.log('[TCNNVirtualStudio] onReady callback completed');

        // Force a re-render by updating a dummy state
        setUseSimpleMode(prev => prev);

        // Start processing loop
        const processFrame = async () => {
          if (!runningRef.current || !videoRef.current) return;

          try {
            if (segmentationRef.current && videoRef.current && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              // Full mode with MediaPipe
              await segmentationRef.current.send({ image: videoRef.current });
            } else {
              // Simple mode - render directly with background if needed
              const canvas = canvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const mode = bgModeRef.current;
                  ctx.save();
                  ctx.translate(width, 0);
                  ctx.scale(-1, 1);

                  // Draw background if not simple mode
                  if (mode !== 'simple') {
                    const bgCanvas = mode === 'cityscape' ? cityscapeBgRef.current : newsroomBgRef.current;
                    if (bgCanvas) {
                      ctx.drawImage(bgCanvas, 0, 0, width, height);
                    }
                  }

                  // Draw video if ready
                  if (videoRef.current && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    ctx.drawImage(videoRef.current, 0, 0, width, height);
                  }
                  ctx.restore();
                }
              }
            }
          } catch (frameErr) {
            console.warn('[TCNNVirtualStudio] Frame processing error:', frameErr);
          }

          rafRef.current = requestAnimationFrame(processFrame);
        };

        processFrame();
        } catch (err: any) {
          const msg = err?.message || 'Failed to initialize virtual studio';
          console.error('[TCNNVirtualStudio] Init error:', msg, err);
          onError?.(msg);
          throw err; // Re-throw to be caught by overall timeout
        }
      })();

      try {
        await Promise.race([initPromise, overallTimeout]);
      } catch (err: any) {
        console.error('[TCNNVirtualStudio] Overall timeout or error:', err);
        // Even on timeout/error, try to complete initialization in simple mode
        console.log('[TCNNVirtualStudio] Attempting fallback initialization after error');
        setUseSimpleMode(true);
        setIsInitialized(true);
        onModeChange?.('simple');
        onReady?.();
        onError?.(err.message || 'Virtual studio initialization failed');
      }
    }, [width, height, generateNewsroomBackground, generateCityscapeBackground, onSegmentationResults, onReady, onError, onModeChange]);

    // Stop everything
    const stop = useCallback(() => {
      runningRef.current = false;
      setIsInitialized(false);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      if (segmentationRef.current) {
        segmentationRef.current.close().catch(console.error);
        segmentationRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        stop();
      };
    }, [stop]);

    // Safety mechanism: if component has been mounted for 30 seconds and still not initialized, force simple mode
    useEffect(() => {
      const safetyTimeout = setTimeout(() => {
        if (!isInitialized && !runningRef.current) {
          console.warn('[TCNNVirtualStudio] Safety timeout reached - forcing simple mode initialization');
          setUseSimpleMode(true);
          setIsInitialized(true);
          onModeChange?.('simple');
          onReady?.();
        }
      }, 30000); // 30 seconds

      return () => clearTimeout(safetyTimeout);
    }, [isInitialized, onModeChange, onReady]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      getCompositeStream: () => {
        if (!canvasRef.current) return null;
        // Capture canvas stream + original audio tracks
        const canvasStream = canvasRef.current.captureStream(30);
        if (streamRef.current) {
          const audioTracks = streamRef.current.getAudioTracks();
          audioTracks.forEach(track => canvasStream.addTrack(track));
        }
        return canvasStream;
      },
      setBackgroundMode: (mode: BackgroundMode) => {
        bgModeRef.current = mode;
      },
      start,
      stop,
      isRunning: () => runningRef.current,
    }), [start, stop]);

    return (
      <div className={className} style={{ position: 'relative', width, height }}>
        {/* Hidden video element for webcam input */}
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          playsInline
          muted
          autoPlay
        />

        {/* Output canvas */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: 'inherit',
          }}
        />

        {/* Loading overlay */}
        {showLoadingOverlay && !isInitialized && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            borderRadius: 'inherit',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, margin: '0 auto 12px',
                border: '3px solid rgba(0,162,255,0.3)',
                borderTopColor: '#00a2ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'system-ui' }}>
                Initializing Virtual Studio...
              </p>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
);

TCNNVirtualStudio.displayName = 'TCNNVirtualStudio';
export default TCNNVirtualStudio;
