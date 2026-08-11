// AR Gift Renderer - Three.js based 3D gift rendering engine
// Renders 3D models attached to tracking points on the video stream

import * as THREE from 'three';
import type {
  ARGiftEffect,
  ARGiftInstance,
  TrackingData,
  TrackingPointTransform,
  FaceLandmarks,
  BodyLandmarks,
} from '../../types/arGifts';
import { computeTrackingPointTransform } from '../../types/arGifts';
import { f } from 'node_modules/obs-websocket-js/dist/base-BBN0PZdy';

const loadedModels = new Map<string, THREE.Object3D>();
const loadingModels = new Map<string, Promise<THREE.Object3D>>();

async function loadGLBModel(url: string): Promise<THREE.Object3D> {
  if (loadedModels.has(url)) {
    return loadedModels.get(url)!.clone();
  }
  if (loadingModels.has(url)) {
    return (await loadingModels.get(url)!).clone();
  }

  const loaderPromise = new Promise<THREE.Object3D>((resolve, reject) => {
    import('@babylonjs/loaders').then(({ GLTF2 }) => {
      const loader = new (GLTF2 as any).GLTFLoader();
      loader.load(
        url,
        (gltf: any) => {
          const model = gltf.scene;
          loadedModels.set(url, model.clone());
          resolve(model);
        },
        undefined,
        reject
      );
    }).catch(reject);
  });

  loadingModels.set(url, loaderPromise);
  const model = await loaderPromise;
  loadingModels.delete(url);
  return model.clone();
}

function createParticleSystem(effect: string): THREE.Points {
  const count = effect.includes('storm') ? 500 : 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const colorMap: Record<string, THREE.Color[]> = {
    gold_sparkle: [new THREE.Color(0xffd700), new THREE.Color(0xffa500), new THREE.Color(0xffffff)],
    golden_rays: [new THREE.Color(0xffd700), new THREE.Color(0xffec8b), new THREE.Color(0xffffff)],
    feather_particles: [new THREE.Color(0xffffff), new THREE.Color(0xffefd5), new THREE.Color(0xffffff)],
    gold_particle_storm: [new THREE.Color(0xffd700), new THREE.Color(0xffff00), new THREE.Color(0xb8860b)],
    purple_gold_confetti: [new THREE.Color(0x9370db), new THREE.Color(0xffd700), new THREE.Color(0x800080)],
    troll_sparkle: [new THREE.Color(0x32cd32), new THREE.Color(0x7cfc00), new THREE.Color(0x00ff00)],
    troll_king_aura: [new THREE.Color(0x9932cc), new THREE.Color(0xffd700), new THREE.Color(0x800080)],
    troll_confetti_storm: [new THREE.Color(0x32cd32), new THREE.Color(0xffd700), new THREE.Color(0x9932cc), new THREE.Color(0xff6347)],
    presidential_mode: [new THREE.Color(0xffd700), new THREE.Color(0x9932cc), new THREE.Color(0xffffff), new THREE.Color(0xc0c0c0)],
    presidential_glow: [new THREE.Color(0xffd700), new THREE.Color(0x9932cc)],
    gemstone_glow: [new THREE.Color(0x9370db), new THREE.Color(0x4b0082), new THREE.Color(0xffd700)],
    mini_flames: [new THREE.Color(0xff4500), new THREE.Color(0xff6347), new THREE.Color(0xffd700)],
    fur_sparkle: [new THREE.Color(0xff8c00), new THREE.Color(0xffd700), new THREE.Color(0xffffff)],
    feather_flutter: [new THREE.Color(0xffffff), new THREE.Color(0xf5f5dc), new THREE.Color(0xffd700)],
    bounce_sparkle: [new THREE.Color(0xff0000), new THREE.Color(0xff6347), new THREE.Color(0xffffff)],
    reflection_glare: [new THREE.Color(0xffffff), new THREE.Color(0xe0e0e0)],
    gold_thread_sparkle: [new THREE.Color(0xffd700), new THREE.Color(0xdaa520)],
    troll_city_glow: [new THREE.Color(0x32cd32), new THREE.Color(0x00ff00)],
  };

  const palette = colorMap[effect] || [new THREE.Color(0xffffff)];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = Math.random() * 5 + 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  (particles as any)._effect = effect;
  (particles as any)._birthTime = performance.now();

  return particles;
}

