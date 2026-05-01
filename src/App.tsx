import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Sky, Environment, Sparkles, Stats } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEMPLATES } from './templates';
import { GoogleGenAI } from "@google/genai";

import { Volume2, VolumeX, Music, Wind, Search, Info, ExternalLink, ChevronDown, ChevronUp, Zap, Hand, MousePointer2, Hammer, Paintbrush, Undo2, Redo2, X } from 'lucide-react';
import { COLORS, COLOR_MAP, PLATE_HEIGHT, BRICK_HEIGHT, GRID_UNIT_WIDTH, GRID_UNIT_HEIGHT, STUD_HEIGHT, STUD_RADIUS, PARTS, PART_MAP, getGridPos, normalizePos, getCollisionBoxes, checkCollision } from './parts';

const AudioEngine = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sfxGain: null as GainNode | null,
  ambientGain: null as GainNode | null,
  musicGain: null as GainNode | null,
  
  // Music tracks
  musicAudio: null as HTMLAudioElement | null,
  ambientAudio: null as HTMLAudioElement | null,
  musicTracks: [
    '/music/midnight-jazz-cafe.mp3',
    '/music/rainy-afternoon-chords.mp3',
    '/music/rainy-day-contemplation.mp3'
  ],
  currentTrackIndex: 0,
  isInitialized: false,
  
  init() {
    if (this.isInitialized) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      
      // Initialize internal gains to 0. React state will bring them up.
      this.ambientGain.gain.value = 0;
      this.musicGain.gain.value = 0;

      this.setupWind();
      this.setupMusic();
      this.isInitialized = true;
    } catch (e) {
      console.warn("Audio Context failed to initialize", e);
    }
  },

  setupMusic() {
    if (!this.ctx || !this.musicGain) return;
    this.musicAudio = new Audio();
    this.musicAudio.crossOrigin = "anonymous";
    const source = this.ctx.createMediaElementSource(this.musicAudio);
    source.connect(this.musicGain);

    this.musicAudio.onended = () => {
      this.playNextTrack();
    };
  },

  playNextTrack() {
    if (!this.musicAudio) return;
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
    this.musicAudio.src = this.musicTracks[this.currentTrackIndex];
    this.musicAudio.play().catch(() => {});
  },

  setupWind() {
    if (!this.ctx || !this.ambientGain) return;
    this.ambientAudio = new Audio('/music/freesound_community-windy-forest-32853.mp3');
    this.ambientAudio.crossOrigin = "anonymous";
    this.ambientAudio.loop = true;
    const source = this.ctx.createMediaElementSource(this.ambientAudio);
    source.connect(this.ambientGain);
  },

  playClick() {
    if (!this.isInitialized) return;
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    if (!this.ctx || !this.sfxGain) return;
    
    const t = this.ctx.currentTime + 0.01;
    
    // Impact 1: Depth/Thud
    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(150, t);
    osc1.frequency.exponentialRampToValueAtTime(45, t + 0.05);
    g1.gain.setValueAtTime(0.25, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc1.connect(g1);
    g1.connect(this.sfxGain);

    // Impact 2: Sharp plastic click
    const bufSize = this.ctx.sampleRate * 0.02;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    for(let i=0; i<bufSize; i++) buf.getChannelData(0)[i] = (Math.random() * 2 - 1) * 0.3;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3200;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.sfxGain);

    osc1.start(t);
    noise.start(t);
    osc1.stop(t + 0.05);
    noise.stop(t + 0.02);
  },

  playPop() {
    if (!this.isInitialized || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  },

  setSfxVolume(v: number) { 
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(v, this.ctx?.currentTime || 0, 0.1); 
  },
  setAmbientVolume(v: number) { 
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(v, this.ctx?.currentTime || 0, 0.1);
    if (v > 0 && this.ambientAudio && this.ambientAudio.paused) {
      this.ambientAudio.play().catch(() => {});
    } else if (v === 0 && this.ambientAudio) {
      this.ambientAudio.pause();
    }
  },
  setMusicVolume(v: number) { 
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(v, this.ctx?.currentTime || 0, 0.1);
    
    if (v > 0 && this.musicAudio && this.musicAudio.paused) {
      if (!this.musicAudio.src) {
        this.musicAudio.src = this.musicTracks[this.currentTrackIndex];
      }
      this.musicAudio.play().catch(() => {});
    } else if (v === 0 && this.musicAudio) {
      this.musicAudio.pause();
    }
  }
};

function LicenseItem({ title, license, content }: { title: string, license: string, content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white hover:border-gray-200 transition-colors">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 flex items-center justify-between px-4 transition-colors"
      >
        <div className="text-left leading-none">
          <p className="text-[10px] font-black text-gray-800 tracking-tight">{title}</p>
          <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{license}</p>
        </div>
        {isOpen ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100/50">
            <p className="text-[9px] text-gray-500 leading-relaxed font-mono whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
              {content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const baseplateStudUVsOnCompile = (shader: any) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    `
    #include <uv_vertex>
    #ifdef USE_INSTANCING
      vec4 worldPositionForUV = instanceMatrix * vec4(position, 1.0);
      vec2 floorUv = vec2(
         (worldPositionForUV.x + 16.0) / 32.0,
         (-worldPositionForUV.z + 16.0) / 32.0
      );
      #if defined( USE_UV )
        vUv = floorUv;
      #endif
      #if defined( USE_MAP )
        vMapUv = floorUv;
      #endif
      #if defined( USE_NORMALMAP )
        vNormalMapUv = floorUv;
      #endif
      #if defined( USE_ROUGHNESSMAP )
        vRoughnessMapUv = floorUv;
      #endif
    #endif
    `
  );
};

const randomUVsOnCompile = (shader: any) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    `
    #include <uv_vertex>
    #ifdef USE_INSTANCING
      vec2 uvOffset = instanceMatrix[3].xz * 0.137;
    #else
      vec2 uvOffset = modelMatrix[3].xz * 0.137;
    #endif
    #if defined( USE_UV )
      vUv += uvOffset;
    #endif
    #if defined( USE_MAP )
      vMapUv += uvOffset;
    #endif
    #if defined( USE_NORMALMAP )
      vNormalMapUv += uvOffset;
    #endif
    #if defined( USE_ROUGHNESSMAP )
      vRoughnessMapUv += uvOffset;
    #endif
    `
  );
};

const { roughnessMap, floorRoughnessMap, studFloorRoughnessMap, studFloorNormalMap, microRoughnessMap, normalMap, floorNormalMap, customEnvMap } = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base: Semi-glossy plastic (#11 to #22 is very shiny, #33+ is more matte)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 1024, 1024);
    
    // 1. Fine Pitting / Dust (Dots)
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const v = Math.floor(Math.random() * 40) + 40;
        const size = Math.random() * 2 + 1; // Much smaller dots
        ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. Play Wear Scratches (Irregular lines)
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const len = Math.random() * 60 + 20; // Longer scratches
      const angle = Math.random() * Math.PI * 2;
      const v = Math.floor(Math.random() * 100) + 120; // High roughness value
      const opacity = Math.random() * 0.3 + 0.1;
      
      ctx.strokeStyle = `rgba(${v},${v},${v},${opacity})`;
      ctx.lineWidth = Math.random() * 1.5 + 0.5; // Thinner lines
      ctx.beginPath();
      ctx.moveTo(x, y);
      const midX = x + Math.cos(angle) * (len * 0.5) + (Math.random() - 0.5) * 10;
      const midY = y + Math.sin(angle) * (len * 0.5) + (Math.random() - 0.5) * 10;
      ctx.lineTo(midX, midY);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
    
    // 3. Rubbed areas / Smudges (Heavy wear patches)
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = Math.random() * 30 + 10;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const intensity = Math.floor(Math.random() * 60) + 150;
      grad.addColorStop(0, `rgba(${intensity}, ${intensity}, ${intensity}, 0.25)`);
      grad.addColorStop(1, 'rgba(26, 26, 26, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const baseTex = new THREE.CanvasTexture(canvas);
  baseTex.wrapS = baseTex.wrapT = THREE.RepeatWrapping;
  
  // Versions for different scales
  const rMap = baseTex.clone();
  rMap.repeat.set(0.5, 0.5); // 1 repeat per 2 units, same as the floor
  
  const mMap = baseTex.clone();
  mMap.repeat.set(0.5, 0.5); // Better for bricks/studs

  // Generate Normal Map from Roughness Map
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = 1024;
  normalCanvas.height = 1024;
  const nCtx = normalCanvas.getContext('2d');
  if (ctx && nCtx) {
     const imgData = ctx.getImageData(0, 0, 1024, 1024);
     const nData = nCtx.createImageData(1024, 1024);
     const data = imgData.data;
     const nd = nData.data;
     const w = 1024;
     const h = 1024;
     
     // Simple discrete difference to approximate local gradient
     for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
           const i = (y * w + x) * 4;
           // Red channel holds grayscale height
           const c = data[i] / 255.0; 
           
           const cxX = x < w - 1 ? data[i + 4] / 255.0 : c;
           const cyY = y < h - 1 ? data[i + w * 4] / 255.0 : c;
           
           // Height difference
           const dx = (c - cxX) * 15.0; // strength multiplier
           const dy = (c - cyY) * 15.0;
           const dz = 1.0;
           
           // Normalize vector
           const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
           const nx = dx / len;
           const ny = dy / len;
           const nz = dz / len;
           
           // Map from [-1, 1] to [0, 255]
           nd[i] = Math.floor((nx * 0.5 + 0.5) * 255);     // R represents X
           nd[i+1] = Math.floor((ny * 0.5 + 0.5) * 255);   // G represents Y
           nd[i+2] = Math.floor((nz * 0.5 + 0.5) * 255);   // B represents Z
           nd[i+3] = 255;                                  // Alpha
        }
     }
     nCtx.putImageData(nData, 0, 0);
  }
  
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  
  const nMap = normalTex.clone();
  nMap.repeat.set(1, 1);
  
  const floorNMap = normalTex.clone();
  floorNMap.repeat.set(16, 16);

  // ---------------------------------------------------------
  // Create Custom Environment Map (Blank backdrop with a "Sun")
  // ---------------------------------------------------------
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const envCtx = envCanvas.getContext('2d');
  if (envCtx) {
    // Brighter neutral environment background for better color representation
    envCtx.fillStyle = '#2a2a2a';
    envCtx.fillRect(0, 0, 1024, 512);
    
    // Major light source (Simulated Sun)
    const centerX = 512;
    const centerY = 120;
    const radius = 90;
    
    // Sun
    const grad = envCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 4);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.1, '#fff9e6'); 
    grad.addColorStop(0.2, '#bbbbbb');
    grad.addColorStop(0.5, '#444444');
    grad.addColorStop(1, 'rgba(42, 42, 42, 0)');
    
    envCtx.fillStyle = grad;
    envCtx.beginPath();
    envCtx.arc(centerX, centerY, radius * 4, 0, Math.PI * 2);
    envCtx.fill();

    // Fill light (Back)
    const backCenterX = 100;
    const backCenterY = 400;
    const backGrad = envCtx.createRadialGradient(backCenterX, backCenterY, 0, backCenterX, backCenterY, 300);
    backGrad.addColorStop(0, '#333344');
    backGrad.addColorStop(1, 'rgba(42, 42, 42, 0)');
    envCtx.fillStyle = backGrad;
    envCtx.beginPath();
    envCtx.arc(backCenterX, backCenterY, 300, 0, Math.PI * 2);
    envCtx.fill();
  }
  const eMap = new THREE.CanvasTexture(envCanvas);
  eMap.mapping = THREE.EquirectangularReflectionMapping;

  rMap.wrapS = THREE.RepeatWrapping;
  rMap.wrapT = THREE.RepeatWrapping;
  rMap.repeat.set(1, 1);

  const floorMap = rMap.clone();
  floorMap.repeat.set(16, 16);

  const studFloorMap = rMap.clone();
  studFloorMap.repeat.set(0.15, 0.15);
  
  const studFloorNMap = normalTex.clone();
  studFloorNMap.wrapS = THREE.RepeatWrapping;
  studFloorNMap.wrapT = THREE.RepeatWrapping;
  studFloorNMap.repeat.set(0.15, 0.15);

  return { roughnessMap: rMap, floorRoughnessMap: floorMap, studFloorRoughnessMap: studFloorMap, studFloorNormalMap: studFloorNMap, microRoughnessMap: mMap, normalMap: nMap, floorNormalMap: floorNMap, customEnvMap: eMap };
})();

/**
 * Grid Snapping and Position Calculation
 * Calculates the snapped grid position based on mouse interaction point, surface normal, and block size.
 * @param point - The 3D world position clicked or hovered.
 * @param normal - The normal vector of the surface being interacted with.
 * @param size - The dimensions of the brick [width, depth, height].
 * @param snapToGrid - Whether grid snapping is enabled.
 * @param rotation - Current Y-axis rotation (0-3).
 * @returns [x, y, z] snapped world coordinates.
 */
/**
 * Custom hook to pre-generate and memoize Three.js geometries for all parts.
 * Merges visual components (base, studs, holes) into single BufferGeometries
 * for optimized instantiation and rendering.
 */
