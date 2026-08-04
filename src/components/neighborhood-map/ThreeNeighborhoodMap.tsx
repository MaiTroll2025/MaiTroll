import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Html,
  MapControls,
  PerspectiveCamera,
  Preload,
} from '@react-three/drei';
import CityScene from './CityScene';

export interface HouseMarker {
  id: string;
  x: number;
  y: number;
  owner?: string;
  isLive?: boolean;
  badges?: string[];
  status?: 'owned' | 'raided' | 'locked' | 'admin';
}

export interface NeighborhoodCar {
  pathId: string;
  offset?: number;
  color?: string;
}

interface ThreeNeighborhoodMapProps {
  houses?: HouseMarker[];
  cars?: NeighborhoodCar[];
  onPropertyClick?: (property: HouseMarker) => void;
}

function LoadingScreen() {
  return (
    <Html center>
      <div className="rounded-xl border border-cyan-400/30 bg-slate-950/90 px-5 py-3 text-sm text-cyan-100 shadow-xl backdrop-blur">
        Loading Mai Troll…
      </div>
    </Html>
  );
}

export default function ThreeNeighborhoodMap({
  houses = [],
  cars = [],
  onPropertyClick,
}: ThreeNeighborhoodMapProps) {
  const normalizedHouses = useMemo(
    () =>
      houses.map((house) => ({
        ...house,

        // Convert the old 0–100 SVG coordinates into 3D world coordinates.
        worldX: (house.x - 50) * 0.9,
        worldZ: (house.y - 50) * 0.72,
      })),
    [houses],
  );

  return (
    <div className="relative h-[620px] w-full overflow-hidden rounded-2xl border border-cyan-400/15 bg-slate-950 shadow-2xl">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.domElement.style.touchAction = 'none';
        }}
      >
        <color attach="background" args={['#020711']} />

        <fog attach="fog" args={['#06101f', 70, 180]} />

        <PerspectiveCamera
          makeDefault
          position={[58, 62, 70]}
          fov={42}
          near={0.1}
          far={300}
        />

        <Suspense fallback={<LoadingScreen />}>
          <CityScene
            houses={normalizedHouses}
            cars={cars}
            onPropertyClick={onPropertyClick}
          />

          <Preload all />
        </Suspense>

        <MapControls
          makeDefault
          enableRotate
          enablePan
          enableZoom
          minDistance={45}
          maxDistance={125}
          minPolarAngle={Math.PI * 0.18}
          maxPolarAngle={Math.PI * 0.44}
          target={[0, 0, 0]}
          dampingFactor={0.08}
          enableDamping
          screenSpacePanning={false}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-cyan-300/20 bg-black/55 px-3 py-1 text-xs text-slate-200 backdrop-blur">
        Mai Troll Living Map
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg border border-white/10 bg-black/55 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
        Drag to move · Scroll to zoom · Drag right mouse to rotate
      </div>
    </div>
  );
}