function createProceduralGift(gift: ARGiftEffect): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `ar_gift_${gift.id}`;

  switch (gift.id) {
    case 'ar_crown': {
      const ringGeo = new THREE.TorusGeometry(0.35, 0.05, 8, 32);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0xffa500,
        emissiveIntensity: 0.3,
      });
      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      for (let i = 0; i < 5; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.06, 0.2, 4);
        const spike = new THREE.Mesh(spikeGeo, goldMat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.32, 0.1, Math.sin(angle) * 0.32);
        group.add(spike);

        const gemGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const gemMat = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          metalness: 0.3,
          roughness: 0.1,
          emissive: 0xff0000,
          emissiveIntensity: 0.5,
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(Math.cos(angle) * 0.35, -0.12, Math.sin(angle) * 0.35);
        group.add(gem);
      }

      const pointLight = new THREE.PointLight(0xffd700, 1, 3);
      pointLight.position.set(0, 0.3, 0);
      group.add(pointLight);
      break;
    }

    case 'ar_sunglasses': {
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.2,
      });
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x222244,
        metalness: 0.9,
        roughness: 0.0,
        transparent: true,
        opacity: 0.7,
      });

      const leftLens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), lensMat);
      leftLens.rotation.z = Math.PI / 2;
      leftLens.position.set(-0.15, 0, 0);
      group.add(leftLens);

      const rightLens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), lensMat);
      rightLens.rotation.z = Math.PI / 2;
      rightLens.position.set(0.15, 0, 0);
      group.add(rightLens);

      const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 0.02),
        frameMat
      );
      group.add(bridge);
      break;
    }

    case 'ar_clown_nose': {
      const noseGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const noseMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.1,
        roughness: 0.5,
        emissive: 0xff0000,
        emissiveIntensity: 0.2,
      });
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0, 0, 0.05);
      group.add(nose);
      break;
    }

    case 'ar_halo': {
      const haloGeo = new THREE.TorusGeometry(0.3, 0.03, 16, 48);
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.95,
        roughness: 0.05,
        emissive: 0xffd700,
        emissiveIntensity: 0.8,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.1;
      group.add(halo);

      const rayGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4);
      const rayMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.4,
      });
      for (let i = 0; i < 12; i++) {
        const ray = new THREE.Mesh(rayGeo, rayMat);
        const angle = (i / 12) * Math.PI * 2;
        ray.position.set(Math.cos(angle) * 0.35, 0.3, Math.sin(angle) * 0.35);
        ray.rotation.x = Math.cos(angle) * 0.3;
        ray.rotation.z = Math.sin(angle) * 0.3;
        group.add(ray);
      }

      const haloLight = new THREE.PointLight(0xffd700, 2, 5);
      haloLight.position.y = 0.3;
      group.add(haloLight);
      break;
    }

    case 'ar_mini_troll': {
      const bodyGeo = new THREE.SphereGeometry(0.15, 16, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x32cd32,
        metalness: 0.2,
        roughness: 0.6,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(body);

      const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const pupilGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.06, 0.04, 0.13);
      group.add(leftEye);
      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      leftPupil.position.set(-0.06, 0.04, 0.15);
      group.add(leftPupil);

      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.06, 0.04, 0.13);
      group.add(rightEye);
      const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
      rightPupil.position.set(0.06, 0.04, 0.15);
      group.add(rightPupil);

      const earGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
      const leftEar = new THREE.Mesh(earGeo, bodyMat);
      leftEar.position.set(-0.15, 0.1, 0);
      leftEar.rotation.z = 0.3;
      group.add(leftEar);

      const rightEar = new THREE.Mesh(earGeo, bodyMat);
      rightEar.position.set(0.15, 0.1, 0);
      rightEar.rotation.z = -0.3;
      group.add(rightEar);
      break;
    }

    case 'ar_angel_wings': {
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0xffefd5,
        metalness: 0.1,
        roughness: 0.3,
        side: THREE.DoubleSide,
        emissive: 0xffd700,
        emissiveIntensity: 0.1,
      });

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 8; i++) {
          const featherShape = new THREE.Shape();
          featherShape.moveTo(0, 0);
          featherShape.quadraticCurveTo(0.05 * (1 - i * 0.05), 0.15 + i * 0.08, 0, 0.4 + i * 0.05);
          featherShape.quadraticCurveTo(-0.05 * (1 - i * 0.05), 0.15 + i * 0.08, 0, 0);

          const featherGeo = new THREE.ShapeGeometry(featherShape);
          const feather = new THREE.Mesh(featherGeo, wingMat);
          feather.position.set(side * (0.05 + i * 0.02), -0.1 + i * 0.06, -0.1 - i * 0.03);
          feather.rotation.z = side * (0.3 + i * 0.05);
          feather.rotation.y = side * 0.2;
          group.add(feather);
        }
      }

      const wingLight = new THREE.PointLight(0xffd700, 1, 4);
      group.add(wingLight);
      break;
    }

    case 'ar_troll_mask': {
      const maskGeo = new THREE.SphereGeometry(0.35, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6);
      const maskMat = new THREE.MeshStandardMaterial({
        color: 0x32cd32,
        metalness: 0.3,
        roughness: 0.4,
        side: THREE.DoubleSide,
        emissive: 0x00ff00,
        emissiveIntensity: 0.1,
      });
      const mask = new THREE.Mesh(maskGeo, maskMat);
      mask.position.z = 0.1;
      group.add(mask);

      const eyeHoleGeo = new THREE.CircleGeometry(0.08, 16);
      const eyeHoleMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
      });
      const leftEyeHole = new THREE.Mesh(eyeHoleGeo, eyeHoleMat);
      leftEyeHole.position.set(-0.12, 0.08, 0.28);
      group.add(leftEyeHole);
      const rightEyeHole = new THREE.Mesh(eyeHoleGeo, eyeHoleMat);
      rightEyeHole.position.set(0.12, 0.08, 0.28);
      group.add(rightEyeHole);
      break;
    }

    case 'ar_royal_cape': {
      const capeGeo = new THREE.PlaneGeometry(1, 1.5, 10, 20);
      const capeMat = new THREE.MeshStandardMaterial({
        color: 0x8b0000,
        side: THREE.DoubleSide,
        metalness: 0.1,
        roughness: 0.6,
      });
      const cape = new THREE.Mesh(capeGeo, capeMat);
      cape.position.set(0, 0, -0.2);
      group.add(cape);

      const trimGeo = new THREE.PlaneGeometry(1.05, 0.05);
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide,
      });
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(0, 0.6, -0.18);
      group.add(trim);
      (group as any)._capeGeo = capeGeo;
      break;
    }

    case 'ar_presidential_suit': {
      const suitGeo = new THREE.BoxGeometry(0.6, 0.8, 0.15);
      const suitMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        metalness: 0.2,
        roughness: 0.7,
      });
      const suit = new THREE.Mesh(suitGeo, suitMat);
      group.add(suit);

      const lapelGeo = new THREE.BoxGeometry(0.02, 0.4, 0.16);
      const lapelMat = new THREE.MeshStandardMaterial({
        color: 0x9932cc,
        metalness: 0.5,
        roughness: 0.3,
      });
      const leftLapel = new THREE.Mesh(lapelGeo, lapelMat);
      leftLapel.position.set(-0.15, 0.1, 0);
      leftLapel.rotation.z = 0.2;
      group.add(leftLapel);
      const rightLapel = new THREE.Mesh(lapelGeo, lapelMat);
      rightLapel.position.set(0.15, 0.1, 0);
      rightLapel.rotation.z = -0.2;
      group.add(rightLapel);

      const tieGeo = new THREE.ConeGeometry(0.04, 0.3, 4);
      const tieMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.3,
        roughness: 0.5,
      });
      const tie = new THREE.Mesh(tieGeo, tieMat);
      tie.position.set(0, 0.15, 0.08);
      group.add(tie);
      break;
    }

    case 'ar_troll_king_robe': {
      const robeGeo = new THREE.ConeGeometry(0.5, 1.2, 8, 1, true);
      const robeMat = new THREE.MeshStandardMaterial({
        color: 0x4b0082,
        side: THREE.DoubleSide,
        metalness: 0.3,
        roughness: 0.5,
      });
      const robe = new THREE.Mesh(robeGeo, robeMat);
      robe.position.set(0, -0.2, -0.1);
      group.add(robe);

      const goldTrimGeo = new THREE.TorusGeometry(0.5, 0.02, 8, 32);
      const goldTrimMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0xffd700,
        emissiveIntensity: 0.3,
      });
      const trim = new THREE.Mesh(goldTrimGeo, goldTrimMat);
      trim.position.set(0, -0.4, -0.1);
      trim.rotation.x = Math.PI / 2;
      group.add(trim);

      const auraLight = new THREE.PointLight(0x9932cc, 2, 5);
      auraLight.position.y = 0.3;
      group.add(auraLight);
      break;
    }

    case 'ar_presidential_crown': {
      const baseGeo = new THREE.CylinderGeometry(0.4, 0.38, 0.12, 16);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0xffd700,
        emissiveIntensity: 0.3,
      });
      const base = new THREE.Mesh(baseGeo, goldMat);
      group.add(base);

      for (let i = 0; i < 8; i++) {
        const peakGeo = new THREE.ConeGeometry(0.04, 0.25, 4);
        const peak = new THREE.Mesh(peakGeo, goldMat);
        const angle = (i / 8) * Math.PI * 2;
        peak.position.set(Math.cos(angle) * 0.35, 0.18, Math.sin(angle) * 0.35);
        group.add(peak);
      }

      const gemGeo = new THREE.OctahedronGeometry(0.06, 0);
      const gemMat = new THREE.MeshStandardMaterial({
        color: 0x9932cc,
        metalness: 0.5,
        roughness: 0.1,
        emissive: 0x9932cc,
        emissiveIntensity: 0.8,
      });
      for (let i = 0; i < 8; i++) {
        const gem = new THREE.Mesh(gemGeo, gemMat);
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
        gem.position.set(Math.cos(angle) * 0.38, 0.06, Math.sin(angle) * 0.38);
        group.add(gem);
      }

      const crownLight = new THREE.PointLight(0xffd700, 1.5, 4);
      crownLight.position.y = 0.3;
      group.add(crownLight);
      break;
    }

    case 'ar_presidential_seal': {
      const circleGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.03, 32);
      const sealMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.15,
        emissive: 0xffd700,
        emissiveIntensity: 0.2,
        side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(circleGeo, sealMat);
      group.add(circle);

      const ringGeo = new THREE.TorusGeometry(0.6, 0.02, 8, 64);
      const ring = new THREE.Mesh(ringGeo, sealMat);
      ring.position.z = 0.02;
      group.add(ring);

      const eagleGeo = new THREE.ConeGeometry(0.15, 0.5, 4);
      const eagle = new THREE.Mesh(eagleGeo, sealMat);
      eagle.position.y = 0.1;
      eagle.position.z = 0.03;
      eagle.rotation.x = Math.PI;
      group.add(eagle);

      const sealLight = new THREE.PointLight(0xffd700, 1, 6);
      sealLight.position.z = 0.5;
      group.add(sealLight);
      break;
    }

    case 'ar_shoulder_falcon': {
      const bodyGeo = new THREE.ConeGeometry(0.06, 0.2, 6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        metalness: 0.2,
        roughness: 0.6,
      });
      const falconBody = new THREE.Mesh(bodyGeo, bodyMat);
      falconBody.rotation.z = -Math.PI / 2;
      group.add(falconBody);

      for (let w = -1; w <= 1; w += 2) {
        for (let f = 0; f < 5; f++) {
          const wingFeather = new THREE.Mesh(
            new THREE.PlaneGeometry(0.03, 0.12 + f * 0.03),
            new THREE.MeshStandardMaterial({
              color: 0x654321,
              side: THREE.DoubleSide,
            })
          );
          wingFeather.position.set(w * 0.02, 0.02 - f * 0.02, -0.05 - f * 0.03);
          wingFeather.rotation.y = w * (0.3 + f * 0.05);
          group.add(wingFeather);
        }
      }

      const eyeGeo = new THREE.SphereGeometry(0.015, 8, 8);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const leftFalconEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftFalconEye.position.set(-0.05, 0.03, 0.08);
      group.add(leftFalconEye);
      const rightFalconEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightFalconEye.position.set(-0.05, 0.03, -0.08);
      group.add(rightFalconEye);
      break;
    }

    case 'ar_shoulder_dragon': {
      const dBodyGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const dBodyMat = new THREE.MeshStandardMaterial({
        color: 0x228b22,
        metalness: 0.3,
        roughness: 0.4,
      });
      const dBody = new THREE.Mesh(dBodyGeo, dBodyMat);
      group.add(dBody);

      const headGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const head = new THREE.Mesh(headGeo, dBodyMat);
      head.position.set(0.1, 0.05, 0);
      group.add(head);

      const jawGeo = new THREE.ConeGeometry(0.04, 0.1, 4);
      const fireMat = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        emissive: 0xff4500,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7,
      });
      const jaw = new THREE.Mesh(jawGeo, fireMat);
      jaw.position.set(0.18, 0.02, 0);
      jaw.rotation.z = -Math.PI / 2;
      group.add(jaw);

      for (let d = -1; d <= 1; d += 2) {
        for (let fw = 0; fw < 6; fw++) {
          const wing = new THREE.Mesh(
            new THREE.PlaneGeometry(0.04, 0.1 + fw * 0.02),
            new THREE.MeshStandardMaterial({
              color: 0x006400,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8,
            })
          );
          wing.position.set(0, 0.05 - fw * 0.015, d * (0.05 + fw * 0.025));
          wing.rotation.x = d * (0.2 + fw * 0.05);
          group.add(wing);
        }
      }
      break;
    }

    case 'ar_shoulder_tiger': {
      const tBodyGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const tBodyMat = new THREE.MeshStandardMaterial({
        color: 0xff8c00,
        metalness: 0.2,
        roughness: 0.5,
      });
      const tBody = new THREE.Mesh(tBodyGeo, tBodyMat);
      group.add(tBody);

      for (let i = 0; i < 8; i++) {
        const stripeGeo = new THREE.BoxGeometry(0.01, 0.02, 0.2);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        const angle = (i / 8) * Math.PI;
        stripe.position.set(0, Math.sin(angle) * 0.1, Math.cos(angle) * 0.1);
        group.add(stripe);
      }

      const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), tBodyMat);
      tHead.position.set(0, 0.1, 0.05);
      group.add(tHead);

      const noseGeo = new THREE.SphereGeometry(0.02, 8, 8);
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
      const tNose = new THREE.Mesh(noseGeo, noseMat);
      tNose.position.set(0, 0.09, 0.14);
      group.add(tNose);
      break;
    }

    default: {
      const defaultGeo = new THREE.OctahedronGeometry(0.15, 0);
      const defaultMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0xffa500,
        emissiveIntensity: 0.3,
      });
      const defaultMesh = new THREE.Mesh(defaultGeo, defaultMat);
      group.add(defaultMesh);

      const defaultLight = new THREE.PointLight(0xffd700, 0.5, 2);
      group.add(defaultLight);
      break;
    }
  }

  return group;
}