function useBrickGeometries() {
  return useMemo(() => {
    const geometries: Record<string, { visual: THREE.BufferGeometry, collision: THREE.BufferGeometry, edges: THREE.BufferGeometry, size: number[] }> = {};
    
    PARTS.forEach(part => {
      const [w, d, h] = part.size;
      const wActual = w * GRID_UNIT_WIDTH; 
      const dActual = d * GRID_UNIT_WIDTH;
      const hActual = h * GRID_UNIT_HEIGHT;
      
      const visualParts = [];
      const edgeParts = [];
      
      // Base Shape
      const isRound = part.type === 'cylinder' || (part.type === 'tile' && part.id.includes('round'));
      const roofT = Math.min(0.1, hActual); // ensure roof is not thicker than the piece
      
      if ((part.type === 'box' || part.type === 'tile' || part.type === 'brick' || part.type === 'plate') && !isRound) {
         const body = new THREE.BoxGeometry(wActual, hActual, dActual);
         visualParts.push(body);
         edgeParts.push(body);
      } else if (isRound || part.type === 'cylinder_hole') {
         if (part.type === 'cylinder_hole') {
            const outerRadius = wActual / 2;
            const innerRadius = 0.1;
            const shape = new THREE.Shape();
            shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
            const holePath = new THREE.Path();
            holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
            shape.holes.push(holePath);
            const holeGeo = new THREE.ExtrudeGeometry(shape, { depth: hActual, bevelEnabled: false });
            holeGeo.center();
            holeGeo.rotateX(Math.PI / 2);
            visualParts.push(holeGeo);
            edgeParts.push(holeGeo);
         } else {
            const cyl = new THREE.CylinderGeometry(wActual / 2, wActual / 2, hActual, 32);
            visualParts.push(cyl);
            edgeParts.push(cyl);
         }
      } else if (part.type === 'slope_inv') {
         const shape = new THREE.Shape();
         shape.moveTo(-dActual/2, hActual/2);
         shape.lineTo(dActual/2, hActual/2);
         shape.lineTo(dActual/2, -hActual/2);
         shape.lineTo(-dActual/2, hActual/2); 
         const extrudeSettings = { depth: wActual, bevelEnabled: false };
         const slopeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
         slopeGeo.center();
         slopeGeo.rotateY(Math.PI / 2);
         visualParts.push(slopeGeo);
         edgeParts.push(slopeGeo);
      } else if (part.type === 'corner') {
         const shape = new THREE.Shape();
         shape.moveTo(-wActual/2, -dActual/2);
         shape.lineTo(wActual/2, -dActual/2);
         shape.lineTo(wActual/2, 0);
         shape.lineTo(0, 0);
         shape.lineTo(0, dActual/2);
         shape.lineTo(-wActual/2, dActual/2);
         shape.lineTo(-wActual/2, -dActual/2);
         
         const cornerGeo = new THREE.ExtrudeGeometry(shape, { depth: hActual, bevelEnabled: false });
         cornerGeo.center();
         cornerGeo.rotateX(Math.PI / 2);
         visualParts.push(cornerGeo);
         edgeParts.push(cornerGeo);
      } else if (part.type === 'slope') {
         const shape = new THREE.Shape();
         shape.moveTo(-dActual/2, -hActual/2);
         shape.lineTo(dActual/2, -hActual/2);
         shape.lineTo(dActual/2, hActual/2);
         shape.lineTo(-dActual/2, -hActual/2); 
         
         const extrudeSettings = { depth: wActual, bevelEnabled: false };
         const slopeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
         slopeGeo.center();
         slopeGeo.rotateY(Math.PI / 2);
         visualParts.push(slopeGeo);
         edgeParts.push(slopeGeo);
      } else if (part.type === 'slope_2studs') {
         const shape = new THREE.Shape();
         shape.moveTo(-dActual/2, -hActual/2);
         shape.lineTo(dActual/2, -hActual/2);
         shape.lineTo(dActual/2, hActual/2);
         shape.lineTo(0, hActual/2);
         shape.lineTo(-dActual/2, -hActual/2);
 
         const slopeGeo = new THREE.ExtrudeGeometry(shape, { depth: wActual, bevelEnabled: false });
         slopeGeo.center();
         slopeGeo.rotateY(Math.PI / 2);
         visualParts.push(slopeGeo);
         edgeParts.push(slopeGeo);
 
         const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
         for (let x = 0; x < w; x++) {
            const sx = (x - w/2 + 0.5) * GRID_UNIT_WIDTH;
            const sz = -(1.5 - d/2) * GRID_UNIT_WIDTH; 
            const stud = studGeo.clone();
            stud.translate(sx, hActual/2 + STUD_HEIGHT/2, sz);
            visualParts.push(stud);
            edgeParts.push(stud);
         }
      } else if (part.type === 'wedge_plate') {
         const shape = new THREE.Shape();
         shape.moveTo(-wActual/2, -dActual/2);
         shape.lineTo(wActual/2, -dActual/2);
         shape.lineTo(wActual/2, -dActual/2 + GRID_UNIT_WIDTH); 
         shape.lineTo(-wActual/2 + GRID_UNIT_WIDTH, dActual/2); 
         shape.lineTo(-wActual/2, dActual/2);
         shape.lineTo(-wActual/2, -dActual/2);
 
         const wedgeGeo = new THREE.ExtrudeGeometry(shape, { depth: hActual, bevelEnabled: false });
         wedgeGeo.center();
         wedgeGeo.rotateX(Math.PI / 2);
         visualParts.push(wedgeGeo);
         edgeParts.push(wedgeGeo);
 
         const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
         for (let ix = 0; ix < w; ix++) {
            for (let iz = 0; iz < d; iz++) {
               if (ix + iz >= 3) continue;
               
               const sx = (ix - w/2 + 0.5) * GRID_UNIT_WIDTH;
               const sz = (iz - d/2 + 0.5) * GRID_UNIT_WIDTH;
               const stud = studGeo.clone();
               stud.translate(sx, hActual/2 + STUD_HEIGHT/2, sz);
               visualParts.push(stud);
               edgeParts.push(stud);
            }
         }
      } else if (part.type === 'dish_inverted' || part.type === 'dish_test') {
         const segments = 32;
         const outerRadius = wActual / 2;
         const innerRadius = 0.2;
         const thickness = 0.18; 
         const isTest = part.type === 'dish_test';
         
         const points = [];
         const curvePoints = 12;
         for (let i = 0; i <= curvePoints; i++) {
            const t = i / curvePoints;
            const r = innerRadius + (outerRadius - innerRadius) * t;
            const y = -hActual/2 + Math.pow(t, 2.0) * hActual;
            points.push(new THREE.Vector2(r, y));
         }
         for (let i = curvePoints; i >= 0; i--) {
            const t = i / curvePoints;
            const r = innerRadius + (outerRadius - thickness - innerRadius) * t;
            const y = -hActual/2 + Math.pow(t, 2.0) * hActual + thickness;
            points.push(new THREE.Vector2(Math.max(0.01, r), y));
         }
         const latheGeo = new THREE.LatheGeometry(points, segments);
         if (isTest) latheGeo.rotateX(Math.PI);
         visualParts.push(latheGeo);
         edgeParts.push(latheGeo);
         
         if (part.type === 'dish_inverted') {
            const connectGeo = new THREE.CylinderGeometry(0.15, 0.25, 0.2, 16);
            connectGeo.translate(0, -hActual/2 + 0.1, 0);
            visualParts.push(connectGeo);
         } else {
            const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
            studGeo.translate(0, hActual/2 - thickness/2, 0);
            visualParts.push(studGeo);
         }
      } else if (part.type === 'cone') {
         const cyl = new THREE.CylinderGeometry(0.22, wActual / 2, hActual, 32); 
         visualParts.push(cyl);
         edgeParts.push(cyl);
         const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
         const stud = studGeo.clone();
         stud.translate(0, hActual/2 + STUD_HEIGHT/2, 0); 
         visualParts.push(stud);
         edgeParts.push(stud);
      } else if (part.type === 'jumper' || part.type === 'jumper_round') {
         if (part.type === 'jumper_round') {
            const cyl = new THREE.CylinderGeometry(wActual / 2, wActual / 2, hActual, 32);
            visualParts.push(cyl);
            edgeParts.push(cyl);
            const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
            const stud = studGeo.clone();
            stud.translate(0, hActual/2 + STUD_HEIGHT/2, 0); 
            visualParts.push(stud);
            edgeParts.push(stud);
         } else {
            const body = new THREE.BoxGeometry(wActual, hActual, dActual);
            visualParts.push(body);
            edgeParts.push(body);
            const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
            const stud = studGeo.clone();
            stud.translate(0, hActual/2 + STUD_HEIGHT/2, 0); 
            visualParts.push(stud);
            edgeParts.push(stud);
         }
      }
 
      // Add studs for boxes and corners
      if (part.type === 'box' || part.type === 'brick' || part.type === 'plate' || part.type === 'corner' || part.type === 'cylinder' || part.type === 'slope_inv') {
        const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16);
        for (let x = 0; x < w; x++) {
          for (let z = 0; z < d; z++) {
            if (part.type === 'corner' && x >= w / 2 && z >= d / 2) continue;
            if (part.type === 'cylinder') {
              const dx = (x - w / 2 + 0.5) * GRID_UNIT_WIDTH;
              const dz = (z - d / 2 + 0.5) * GRID_UNIT_WIDTH;
              const dist = Math.sqrt(dx * dx + dz * dz);
              const threshold = w === 3 ? 0.6 : (wActual / 2 - 0.01);
              if (dist > threshold) continue;
            }
            const sx = (x - w/2 + 0.5) * GRID_UNIT_WIDTH;
            const sz = (z - d/2 + 0.5) * GRID_UNIT_WIDTH;
            const stud = studGeo.clone();
            stud.translate(sx, hActual/2 + STUD_HEIGHT/2, sz);
            visualParts.push(stud);
            edgeParts.push(stud);
          }
        }
      }
 
      // Add underside structure
      if ((part.type === 'box' || part.type === 'brick' || part.type === 'plate' || part.type === 'corner') && !isRound) {
         const tubeRadiusOuter = 0.16;
         const tubeRadiusInner = 0.10;
         const pinRadius = 0.08;
         const innerH = hActual - (Math.min(0.1, hActual));
         
         const shape = new THREE.Shape();
         shape.absarc(0, 0, tubeRadiusOuter, 0, Math.PI * 2, false);
         const holePath = new THREE.Path();
         holePath.absarc(0, 0, tubeRadiusInner, 0, Math.PI * 2, true);
         shape.holes.push(holePath);
         
         const hollowTubeGeo = new THREE.ExtrudeGeometry(shape, { depth: innerH, bevelEnabled: false });
         hollowTubeGeo.center();
         hollowTubeGeo.rotateX(Math.PI / 2);
         const pinGeo = new THREE.CylinderGeometry(pinRadius, pinRadius, innerH, 12);
         
         for (let x = 0; x < w - 1; x++) {
           for (let z = 0; z < d - 1; z++) {
             if (part.type === 'corner' && x >= w / 2 - 1 && z >= d / 2 - 1) continue;
             const sx = (x - w/2 + 1) * GRID_UNIT_WIDTH;
             const sz = (z - d/2 + 1) * GRID_UNIT_WIDTH;
             const tube = hollowTubeGeo.clone();
             tube.translate(sx, -hActual/2 + innerH/2, sz);
             visualParts.push(tube);
           }
         }
         
         if (w === 1 && d > 1) {
            for (let z = 0; z < d - 1; z++) {
               const sz = (z - d/2 + 1) * GRID_UNIT_WIDTH;
               const pin = pinGeo.clone();
               pin.translate(0, -hActual/2 + innerH/2, sz);
               visualParts.push(pin);
            }
         } else if (d === 1 && w > 1) {
            for (let x = 0; x < w - 1; x++) {
               const sx = (x - w/2 + 1) * GRID_UNIT_WIDTH;
               const pin = pinGeo.clone();
               pin.translate(sx, -hActual/2 + innerH/2, 0);
               visualParts.push(pin);
            }
         }
      }
 
      if (visualParts.length === 0) return;
 
      const mergedVisual = mergeGeometries(visualParts.map(g => g.index ? g.toNonIndexed() : g));
      if (mergedVisual) {
        mergedVisual.computeVertexNormals();
        const pos = mergedVisual.attributes.position;
        const norm = mergedVisual.attributes.normal;
        const uvs = mergedVisual.attributes.uv;
        if (pos && norm && uvs) {
           for (let i = 0; i < pos.count; i++) {
              const nx = Math.abs(norm.getX(i));
              const ny = Math.abs(norm.getY(i));
              const nz = Math.abs(norm.getZ(i));
              const px = pos.getX(i);
              const py = pos.getY(i);
              const pz = pos.getZ(i);
              
              if (ny > nx && ny > nz) uvs.setXY(i, px / 2, pz / 2);
              else if (nx > ny && nx > nz) uvs.setXY(i, pz / 2, py / 2);
              else uvs.setXY(i, px / 2, py / 2);
           }
           uvs.needsUpdate = true;
        }
      }
      
      let collisionGeo;
      if (part.type === 'corner') {
         const c1 = new THREE.BoxGeometry(wActual, hActual, dActual / 2);
         c1.translate(0, 0, -dActual / 4);
         const c2 = new THREE.BoxGeometry(wActual / 2, hActual, dActual / 2);
         c2.translate(-wActual / 4, 0, dActual / 4);
         const collisionParts = [c1, c2].map(g => g.index ? g.toNonIndexed() : g);
         collisionGeo = mergeGeometries(collisionParts);
      } else {
         collisionGeo = new THREE.BoxGeometry(wActual, hActual, dActual);
      }
      
      if (mergedVisual && collisionGeo) {
         const mergedEdges = mergeGeometries(edgeParts.map(g => g.index ? g.toNonIndexed() : g));
         geometries[part.id] = { visual: mergedVisual, collision: collisionGeo, edges: mergedEdges, size: part.size };
      }
    });
    
    return geometries;
  }, []);
}

/**
 * Performs a comprehensive stability check on all placed blocks.
 * Determines which blocks are connected to the ground (baseplate) through a chain of physical connections.
 * 
 * Algorithm:
 * 1. Identify "Grounded" blocks (those touching the floor plane at y = -0.5).
 * 2. Build a connectivity graph (adjacency list) between all blocks based on spatial overlap of studs/holes.
 * 3. Propagate stability from grounded blocks through the graph using a BFS/Iterative approach.
 * 4. Any block not reached in the propagation is considered "unstable" and should fall.
 * 
 * @param blocks - The current array of placed bricks.
 * @param parts - The definition dictionary of available parts.
 * @returns { supportedIds: Set<string>, fallingIds: Set<string> }
 */
/**
 * Spatial Partitioning: Simple Octree for fast collision and stability checks
 */
class Octree {
  nodes: Octree[] = [];
  objects: any[] = [];
  bounds: { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number };
  capacity = 8;
  depth: number;

  constructor(bounds: any, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  subdivide() {
    const { minX, maxX, minY, maxY, minZ, maxZ } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;

    this.nodes = [
      new Octree({ minX, maxX: midX, minY, maxY: midY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY, maxY: midY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX, maxX: midX, minY: midY, maxY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY: midY, maxY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX, maxX: midX, minY, maxY: midY, minZ: midZ, maxZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY, maxY: midY, minZ: midZ, maxZ }, this.depth + 1),
      new Octree({ minX, maxX: midX, minY: midY, maxY, minZ: midZ, maxZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY: midY, maxY, minZ: midZ, maxZ }, this.depth + 1),
    ];
  }

  insert(obj: any) {
    if (!this.intersects(obj.bounds)) return false;

    if (this.nodes.length === 0 && this.objects.length < this.capacity) {
      this.objects.push(obj);
      return true;
    }

    if (this.nodes.length === 0) this.subdivide();

    for (const node of this.nodes) {
      if (node.insert(obj)) return true;
    }

    this.objects.push(obj);
    return true;
  }

  intersects(b: any) {
    return !(b.minX > this.bounds.maxX || b.maxX < this.bounds.minX ||
             b.minY > this.bounds.maxY || b.maxY < this.bounds.minY ||
             b.minZ > this.bounds.maxZ || b.maxZ < this.bounds.minZ);
  }

  query(range: any, result: any[] = []) {
    if (!this.intersects(range)) return result;

    for (const obj of this.objects) {
      if (obj.bounds.minX < range.maxX && obj.bounds.maxX > range.minX &&
          obj.bounds.minY < range.maxY && obj.bounds.maxY > range.minY &&
          obj.bounds.minZ < range.maxZ && obj.bounds.maxZ > range.minZ) {
        result.push(obj);
      }
    }

    for (const node of this.nodes) {
      node.query(range, result);
    }

    return result;
  }
}

export function performStabilityCheck(blocks: any[], parts: any) {
  const EPSILON = 0.05;
  const supported = new Set<string>();
  
  const blockData = blocks.map(b => {
    const part = PART_MAP.get(b.partId);
    if (!part) return null;
    const boxes = getCollisionBoxes(b.position, part, b.rotation);
    // Combined bounds for the whole block
    const bounds = {
      minX: Math.min(...boxes.map(bx => bx.minX)),
      maxX: Math.max(...boxes.map(bx => bx.maxX)),
      minY: Math.min(...boxes.map(bx => bx.minY)),
      maxY: Math.max(...boxes.map(bx => bx.maxY)),
      minZ: Math.min(...boxes.map(bx => bx.minZ)),
      maxZ: Math.max(...boxes.map(bx => bx.maxZ))
    };
    return { id: b.id, part, boxes, bounds };
  }).filter(Boolean) as any[];

  // 1. Find overall bounds for Octree
  if (blockData.length === 0) return { supportedIds: new Set(), fallingIds: new Set() };
  
  const worldBounds = {
    minX: Math.min(...blockData.map(d => d.bounds.minX)) - 1,
    maxX: Math.max(...blockData.map(d => d.bounds.maxX)) + 1,
    minY: -1,
    maxY: Math.max(...blockData.map(d => d.bounds.maxY)) + 1,
    minZ: Math.min(...blockData.map(d => d.bounds.minZ)) - 1,
    maxZ: Math.max(...blockData.map(d => d.bounds.maxZ)) + 1
  };

  const tree = new Octree(worldBounds);
  for (const b of blockData) tree.insert(b);

  // 2. Identify grounded blocks
  for (const b of blockData) {
    if (b.part.type === 'slope_inv') continue;
    for (const box of b.boxes) {
      if (Math.abs(box.minY - (-0.5)) < EPSILON) {
        supported.add(b.id);
        break;
      }
    }
  }

  // 3. Connection mapping using Octree
  const edges = new Map<string, Set<string>>();
  for (const b of blockData) edges.set(b.id, new Set());

  const hasStudsOnTop = (type: string) => ['box', 'brick', 'plate', 'corner', 'cylinder', 'cone', 'slope_inv', 'jumper', 'jumper_round', 'slope_2studs'].includes(type);
  const hasHolesOnBottom = (type: string) => ['box', 'brick', 'plate', 'corner', 'cylinder', 'slope', 'tile', 'jumper', 'jumper_round', 'cone', 'slope_inv', 'wedge_plate'].includes(type);

  for (const b1 of blockData) {
    // Check for support above b1
    const queryRange = {
      minX: b1.bounds.minX - EPSILON, 
      maxX: b1.bounds.maxX + EPSILON,
      minY: b1.bounds.maxY - EPSILON, 
      maxY: b1.bounds.maxY + EPSILON * 2,
      minZ: b1.bounds.minZ - EPSILON, 
      maxZ: b1.bounds.maxZ + EPSILON
    };
    
    const possibleAbove = tree.query(queryRange);
    for (const b2 of possibleAbove) {
      if (b1.id === b2.id) continue;
      
      let connected = false;
      for (const box1 of b1.boxes) {
        for (const box2 of b2.boxes) {
          const overlapXZ = box1.minX < box2.maxX - EPSILON &&
                            box1.maxX > box2.minX + EPSILON &&
                            box1.minZ < box2.maxZ - EPSILON &&
                            box1.maxZ > box2.minZ + EPSILON;
          if (overlapXZ && Math.abs(box2.minY - box1.maxY) < EPSILON) {
             if (hasStudsOnTop(b1.part.type) && hasHolesOnBottom(b2.part.type)) {
                connected = true;
                break;
             }
          }
        }
        if (connected) break;
      }
      
      if (connected) {
        edges.get(b1.id)?.add(b2.id);
        edges.get(b2.id)?.add(b1.id);
      }
    }
  }

  // 4. Reachability propagation
  const queue = Array.from(supported);
  while (queue.length > 0) {
    const currId = queue.shift()!;
    const neighbors = edges.get(currId);
    if (neighbors) {
      for (const nextId of neighbors) {
        if (!supported.has(nextId)) {
          supported.add(nextId);
          queue.push(nextId);
        }
      }
    }
  }

  const fallingIds = new Set<string>();
  for (const b of blocks) {
    if (!supported.has(b.id)) fallingIds.add(b.id);
  }
  
  return { supportedIds: supported, fallingIds };
}

/**
 * Component for animating a group of falling blocks.
 * Uses useFrame for direct Three.js position/rotation updates to ensure high performance.
 */
const SceneSettings = ({ isNightMode, intensity }: { isNightMode: boolean, intensity: number }) => {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    const bgColor = isNightMode ? '#12121c' : '#f3f4f6';
    gl.setClearColor(bgColor);
    scene.background = new THREE.Color(bgColor);
    
    if (scene) {
       (scene as any).environmentIntensity = intensity;
       scene.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
             const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
             materials.forEach((m: any) => {
                if (m.envMapIntensity !== undefined) m.envMapIntensity = intensity;
             });
          }
       });
    }
  }, [isNightMode, gl, scene, intensity]);

  // Lock environment intensity to prevent it being overwritten by Environment presets
  useFrame(() => {
    if (scene && (scene as any).environmentIntensity !== intensity) {
      (scene as any).environmentIntensity = intensity;
    }
  });

  return null;
}

const LED_MARKER_GEOMETRY = new THREE.RingGeometry(0.13, 0.16, 32);

const LEDMarker = ({ position, rotation, color }: any) => {
  return (
    <mesh position={position} rotation={rotation} geometry={LED_MARKER_GEOMETRY}>
      <meshBasicMaterial 
        color={color} 
        transparent
        opacity={0.9}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
        depthTest={true}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

const FallingGroup = React.memo(({ group, geometries, onRemove }: any) => {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const velocities = useRef<number[]>([]);
  const startTime = useRef(Date.now());
  const initializedMeshes = useRef(new Set<string>());
  const { strength, mode, blocks } = group;

  // Initialize initial velocities if needed
  if (velocities.current.length === 0 && blocks.length > 0) {
    velocities.current = blocks.map(() => (mode === 'explosion' ? 3.0 : 0.0));
  }

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1); // Cap delta to prevent tunneling through large leaps
    const timeElapsed = Date.now() - startTime.current;

    blocks.forEach((b: any, i: number) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;

      // Calculate new velocity and position
      velocities.current[i] += strength * d;
      const move = velocities.current[i] * d;

      if (mode === 'up') {
        // Anti-Grav mode: Simple upward linear translation
        mesh.position.y += move;
      } else if (mode === 'explosion' && b.vector) {
        // Explosion mode: Translate along pre-calculated outward vector
        mesh.position.x += b.vector[0] * move;
        mesh.position.y += b.vector[1] * move;
        mesh.position.z += b.vector[2] * move;
      }
      
      // Add some tumbling rotation for realism
      mesh.rotation.x += d * 0.2;
      mesh.rotation.z += d * 0.1;
    });

    // Cleanup: Remove the visual representation after the animation duration (8s)
    if (timeElapsed > 8000) {
      onRemove(group.id);
    }
  });

  return (
    <group>
      {blocks.map((b: any, i: number) => {
        const geoData = geometries[b.partId] || geometries['brick_2x2'];
        const colorMeta = (COLOR_MAP.get(b.color) || { value: b.color }) as any;
        
        const isTranslucent = b.material === 'trans' || (b.material === undefined && colorMeta.isTranslucent);
        const isGlow = (b.partId.startsWith('logic_')) && (b.material === 'glow' || (b.material === undefined && colorMeta.isGlow));
        const isMetal = b.material === 'metal';
        
        return (
          <group key={b.id}>
            <mesh
              ref={(el) => {
                meshRefs.current[i] = el;
                if (el && !initializedMeshes.current.has(b.id)) {
                  const p = normalizePos(b.position);
                  el.position.set(p[0], p[1], p[2]);
                  initializedMeshes.current.add(b.id);
                }
              }}
              rotation={[0, b.rotation * (Math.PI / 2), 0]}
              geometry={geoData.visual}
              castShadow
              receiveShadow
              frustumCulled={false}
            >
          <meshPhysicalMaterial 
             color={b.color} 
             roughness={isMetal ? 0.1 : 0.25} 
             roughnessMap={roughnessMap}
             normalMap={normalMap}
             normalScale={[0.8, 0.8]}
             metalness={isMetal ? 0.9 : 0.0} 
             clearcoat={isMetal ? 1.0 : 0.4} 
             clearcoatRoughness={isMetal ? 0.05 : 0.2} 
             transparent={isTranslucent}
             opacity={isTranslucent ? (colorMeta.opacity ?? 0.5) : 1}
             emissive={isGlow ? new THREE.Color(colorMeta.emissive || b.color) : new THREE.Color(0,0,0)}
             emissiveIntensity={isGlow ? 12.0 : 0}
             depthWrite={!isTranslucent}
             side={THREE.DoubleSide}
          />
            </mesh>
            {colorMeta.isGlow && (
               <group 
                 position={normalizePos(b.position) as any}
                 rotation={[0, b.rotation * (Math.PI / 2), 0]}
               >
                  <LEDMarker position={[0, 0, (geoData.size[1]*0.5)/2 + 0.002]} color={colorMeta.emissive} />
                  <LEDMarker position={[0, 0, -(geoData.size[1]*0.5)/2 - 0.002]} rotation={[0, Math.PI, 0]} color={colorMeta.emissive} />
                  <LEDMarker position={[(geoData.size[0]*0.5)/2 + 0.002, 0, 0]} rotation={[0, Math.PI/2, 0]} color={colorMeta.emissive} />
                  <LEDMarker position={[-(geoData.size[0]*0.5)/2 - 0.002, 0, 0]} rotation={[0, -Math.PI/2, 0]} color={colorMeta.emissive} />
               </group>
            )}
          </group>
        );
      })}
    </group>
  );
});

/**
 * Visual studs on the baseplate for aesthetic depth.
 * Uses InstancedMesh to render thousands of studs as a single draw call.
 */