export class ARGiftRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private activeGifts: Map<string, ARGiftInstance> = new Map();
  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private videoWidth: number;
  private videoHeight: number;
  private maxActiveGifts: number;
  private onGiftExpired?: (instanceId: string) => void;

  constructor(
    canvas: HTMLCanvasElement,
    videoWidth: number,
    videoHeight: number,
    maxGifts: number = 20,
    onGiftExpired?: (instanceId: string) => void
  ) {
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
    this.maxActiveGifts = maxGifts;
    this.onGiftExpired = onGiftExpired;

    this.scene = new THREE.Scene();

    const aspect = videoWidth / videoHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    this.renderer.setSize(videoWidth, videoHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 3, 5);
    this.scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-2, -1, -3);
    this.scene.add(backLight);

    this.clock = new THREE.Clock();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  async addGift(
    gift: ARGiftEffect,
    senderId: string,
    senderName: string,
    receiverId: string,
    instanceId: string,
    stackIndex: number = 0
  ): Promise<void> {
    if (this.activeGifts.size >= this.maxActiveGifts) {
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      this.activeGifts.forEach((inst, id) => {
        if (inst.startTime < oldestTime) {
          oldestTime = inst.startTime;
          oldestId = id;
        }
      });
      if (oldestId) {
        this.removeGift(oldestId);
      }
    }

    let model: THREE.Object3D;
    try {
      if (gift.modelUrl) {
        model = await loadGLBModel(gift.modelUrl);
      } else {
        model = createProceduralGift(gift);
      }
    } catch {
      model = createProceduralGift(gift);
    }

    let particles: THREE.Points | null = null;
    if (gift.particleEffect) {
      particles = createParticleSystem(gift.particleEffect);
      this.scene.add(particles);
    }

    this.scene.add(model);

    const instance: ARGiftInstance = {
      id: instanceId,
      giftId: gift.id,
      gift,
      senderId,
      senderName,
      receiverId,
      trackingPoint: gift.trackingPoint,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      startTime: performance.now(),
      duration: gift.durationMs,
      isActive: true,
      stackIndex,
      modelRef: model,
      particleRef: particles,
    };

    this.activeGifts.set(instanceId, instance);
  }

  removeGift(instanceId: string): void {
    const instance = this.activeGifts.get(instanceId);
    if (!instance) return;

    if (instance.modelRef) {
      this.scene.remove(instance.modelRef);
      if (instance.modelRef instanceof THREE.Mesh) {
        instance.modelRef.geometry?.dispose();
        if (Array.isArray(instance.modelRef.material)) {
          instance.modelRef.material.forEach((m) => m.dispose());
        } else {
          instance.modelRef.material?.dispose();
        }
      }
    }

    if (instance.particleRef) {
      this.scene.remove(instance.particleRef);
      instance.particleRef.geometry?.dispose();
      if (instance.particleRef instanceof THREE.Points) {
        (instance.particleRef.material as THREE.Material)?.dispose();
      }
    }

    this.activeGifts.delete(instanceId);
    this.onGiftExpired?.(instanceId);
  }

  updateTracking(faceData: FaceLandmarks | null, bodyData: BodyLandmarks | null): void {
    const now = performance.now();

    this.activeGifts.forEach((instance) => {
      if (!instance.isActive) return;

      const elapsed = now - instance.startTime;
      if (elapsed >= instance.duration) {
        this.removeGift(instance.id);
        return;
      }

      const transform = computeTrackingPointTransform(
        instance.trackingPoint,
        faceData,
        bodyData,
        this.videoWidth,
        this.videoHeight
      );

      if (!transform) return;

      const model = instance.modelRef as THREE.Object3D;
      if (!model) return;

      model.position.set(
        transform.position.x * 3,
        transform.position.y * 3,
        transform.position.z * 3
      );

      model.rotation.set(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z
      );

      const baseScale = transform.scale * 0.5;
      const entryProgress = Math.min(elapsed / 500, 1);
      const exitProgress = elapsed > instance.duration - 500 ? (elapsed - (instance.duration - 500)) / 500 : 0;
      const scaleMultiplier = entryProgress * (1 - exitProgress);
      model.scale.setScalar(baseScale * scaleMultiplier);

      if (instance.particleRef) {
        instance.particleRef.position.copy(model.position);

        const positions = instance.particleRef.geometry.attributes.position;
        if (positions) {
          const arr = positions.array as Float32Array;
          for (let i = 0; i < arr.length; i += 3) {
            arr[i] += (Math.random() - 0.5) * 0.05;
            arr[i + 1] += (Math.random() - 0.5) * 0.05;
            arr[i + 2] += (Math.random() - 0.5) * 0.05;
          }
          positions.needsUpdate = true;
        }
      }
    });
  }

  private render = (): void => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.render);

    const elapsed = this.clock.getElapsedTime();

    this.activeGifts.forEach((instance) => {
      const model = instance.modelRef as THREE.Object3D;
      if (!model) return;

      if (instance.gift.triggerType === 'animated_loop') {
        const floatY = Math.sin(elapsed * 2 + instance.stackIndex) * 0.05;
        model.position.y += floatY * 0.01;

        if (
          instance.trackingPoint === 'above_head' ||
          instance.gift.id === 'ar_presidential_seal'
        ) {
          model.rotation.y = elapsed * 0.5;
        }
      }

      if (instance.gift.id === 'ar_clown_nose') {
        const bounce = Math.abs(Math.sin(elapsed * 5)) * 0.1;
        model.scale.setScalar(model.scale.x * (1 + bounce * 0.02));
      }
    });

    this.renderer.render(this.scene, this.camera);
  };

  clearAll(): void {
    const ids = Array.from(this.activeGifts.keys());
    ids.forEach((id) => this.removeGift(id));
  }

  resize(width: number, height: number): void {
    this.videoWidth = width;
    this.videoHeight = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  getActiveGiftCount(): number {
    return this.activeGifts.size;
  }

  getActiveGiftsData(): ARGiftInstance[] {
    return Array.from(this.activeGifts.values());
  }

  dispose(): void {
    this.stop();
    this.clearAll();
    this.renderer.dispose();
  }
}