function BaseplateStuds({ isNightMode }: { isNightMode: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const size = 32;
  const count = (size * 2) * (size * 2);
  
  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const temp = new THREE.Object3D();
    const halfSize = size;
    let idx = 0;
    for (let x = -halfSize; x < halfSize; x++) {
      for (let z = -halfSize; z < halfSize; z++) {
        temp.position.set(x * 0.5 + 0.25, -0.45, z * 0.5 + 0.25);
        temp.updateMatrix();
        meshRef.current.setMatrixAt(idx++, temp.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} receiveShadow>
      <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
      <meshStandardMaterial 
        color={isNightMode ? "#1a1a25" : "#d1d5db"} 
        roughness={isNightMode ? 0.7 : 0.85} 
        roughnessMap={studFloorRoughnessMap}
        normalMap={studFloorNormalMap}
        normalScale={[0.8, 0.8]}
        onBeforeCompile={randomUVsOnCompile}
      />
    </instancedMesh>
  );
}

/**
 * Orchestrates the rendering of all blocks by grouping them by their part types.
 * This allows us to use one InstancedMesh per part type for maximum efficiency.
 */
const InstancedBlocksGroup = React.memo(({ 
  blocks, geometries, showEdges, addBlock, removeBlock, updateGhost, 
  snapToGrid, currentRotation, isDrag, currentPart, pointerDownPos,
  selectedIds, onSelect, isCtrlPressed, isShiftPressed, logicState, toggleBlockMeta, transformOffset,
  mouseMode, currentColor, updateBlockColor
}: any) => {
  const blocksByMaterial = useMemo(() => {
    const map = new Map<string, { partId: string, list: any[], materialProps: any }>();
    
    blocks.forEach((b: any) => {
      if (b.partId === 'logic_battery') return; // rendering separately
      let colorMeta = (COLOR_MAP.get(b.color) || { value: b.color }) as any;
      
      let isTranslucent = b.material === 'trans' || (b.material === undefined && colorMeta.isTranslucent);
      let isGlow = (b.partId.startsWith('logic_')) && (b.material === 'glow' || (b.material === undefined && colorMeta.isGlow));
      let isMetal = b.material === 'metal';
      
      let opacity = isTranslucent ? (colorMeta.opacity ?? 0.5) : 1;
      let emissiveColor = colorMeta.emissive || isGlow ? new THREE.Color(colorMeta.emissive || b.color) : new THREE.Color(0, 0, 0);
      let baseColor = b.color;
      let matKeyColor = b.color;

      const power = logicState[b.id] || 0;
      const isPowered = power > 0;

      let emissiveIntensity = isGlow && isPowered ? 4.0 : 0;

      if (b.partId === 'logic_led') {
         isTranslucent = b.material === 'trans' || (b.material === undefined && colorMeta.isTranslucent);
         opacity = isTranslucent ? (colorMeta.opacity ?? 1.0) : 1.0;
         isGlow = true;
         baseColor = b.color;
         emissiveColor = new THREE.Color(colorMeta.emissive || b.color);
         emissiveIntensity = isPowered ? 5.0 : 0;
      } else if (b.partId === 'logic_wire') {
         isTranslucent = false;
         isGlow = true;
         opacity = 1.0;
         emissiveColor = new THREE.Color(isPowered ? '#ff0000' : '#000000');
         baseColor = isPowered ? '#ff0000' : '#262626';
         matKeyColor = 'wire';
         emissiveIntensity = isPowered ? 1.2 : 0;
      }

      const materialType = isTranslucent && isGlow ? (isPowered ? 'TG_ON' : 'TG_OFF') : isTranslucent ? 'T' : isMetal ? 'M' : isGlow ? (isPowered ? 'G_ON' : 'G_OFF') : 'O';
      const key = `${b.partId}_${materialType}_${matKeyColor}`;
      
      if (!map.has(key)) {
        map.set(key, { 
          partId: b.partId, 
          list: [], 
          materialProps: {
            transparent: isTranslucent || false,
            opacity: opacity,
            emissive: emissiveColor,
            emissiveIntensity: emissiveIntensity,
            toneMapped: !isGlow,
            color: baseColor,
            metalness: isMetal ? 0.9 : 0.0,
            roughness: isMetal ? 0.1 : 0.25,
            clearcoat: isMetal ? 1.0 : 0.4
          }
        });
      }
      map.get(key)!.list.push(b);
    });
    return map;
  }, [blocks, logicState]);

  return (
    <>
      {Array.from(blocksByMaterial.entries()).map(([key, data]) => (
        <InstancedPart 
           key={key}
           partId={data.partId}
           blocks={data.list}
           materialProps={data.materialProps}
           showEdges={showEdges}
           geometries={geometries}
           addBlock={addBlock}
           removeBlock={removeBlock}
           updateGhost={updateGhost}
           snapToGrid={snapToGrid}
           currentRotation={currentRotation}
           isDrag={isDrag}
           currentPart={currentPart}
           pointerDownPos={pointerDownPos}
           selectedIds={selectedIds}
           onSelect={onSelect}
           isCtrlPressed={isCtrlPressed}
           isShiftPressed={isShiftPressed}
           logicState={logicState}
           toggleBlockMeta={toggleBlockMeta}
           transformOffset={transformOffset}
           mouseMode={mouseMode}
           currentColor={currentColor}
           updateBlockColor={updateBlockColor}
        />
      ))}
    </>
  );
});

const InstancedLedMarkers = ({ blocks, geoData, color, intensity }: any) => {
   const meshRef = useRef<THREE.InstancedMesh>(null);
   const count = blocks.length * 4;
   
   const finalColor = useMemo(() => {
      const c = new THREE.Color(color);
      if (intensity > 1.0) c.multiplyScalar(intensity * 0.5); // Boost color for bloom
      return c;
   }, [color, intensity]);

   useLayoutEffect(() => {
      const mesh = meshRef.current;
      if (!mesh || !geoData || !geoData.size) return;

      const dummy = new THREE.Object3D();
      const localDummy = new THREE.Object3D();
      const actualSize = geoData.size.map((s: number) => s * 0.5);
      
      blocks.forEach((b: any, i: number) => {
         const p = normalizePos(b.position);
         const baseRotation = b.rotation * (Math.PI / 2);
         
         const markerConfigs = [
            { pos: [0, 0, actualSize[1]/2 + 0.002], rot: [0, 0, 0] },
            { pos: [0, 0, -actualSize[1]/2 - 0.002], rot: [0, Math.PI, 0] },
            { pos: [actualSize[0]/2 + 0.002, 0, 0], rot: [0, Math.PI/2, 0] },
            { pos: [-actualSize[0]/2 - 0.002, 0, 0], rot: [0, -Math.PI/2, 0] },
         ];

         dummy.position.set(p[0], p[1], p[2]);
         dummy.rotation.set(0, baseRotation, 0);
         dummy.updateMatrix();

         markerConfigs.forEach((m, mi) => {
            localDummy.position.set(m.pos[0], m.pos[1], m.pos[2]);
            localDummy.rotation.set(m.rot[0], m.rot[1], m.rot[2]);
            localDummy.updateMatrix();
            
            const finalMatrix = dummy.matrix.clone().multiply(localDummy.matrix);
            mesh.setMatrixAt(i * 4 + mi, finalMatrix);
         });
      });

      mesh.instanceMatrix.needsUpdate = true;
   }, [blocks, geoData, color]);

   return (
      <instancedMesh 
        ref={meshRef} 
        args={[LED_MARKER_GEOMETRY, undefined, count]} 
        frustumCulled={false}
      >
         <meshBasicMaterial 
            color={finalColor} 
            transparent
            opacity={0.9} 
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            depthTest={true}
            depthWrite={false}
            toneMapped={false}
         />
      </instancedMesh>
   );
};

const InstancedPart = ({ 
  partId, 
  blocks, 
  geometries, 
  addBlock, 
  removeBlock, 
  updateGhost, 
  snapToGrid, 
  currentRotation, 
  isDrag, 
  currentPart, 
  materialProps, 
  pointerDownPos,
  selectedIds,
  onSelect,
  isCtrlPressed,
  isShiftPressed,
  transformOffset,
  logicState,
  toggleBlockMeta,
  mouseMode,
  currentColor,
  updateBlockColor,
  showEdges
}: any) => {
  const geoData = geometries[partId] || geometries['brick_2x2'];
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geoData.edges || geoData.visual, 30), [geoData.edges, geoData.visual]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const highlightColor = new THREE.Color('#4dabf7'); // Light blue selection highlight

    blocks.forEach((b: any, i: number) => {
      const p = normalizePos(b.position);
      const isSelected = selectedIds.includes(b.id);
      
      const offsetX = isSelected && transformOffset ? transformOffset[0] : 0;
      const offsetY = isSelected && transformOffset ? transformOffset[1] : 0;
      const offsetZ = isSelected && transformOffset ? transformOffset[2] : 0;

      dummy.position.set(p[0] + offsetX, p[1] + offsetY, p[2] + offsetZ);
      dummy.rotation.set(0, b.rotation * (Math.PI / 2), 0);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
      
      let blockColor = b.color;
      if (b.partId === 'logic_wire') {
         const power = logicState[b.id] || 0;
         blockColor = power > 0 ? '#ff0000' : '#262626';
      } else if (b.partId === 'logic_battery') {
         blockColor = b.meta?.isOn ? '#33cc33' : '#cc3333';
      }
      
      if (isSelected) {
        // Blend selection color slightly
        color.set(blockColor).lerp(highlightColor, 0.4);
      } else {
        color.set(blockColor);
      }
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    
    mesh.computeBoundingSphere();
    if (mesh.geometry) {
       mesh.geometry.computeBoundingBox();
       mesh.geometry.computeBoundingSphere();
    }
  }, [blocks, selectedIds, transformOffset, logicState]);

  useFrame(({ clock }) => {
     if (partId === 'logic_wire' && meshRef.current) {
        const mesh = meshRef.current;
        const color = new THREE.Color();
        const highlightColor = new THREE.Color('#4dabf7');
        const t = clock.elapsedTime * 3; // pulse speed
        const pulseAmt = Math.pow((Math.sin(t) * 0.5 + 0.5), 3.0); // Stays closer to 0 (dark red) longer

        let needsUpdate = false;
        let isPoweredGroup = false;

        blocks.forEach((b: any, i: number) => {
           const power = logicState[b.id] || 0;
           if (power > 0) {
              isPoweredGroup = true;
              const baseColor = new THREE.Color('#800000'); // dark red
              const dimColor = new THREE.Color('#050000'); // nearly black
              color.copy(dimColor).lerp(baseColor, pulseAmt);
              
              const isSelected = selectedIds.includes(b.id);
              if (isSelected) {
                 color.lerp(highlightColor, 0.4);
              }
              mesh.setColorAt(i, color);
              needsUpdate = true;
           }
        });
        if (needsUpdate && mesh.instanceColor) {
           mesh.instanceColor.needsUpdate = true;
        }

        // Pulse the actual emissiveness of the material for the powered group
        if (isPoweredGroup && mesh.material) {
           const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshPhysicalMaterial;
           mat.emissive.lerpColors(new THREE.Color('#050000'), new THREE.Color('#800000'), pulseAmt);
           mat.emissiveIntensity = 2.0; // Boosted since dark red is very dark
        }
     }
  });

  const handlePointerEvent = useCallback((e: any, type: 'move' | 'up' | 'context') => {
    e.stopPropagation();
    
    if (e.instanceId === undefined && type !== 'move') {
      return;
    }
    
    const block = e.instanceId !== undefined ? blocks[e.instanceId] : null;

    // Calculate grid setup for ghost and building
    let gridPos: number[] | null = null;
    if (block) {
      const rotAngle = block.rotation * (Math.PI / 2);
      const n = (e.face?.normal?.clone() || new THREE.Vector3(0, 1, 0));
      n.applyEuler(new THREE.Euler(0, rotAngle, 0));
      const isJumper = block.partId.includes('jumper');
      const allowHalfStud = isCtrlPressed.current || isJumper;
      gridPos = getGridPos(e.point, n, currentPart.size, snapToGrid, currentRotation, allowHalfStud);
    }
    
    if (type === 'move') {
       if (gridPos && mouseMode === 'build') {
         updateGhost(true, gridPos);
       } else {
         updateGhost(false);
       }
       return;
    }

    const dragging = isDrag(e);
    if (dragging) return;

    // RIGHT CLICK
    if (type === 'context') {
       if (e.nativeEvent && e.nativeEvent.preventDefault) e.nativeEvent.preventDefault();
       if (!block || dragging) return;
       
       if (mouseMode === 'build') {
         if (selectedIds.includes(block.id)) {
            selectedIds.forEach((id: string) => removeBlock(id));
         } else {
            removeBlock(block.id);
         }
         updateGhost(false);
       } else if (mouseMode === 'select') {
         onSelect((prev: string[]) => prev.filter((id) => id !== block.id));
       }
       return;
    }

    if (e.button === 2) return;

    // LEFT CLICK
    if (type === 'up' && e.button === 0) {
       if (mouseMode === 'interact') {
          if (block && block.partId === 'logic_battery') {
             if (toggleBlockMeta) toggleBlockMeta(block.id, 'isOn');
          }
       } else if (mouseMode === 'select') {
          if (block) {
             onSelect((prev: string[]) => prev.includes(block.id) ? prev.filter((id) => id !== block.id) : [...prev, block.id]);
          }
       } else if (mouseMode === 'paint') {
          if (block && updateBlockColor) {
             updateBlockColor(block.id, currentColor);
          }
       } else if (mouseMode === 'build') {
          if (gridPos && !(window as any)._shiftIsActive) {
             addBlock(gridPos);
          }
       }
    }
  }, [blocks, addBlock, removeBlock, updateGhost, snapToGrid, currentRotation, currentPart, isDrag, selectedIds, mouseMode, currentColor, updateBlockColor, toggleBlockMeta, onSelect]);

  return (
    <group>
      <instancedMesh 
        ref={meshRef} 
        args={[geoData.visual, undefined, 2000]} 
        count={blocks.length} 
        castShadow 
        receiveShadow
        frustumCulled={false}
        onPointerUp={(e) => handlePointerEvent(e, 'up')}
        onPointerMove={(e) => handlePointerEvent(e, 'move')}
        onPointerDown={(e) => {
          const cx = e.nativeEvent?.clientX ?? e.clientX ?? 0;
          const cy = e.nativeEvent?.clientY ?? e.clientY ?? 0;
          if (pointerDownPos) {
            pointerDownPos.current = { x: cx, y: cy };
          }
          e.stopPropagation();
        }}
        onContextMenu={(e) => handlePointerEvent(e, 'context')}
        onPointerOut={(e) => { e.stopPropagation(); updateGhost(false); }}
      >
        <meshPhysicalMaterial 
          {...materialProps}
          roughness={materialProps.roughness ?? 0.25}
          polygonOffset={true}
          polygonOffsetFactor={3}
          polygonOffsetUnits={3}
          roughnessMap={roughnessMap}
          normalMap={normalMap}
          normalScale={[0.6, 0.6]}
          metalness={0.0}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
          depthWrite={!materialProps.transparent}
          side={THREE.DoubleSide}
          onBeforeCompile={randomUVsOnCompile}
        />
      </instancedMesh>

      {showEdges && blocks.map((b: any) => {
         const p = normalizePos(b.position);
         const isSelected = selectedIds.includes(b.id);
         const offsetX = isSelected && transformOffset ? transformOffset[0] : 0;
         const offsetY = isSelected && transformOffset ? transformOffset[1] : 0;
         const offsetZ = isSelected && transformOffset ? transformOffset[2] : 0;

         return (
            <lineSegments 
               key={`edge-${b.id}`} 
               position={[p[0] + offsetX, p[1] + offsetY, p[2] + offsetZ]} 
               rotation={[0, b.rotation * (Math.PI / 2), 0]} 
               geometry={edgesGeo}
            >
               <lineBasicMaterial color="#000000" opacity={0.6} transparent depthTest={true} />
            </lineSegments>
         );
      })}

      {partId.includes('led') && (
         <InstancedLedMarkers blocks={blocks} geoData={geoData} color={materialProps.emissiveIntensity > 0 ? materialProps.emissive : new THREE.Color('#999999')} intensity={materialProps.emissiveIntensity} />
      )}
      {partId === 'logic_wire' && materialProps.emissiveIntensity > 0 && blocks.map((b: any) => {
         const p = normalizePos(b.position);
         return (
             <FallingSparks key={`sparkle-${b.id}`} position={[p[0], p[1] + 0.2, p[2]]} color="#ff8833" />
         );
      })}
    </group>
  );
};

const FallingSparks = ({ position, color = "#ffaa55" }: any) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 1;
  
  const sparkTex = useMemo(() => {
     const canvas = document.createElement('canvas');
     canvas.width = 64;
     canvas.height = 64;
     const ctx = canvas.getContext('2d');
     if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
     }
     const tex = new THREE.CanvasTexture(canvas);
     return tex;
  }, []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
       pos: new THREE.Vector3(0, 0, 0),
       vel: new THREE.Vector3((Math.random() - 0.5) * 2.0, Math.random() * 0.5 + 0.1, (Math.random() - 0.5) * 2.0),
       life: Math.random() * 2.0,
       maxLife: Math.random() * 0.5 + 0.3
    }));
  }, [count]);
  
  const positions = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(delta, 0.1);
    for (let i = 0; i < count; i++) {
        let p = data[i];
        p.life += dt;
        p.vel.y -= dt * 3.0; // Gravity
        
        p.pos.add(p.vel.clone().multiplyScalar(dt));
        
        // Floor collision or end of life
        if (p.life > p.maxLife || (position[1] + p.pos.y) < -0.5) {
            p.life = 0;
            p.pos.set(0, 0, 0);
            p.vel.set((Math.random() - 0.5) * 2.0, Math.random() * 0.5 + 0.1, (Math.random() - 0.5) * 2.0);
        }
        
        positions[i*3] = p.pos.x;
        positions[i*3+1] = p.pos.y;
        positions[i*3+2] = p.pos.z;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.06} map={sparkTex} color={color} transparent opacity={1.0} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const BatteriesGroup = React.memo(({ blocks, geometries, showEdges, selectedIds, transformOffset, toggleBlockMeta, mouseMode, onSelect, isDrag, removeBlock }: any) => {
  const batteryBlocks = blocks.filter((b: any) => b.partId === 'logic_battery');
  
  const batteryEdgesGeo = useMemo(() => {
    return geometries['logic_battery']?.edges ? new THREE.EdgesGeometry(geometries['logic_battery'].edges) : null;
  }, [geometries]);

  if (batteryBlocks.length === 0) return null;

  return (
    <group>
      {batteryBlocks.map((b: any) => {
        const isSelected = selectedIds.includes(b.id);
        const offsetX = isSelected && transformOffset ? transformOffset[0] : 0;
        const offsetY = isSelected && transformOffset ? transformOffset[1] : 0;
        const offsetZ = isSelected && transformOffset ? transformOffset[2] : 0;
        
        const pos = normalizePos(b.position);
        
        return (
          <group 
            key={b.id} 
            position={[pos[0] + offsetX, pos[1] + offsetY, pos[2] + offsetZ]}
            rotation={[0, b.rotation * (Math.PI / 2), 0]}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (isDrag(e)) return;
              if (e.button === 2 && removeBlock) {
                 removeBlock(b.id);
                 return;
              }
              if (mouseMode === 'interact') {
                toggleBlockMeta(b.id, 'isOn');
              } else if (mouseMode === 'select') {
                onSelect((prev: string[]) => prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]);
              }
            }}
            onPointerEnter={(e) => {
              e.stopPropagation();
              if (mouseMode === 'interact') {
                document.body.style.cursor = 'pointer';
              }
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              if (mouseMode === 'interact') {
                document.body.style.cursor = 'auto';
              }
            }}
          >
            {/* Base (Bottom 2/3) - Black */}
            <mesh position={[0, -0.1, 0]} castShadow>
              <boxGeometry args={[1, 0.4, 1]} />
              <meshStandardMaterial polygonOffset={true} polygonOffsetFactor={3} polygonOffsetUnits={3} color="#262626" roughness={0.4} metalness={0.8} roughnessMap={roughnessMap} normalMap={normalMap} normalScale={[0.8, 0.8]} onBeforeCompile={randomUVsOnCompile} />
            </mesh>
            
            {/* Top (Top 1/3) - Copper */}
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[1, 0.2, 1]} />
              <meshStandardMaterial polygonOffset={true} polygonOffsetFactor={3} polygonOffsetUnits={3} color="#ffcca1" roughness={0.3} metalness={0.9} roughnessMap={roughnessMap} normalMap={normalMap} normalScale={[0.8, 0.8]} onBeforeCompile={randomUVsOnCompile} />
            </mesh>

            {/* Studs if desired - Copper */}
            <group position={[0, 0.3, 0]}>
               { [[0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]].map((studPos, i) => (
                  <mesh key={i} position={[studPos[0], STUD_HEIGHT/2, studPos[1]]} castShadow>
                    <cylinderGeometry args={[STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16]} />
                    <meshStandardMaterial polygonOffset={true} polygonOffsetFactor={3} polygonOffsetUnits={3} color="#ffcca1" roughness={0.3} metalness={0.9} roughnessMap={roughnessMap} normalMap={normalMap} normalScale={[0.8, 0.8]} onBeforeCompile={randomUVsOnCompile} />
                  </mesh>
               ))}
               <mesh position={[0, 0.05, 0]}>
                 <cylinderGeometry args={[0.04, 0.04, 0.11, 16]} />
                 <meshStandardMaterial 
                   color={b.meta?.isOn ? "#33ff33" : "#444444"} 
                   emissive={b.meta?.isOn ? "#33ff33" : "#000000"} 
                   emissiveIntensity={b.meta?.isOn ? 5 : 0} 
                 />
               </mesh>
            </group>
            {isSelected && <mesh position={[0,0,0]}><boxGeometry args={[1.02, 0.62, 1.02]} /><meshBasicMaterial color="#4dabf7" wireframe transparent opacity={0.6} /></mesh>}
            {showEdges && batteryEdgesGeo && (
               <lineSegments raycast={() => null} geometry={batteryEdgesGeo}>
                  <lineBasicMaterial color="#000000" opacity={0.6} transparent depthTest={true} />
               </lineSegments>
            )}
          </group>
        );
      })}
    </group>
  );
});

export default function App() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const historyRef = useRef<any[][]>([[]]);
  const historyIndexRef = useRef(0);
  
  const updateBlocks = useCallback((newBlocks: any[]) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(newBlocks);
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setBlocks(newBlocks);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      setBlocks(historyRef.current[historyIndexRef.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      setBlocks(historyRef.current[historyIndexRef.current]);
    }
  }, []);

  /**
   * Loads a complete pre-defined template into the workspace.
   */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isShiftPressed = useRef(false);
  const isCtrlPressed = useRef(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        isCtrlPressed.current = true;
      }
      if (e.key === 'Shift') {
        isShiftPressed.current = true;
      }
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        isCtrlPressed.current = false;
      }
      if (e.key === 'Shift') {
        isShiftPressed.current = false;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, []);

  const parseSaveFile = useCallback((content: string) => {
    const lines = content.split('\n');
    const newBlocks: any[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('-') || trimmed.startsWith('PART-ID') || trimmed.startsWith('BRICKCRAFT')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 6) {
        const px = parseFloat(parts[1]);
        const py = parseFloat(parts[2]);
        const pz = parseFloat(parts[3]);
        const rot = parseInt(parts[4], 10);
        const color = parts[5];
        const material = parts[6] || 'solid';
        if (isNaN(px) || isNaN(py) || isNaN(pz)) continue;
        newBlocks.push({
          id: Math.random().toString(36).substring(2, 9),
          partId: parts[0],
          position: [px / 2 - 32, py - 0.5, pz / 2 - 32], 
          rotation: isNaN(rot) ? 0 : rot,
          color: color,
          material: material
        });
      }
    }
    return newBlocks;
  }, []);

  const onSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const duplicateSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selectedBlocks = blocks.filter(b => selectedIds.includes(b.id));
    const newBlocksToAdd = selectedBlocks.map(b => ({
      ...b,
      id: Math.random().toString(36).substring(2, 9),
      position: [b.position[0], b.position[1] + 1, b.position[2]] // Shift up
    }));
    updateBlocks([...blocks, ...newBlocksToAdd]);
    setSelectedIds(newBlocksToAdd.map(b => b.id));
    setSimulationMessage({ text: `${newBlocksToAdd.length} Steine dupliziert`, type: 'success' });
    setTimeout(() => setSimulationMessage(null), 3000);
  }, [selectedIds, blocks, updateBlocks]);

  const loadTemplate = useCallback(async (template: any) => {
    try {
      const response = await fetch(template.path);
      const text = await response.text();
      const newBlocks = parseSaveFile(text).map((b, i) => ({
        ...b,
        id: `template-${template.id}-${i}-${Date.now()}`
      }));
      if (newBlocks.length > 0) {
        updateBlocks(newBlocks);
        setSimulationMessage({ text: `${template.name} geladen!`, type: 'success' });
        setTimeout(() => setSimulationMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to load template file:", err);
    }
  }, [updateBlocks, parseSaveFile]);

  const [transformOffset, setTransformOffset] = useState<[number, number, number] | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const transformDummyRef = useRef<THREE.Group>(null);
  const initialPositionsRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    if (selectedIds.length > 0 && transformDummyRef.current && !isTransforming) {
      const selectedBlocks = blocksRef.current.filter(b => selectedIds.includes(b.id));
      if (selectedBlocks.length > 0) {
        let cx = 0, cy = 0, cz = 0;
        selectedBlocks.forEach(b => {
          cx += b.position[0];
          cy += b.position[1];
          cz += b.position[2];
        });
        cx /= selectedBlocks.length;
        cy /= selectedBlocks.length;
        cz /= selectedBlocks.length;
        transformDummyRef.current.position.set(cx, cy, cz);
        transformDummyRef.current.userData.initialPosition = [cx, cy, cz];
      }
    }
  }, [selectedIds, isTransforming]);

  const [mouseMode, setMouseMode] = useState<'interact' | 'select' | 'build' | 'paint'>('interact');
  const [currentColor, setCurrentColor] = useState(COLORS[0].value);
  const [currentMaterial, setCurrentMaterial] = useState('solid');
  const [currentPartId, setCurrentPartId] = useState('brick_2x2');
  const [isPlate, setIsPlate] = useState(false);

  const [logicState, setLogicState] = useState<Record<string, number>>({});
  
  const activeGlowBlocks = useMemo(() => {
     return blocks.filter((b: any) => {
         if (b.partId === 'logic_led') return logicState[b.id] > 0;
         if (b.partId === 'logic_wire' || b.partId === 'logic_battery') return false;
         return COLOR_MAP.get(b.color)?.isGlow;
     }).slice(0, 30);
  }, [blocks, logicState]);

  useEffect(() => {
    const logicBlocks = blocks.filter(b => b.partId.startsWith('logic_'));
    const nextState: Record<string, number> = {};
    
    // Batteries that are active get full power (15)
    logicBlocks.forEach(b => {
      if (b.partId === 'logic_battery' && b.meta?.isOn) {
        nextState[b.id] = 15;
      }
    });

    let queue = logicBlocks.filter(b => nextState[b.id] === 15);
    
    while(queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const currentPower = nextState[current.id];
      if (currentPower <= 1) continue;
      
      logicBlocks.forEach(neighbor => {
        if (neighbor.id === current.id || neighbor.partId === 'logic_battery') return;
        
        const cPart = PART_MAP.get(current.partId);
        const nPart = PART_MAP.get(neighbor.partId);
        if (!cPart || !nPart) return;

        const cxSize = (current.rotation % 2 === 1 ? cPart.size[1] : cPart.size[0]) * 0.5;
        const czSize = (current.rotation % 2 === 1 ? cPart.size[0] : cPart.size[1]) * 0.5;
        const nxSize = (neighbor.rotation % 2 === 1 ? nPart.size[1] : nPart.size[0]) * 0.5;
        const nzSize = (neighbor.rotation % 2 === 1 ? nPart.size[0] : nPart.size[1]) * 0.5;
        
        const dx = Math.abs(neighbor.position[0] - current.position[0]);
        const dz = Math.abs(neighbor.position[2] - current.position[2]);
        const dy = Math.abs(neighbor.position[1] - current.position[1]);
        
        // Touch condition with tolerance for grid misalignment
        const dxMax = (cxSize + nxSize) / 2 + 0.2;
        const dzMax = (czSize + nzSize) / 2 + 0.2;

        const touchX = dx <= dxMax;
        const touchZ = dz <= dzMax;
        
        // Check if it's purely diagonal (touching only on the corner)
        // If dx is close to dxMax AND dz is close to dzMax, it's diagonal.
        const isDiagonal = dx > dxMax - 0.35 && dz > dzMax - 0.35;
        
        let isValidTouch = touchX && touchZ && !isDiagonal;
        if (current.partId === 'logic_battery' || neighbor.partId === 'logic_battery') {
           isValidTouch = touchX && touchZ; // Allows diagonal "schräg dazu" for battery
        }
        
        // Height check - must basically touch on Y
        const touchY = dy <= (cPart.size[2] + nPart.size[2]) / 2 + 0.1;
        
        if (isValidTouch && touchY) {
          if (!nextState[neighbor.id]) {
            nextState[neighbor.id] = 15; // Unbegrenzte Reichweite
            queue.push(neighbor);
          }
        }
      });
    }

    setLogicState(prev => {
      // Deep compare to prevent infinite re-renders or unnecessary updates
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextState);
      if (prevKeys.length !== nextKeys.length) return nextState;
      let changed = false;
      for (const k of nextKeys) {
        if (prev[k] !== nextState[k]) {
          changed = true;
          break;
        }
      }
      return changed ? nextState : prev;
    });

  }, [blocks]);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isValidPlacement, setIsValidPlacement] = useState(true);
  const ghostRef = useRef<THREE.Group>(null);
  const footprintRef = useRef<THREE.Group>(null);
  const ghostMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const ghostEdgesRef = useRef<THREE.LineBasicMaterial>(null);
  const hudHeightRef = useRef<HTMLSpanElement>(null);
  const lastValidRef = useRef<boolean>(true);
  
  const [gravityStrength, setGravityStrength] = useState(9.8);
  const [gravityMode, setGravityMode] = useState<'up' | 'explosion'>('up');
  const [fallingGroups, setFallingGroups] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'katalog' | 'vorlagen' | 'ki' | 'werkzeug' | 'info' | 'logic'>('katalog');
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(1);

  useEffect(() => {
    if (AudioEngine.isInitialized) {
      AudioEngine.setSfxVolume(sfxEnabled ? 1 : 0);
    }
  }, [sfxEnabled, isAudioReady]);

  useEffect(() => {
    if (AudioEngine.isInitialized) {
      AudioEngine.setMusicVolume(musicEnabled ? 0.5 : 0);
    }
  }, [musicEnabled, isAudioReady]);

  useEffect(() => {
    const handleInteraction = () => {
      if (!isAudioReady) {
        AudioEngine.init();
        setIsAudioReady(true);
      }
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [isAudioReady]);

  const [isNightMode, setIsNightMode] = useState(false);
  const [envIntensity, setEnvIntensity] = useState(1.0);

  useEffect(() => {
    setEnvIntensity(isNightMode ? 0.4 : 1.0);
  }, [isNightMode]);
  const [showEdges, setShowEdges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Brick' | 'Plate' | 'Tile' | 'Round' | 'Special'>('All');
  const [showGrid, setShowGrid] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<{ text: string, type: 'success' | 'warning' | 'error' } | null>(null);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(0);

  const filteredParts = useMemo(() => {
    return PARTS.filter(p => {
      const isLogic = p.id.startsWith('logic_');
      if (isLogic && sidebarTab !== 'logic') return false;

      const matchesSearch = p.label.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      
      if (activeCategory === 'All') return true;
      if (activeCategory === 'Brick' && p.type === 'brick') return true;
      if (activeCategory === 'Plate' && p.type === 'plate') return true;
      if (activeCategory === 'Tile' && p.type === 'tile') return true;
      if (activeCategory === 'Round' && (p.type === 'cylinder' || p.id.includes('round'))) return true;
      if (activeCategory === 'Special' && (p.type === 'slope' || p.type === 'corner' || p.type === 'slope_inv')) return true;
      
      return false;
    });
  }, [searchTerm, activeCategory, sidebarTab]);

  const handlePhysicsCheck = useCallback(() => {
    const { supportedIds, fallingIds } = performStabilityCheck(blocks, PARTS);
    
    if (fallingIds.size === 0) {
       setSimulationMessage({ text: 'Alle Steine sind fest verbunden!', type: 'success' });
       setTimeout(() => setSimulationMessage(null), 3000);
       return;
    }

    setSimulationMessage({ text: `${fallingIds.size} Steine entfernt (instabil)`, type: 'warning' });
    setTimeout(() => setSimulationMessage(null), 3000);
    if (fallingIds.size > 0) {
      const supported = blocks.filter(b => supportedIds.has(b.id));
      const falling = blocks.filter(b => fallingIds.has(b.id));
      
      let fallingBlocksWithVectors = falling;
      if (gravityMode === 'explosion') {
        const center = new THREE.Vector3(0, 0, 0);
        let validPoints = 0;
        falling.forEach(b => {
          const p = normalizePos(b.position);
          if (!isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) {
             center.add(new THREE.Vector3(p[0], p[1], p[2]));
             validPoints++;
          }
        });
        if (validPoints > 0) {
          center.divideScalar(validPoints);
        }

        fallingBlocksWithVectors = falling.map(b => {
          const p = normalizePos(b.position);
          const pos = new THREE.Vector3(p[0], p[1], p[2]);
          const dir = new THREE.Vector3().subVectors(pos, center);
          // If the brick is at the center or center is invalid, give it a random direction
          if (dir.lengthSq() < 0.0001 || isNaN(dir.x)) {
            dir.set(Math.random() - 0.5, 0.5, Math.random() - 0.5);
          }
          dir.normalize();
          // Ensure a decent upwards component for the explosion
          dir.y = Math.abs(dir.y) + 0.3;
          dir.normalize();
          return { ...b, vector: [dir.x, dir.y, dir.z] };
        });
      }

      // Update blocks to only supported ones
      updateBlocks(supported);
      setFallingGroups(prev => [...prev, { id: Math.random().toString(), blocks: fallingBlocksWithVectors, mode: gravityMode, strength: gravityStrength }]);
    }
  }, [blocks, gravityMode, gravityStrength]);

  const removeFallingGroup = useCallback((id: string) => {
    setFallingGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const pointerDownPos = useRef({ x: 0, y: 0 });
  const shiftState = useRef({ active: false, lockedX: 0, lockedZ: 0, baseY: 0, startClientY: 0 });
  const ghostPosRef = useRef<number[]>([0,0,0]);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  const isDrag = useCallback((e: any) => {
    const cx = e.nativeEvent?.clientX ?? e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const cy = e.nativeEvent?.clientY ?? e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const dx = cx - pointerDownPos.current.x;
    const dy = cy - pointerDownPos.current.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const dragging = dist > 8;
    return dragging;
  }, []);

  const geometries = useBrickGeometries();
  const currentPart = useMemo(() => PART_MAP.get(currentPartId) || PARTS[0], [currentPartId]);

  /**
   * Updates the "ghost" preview block that follows the mouse.
   * Performs real-time collision detection and boundary checks to provide visual feedback (invalid = red tint).
   */
  const updateGhost = useCallback((visible: boolean, pos?: number[], isFromShift = false) => {
    // If shift-lock (vertical movement) is active, only allow height updates via that specific flow
    if (shiftState.current.active && !isFromShift) return;

    if (ghostRef.current) {
      ghostRef.current.visible = visible;
      if (pos) {
        ghostRef.current.position.set(pos[0], pos[1], pos[2]);
        ghostPosRef.current = pos;
        
        // Update user-facing height via ref for performance (direct DOM update)
        const displayHeight = (pos[1] - currentPart.size[2] * GRID_UNIT_HEIGHT * 0.5 + 0.5) / GRID_UNIT_HEIGHT;
        if (hudHeightRef.current) {
           hudHeightRef.current.textContent = displayHeight.toFixed(2).replace(/\.00$/, '');
        }

        // Keep React state in sync but only if it's potentially needed elsewhere (mostly for initial render)
        // Note: We avoid heavy React re-renders here by only updating state when absolutely necessary
        
        // Update the footprint projector on the baseplate
        if (footprintRef.current) {
           footprintRef.current.position.set(0, -pos[1] - 0.499, 0);
        }

        const isRot = currentRotation % 2 !== 0;
        const width = isRot ? currentPart.size[1] : currentPart.size[0];
        const depth = isRot ? currentPart.size[0] : currentPart.size[1];

        const hw = width * GRID_UNIT_WIDTH * 0.5;
        const hd = depth * GRID_UNIT_WIDTH * 0.5;

        // Ensure block is within the allowed 100x100x50 build cube
        const inBounds = 
          pos[0] - hw >= -50 && pos[0] + hw <= 50 &&
          pos[2] - hd >= -50 && pos[2] + hd <= 50 &&
          pos[1] <= 50;

        const hasCollision = blocksRef.current.some(b => {
          const bPart = PART_MAP.get(b.partId);
          if (!bPart) return false;
          return checkCollision(pos, currentPart, currentRotation, b.position, bPart, b.rotation);
        });
        
        const nextValid = inBounds && !hasCollision && pos[1] >= -0.45;
        
        lastValidRef.current = nextValid;
        setIsValidPlacement(nextValid); // Keep state for internal use if needed
        if (ghostMaterialRef.current) {
           let previewColor = currentColor;
           if (currentPartId === 'logic_wire') previewColor = '#262626';
           if (currentPartId === 'logic_battery') previewColor = '#262626';

           const baseColor = nextValid ? previewColor : '#ff0000';
           ghostMaterialRef.current.color.set(baseColor);
           ghostMaterialRef.current.opacity = nextValid ? 0.5 : 0.8;
           if (isNightMode) {
              ghostMaterialRef.current.emissive.set(nextValid ? previewColor : '#330000');
              ghostMaterialRef.current.emissiveIntensity = nextValid ? 0.8 : 1.0;
           } else {
              ghostMaterialRef.current.emissive.set(nextValid ? '#000000' : '#ff0000');
              ghostMaterialRef.current.emissiveIntensity = nextValid ? 0.2 : 4.0;
           }
        }
        if (ghostEdgesRef.current) {
           ghostEdgesRef.current.color.set(nextValid ? (isNightMode ? "#888888" : "black") : "#ff0000");
        }
      }
      ghostRef.current.rotation.set(0, currentRotation * (Math.PI / 2), 0);
    }
  }, [currentRotation, currentPart, isNightMode, currentColor, currentPartId]);

  useEffect(() => {
    if (ghostRef.current && ghostRef.current.visible && ghostPosRef.current) {
      updateGhost(true, ghostPosRef.current);
    }
  }, [currentColor, currentPartId, updateGhost]);

  /**
   * Finalizes the placement of a new block into the world state.
   */
  const addBlock = (pos: number[]) => {
    const isRot = currentRotation % 2 !== 0;
    const width = isRot ? currentPart.size[1] : currentPart.size[0];
    const depth = isRot ? currentPart.size[0] : currentPart.size[1];

    const hw = width * GRID_UNIT_WIDTH * 0.5;
    const hd = depth * GRID_UNIT_WIDTH * 0.5;

    // Strict boundary enforcement (64x64 stud area)
    const inBounds = 
      pos[0] - hw >= -32 && pos[0] + hw <= 32 &&
      pos[2] - hd >= -32 && pos[2] + hd <= 32 &&
      pos[1] <= 32;

    const hasCollision = blocks.some(b => {
      const bPart = PART_MAP.get(b.partId);
      if (!bPart) return false;
      return checkCollision(pos, currentPart, currentRotation, b.position, bPart, b.rotation);
    });

      if (inBounds && !hasCollision && pos[1] >= -0.45) {
        AudioEngine.playClick();
        
        let storedColor = currentColor;
        if (currentPartId === 'logic_wire') storedColor = '#400000';
        if (currentPartId === 'logic_battery') storedColor = '#262626';

        updateBlocks([...blocks, {
        id: Math.random().toString(36).substring(2, 9),
        position: pos,
        color: storedColor,
        partId: currentPartId,
        rotation: currentRotation,
        material: currentMaterial
      }]);
    }
  };

  const removeBlock = (id: string) => {
    AudioEngine.playPop();
    setBlocks(prev => {
      const next = prev.filter(b => b.id !== id);
      
      // Update history
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(next);
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      
      return next;
    });
  };

  const updateBlockColor = useCallback((id: string, color: string) => {
    AudioEngine.playClick();
    setBlocks(prev => {
      const next = prev.map(b => {
        if (b.id !== id) return b;
        let finalColor = color;
        if (b.partId === 'logic_wire') finalColor = '#262626';
        if (b.partId === 'logic_battery') finalColor = '#262626';
        return { ...b, color: finalColor };
      });
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(next);
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      return next;
    });
  }, []);

  const toggleBlockMeta = useCallback((id: string, key: string) => {
    AudioEngine.playClick();
    setBlocks(prev => {
      const next = prev.map(b => {
        if (b.id === id) {
          return {
            ...b,
            meta: {
              ...(b.meta || {}),
              [key]: !(b.meta?.[key])
            }
          };
        }
        return b;
      });
      // Skip history push for this to avoid cluttering history with toggle states?
      // actually let's push it so undo works on toggles
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(next);
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      
      return next;
    });
  }, []);

  /**
   * Serializes current world state into a plain text file.
   * Maps internal coordinate system to user-friendly stud values (0-128).
   */
  const handleSave = () => {
    let data = "================================================================================\n";
    data += "BRICKCRAFT SAVE - BOUNDED GRID (64x32x64)\n";
    data += "================================================================================\n";
    data += "PART-ID".padEnd(20) + "X".padEnd(10) + "Y".padEnd(10) + "Z".padEnd(10) + "ROT".padEnd(10) + "COLOR".padEnd(10) + "MATERIAL\n";
    data += "----------------------------------------------------------------------------------------------------\n";
    
    blocks.forEach(b => {
      const p = normalizePos(b.position);
      // Coordinate Mapping: internal units -> stud system
      const outX = (p[0] + 32) * 2; 
      const outZ = (p[2] + 32) * 2; 
      const normalizedY = p[1] + 0.5;
      
      data += b.partId.padEnd(20) + 
              outX.toFixed(2).padEnd(10) + 
              normalizedY.toFixed(2).padEnd(10) + 
              outZ.toFixed(2).padEnd(10) + 
              b.rotation.toString().padEnd(10) + 
              b.color.padEnd(10) + 
              (b.material || 'solid') + "\n";
    });
    
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brickcraft_save.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Deserializes a save file and updates the world state.
   * Includes specific filtering to ignore file headers and metadata lines.
   */
  const handleLoad = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    requestAnimationFrame(() => {
       requestAnimationFrame(() => {
          const reader = new FileReader();
          reader.onload = (readerEvent) => {
              const content = readerEvent.target?.result as string;
              const newBlocks = parseSaveFile(content);
              if (newBlocks.length > 0) {
                 updateBlocks(newBlocks);
                 setSimulationMessage({ text: `${newBlocks.length} Steine erfolgreich geladen`, type: 'success' });
                 setTimeout(() => setSimulationMessage(null), 3000);
              } else {
                 setSimulationMessage({ text: 'Keine gültigen Steine gefunden', type: 'error' });
                 setTimeout(() => setSimulationMessage(null), 3000);
              }
              setIsLoading(false);
          };
          reader.readAsText(file);
       });
    });
    e.target.value = '';
  };

  const handleAiBuild = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const partsList = PARTS.map(p => p.id).join(', ');
      const colorsList = COLORS.map(c => `${c.name}: ${c.value}`).join(', ');
      const systemPrompt = `You are an expert 3D Brick Architect for a digital building simulator. 
Your task is to generate a JSON array of blocks to build the user's request.

COORDINATE SYSTEM:
- World Space: X (left/right), Y (up/down), Z (front/back).
- Floor Level: All models MUST start on the floor (y = -0.5 is the baseplate).
- Vertical alignment (Y):
  * Center of a Brick sitting on the floor: y = -0.2 (world height 0.6)
  * Center of a Plate sitting on the floor: y = -0.4 (world height 0.2)
  * Stacking: Add 0.6 to y for each brick layer. Add 0.2 to y for each plate layer.
- Horizontal alignment (X/Z): Use steps of 0.5.

STRUCTURAL RULES:
1. VOLUMETRIC 3D: Build in all three dimensions (X, Y, and Z). Avoid flat 2D silhouettes. Create depth, thickness, and volume.
2. SOLIDS: Surfaces should be closed where possible. Gaps should be intentional features, not structural bugs.
3. GROUNDING: The bottom-most layer of the model MUST be placed exactly on the floor or connected to the ground. No floating parts.
4. GRID SNAP: Ensure all coordinates are perfectly aligned to the grid (0.5 increments for X/Z).
5. LIMITS: Max 80 blocks. Use a mix of bricks and plates for detail.

ALLOWED PARTS: ${partsList}
ALLOWED COLORS: ${colorsList}

OUTPUT: A valid raw JSON array of objects with keys: "position" ([x,y,z]), "partId", "color", "rotation" (0-3). No markdown.`;
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Build: ${aiPrompt}`,
        config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
      });
      const generatedBlocks = JSON.parse(response.text);
      if (generatedBlocks && generatedBlocks.length > 0) {
        // 1. Find the lowest point to offset the whole model to the floor
        let minY = Infinity;
        generatedBlocks.forEach((b: any) => {
          if (b.position && typeof b.position[1] === 'number') {
            const isPlate = b.partId?.includes('plate') || b.partId?.includes('tile');
            const worldH = isPlate ? (PLATE_HEIGHT * GRID_UNIT_HEIGHT) : GRID_UNIT_HEIGHT;
            const bottom = b.position[1] - (worldH / 2);
            if (bottom < minY) minY = bottom;
          }
        });

        // Current baseplate floor is at y = -0.5
        const yOffset = -0.5 - minY;

        // 2. Apply offset and strict grid snapping
        const cleanedBlocks = generatedBlocks.map((b: any, i: number) => {
          const px = Math.round(b.position[0] * 2) / 2;
          const py = b.position[1] + yOffset;
          const pz = Math.round(b.position[2] * 2) / 2;
          
          return {
            ...b,
            id: `ai-${Date.now()}-${i}`,
            position: [px, py, pz],
            rotation: Math.max(0, Math.min(3, Math.round(b.rotation || 0)))
          };
        });

        updateBlocks([...blocks, ...cleanedBlocks]);
      }
      setAiPrompt('');
      setSimulationMessage({ text: 'KI hat das Modell herbeigezaubert!', type: 'success' });
      setTimeout(() => setSimulationMessage(null), 3000);
    } catch (err) {
      console.error("AI Build failed:", err);
      setSimulationMessage({ text: 'KI Baufehler.', type: 'error' });
      setTimeout(() => setSimulationMessage(null), 3000);
    } finally { setIsAiLoading(false); }
  };
  
  /**
   * Global Event Listeners: Handles keyboard shortcuts (Undo/Redo, Rotation)
   * and the complex "Shift-Lock" vertical placement mode.
   */
  useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
           e.preventDefault();
           if (e.shiftKey) redo();
           else undo();
        }
        if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
           e.preventDefault();
           redo();
        }
        if (e.key === 'r' || e.key === 'R') {
           setCurrentRotation(prev => (prev + 1) % 4);
        }
        if (e.key === 'Shift') {
           if (!shiftState.current.active && ghostRef.current?.visible) {
              shiftState.current.active = true;
              setIsShiftActive(true);
              (window as any)._shiftIsActive = true;
              shiftState.current.lockedX = ghostPosRef.current[0];
              shiftState.current.lockedZ = ghostPosRef.current[2];
              shiftState.current.baseY = ghostPosRef.current[1];
              shiftState.current.startClientY = lastMousePos.current.y;
           }
        }
     };
     const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
           shiftState.current.active = false;
           setIsShiftActive(false);
           (window as any)._shiftIsActive = false;
        }
     };
     
     const handlePointerDown = (e: PointerEvent) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
     };
     
     const handlePointerMove = (e: PointerEvent) => {
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        
        // Vertical Step-Adjustment Logic
        // Translates vertical mouse movement into plate-height increments (1/3 brick)
        if (shiftState.current.active && ghostRef.current?.visible) {
           const dy = shiftState.current.startClientY - e.clientY;
           const steps = Math.round(dy / 25);
           
           const currentPartSize = PART_MAP.get(currentPartId)?.size || [2,2,1];
           const sy = currentPartSize[2];
           
           const newY = shiftState.current.baseY + steps * PLATE_HEIGHT;
           const targetY = Math.max(-0.5 + (sy * 0.5), newY);
           
           updateGhost(true, [shiftState.current.lockedX, targetY, shiftState.current.lockedZ], true);
        }
     };

     // Use document-level event capturing to intercept any potential swallowed events
     document.addEventListener('keydown', handleKeyDown);
     document.addEventListener('keyup', handleKeyUp);
     document.addEventListener('pointerdown', handlePointerDown, { capture: true });
     document.addEventListener('pointermove', handlePointerMove, { capture: true });
     
     return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
        document.removeEventListener('pointermove', handlePointerMove, { capture: true });
     }
  }, [updateGhost, currentPartId]);

  return (
    <div className={`flex flex-col w-screen h-screen overflow-hidden bg-[#f3f4f6] font-sans text-[#1f2937] ${isCtrlPressed.current ? 'cursor-crosshair' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      {isLoading && (
        <div className="absolute inset-0 z-[100] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 bg-white px-10 py-8 rounded-3xl shadow-2xl border border-gray-100 animate-in fade-in duration-200 zoom-in-95">
             <div className="w-10 h-10 border-[4px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
             <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-600">Lädt Welt...</div>
          </div>
        </div>
      )}
      
      <header className="h-[56px] bg-white border-b border-gray-200 flex items-center px-6 justify-between z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="font-black text-[1.1rem] tracking-tighter flex items-center gap-1.5 group cursor-default">
            <span className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] rotate-[-10deg] group-hover:rotate-0 transition-transform shadow-lg shadow-blue-200">B</span>
             BRICK<span className="text-blue-600">CRAFT</span>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
             {[
               { id: 'katalog', label: 'Bausteine', icon: Search },
               { id: 'logic', label: 'Logik', icon: Zap },
               { id: 'vorlagen', label: 'Library', icon: Info },
               { id: 'werkzeug', label: 'Settings', icon: Volume2 },
             ].map((tab) => (
                <button 
                   key={tab.id}
                   onClick={() => setSidebarTab(tab.id as any)}
                   className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tight ${sidebarTab === tab.id ? 'bg-white shadow-md text-blue-600 outline-none' : 'text-gray-500 hover:text-gray-700'}`}
                >
                   <tab.icon size={12} />
                   {tab.label}
                </button>
             ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
             <button onClick={undo} title="Undo (Ctrl+Z)" className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all active:scale-90"><Undo2 size={16} /></button>
             <button onClick={redo} title="Redo (Ctrl+Y)" className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all active:scale-90"><Redo2 size={16} /></button>
          </div>
          
          <div className="h-6 w-[1px] bg-gray-200" />

          <button 
             onClick={handleSave}
             className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 flex items-center gap-2"
          >
             Export <ExternalLink size={12} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex relative overflow-hidden bg-gray-50">
        
        {/* Left Sidebar (Minimal) */}
        <aside className="w-[320px] bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 overflow-hidden shadow-2xl shadow-gray-200/50">
          <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
            
            {sidebarTab === 'katalog' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-left-2 duration-500">
                <section>
                   <div className="flex items-center justify-between mb-4 px-1">
                      <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Palette</h3>
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-white shadow-xl" 
                        style={{ backgroundColor: currentColor, boxShadow: `0 0 10px ${currentColor}44` }} 
                      />
                   </div>
                   <div className="grid grid-cols-6 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                     {COLORS.map(c => (
                       <button
                         key={`${c.name}-${c.value}`}
                         className={`w-full aspect-square rounded-lg cursor-pointer transition-all hover:scale-110 active:scale-90 shadow-sm ${currentColor === c.value ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 z-10 shadow-lg' : ''}`}
                         style={{ backgroundColor: c.value }}
                         onClick={() => {
                            setCurrentColor(c.value);
                            if (c.isTranslucent) setCurrentMaterial('trans');
                            else if (c.isGlow) setCurrentMaterial('glow');
                         }}
                         title={c.name}
                       />
                     ))}
                   </div>
                </section>

                <section>
                   <div className="flex items-center justify-between mb-4 px-1">
                      <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Material</h3>
                   </div>
                   <div className="flex gap-2 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                      {[
                        { id: 'solid', label: 'Plastik', icon: Hammer },
                        { id: 'trans', label: 'Transparent', icon: Paintbrush },
                        { id: 'metal', label: 'Metall', icon: Zap },
                        { id: 'glow', label: 'Leuchten', icon: Info }
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setCurrentMaterial(m.id)}
                          className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${currentMaterial === m.id ? 'bg-white shadow-md text-blue-600 scale-105 z-10' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`}
                        >
                          <m.icon size={14} />
                          <span className="text-[8px] font-black uppercase tracking-tighter">{m.label}</span>
                        </button>
                      ))}
                   </div>
                </section>

                <section>
                   <div className="space-y-4 mb-6 px-1">
                      <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Bricks</h3>
                      <div className="relative">
                         <input 
                            type="text" 
                            placeholder="Find unique part..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all placeholder:text-gray-300"
                         />
                         <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400 opacity-50" />
                         {searchTerm && (
                            <button 
                              onClick={() => setSearchTerm('')}
                              className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X size={14} /> 
                            </button>
                         )}
                      </div>
                      <div className="flex flex-wrap gap-1 bg-gray-50 p-1 rounded-xl">
                         {['All', 'Brick', 'Plate', 'Tile', 'Round', 'Special'].map((cat: any) => (
                            <button 
                               key={cat}
                               onClick={() => setActiveCategory(cat)}
                               className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${activeCategory === cat ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'}`}
                            >
                               {cat}
                            </button>
                         ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                      {filteredParts.map(p => (
                         <button 
                            key={p.id}
                            onClick={() => {
                              setCurrentPartId(p.id);
                              if (sfxEnabled) AudioEngine.playClick();
                            }}
                            className={`group flex flex-col items-center gap-3 p-4 border rounded-3xl transition-all duration-500
                              ${currentPartId === p.id 
                                ? 'border-blue-600 bg-blue-50/30 shadow-xl shadow-blue-900/5 ring-1 ring-blue-600 scale-[1.02]' 
                                : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/10'}`}
                         >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${currentPartId === p.id ? 'bg-blue-600 text-white shadow-xl' : 'bg-gray-50 text-gray-300 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                               <p className="text-[10px] font-black">{p.size.map((n: number) => Number.isInteger(n) ? n : parseFloat(n.toFixed(2))).join('x')}</p>
                            </div>
                            <div className="text-center">
                               <p className={`text-[10px] font-black leading-none uppercase tracking-tighter ${currentPartId === p.id ? 'text-blue-700' : 'text-gray-800'}`}>
                                  {p.label}
                               </p>
                               <span className="text-[7px] font-bold text-gray-300 uppercase tracking-widest mt-1 block">ID: {p.id.split('_').pop()}</span>
                            </div>
                         </button>
                      ))}
                   </div>
                </section>
              </div>
            )}

            {sidebarTab === 'logic' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-500">
                 <section>
                     <div className="space-y-4 mb-6 px-1">
                      <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Logik Bausteine</h3>
                      <p className="text-xs text-gray-500">Logiksteine funktionieren wie Redstone. Kabel verbinden Komponenten, die Batterie liefert Strom und LEDs leuchten wenn sie Strom erhalten. Die Stromreichweite der Batterie und Kabel ist komplett unbegrenzt. Klicke (mit Interaktionswerkzeug) auf die Batterie, um sie ein- oder auszuschalten.</p>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      {['logic_battery', 'logic_wire', 'logic_led'].map(partId => {
                         const p = PARTS.find(part => part.id === partId);
                         if (!p) return null;
                         return (
                          <button 
                             key={p.id}
                             onClick={() => {
                               setCurrentPartId(p.id);
                               if (sfxEnabled) AudioEngine.playClick();
                             }}
                             className={`group flex flex-col items-center gap-3 p-4 border rounded-3xl transition-all duration-500
                               ${currentPartId === p.id 
                                 ? 'border-blue-600 bg-blue-50/30 shadow-xl shadow-blue-900/5 ring-1 ring-blue-600 scale-[1.02]' 
                                 : 'border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/10'}`}
                          >
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${currentPartId === p.id ? 'bg-blue-600 text-white shadow-xl' : 'bg-gray-50 text-gray-300 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                                <Zap size={20} />
                             </div>
                             <div className="text-center">
                                <p className={`text-[10px] font-black leading-none uppercase tracking-tighter ${currentPartId === p.id ? 'text-blue-700' : 'text-gray-800'}`}>
                                   {p.label}
                                </p>
                             </div>
                          </button>
                         )
                      })}
                   </div>
                   <div className="space-y-4 mb-6 mt-6 px-1">
                      <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Leuchtfarben</h3>
                      <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        {COLORS.filter(c => c.isGlow).map(c => (
                          <button
                            key={c.name}
                            className={`w-full aspect-square rounded-lg cursor-pointer transition-all hover:scale-110 active:scale-90 shadow-sm ${currentColor === c.value ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 z-10 shadow-lg' : ''}`}
                            style={{ backgroundColor: c.value }}
                            onClick={() => {
                               setCurrentColor(c.value);
                               setCurrentPartId('logic_led');
                            }}
                            title={c.name}
                          />
                        ))}
                      </div>
                   </div>
                   <div className="space-y-4 mb-6 mt-6 px-1">
                      <div className="flex justify-between items-center">
                         <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Leuchtkraft</h3>
                      </div>
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                          {[1, 2, 3].map(level => (
                            <button 
                               key={level}
                               onClick={() => setGlowIntensity(level)}
                               className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-widest ${glowIntensity === level ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                               Stufe {level}
                            </button>
                          ))}
                      </div>
                   </div>
                 </section>
              </div>
            )}

            {sidebarTab === 'vorlagen' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400 px-1">Library</h3>
                <div className="grid grid-cols-1 gap-4">
                   {TEMPLATES.map(t => (
                      <button 
                         key={t.id}
                         onClick={() => loadTemplate(t)}
                         className="group relative h-32 w-full rounded-3xl overflow-hidden border border-gray-100 text-left bg-white hover:shadow-2xl hover:border-blue-400 transition-all active:scale-95"
                      >
                         <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent group-hover:from-blue-500/10 transition-colors" />
                         <div className="relative p-6 h-full flex flex-col justify-end">
                            <span className="text-xs font-black text-gray-900 uppercase tracking-tighter mb-1 block group-hover:translate-x-1 transition-transform">{t.name}</span>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight opacity-100 group-hover:opacity-60">{t.description}</p>
                         </div>
                         <div className="absolute top-4 right-4 p-2 bg-blue-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                            <ExternalLink size={12} className="text-blue-500" />
                         </div>
                      </button>
                   ))}
                </div>
              </div>
            )}

            {sidebarTab === 'info' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-6 pb-12">
                <section>
                   <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400 px-1 mb-4">Über Brickcraft</h3>
                   <div className="p-6 bg-gray-50 rounded-3xl space-y-4">
                     <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                       Brickcraft ist ein experimenteller 3D-Baukasten für Browser, der die Ästhetik klassischer Klemmbausteine mit moderner Web-Technologie verbindet.
                       Das Ziel ist ein intuitives, performantes System für Konstruktionen und Logik-Simulationen.
                     </p>
                     <p className="text-[10px] text-gray-400 leading-relaxed font-bold italic">
                       Hinweis: Dies ist eine technische Demo. Alle Daten werden lokal in Ihrem Browser gespeichert.
                     </p>
                   </div>
                </section>

                <section>
                   <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400 px-1 mb-4 border-t border-gray-50 pt-6">Impressum & Credits</h3>
                   <div className="p-6 bg-gray-50 rounded-3xl space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">Entwickelt von</p>
                        <p className="text-[11px] text-gray-600">AI Studio Brickcraft Team</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">Kontakt / Feedback</p>
                        <p className="text-[11px] text-gray-600">NERV.PenPen@gmail.com</p>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-[9px] text-gray-400 font-medium leading-tight">
                          Diese Anwendung wurde zu Demonstrationszwecken erstellt. 
                          Alle Rechte an genutzten Software-Bibliotheken verbleiben bei den jeweiligen Autoren (siehe Lizenzen).
                        </p>
                      </div>
                   </div>
                </section>

                <section>
                   <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400 px-1 mb-4 border-t border-gray-50 pt-6">Lizenzen</h3>
                   <div className="space-y-2">
                     <LicenseItem 
                       title="React" 
                       license="MIT" 
                       content={["Copyright (c) Meta Platforms, Inc. and affiliates.", "", "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction... (MIT License)"].join('\n')}
                     />
                     <LicenseItem 
                       title="Three.js" 
                       license="MIT" 
                       content={["Copyright © 2010-2024 three.js authors", "", "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction... (MIT License)"].join('\n')}
                     />
                     <LicenseItem 
                       title="React Three Fiber" 
                       license="MIT" 
                       content={["Copyright (c) 2018 Paul Henschel", "", "Permission is hereby granted, free of charge..."].join('\n')}
                     />
                     <LicenseItem 
                       title="Lucide Icons" 
                       license="ISC" 
                       content={["Copyright (c) 2024 Lucide Contributors", "", "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies."].join('\n')}
                     />
                     <LicenseItem 
                       title="Audio / Sounds" 
                       license="Creative Commons" 
                       content={["Audio provided by ElevenLabs.", "https://elevenlabs.io/music/lofi", "", "All Lo-Fi beats and sound effects were synthesized using generative AI technologies for creative experimentation."].join('\n')}
                     />
                   </div>
                </section>

                <section className="pt-10">
                   <div className="p-6 bg-gray-900 rounded-[32px] shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wind size={80} /></div>
                      <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.3em] mb-4">Experimental Feature</p>
                      <h3 className="text-sm font-black text-white mb-2">Neural Algorithm Build</h3>
                      <p className="text-[10px] text-white/50 mb-6 leading-relaxed">
                        Die KI-Konstruktion ist nun ein verstecktes Feature für fortgeschrittene Nutzer. 
                        Beschreiben Sie Ihre Architektur-Idee in Kurzform.
                      </p>
                      
                      <div className="space-y-4">
                        <textarea 
                           rows={3}
                           placeholder="z.B. Ein roter Turm mit Glasfenstern..."
                           value={aiPrompt}
                           onChange={(e) => setAiPrompt(e.target.value)}
                           className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-medium text-white outline-none focus:ring-4 focus:ring-blue-500/20 placeholder:text-white/20 transition-all resize-none"
                           disabled={isAiLoading}
                        />
                        
                        <button 
                          onClick={handleAiBuild}
                          disabled={isAiLoading || !aiPrompt.trim()}
                          className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${isAiLoading ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95'}`}
                        >
                          {isAiLoading ? 'Algorithmus läuft...' : 'Konstruktion starten'}
                        </button>
                      </div>
                   </div>
                </section>
              </div>
            )}

            {sidebarTab === 'werkzeug' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-8">
                <section>
                   <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400 mb-6 px-1">Audio Synthesis</h3>
                   <div className="space-y-3">
                      {[
                        { id: 'sfx', label: 'Sound-Effekte', icon: Volume2, state: sfxEnabled, setter: setSfxEnabled },
                        { id: 'music', label: 'Lo-Fi Beats', icon: Music, state: musicEnabled, setter: setMusicEnabled }
                      ].map((item) => (
                        <button 
                           key={item.id}
                           onClick={() => {
                             AudioEngine.init();
                             setIsAudioReady(true);
                             item.setter(!item.state);
                           }}
                           className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${item.state ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-white border-gray-100 text-gray-400 hover:border-blue-100 hover:text-gray-600'}`}
                        >
                           <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${item.state ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                 <item.icon size={18} />
                              </div>
                              <span className="text-xs font-black uppercase tracking-tight">{item.label}</span>
                           </div>
                           <div className={`w-10 h-5 rounded-full p-1 transition-colors relative ${item.state ? 'bg-blue-500' : 'bg-gray-200'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full transition-transform ${item.state ? 'translate-x-5' : 'translate-x-0'}`} />
                           </div>
                        </button>
                      ))}
                   </div>
                </section>

                <section>
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Physik-Simulation
                   </h3>
                   <div className="space-y-4">
                      <button
                        onClick={handlePhysicsCheck}
                        className="w-full py-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95"
                      >
                        🌍 Gravitation prüfen
                      </button>

                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-inner">
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stärke</span>
                            <span className="text-xs font-mono font-bold text-blue-600">{gravityStrength.toFixed(1)} m/s²</span>
                         </div>
                         <input 
                            type="range" 
                            min="1" 
                            max="20" 
                            step="0.1"
                            value={gravityStrength} 
                            onChange={(e) => setGravityStrength(Number(e.target.value))}
                            className="w-full accent-blue-600 cursor-pointer"
                         />
                      </div>

                      <div className="flex bg-gray-100 p-1 rounded-xl">
                         {['up', 'explosion'].map(mode => (
                           <button 
                              key={mode}
                              onClick={() => setGravityMode(mode as any)}
                              className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all uppercase tracking-widest ${gravityMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                           >
                              {mode === 'up' ? 'Anti-Grav' : 'Explosion'}
                           </button>
                         ))}
                      </div>
                   </div>
                </section>

                <section>
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Anleitung
                   </h3>
                   <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: 'L-Klick', val: 'Platzieren' },
                        { key: 'R-Klick', val: 'Löschen' },
                        { key: 'Rad', val: 'Zoom' },
                        { key: 'Shift', val: 'Höhen-Sperre' },
                        { key: 'Ctrl+Z', val: 'Undo' },
                        { key: 'R', val: 'Drehen' }
                      ].map(item => (
                        <div key={item.key} className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">
                           <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 px-1 rounded">{item.key}</span>
                           <span className="text-[10px] text-gray-500 font-medium">{item.val}</span>
                        </div>
                      ))}
                   </div>
                </section>

                <section>
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Beleuchtung
                   </h3>
                   <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 ${isNightMode ? 'bg-indigo-50 border-indigo-100' : ''}`}>
                     <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Nachtmodus</span>
                        <span className="text-[8px] text-gray-400 font-medium">Schatten & Glow</span>
                     </div>
                     <button 
                        onClick={() => setIsNightMode(!isNightMode)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${isNightMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isNightMode ? 'left-5' : 'left-1'}`} />
                     </button>
                   </div>
                   <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center">
                         <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Umgebungslicht</span>
                         <span className="text-[10px] font-mono font-bold text-blue-600">{envIntensity.toFixed(1)}</span>
                      </div>
                      <input 
                         type="range"
                         min="0.1"
                         max="2.0"
                         step="0.1"
                         value={envIntensity}
                         onChange={(e) => setEnvIntensity(parseFloat(e.target.value))}
                         className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                   </div>
                </section>

                <section>
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Ansicht
                   </h3>
                   <div className="flex flex-col gap-2">
                       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                         <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Gitternetz</span>
                         <button 
                            onClick={() => setShowGrid(!showGrid)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${showGrid ? 'bg-blue-600' : 'bg-gray-300'}`}
                         >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showGrid ? 'left-5' : 'left-1'}`} />
                         </button>
                       </div>
                       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                         <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Linien (Edges)</span>
                         <button 
                            onClick={() => setShowEdges(!showEdges)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${showEdges ? 'bg-blue-600' : 'bg-gray-300'}`}
                         >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showEdges ? 'left-5' : 'left-1'}`} />
                         </button>
                       </div>
                   </div>
                </section>
              </div>
            )}
            
            {/* Always visible at the bottom of the scroll area or fixed */}
            <div className="pt-8 border-t border-gray-50 space-y-3">
               <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-300 mb-2">System</h3>
               <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95 shadow-sm">Speichern</button>
                  <label className="flex-1 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95 shadow-sm text-center cursor-pointer">
                    Laden <input type="file" onChange={handleLoad} className="hidden" accept=".txt" />
                  </label>
               </div>
            </div>

          </div>
          
          <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end">
             <button onClick={() => setSidebarTab('info')} className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95">
                <Info size={16} />
             </button>
          </div>
        </aside>

        {/* Center: Canvas Area */}
        <section className="flex-1 relative bg-gray-100 overflow-hidden">
           
           {/* MOUSE MODE MENÜ */}
           <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 p-2 bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/50">
              {[
                { id: 'interact', label: 'Bewegen / Interagieren', icon: Hand },
                { id: 'select', label: 'Auswählen', icon: MousePointer2 },
                { id: 'build', label: 'Bauen / Löschen', icon: Hammer },
                { id: 'paint', label: 'Einfärben', icon: Paintbrush },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => {
                     setMouseMode(mode.id as any);
                     if (mode.id !== 'select') {
                       setSelectedIds([]);
                     }
                  }}
                  title={mode.label}
                  className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all duration-300 ${mouseMode === mode.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-800'}`}
                >
                  <mode.icon size={20} />
                </button>
              ))}
           </div>

           {/* SELECTION FLOATING UI */}
           {selectedIds.length > 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 bg-gray-900/90 backdrop-blur-2xl rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 animate-in slide-in-from-bottom-10 duration-500">
                <div className="px-6 py-2 border-r border-white/5 flex flex-col justify-center">
                   <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em] mb-0.5">Focus Mode</p>
                   <p className="text-white text-[14px] font-black tracking-tight">{selectedIds.length} <span className="text-white/40 text-[10px] uppercase ml-1">Stacked</span></p>
                </div>
                <div className="flex items-center gap-1.5 p-1">
                   <button 
                      onClick={duplicateSelection}
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-900/20"
                   >
                     Duplicate
                   </button>
                   <button 
                      onClick={() => {
                         const next = blocks.filter(b => !selectedIds.includes(b.id));
                         updateBlocks(next);
                         setSelectedIds([]);
                      }}
                      className="px-8 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-red-500/20 transition-all active:scale-95"
                   >
                     Clear Selection
                   </button>
                   <button 
                      onClick={() => setSelectedIds([])}
                      className="w-11 h-11 flex items-center justify-center text-white/30 hover:text-white transition-all rounded-full hover:bg-white/5"
                   >
                      <Info size={18} />
                   </button>
                </div>
              </div>
           )}

           {/* Single Block Info Panel */}
           {selectedIds.length === 1 && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2 z-20 w-64 bg-white/90 backdrop-blur-3xl rounded-3xl p-6 shadow-2xl border border-gray-100 animate-in slide-in-from-right-8 duration-500">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-6 flex items-center gap-2">
                   <Info size={12} /> Stein Details
                 </h4>
                 {(() => {
                    const sb = blocks.find(b => b.id === selectedIds[0]);
                    const sp = sb ? PART_MAP.get(sb.partId) : null;
                    const sc = sb ? (COLOR_MAP.get(sb.color) || { name: 'Custom' }) as any : null;
                    if (!sb || !sp) return <div className="text-xs text-gray-500">Lade...</div>;
                    return (
                       <div className="space-y-4">
                          <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                             <span className="text-[10px] uppercase font-bold text-gray-400">Typ</span>
                             <span className="font-medium text-xs text-gray-800">{sp.label}</span>
                          </div>
                          <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                             <span className="text-[10px] uppercase font-bold text-gray-400">Farbe</span>
                             <div className="flex items-center gap-2">
                               <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: sb.color }} />
                               <span className="font-medium text-xs text-gray-800">{sc.name}</span> <span className="font-mono text-[9px] text-gray-400">({sb.color.toUpperCase()})</span>
                             </div>
                          </div>
                          <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                             <span className="text-[10px] uppercase font-bold text-gray-400">Material/Textur</span>
                             <span className="font-medium text-xs text-gray-800">{sc?.isGlow ? 'Leuchtend (Emissive)' : (sc?.isTranslucent ? 'Glas (Transparent)' : 'Plastik (Strukturiert)')}</span>
                          </div>
                          <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                             <span className="text-[10px] uppercase font-bold text-gray-400">Größe</span>
                             <span className="font-mono text-xs text-gray-600">
                               {sp.size.map((n: number) => Number.isInteger(n) ? n : parseFloat(n.toFixed(2))).join(' x ')}
                             </span>
                          </div>
                          <div className="flex justify-between items-end pb-2">
                             <span className="text-[10px] uppercase font-bold text-gray-400">ID</span>
                             <span className="font-mono text-[9px] bg-gray-100 px-1 py-0.5 rounded text-gray-500">{sb.id}</span>
                          </div>
                       </div>
                    );
                 })()}
              </div>
           )}

           {/* Vertical Lock Indicator */}
           {isShiftActive && (
             <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 animate-in slide-in-from-top-8 duration-500">
                <div className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center gap-4">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                   Vertical-Lock Engaged
                </div>
             </div>
           )}

           {/* Half-Stud Indicator */}
           {isCtrlPressed.current && mouseMode === 'build' && (
             <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 animate-in slide-in-from-top-8 duration-500">
                <div className="px-6 py-2.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center gap-4">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                   Half-Stud Snapping
                </div>
             </div>
           )}

           {/* Cursor Status */}
           {isCtrlPressed.current && mouseMode === 'select' && (
             <div className="absolute top-8 right-8 z-30 pointer-events-none animate-in fade-in duration-500 scale-110">
                <div className="px-5 py-2.5 bg-gray-900/95 backdrop-blur-xl text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-3 border border-white/20 shadow-2xl shadow-blue-900/20">
                   <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_15px_#3b82f6]" />
                   Multi-Selector
                </div>
             </div>
           )}

        {/* --- Central Canvas Content --- */}
        <div className="flex-1 relative flex items-center justify-center p-0 m-0 transition-colors duration-500 h-full w-full" style={{
           backgroundImage: `radial-gradient(circle, ${isNightMode ? '#1e1b4b' : '#d1d5db'} 1px, transparent 1px)`,
           backgroundColor: isNightMode ? '#010103' : '#f3f4f6',
           backgroundSize: '40px 40px'
        }}
        onPointerUp={(e) => {
           // Handle placement on "empty" space if height lock is active
           if (e.button === 0 && shiftState.current.active && !isDrag(e) && mouseMode === 'build') {
              addBlock(ghostPosRef.current);
           }
        }}
        >
          <Canvas 
            shadows={{ type: THREE.PCFSoftShadowMap }} 
            camera={{ position: [10, 10, 10], fov: 45 }} 
            gl={{ 
                alpha: true, 
                antialias: true, 
                stencil: false, 
                depth: true, 
                toneMapping: THREE.ACESFilmicToneMapping,
                outputColorSpace: THREE.SRGBColorSpace,
                toneMappingExposure: 1.2
            }}
          >
            <Stats className="!fixed !bottom-4 !right-4 !top-auto !left-auto" />
        <OrbitControls 
          makeDefault 
          maxPolarAngle={Math.PI / 1.8} 
          minDistance={2} 
          maxDistance={100}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
          }}
        />
        
        <ambientLight 
          intensity={isNightMode ? 0.35 : 0.8} 
          color={isNightMode ? "#7788dd" : "#ffffff"} 
        />
        
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={isNightMode ? 0.35 : 1.8} 
          color={isNightMode ? "#5566aa" : "#fff4e5"}
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-bias={-0.0002}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />

        <group>
           <pointLight position={[-20, 10, -20]} intensity={isNightMode ? 0.5 : 0} color="#223366" />
           <pointLight position={[20, 10, 20]} intensity={isNightMode ? 0.2 : 0} color="#112244" />
           <pointLight position={[0, 15, 0]} intensity={isNightMode ? 0.3 : 0} color="#223388" distance={50} />
           {Array.from({ length: 30 }).map((_, i) => {
              const b = activeGlowBlocks[i];
              if (!b) return <pointLight key={`pool-light-${i}`} intensity={0} distance={0.1} />;
              return (
                <pointLight 
                  key={`pool-light-${i}`}
                  position={[b.position[0], b.position[1] + 0.4, b.position[2]]}
                  intensity={isNightMode ? (b.partId === 'logic_led' ? (glowIntensity === 1 ? 10.0 : glowIntensity === 2 ? 25.0 : 60.0) : 5.0) : 0} // lower for wire
                  distance={b.partId === 'logic_led' ? (glowIntensity === 1 ? 8 : glowIntensity === 2 ? 16 : 32) : 4} // lower for wire
                  color={b.partId === 'logic_led' ? (COLOR_MAP.get(b.color)?.emissive || b.color || '#ff3333') : (COLOR_MAP.get(b.color)?.emissive || '#ff3333')}
                  decay={2}
                />
              );
           })}
        </group>
        
        <Environment 
          map={customEnvMap} 
          blur={showGrid ? 0.6 : 0}
        />
        <SceneSettings isNightMode={isNightMode} intensity={envIntensity} />

        {/* Baseplate / Floor Interaction Group */}
        <group
          onPointerDown={(e) => {
            const cx = e.nativeEvent?.clientX ?? e.clientX ?? 0;
            const cy = e.nativeEvent?.clientY ?? e.clientY ?? 0;
            if (pointerDownPos) {
              pointerDownPos.current = { x: cx, y: cy };
            }
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (isDrag(e)) {
               return;
            }
            if ((window as any)._shiftIsActive) return;
            if (e.button === 0) {
              if (mouseMode === 'build') {
                 const n = new THREE.Vector3(0, 1, 0);
                 addBlock(getGridPos(e.point, n, currentPart.size, snapToGrid, currentRotation, isCtrlPressed.current));
              } else if (mouseMode === 'select') {
                 setSelectedIds([]);
              }
            }
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (mouseMode === 'build') {
               const n = new THREE.Vector3(0, 1, 0);
               const gridPos = getGridPos(e.point, n, currentPart.size, snapToGrid, currentRotation, isCtrlPressed.current);
               updateGhost(true, gridPos);
            } else {
               updateGhost(false);
            }
          }}
          onPointerOut={() => {
            updateGhost(false);
          }}
          onContextMenu={(e) => {
             e.stopPropagation();
             if (mouseMode === 'select') {
                setSelectedIds([]);
             }
          }} // Clear selection on floor right click and prevent default
        >
          {/* Solid Box Floor (Visible when Grid is off) */}
          <mesh 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[0, -0.5 - 0.3333/2, 0]} 
            receiveShadow
            visible={!showGrid}
          >
             <boxGeometry args={[32, 32, 0.3333]} />
             <meshStandardMaterial 
              color={isNightMode ? "#2a2a35" : "#e5e7eb"} 
              roughness={isNightMode ? 0.7 : 0.9} 
              metalness={isNightMode ? 0.1 : 0.0} 
              roughnessMap={floorRoughnessMap}
              normalMap={floorNormalMap}
              normalScale={[0.8, 0.8]}
              side={THREE.DoubleSide} 
              depthWrite={true} 
            />
          </mesh>

          {/* Transparent Plane Floor (Visible when Grid is on) */}
          <mesh 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[0, -0.5, 0]} 
            receiveShadow
            visible={showGrid}
          >
             <planeGeometry args={[32, 32]} />
             <meshStandardMaterial 
              color={isNightMode ? "#2a2a35" : "#e5e7eb"} 
              roughness={isNightMode ? 0.7 : 0.9} 
              metalness={isNightMode ? 0.1 : 0.0} 
              opacity={0.6} 
              transparent={true} 
              side={THREE.DoubleSide} 
              depthWrite={true} 
            />
          </mesh>
        </group>
        
        {/* Environmental Helpers */}
        <group visible={!showGrid}>
          <BaseplateStuds isNightMode={isNightMode} />
        </group>
        <group visible={showGrid}>
          <gridHelper args={[32, 64, isNightMode ? 0x4444ff : 0x000000, isNightMode ? 0x222266 : 0x000000]} position={[0, -0.499, 0]} material-opacity={isNightMode ? 0.2 : 0.1} material-transparent />
        </group>

        {/* The World Content: Bricks being rendered using efficient instancing */}
        <InstancedBlocksGroup 
          blocks={blocks}
          geometries={geometries}
          showEdges={showEdges}
          addBlock={addBlock}
          removeBlock={removeBlock}
          updateGhost={updateGhost}
          snapToGrid={snapToGrid}
          currentPart={currentPart}
          currentRotation={currentRotation}
          isDrag={isDrag}
          pointerDownPos={pointerDownPos}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          isCtrlPressed={isCtrlPressed}
          isShiftPressed={isShiftPressed}
          transformOffset={transformOffset}
          logicState={logicState}
          toggleBlockMeta={toggleBlockMeta}
          mouseMode={mouseMode}
          currentColor={currentColor}
          updateBlockColor={updateBlockColor}
        />

        <BatteriesGroup 
           blocks={blocks}
           geometries={geometries}
           showEdges={showEdges}
           selectedIds={selectedIds}
           transformOffset={transformOffset}
           toggleBlockMeta={toggleBlockMeta}
           mouseMode={mouseMode}
           onSelect={setSelectedIds}
           isDrag={isDrag}
           removeBlock={removeBlock}
        />

        {selectedIds.length > 0 && (
          <TransformControls
            object={transformDummyRef}
            mode="translate"
            onMouseDown={() => {
              setIsTransforming(true);
              const selectedBlocks = blocksRef.current.filter(b => selectedIds.includes(b.id));
              const initPos: Record<string, number[]> = {};
              selectedBlocks.forEach(b => {
                initPos[b.id] = [...b.position];
              });
              initialPositionsRef.current = initPos;
              if (transformDummyRef.current) {
                transformDummyRef.current.userData.initialPosition = [
                  transformDummyRef.current.position.x,
                  transformDummyRef.current.position.y,
                  transformDummyRef.current.position.z,
                ];
              }
            }}
            onMouseUp={() => {
              setIsTransforming(false);
              if (transformOffset && (transformOffset[0] !== 0 || transformOffset[1] !== 0 || transformOffset[2] !== 0)) {
                let yBelowFloor = false;
                const newBlocks = blocksRef.current.map(b => {
                  if (selectedIds.includes(b.id)) {
                    const ny = initialPositionsRef.current[b.id][1] + transformOffset[1];
                    if (ny < -0.45) yBelowFloor = true;
                    return {
                      ...b,
                      position: [
                        initialPositionsRef.current[b.id][0] + transformOffset[0],
                        ny,
                        initialPositionsRef.current[b.id][2] + transformOffset[2],
                      ]
                    };
                  }
                  return b;
                });
                
                if (!yBelowFloor) {
                  updateBlocks(newBlocks);
                }
              }
              setTransformOffset(null);
            }}
            onChange={(e) => {
              if (isTransforming && transformDummyRef.current && transformDummyRef.current.userData.initialPosition) {
                const dx = transformDummyRef.current.position.x - transformDummyRef.current.userData.initialPosition[0];
                const dy = transformDummyRef.current.position.y - transformDummyRef.current.userData.initialPosition[1];
                const dz = transformDummyRef.current.position.z - transformDummyRef.current.userData.initialPosition[2];
                
                const snappedDx = snapToGrid ? Math.round(dx / GRID_UNIT_WIDTH) * GRID_UNIT_WIDTH : dx;
                const snappedDy = snapToGrid ? Math.round(dy / (PLATE_HEIGHT * GRID_UNIT_HEIGHT)) * (PLATE_HEIGHT * GRID_UNIT_HEIGHT) : dy;
                const snappedDz = snapToGrid ? Math.round(dz / GRID_UNIT_WIDTH) * GRID_UNIT_WIDTH : dz;
                
                setTransformOffset([snappedDx, snappedDy, snappedDz]);
              }
            }}
          />
        )}
        <group ref={transformDummyRef} />

        {fallingGroups.map(fg => (
          <FallingGroup 
             key={fg.id} 
             group={fg} 
             geometries={geometries} 
             onRemove={removeFallingGroup} 
          />
        ))}

        {/* Ghost Block along with Footprint Shadow */}
        {geometries[currentPartId] && (
          <group ref={ghostRef} visible={false}>
            <mesh geometry={geometries[currentPartId].visual} raycast={() => null}>
               <meshPhysicalMaterial 
                  ref={ghostMaterialRef}
                  color={currentColor}
                  transparent 
                  opacity={0.5}
                  roughness={0.4}
                  roughnessMap={roughnessMap}
                  normalMap={normalMap}
                  normalScale={[0.1, 0.1]}
                  depthWrite={false}
                  emissive={isNightMode ? currentColor : '#000000'}
                  emissiveIntensity={isNightMode ? 0.8 : 0.2}
                  toneMapped={!PART_MAP.get(currentPartId)?.id?.includes('logic')}
               />
               <lineSegments raycast={() => null}>
                  <edgesGeometry args={[geometries[currentPartId].edges || geometries[currentPartId].visual]} />
                  <lineBasicMaterial ref={ghostEdgesRef} color={isNightMode ? "#888888" : "black"} opacity={0.3} transparent depthTest={true} />
               </lineSegments>
            </mesh>
            
            <group ref={footprintRef}>
              <mesh rotation={[-Math.PI/2, 0, 0]} raycast={() => null}>
                 <planeGeometry args={[
                    currentPart.size[0] * 0.5, 
                    currentPart.size[1] * 0.5
                 ]} />
                 <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
              </mesh>
            </group>
          </group>
        )}

        {/* Postprocessing 
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1.1} mipmapBlur intensity={0.1} />
        </EffectComposer>
        */}
      </Canvas>

      {/* Floating UI Overlays */}
      {simulationMessage && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg border text-sm font-bold z-50 transition-all transform scale-100 ${
          simulationMessage.type === 'success' ? 'bg-[#ecfdf5] border-[#10b981] text-[#047857]' : 
          simulationMessage.type === 'warning' ? 'bg-[#fffbeb] border-[#f59e0b] text-[#b45309]' : 
          'bg-[#fef2f2] border-[#ef4444] text-[#b91c1c]'
        }`}>
          {simulationMessage.type === 'success' ? '✅' : '⚠️'} {simulationMessage.text}
        </div>
      )}

      {/* Height Indicator (Vertical Placement HUD) */}
      {isShiftActive && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold pointer-events-none z-50 shadow-xl flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <span className="text-[9px] opacity-70 uppercase tracking-[0.2em] mb-0.5">Höhen-Ebene</span>
            <div className="flex items-baseline gap-1">
               <span className="text-lg" ref={hudHeightRef}>
                  0
               </span>
               <span className="text-[10px] opacity-60">BRICKS</span>
            </div>
         </div>
      )}

      {/* Tooltip / Status Footer */}
      <div className="absolute bottom-6 left-6 bg-[#ffffff] px-4 py-2 rounded-[20px] shadow-sm text-xs text-[#6b7280] border border-[#d1d5db] pointer-events-none flex items-center">
        Position: {blocks.length > 0 ? blocks[blocks.length - 1].position.map((n: number) => n.toFixed(1)).join(', ') : '0, 0, 0'} &nbsp; | &nbsp; Raster: {snapToGrid ? '1' : 'Frei'}
      </div>
      
      </div>
      </section>
      </main>
    </div>
  );
}
