import React, { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEMPLATES } from './templates';
import { GoogleGenAI } from "@google/genai";

const COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Tan', value: '#E4CD9E' },
  { name: 'Red', value: '#C91A09' },
  { name: 'Blue', value: '#0055BF' },
  { name: 'Yellow', value: '#F2CD37' },
  { name: 'Black', value: '#111111' },
  { name: 'Green', value: '#237841' },
  { name: 'Medium Blue', value: '#5A93DB' },
  { name: 'Orange', value: '#FE8A18' },
  { name: 'Reddish Brown', value: '#582A12' },
  { name: 'Light Bluish Grey', value: '#A0A5A9' },
  { name: 'Dark Bluish Grey', value: '#6C6E68' },
  // 90s Translucent
  { name: 'Trans-Clear', value: '#eeeeee', isTranslucent: true, opacity: 0.4 },
  { name: 'Trans-Neon Orange', value: '#FF4D00', isTranslucent: true, opacity: 0.5 },
  { name: 'Trans-Neon Green', value: '#39FF14', isTranslucent: true, opacity: 0.5 },
  { name: 'Trans-Deep Blue', value: '#002366', isTranslucent: true, opacity: 0.6 },
  { name: 'Glow White', value: '#ffffff', isGlow: true, emissive: '#ffffff' },
  { name: 'Glow Red', value: '#ff0000', isGlow: true, emissive: '#ff2222' },
  { name: 'Glow Cyan', value: '#00ffff', isGlow: true, emissive: '#11ffff' },
  { name: 'Glow Yellow', value: '#ffff00', isGlow: true, emissive: '#ffff11' },
];

const COLOR_MAP = new Map(COLORS.map(c => [c.value, c]));

// Definition of block types. Size is [x, z, y_height] in grid units
const PLATE_HEIGHT = 1/3;
const BRICK_SIZES = [
  { id: '1x1', label: '1x1', size: [1, 1] },
  { id: '1x2', label: '1x2', size: [1, 2] },
  { id: '1x3', label: '1x3', size: [1, 3] },
  { id: '1x4', label: '1x4', size: [1, 4] },
  { id: '1x6', label: '1x6', size: [1, 6] },
  { id: '1x8', label: '1x8', size: [1, 8] },
  { id: '1x10', label: '1x10', size: [1, 10] },
  { id: '2x2', label: '2x2', size: [2, 2] },
  { id: '2x3', label: '2x3', size: [2, 3] },
  { id: '2x4', label: '2x4', size: [2, 4] },
  { id: '2x6', label: '2x6', size: [2, 6] },
  { id: '2x8', label: '2x8', size: [2, 8] },
  { id: '2x10', label: '2x10', size: [2, 10] },
  { id: '4x4', label: '4x4', size: [4, 4] },
  { id: '6x6', label: '6x6', size: [6, 6] },
];

const SPECIAL_PARTS = [
  { id: 'slope1x2', label: '1x2 Dach', size: [1, 2, 1], type: 'slope' },
  { id: 'slope2x2', label: '2x2 Dach', size: [2, 2, 1], type: 'slope' },
  { id: 'slope2x4', label: '2x4 Dach', size: [2, 4, 1], type: 'slope' },
  { id: 'tile1x1', label: '1x1 Fliese', size: [1, 1, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile1x2', label: '1x2 Fliese', size: [1, 2, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile1x4', label: '1x4 Fliese', size: [1, 4, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile2x2', label: '2x2 Fliese', size: [2, 2, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile2x4', label: '2x4 Fliese', size: [2, 4, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile4x4', label: '4x4 Fliese', size: [4, 4, PLATE_HEIGHT], type: 'tile' },
  { id: 'corner2x2', label: '2x2 Winkelplatte', size: [2, 2, PLATE_HEIGHT], type: 'corner' },
  // Round Parts
  { id: 'round_1x1_brick', label: '1x1 Rundstein', size: [1, 1, 1], type: 'cylinder' },
  { id: 'round_1x1_plate', label: '1x1 Rundplatte', size: [1, 1, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'round_1x1_tile', label: '1x1 Rundfliese', size: [1, 1, PLATE_HEIGHT], type: 'tile' },
  { id: 'round_2x2_brick', label: '2x2 Rundstein', size: [2, 2, 1], type: 'cylinder' },
  { id: 'round_2x2_plate', label: '2x2 Rundplatte', size: [2, 2, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'round_2x2_tile', label: '2x2 Rundfliese', size: [2, 2, PLATE_HEIGHT], type: 'tile' },
  { id: 'round_4x4_brick', label: '4x4 Rundstein', size: [4, 4, 1], type: 'cylinder' },
  { id: 'round_4x4_plate', label: '4x4 Rundplatte', size: [4, 4, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'slope_inv_1x2', label: '1x2 Dach Invers', size: [1, 2, 1], type: 'slope_inv' },
];

const PARTS = [
  // 1. STANDARD BRICKS (sorted by size)
  ...BRICK_SIZES.map(s => ({ id: `brick_${s.id}`, label: `${s.label} Stein`, size: [s.size[0], s.size[1], 1], type: 'brick' })),
  // 2. STANDARD PLATES (sorted by size)
  ...BRICK_SIZES.map(s => ({ id: `plate_${s.id}`, label: `${s.label} Platte`, size: [s.size[0], s.size[1], PLATE_HEIGHT], type: 'plate' })),
  // 3. SPECIAL PARTS (slopes, etc.)
  ...SPECIAL_PARTS
];

const PART_MAP = new Map(PARTS.map(p => [p.id, p]));

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
function getGridPos(point: THREE.Vector3, normal: THREE.Vector3, size: number[], snapToGrid: boolean, rotation: number): number[] {
  // Determine actual footprint dimensions based on rotation
  const isRotated = rotation % 2 !== 0;
  const sx = isRotated ? size[1] : size[0];
  const sz = isRotated ? size[0] : size[1];
  const sy = size[2];

  // If snapping is disabled, return approximate placement relative to surface
  if (!snapToGrid) {
     return [
       point.x + normal.x * (sx * 0.25), 
       point.y + normal.y * (sy * 0.5), 
       point.z + normal.z * (sz * 0.25)
     ];
  }

  // X and Z Grids: Blocks align to a 0.5 unit grid.
  // Offset calculated as half-width (studs are 0.5 units apart).
  const offsetX = sx * 0.25;
  const targetX = point.x + normal.x * offsetX;
  const snappedX = Math.round((targetX - offsetX) / 0.5) * 0.5 + offsetX;

  const offsetZ = sz * 0.25;
  const targetZ = point.z + normal.z * offsetZ;
  const snappedZ = Math.round((targetZ - offsetZ) / 0.5) * 0.5 + offsetZ;

  // Y-snapping: Vertical height snaps in units of a plate (1/3 of a full brick height).
  // The baseplate plane starts at y = -0.5.
  const targetCenterY = point.y + normal.y * (sy * 0.5);
  const targetBottomY = targetCenterY - sy * 0.5;
  const stepsY = Math.round((targetBottomY - (-0.5)) / PLATE_HEIGHT);
  const snappedBottomY = -0.5 + stepsY * PLATE_HEIGHT;
  const snappedY = snappedBottomY + sy * 0.5;

  return [snappedX, snappedY, snappedZ];
}

/**
 * Normalizes position data into a standard [x, y, z] array.
 * Robustly handles missing data or NaN values encountered during save/load.
 */
const normalizePos = (p: any): number[] => {
  if (Array.isArray(p)) return [isNaN(p[0]) ? 0 : p[0], isNaN(p[1]) ? 0 : p[1], isNaN(p[2]) ? 0 : p[2]];
  return [p?.x || 0, p?.y || 0, p?.z || 0];
};

/**
 * Generates one or more bounding boxes for a specific part type.
 * Used for physics collision checks and stability calculations.
 */
function getCollisionBoxes(posRaw: any, part: any, rot: number) {
  const pos = normalizePos(posRaw);
  const isRot = rot % 2 !== 0;
  const sx = (isRot ? part.size[1] : part.size[0]) * 0.5;
  const sz = (isRot ? part.size[0] : part.size[1]) * 0.5;
  const sy = part.size[2];

  // Specific logic for L-shaped corner parts
  if (part.type === 'corner') {
    const wActual = part.size[0] * 0.5;
    const dActual = part.size[1] * 0.5;
    
    // Sub-boxes defining the L-shape unrotated
    const boxes = [
      { minX: -wActual/2, maxX: wActual/2, minY: -sy/2, maxY: sy/2, minZ: -dActual/2, maxZ: 0 },
      { minX: -wActual/2, maxX: 0, minY: -sy/2, maxY: sy/2, minZ: 0, maxZ: dActual/2 }
    ];

    return boxes.map(b => {
      // Rotate the local bounds around the center point
      let minX = b.minX, maxX = b.maxX, minZ = b.minZ, maxZ = b.maxZ;
      for (let i = 0; i < (rot % 4); i++) {
        const p1x = minX, p1z = minZ;
        const p2x = maxX, p2z = maxZ;
        minX = p1z; minZ = -p2x;
        maxX = p2z; maxZ = -p1x;
      }

      return {
        minX: pos[0] + Math.min(minX, maxX),
        maxX: pos[0] + Math.max(minX, maxX),
        minY: pos[1] + b.minY,
        maxY: pos[1] + b.maxY,
        minZ: pos[2] + Math.min(minZ, maxZ),
        maxZ: pos[2] + Math.max(minZ, maxZ),
      };
    });
  }

  // Standard rectangular bounding box for most parts
  return [{
    minX: pos[0] - sx / 2,
    maxX: pos[0] + sx / 2,
    minY: pos[1] - sy / 2,
    maxY: pos[1] + sy / 2,
    minZ: pos[2] - sz / 2,
    maxZ: pos[2] + sz / 2,
  }];
}

/**
 * Checks for intersection between two blocks.
 * Uses Axis-Aligned Bounding Box (AABB) intersection for efficiency.
 */
function checkCollision(posA: number[], partA: any, rotA: number, posB: number[], partB: any, rotB: number) {
  const boxesA = getCollisionBoxes(posA, partA, rotA);
  const boxesB = getCollisionBoxes(posB, partB, rotB);
  
  const EPSILON = 0.05; // Guard against floating point errors
  
  for (const a of boxesA) {
    for (const b of boxesB) {
      if (
        a.minX < b.maxX - EPSILON && 
        a.maxX > b.minX + EPSILON && 
        a.minY < b.maxY - EPSILON && 
        a.maxY > b.minY + EPSILON && 
        a.minZ < b.maxZ - EPSILON && 
        a.maxZ > b.minZ + EPSILON
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Custom hook to pre-generate and memoize Three.js geometries for all parts.
 * Merges visual components (base, studs, holes) into single BufferGeometries
 * for optimized instantiation and rendering.
 */
function useBrickGeometries() {
  return useMemo(() => {
    const geometries: Record<string, { visual: THREE.BufferGeometry, collision: THREE.BufferGeometry, size: number[] }> = {};
    
    PARTS.forEach(part => {
      const [w, d, h] = part.size;
      const wActual = w * 0.5; // 0.5 units per stud
      const dActual = d * 0.5;
      
      const visualParts = [];
      
      // Base Shape
      const isRound = part.id.includes('round') || part.type === 'cylinder' || part.type === 'round_tile';
      
      if ((part.type === 'box' || part.type === 'tile' || part.type === 'brick' || part.type === 'plate') && !isRound) {
         visualParts.push(new THREE.BoxGeometry(wActual, h, dActual));
      } else if (isRound || part.type === 'cylinder_hole') {
         if (part.type === 'cylinder_hole') {
            const outerRadius = wActual / 2;
            const innerRadius = 0.1;
            const shape = new THREE.Shape();
            shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
            const holePath = new THREE.Path();
            holePath.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
            shape.holes.push(holePath);
            const holeGeo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
            holeGeo.center();
            holeGeo.rotateX(Math.PI / 2);
            visualParts.push(holeGeo);
         } else {
            visualParts.push(new THREE.CylinderGeometry(wActual / 2, wActual / 2, h, 32));
         }
      } else if (part.type === 'slope_inv') {
         const shape = new THREE.Shape();
         shape.moveTo(-dActual/2, h/2);
         shape.lineTo(dActual/2, h/2);
         shape.lineTo(dActual/2, -h/2);
         shape.lineTo(-dActual/2, h/2); 
         const extrudeSettings = { depth: wActual, bevelEnabled: false };
         const slopeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
         slopeGeo.center();
         slopeGeo.rotateY(Math.PI / 2);
         visualParts.push(slopeGeo);
      } else if (part.type === 'corner') {
         const part1 = new THREE.BoxGeometry(wActual, h, dActual / 2);
         part1.translate(0, 0, -dActual / 4);
         const part2 = new THREE.BoxGeometry(wActual / 2, h, dActual / 2);
         part2.translate(-wActual / 4, 0, dActual / 4);
         visualParts.push(part1, part2);
      } else if (part.type === 'slope') {
         // Create a slope geometry
         const shape = new THREE.Shape();
         shape.moveTo(-dActual/2, -h/2);
         shape.lineTo(dActual/2, -h/2);
         shape.lineTo(dActual/2, h/2);
         shape.lineTo(-dActual/2, -h/2); // Slanted side
         
         const extrudeSettings = { depth: wActual, bevelEnabled: false };
         const slopeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
         slopeGeo.center();
         // Fix rotation: extruded along Z, width was along X. Rotate to map Z -> X, X -> -Z.
         slopeGeo.rotateY(Math.PI / 2);
         visualParts.push(slopeGeo);
      }

      // Add studs for boxes and corners (excluding tiles and slopes)
      if (part.type === 'box' || part.type === 'brick' || part.type === 'plate' || part.type === 'corner' || part.type === 'cylinder' || part.type === 'cone' || part.type === 'slope_inv') {
        const studGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
        for (let x = 0; x < w; x++) {
          for (let z = 0; z < d; z++) {
            // For corner, skip the front-right stud (where x >= w/2 and z >= d/2)
            if (part.type === 'corner' && x >= w / 2 && z >= d / 2) {
              continue;
            }
            
            // For cylinders, only add studs that fit inside the circle
            if (part.type === 'cylinder') {
              const dx = (x - w / 2 + 0.5) * 0.5;
              const dz = (z - d / 2 + 0.5) * 0.5;
              const dist = Math.sqrt(dx * dx + dz * dz);
              if (dist > wActual / 2 - 0.01) continue;
            }

            const sx = (x - w/2 + 0.5) * 0.5;
            const sz = (z - d/2 + 0.5) * 0.5;
            const stud = studGeo.clone();
            stud.translate(sx, h/2 + 0.05, sz);
            visualParts.push(stud);
          }
        }
      }

      // Add underside "holes" (negative cylinders)
      if (part.type === 'box' || part.type === 'brick' || part.type === 'plate' || part.type === 'corner' || part.type === 'cylinder' || part.type === 'slope') {
        const holeGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12);
        for (let x = 0; x < w; x++) {
          for (let z = 0; z < d; z++) {
            if (part.type === 'cylinder') {
               const dx = (x - w / 2 + 0.5) * 0.5;
               const dz = (z - d / 2 + 0.5) * 0.5;
               const dist = Math.sqrt(dx * dx + dz * dz);
               if (dist > wActual / 2 - 0.1) continue;
            }
            if (part.type === 'corner' && x >= w / 2 && z >= d / 2) continue;

            const sx = (x - w/2 + 0.5) * 0.5;
            const sz = (z - d/2 + 0.5) * 0.5;
            const hole = holeGeo.clone();
            hole.translate(sx, -h/2 + 0.025, sz);
            visualParts.push(hole);
          }
        }
      }

      if (visualParts.length === 0) return;

      const mergedVisual = mergeGeometries(visualParts.map(g => g.index ? g.toNonIndexed() : g));
      if (mergedVisual) {
        mergedVisual.computeVertexNormals();
      }
      
      // Collision block is just a simple bounding box, except for corners which need an L-shape
      let collisionGeo;
      if (part.type === 'corner') {
         const c1 = new THREE.BoxGeometry(wActual, h, dActual / 2);
         c1.translate(0, 0, -dActual / 4);
         const c2 = new THREE.BoxGeometry(wActual / 2, h, dActual / 2);
         c2.translate(-wActual / 4, 0, dActual / 4);
         const collisionParts = [c1, c2].map(g => g.index ? g.toNonIndexed() : g);
         collisionGeo = mergeGeometries(collisionParts);
      } else {
         collisionGeo = new THREE.BoxGeometry(wActual, h, dActual);
      }
      
      if (mergedVisual && collisionGeo) {
         geometries[part.id] = { visual: mergedVisual, collision: collisionGeo, size: part.size };
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
function performStabilityCheck(blocks: any[], parts: typeof PARTS) {
    const findPart = (id: string) => PART_MAP.get(id);
  const EPSILON = 0.05;

  // Pre-calculate world-space bounding boxes for all active blocks
  const blockBoxes = blocks
    .filter(b => getPart(b.partId) !== undefined)
    .map(b => ({
       id: b.id,
       part: getPart(b.partId)!,
       boxes: getCollisionBoxes(normalizePos(b.position), getPart(b.partId)!, b.rotation)
    }));

  const supported = new Set<string>();

  // PHASE 1: Identify blocks directly supported by the floor
  for (const b of blockBoxes) {
     if (b.part.type === 'slope_inv') continue; // Inverse slopes lack bottom grip
     for (const box of b.boxes) {
        if (Math.abs(box.minY - (-0.5)) < EPSILON) {
           supported.add(b.id);
           break;
        }
     }
  }

  // PHASE 2: Build a graph of physical connections between blocks
  const edges = new Map<string, Set<string>>();
  for (const b of blocks) edges.set(b.id, new Set());

  for (let i = 0; i < blockBoxes.length; i++) {
     for (let j = i + 1; j < blockBoxes.length; j++) {
        const b1 = blockBoxes[i];
        const b2 = blockBoxes[j];
        let connected = false;

        const hasStudsOnTop = (type: string) => ['box', 'brick', 'plate', 'corner', 'cylinder', 'cone', 'slope_inv'].includes(type);
        const hasHolesOnBottom = (type: string) => ['box', 'brick', 'plate', 'corner', 'cylinder', 'slope', 'tile'].includes(type);

        for (const box1 of b1.boxes) {
           for (const box2 of b2.boxes) {
              // Blocks must overlap in XZ plane to potentially connect
              const overlapXZ = box1.minX < box2.maxX - EPSILON &&
                                box1.maxX > box2.minX + EPSILON &&
                                box1.minZ < box2.maxZ - EPSILON &&
                                box1.maxZ > box2.minZ + EPSILON;

              if (overlapXZ) {
                 // Check vertical adjacency (stud-to-hole or hole-to-stud)
                 // Case 1: b1 is on top of b2
                 if (Math.abs(box1.minY - box2.maxY) < EPSILON) {
                    if (hasStudsOnTop(b2.part?.type) && hasHolesOnBottom(b1.part?.type)) {
                       connected = true;
                    }
                 }
                 // Case 2: b2 is on top of b1
                 if (Math.abs(box2.minY - box1.maxY) < EPSILON) {
                    if (hasStudsOnTop(b1.part?.type) && hasHolesOnBottom(b2.part?.type)) {
                       connected = true;
                    }
                 }
              }
           }
        }
        if (connected) {
           edges.get(b1.id)?.add(b2.id);
           edges.get(b2.id)?.add(b1.id);
        }
     }
  }

  // PHASE 3: Propagate state from grounded blocks through the graph
  let changed = true;
  while (changed) {
     changed = false;
     for (const [id, neighbors] of edges.entries()) {
        if (!supported.has(id)) {
           for (const neighbor of neighbors) {
              if (supported.has(neighbor)) {
                 supported.add(id);
                 changed = true;
                 break;
              }
           }
        }
     }
  }

  // PHASE 4: Result generation
  const fallingIds = new Set<string>();
  for (const b of blocks) {
     if (!supported.has(b.id)) {
        fallingIds.add(b.id);
     }
  }
  
  return { supportedIds: supported, fallingIds };
}

/**
 * Component for animating a group of falling blocks.
 * Uses useFrame for direct Three.js position/rotation updates to ensure high performance.
 */
const SceneSettings = ({ isNightMode }: { isNightMode: boolean }) => {
  const { gl, scene } = useThree();
  const intensityTarget = isNightMode ? 0.45 : 1.0;
  
  useEffect(() => {
    const bgColor = isNightMode ? '#12121c' : '#f3f4f6';
    gl.setClearColor(bgColor);
    scene.background = new THREE.Color(bgColor);
    
    if (scene) {
       (scene as any).environmentIntensity = intensityTarget;
       scene.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
             const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
             materials.forEach((m: any) => {
                m.needsUpdate = true;
                if (m.envMapIntensity !== undefined) m.envMapIntensity = intensityTarget;
             });
          }
       });
    }
  }, [isNightMode, gl, scene, intensityTarget]);

  // Lock environment intensity to prevent it being overwritten by Environment presets
  useFrame(() => {
    if (scene && (scene as any).environmentIntensity !== intensityTarget) {
      (scene as any).environmentIntensity = intensityTarget;
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
             roughness={0.1} 
             metalness={0.0} 
             clearcoat={1.0} 
             clearcoatRoughness={0.05} 
             transparent={colorMeta.isTranslucent}
             opacity={colorMeta.opacity ?? 1}
             emissive={colorMeta.isGlow ? new THREE.Color(colorMeta.emissive) : new THREE.Color(0,0,0)}
             emissiveIntensity={colorMeta.isGlow ? 12.0 : 0}
             depthWrite={!colorMeta.isTranslucent}
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
        roughness={isNightMode ? 0.4 : 0.6} 
      />
    </instancedMesh>
  );
}

/**
 * Orchestrates the rendering of all blocks by grouping them by their part types.
 * This allows us to use one InstancedMesh per part type for maximum efficiency.
 */
const InstancedBlocksGroup = React.memo(({ blocks, geometries, addBlock, removeBlock, updateGhost, snapToGrid, currentRotation, isDrag, currentPart }: any) => {
  const blocksByMaterial = useMemo(() => {
    const map = new Map<string, { partId: string, list: any[], materialProps: any }>();
    
    blocks.forEach((b: any) => {
      const colorMeta = (COLOR_MAP.get(b.color) || { value: b.color }) as any;
      const materialType = colorMeta.isTranslucent ? 'T' : colorMeta.isGlow ? 'G' : 'O';
      const key = `${b.partId}_${materialType}_${b.color}`;
      
      if (!map.has(key)) {
        map.set(key, { 
          partId: b.partId, 
          list: [], 
          materialProps: {
            transparent: colorMeta.isTranslucent || false,
            opacity: colorMeta.opacity ?? 1,
            emissive: colorMeta.emissive ? new THREE.Color(colorMeta.emissive) : new THREE.Color(0, 0, 0),
            emissiveIntensity: colorMeta.isGlow ? 15.0 : 0,
            color: b.color,
          }
        });
      }
      map.get(key)!.list.push(b);
    });
    return map;
  }, [blocks]);

  return (
    <>
      {Array.from(blocksByMaterial.entries()).map(([key, data]) => (
        <InstancedPart 
           key={key}
           partId={data.partId}
           blocks={data.list}
           materialProps={data.materialProps}
           geometries={geometries}
           addBlock={addBlock}
           removeBlock={removeBlock}
           updateGhost={updateGhost}
           snapToGrid={snapToGrid}
           currentRotation={currentRotation}
           isDrag={isDrag}
           currentPart={currentPart}
        />
      ))}
    </>
  );
});

const InstancedLedMarkers = ({ blocks, geoData, color }: any) => {
   const meshRef = useRef<THREE.InstancedMesh>(null);
   const count = blocks.length * 4;

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
            color={color} 
            transparent
            opacity={0.9} 
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            depthTest={true}
            depthWrite={false}
         />
      </instancedMesh>
   );
};

const InstancedPart = ({ partId, blocks, geometries, addBlock, removeBlock, updateGhost, snapToGrid, currentRotation, isDrag, currentPart, materialProps }: any) => {
  const geoData = geometries[partId] || geometries['brick_2x2'];
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    blocks.forEach((b: any, i: number) => {
      const p = normalizePos(b.position);
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.set(0, b.rotation * (Math.PI / 2), 0);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(b.color));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blocks]);

  const handlePointerEvent = useCallback((e: any, type: 'move' | 'up' | 'context') => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    
    const block = blocks[e.instanceId];
    if (!block) return;

    if (type === 'context') {
      if (!isDrag(e)) removeBlock(block.id);
      updateGhost(false);
      return;
    }

    if (type === 'up' && isDrag(e)) return;
    if (type === 'up' && (window as any)._shiftIsActive) return;

    const rotAngle = block.rotation * (Math.PI / 2);
    const n = (e.face?.normal?.clone() || new THREE.Vector3(0, 1, 0));
    n.applyEuler(new THREE.Euler(0, rotAngle, 0));
    const gridPos = getGridPos(e.point, n, currentPart.size, snapToGrid, currentRotation);

    if (type === 'move') {
      updateGhost(true, gridPos);
    } else {
      addBlock(gridPos);
    }
  }, [blocks, addBlock, removeBlock, updateGhost, snapToGrid, currentRotation, currentPart, isDrag]);

  return (
    <group>
      <instancedMesh 
        ref={meshRef} 
        args={[geoData.visual, undefined, Math.max(1, blocks.length)]} 
        count={blocks.length} 
        castShadow 
        receiveShadow
        onPointerUp={(e) => handlePointerEvent(e, 'up')}
        onPointerMove={(e) => handlePointerEvent(e, 'move')}
        onContextMenu={(e) => handlePointerEvent(e, 'context')}
        onPointerOut={(e) => { e.stopPropagation(); updateGhost(false); }}
      >
        <meshPhysicalMaterial 
          {...materialProps}
          roughness={0.1}
          metalness={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          depthWrite={!materialProps.transparent}
        />
      </instancedMesh>

      {materialProps.emissiveIntensity > 0 && (
         <InstancedLedMarkers blocks={blocks} geoData={geoData} color={materialProps.emissive} />
      )}
    </group>
  );
};

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
  const loadTemplate = useCallback((template: any) => {
    const newBlocks = template.blocks.map((b: any, index: number) => ({
      ...b,
      id: `template-${template.id}-${index}-${Date.now()}`
    }));
    updateBlocks(newBlocks);
    setSimulationMessage({ text: `${template.name} geladen!`, type: 'success' });
    setTimeout(() => setSimulationMessage(null), 3000);
  }, [updateBlocks]);

  const [currentColor, setCurrentColor] = useState(COLORS[0].value);
  const [currentPartId, setCurrentPartId] = useState('brick_2x2');
  const [isPlate, setIsPlate] = useState(false);
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
  const [sidebarTab, setSidebarTab] = useState<'katalog' | 'vorlagen' | 'ki' | 'werkzeug'>('katalog');
  const [isNightMode, setIsNightMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Brick' | 'Plate' | 'Tile' | 'Round' | 'Special'>('All');
  const [showGrid, setShowGrid] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<{ text: string, type: 'success' | 'warning' | 'error' } | null>(null);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(0);

  const filteredParts = useMemo(() => {
    return PARTS.filter(p => {
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
  }, [searchTerm, activeCategory]);

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
    // Determine pointer coordinates regardless of synthetic or native DOM event
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const dx = cx - pointerDownPos.current.x;
    const dy = cy - pointerDownPos.current.y;
    return Math.sqrt(dx*dx + dy*dy) > 5;
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
        const displayHeight = pos[1] - currentPart.size[2] * 0.5 + 0.5;
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

        // Ensure block is within the allowed 100x100x50 build cube
        const inBounds = 
          pos[0] - width/2 >= -50 && pos[0] + width/2 <= 50 &&
          pos[2] - depth/2 >= -50 && pos[2] + depth/2 <= 50 &&
          pos[1] <= 50;

        const hasCollision = blocksRef.current.some(b => {
          const bPart = PART_MAP.get(b.partId);
          if (!bPart) return false;
          return checkCollision(pos, currentPart, currentRotation, b.position, bPart, b.rotation);
        });
        
        const nextValid = inBounds && !hasCollision && pos[1] >= -0.45;
        
        // Update ghost materials directly to avoid App re-renders
        if (nextValid !== lastValidRef.current) {
           lastValidRef.current = nextValid;
           setIsValidPlacement(nextValid); // Keep state for internal use if needed
           if (ghostMaterialRef.current) {
              const baseColor = nextValid ? currentColor : '#ff0000';
              ghostMaterialRef.current.color.set(baseColor);
              ghostMaterialRef.current.opacity = nextValid ? 0.5 : 0.8;
              if (isNightMode) {
                 ghostMaterialRef.current.emissive.set(nextValid ? currentColor : '#330000');
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
      }
      ghostRef.current.rotation.set(0, currentRotation * (Math.PI / 2), 0);
    }
  }, [currentRotation, currentPart, isNightMode, currentColor]);

  useEffect(() => {
    if (ghostRef.current && ghostRef.current.visible) {
      updateGhost(true, ghostPosRef.current);
    }
  }, [updateGhost]);

  /**
   * Finalizes the placement of a new block into the world state.
   */
  const addBlock = (pos: number[]) => {
    const isRot = currentRotation % 2 !== 0;
    const width = isRot ? currentPart.size[1] : currentPart.size[0];
    const depth = isRot ? currentPart.size[0] : currentPart.size[1];

    // Strict boundary enforcement (64x64 stud area)
    const inBounds = 
      pos[0] - width/2 >= -32 && pos[0] + width/2 <= 32 &&
      pos[2] - depth/2 >= -32 && pos[2] + depth/2 <= 32 &&
      pos[1] <= 32;

    const hasCollision = blocks.some(b => {
      const bPart = PART_MAP.get(b.partId);
      if (!bPart) return false;
      return checkCollision(pos, currentPart, currentRotation, b.position, bPart, b.rotation);
    });

    if (inBounds && !hasCollision && pos[1] >= -0.45) {
      updateBlocks([...blocks, {
        id: Math.random().toString(36).substring(2, 9),
        position: pos,
        color: currentColor,
        partId: currentPartId,
        rotation: currentRotation
      }]);
    }
  };

  const removeBlock = (id: string) => {
    updateBlocks(blocks.filter(b => b.id !== id));
  };

  /**
   * Serializes current world state into a plain text file.
   * Maps internal coordinate system to user-friendly stud values (0-128).
   */
  const handleSave = () => {
    let data = "================================================================================\n";
    data += "BRICKCRAFT SAVE - BOUNDED GRID (64x32x64)\n";
    data += "================================================================================\n";
    data += "PART-ID".padEnd(20) + "X".padEnd(10) + "Y".padEnd(10) + "Z".padEnd(10) + "ROT".padEnd(10) + "COLOR\n";
    data += "--------------------------------------------------------------------------------\n";
    
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
              b.color + "\n";
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
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
       const content = readerEvent.target?.result as string;
       const lines = content.split('\n');
       const newBlocks: any[] = [];
       for (const line of lines) {
         const trimmed = line.trim();
         // Filter out headers, dividers, and empty lines
         if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('-') || trimmed.startsWith('PART-ID') || trimmed.startsWith('BRICKCRAFT')) continue;
         
         const parts = trimmed.split(/\s+/);
         if (parts.length >= 6) {
            const px = parseFloat(parts[1]);
            const py = parseFloat(parts[2]);
            const pz = parseFloat(parts[3]);
            const rot = parseInt(parts[4], 10);
            const color = parts[5];
            
            // Skip entries with invalid coordinate data (NaN protection)
            if (isNaN(px) || isNaN(py) || isNaN(pz)) continue;
            
            newBlocks.push({
              id: Math.random().toString(36).substring(2, 9),
              partId: parts[0],
              position: [px / 2 - 32, py - 0.5, pz / 2 - 32], 
              rotation: isNaN(rot) ? 0 : rot,
              color: color
            });
         }
       }
       if (newBlocks.length > 0) {
          updateBlocks(newBlocks);
          setSimulationMessage({ text: `${newBlocks.length} Steine erfolgreich geladen`, type: 'success' });
          setTimeout(() => setSimulationMessage(null), 3000);
       } else {
          setSimulationMessage({ text: 'Keine gültigen Steine gefunden', type: 'error' });
          setTimeout(() => setSimulationMessage(null), 3000);
       }
    };
    reader.readAsText(file);
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
  * Center of a Brick sitting on the floor: y = 0
  * Center of a Plate sitting on the floor: y = -0.333
  * Stacking: Add 1.0 to y for each brick layer. Add 0.333 to y for each plate layer.
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
            const bottom = b.position[1] - (isPlate ? 1/6 : 0.5);
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
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#e5e7eb] font-sans text-[#1f2937]" onContextMenu={(e) => e.preventDefault()}>
      
      {/* --- Main Navigation / Header --- */}
      <header className="h-[64px] bg-white border-b border-[#d1d5db] flex items-center px-6 justify-between z-10 shrink-0">
        <div className="font-extrabold text-[1.25rem] tracking-tight flex items-center gap-2">
           BRICK<span className="text-[#2563eb]">CRAFT</span>
        </div>
        <div className="flex gap-3">
          <button 
             onClick={undo}
             title="Rückgängig machen (Ctrl+Z)"
             className="px-4 py-2 rounded-md border border-[#d1d5db] bg-white text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Undo
          </button>
          <button 
             onClick={redo}
             title="Wiederholen (Ctrl+Y)"
             className="px-4 py-2 rounded-md border border-[#d1d5db] bg-white text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Redo
          </button>
          <button 
             onClick={() => setCurrentRotation(r => (r + 1) % 4)} 
             className="px-4 py-2 rounded-md border border-[#d1d5db] bg-white text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Drehen (R)
          </button>
          <button 
             onClick={() => updateBlocks([])} 
             className="px-4 py-2 rounded-md border border-[#d1d5db] bg-white text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Alle löschen
          </button>
        </div>
      </header>

      {/* --- Central Editor Area --- */}
      <main className="flex-1 flex relative overflow-hidden">
        
        {/* Left Sidebar: Controls and Brick Palette */}
        <aside className="w-[300px] bg-white border-r border-[#d1d5db] flex flex-col shrink-0 z-10 overflow-hidden shadow-xl">
          
          <div className="p-5 border-b border-gray-100 bg-gray-50/30">
            <div className="flex items-center gap-2 mb-4">
               <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center text-white font-black lg shadow-sm">B</div>
               <h1 className="text-lg font-black text-[#111827] tracking-tighter uppercase">Brickcraft</h1>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg">
               {[
                 { id: 'katalog', label: 'Bausatz' },
                 { id: 'vorlagen', label: 'Vorlagen' },
                 { id: 'ki', label: 'KI' },
                 { id: 'werkzeug', label: 'Werkzeug' }
               ].map((tab) => (
                  <button 
                     key={tab.id}
                     onClick={() => setSidebarTab(tab.id as any)}
                     className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-tighter ${sidebarTab === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-8">
            
            {sidebarTab === 'katalog' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <section className="mb-8">
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Ausgewählte Farbe
                   </h3>
                   <div className="flex flex-wrap gap-2.5">
                     {COLORS.map(c => (
                       <button
                         key={c.value}
                         className="w-6 h-6 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95 shadow-sm"
                         style={{ 
                           backgroundColor: c.value,
                           border: currentColor === c.value ? '2px solid white' : (c.value === '#FFFFFF' ? '1px solid #e5e7eb' : 'none'),
                           boxShadow: currentColor === c.value ? '0 0 0 2px #2563eb' : '0 1px 2px rgba(0,0,0,0.1)'
                         }}
                         onClick={() => setCurrentColor(c.value)}
                         title={c.name}
                       />
                     ))}
                   </div>
                </section>

                <section>
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Bauteile
                   </h3>
                   
                   <div className="relative mb-3">
                      <input 
                         type="text" 
                         placeholder="Suchen..."
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full pl-8 pr-3 py-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                      />
                      <span className="absolute left-3 top-2.5 opacity-30 text-[10px]">🔍</span>
                   </div>

                   <div className="flex flex-wrap gap-1 mb-4 overflow-x-auto pb-1 no-scrollbar">
                      {['All', 'Brick', 'Plate', 'Tile', 'Round', 'Special'].map((cat: any) => (
                         <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${activeCategory === cat ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                         >
                            {cat === 'Brick' ? 'Steine' : cat === 'Plate' ? 'Platten' : cat === 'Tile' ? 'Fliesen' : cat === 'Round' ? 'Rund' : cat === 'Special' ? 'Spezial' : 'Alle'}
                         </button>
                      ))}
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                      {filteredParts.map(p => (
                         <div 
                            key={p.id}
                            onClick={() => setCurrentPartId(p.id)}
                            className={`group relative border rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:shadow-md ${currentPartId === p.id ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 shadow-sm' : 'border-gray-100 bg-white hover:border-blue-200'}`}
                         >
                            <span className={`text-[10px] font-bold text-center leading-tight transition-colors ${currentPartId === p.id ? 'text-blue-700' : 'text-gray-700 group-hover:text-blue-600'}`}>{p.label}</span>
                            <span className="text-[8px] font-mono font-bold text-gray-300 uppercase tracking-widest">{p.id.split('_').slice(1).join(' ')}</span>
                            {currentPartId === p.id && (
                              <div className="absolute top-1 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            )}
                         </div>
                      ))}
                   </div>
                </section>
              </div>
            )}

            {sidebarTab === 'vorlagen' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-6 flex items-center gap-2">
                   <span className="w-4 h-[1px] bg-gray-200" /> Bauvorlagen
                </h3>
                <div className="grid grid-cols-1 gap-3">
                   {TEMPLATES.map(t => (
                      <div 
                         key={t.id}
                         onClick={() => loadTemplate(t)}
                         className="border border-gray-100 rounded-2xl p-5 flex flex-col gap-2 cursor-pointer transition-all bg-white hover:shadow-xl hover:border-blue-100 hover:-translate-y-0.5 group active:scale-[0.98]"
                      >
                         <div className="flex justify-between items-start">
                            <span className="text-[13px] font-black text-gray-800 tracking-tight leading-none">{t.name}</span>
                            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">→</div>
                         </div>
                         <p className="text-[10px] text-gray-400 leading-relaxed pr-4">{t.description}</p>
                         <div className="mt-2 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg self-start">
                            JETZT LADEN
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            )}

            {sidebarTab === 'ki' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-6 flex items-center gap-2">
                   <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                   Wunsch-Baumeister
                </h3>
                <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100/50 shadow-sm">
                  <p className="text-[10px] text-purple-700/60 font-bold mb-4 uppercase tracking-widest leading-none">Generative KI</p>
                  <textarea 
                     rows={3}
                     placeholder="Was soll ich bauen? (z.B. Palme, Hund, kleiner Flieger)"
                     value={aiPrompt}
                     onChange={(e) => setAiPrompt(e.target.value)}
                     className="w-full px-4 py-3 border border-purple-200 rounded-2xl text-xs outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300 bg-white shadow-inner resize-none mb-4 transition-all"
                     disabled={isAiLoading}
                  />
                  <button 
                    onClick={handleAiBuild}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className={`w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-purple-200/50 transition-all flex items-center justify-center gap-2 active:scale-95 ${isAiLoading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:opacity-90'}`}
                  >
                    {isAiLoading ? 'Zaubert... 🪄' : 'Herbeizaubern'}
                  </button>
                  <p className="mt-4 text-[9px] text-purple-400 text-center leading-relaxed">Die KI berechnet ein dreidimensionales Modell und platziert es im Raster.</p>
                </div>
              </div>
            )}

            {sidebarTab === 'werkzeug' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-10">
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
                </section>

                <section>
                   <h3 className="text-[11px] uppercase tracking-[0.1em] font-bold text-gray-400 mb-4 flex items-center gap-2">
                     <span className="w-4 h-[1px] bg-gray-200" /> Ansicht
                   </h3>
                   <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                     <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Gitternetz</span>
                     <button 
                        onClick={() => setShowGrid(!showGrid)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${showGrid ? 'bg-blue-600' : 'bg-gray-300'}`}
                     >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showGrid ? 'left-5' : 'left-1'}`} />
                     </button>
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
        </aside>

        {/* Right Content: 3D Viewport (React Three Fiber) */}
        <div className="flex-1 relative flex items-center justify-center p-0 m-0 transition-colors duration-500" style={{
           backgroundImage: `radial-gradient(circle, ${isNightMode ? '#1e1b4b' : '#d1d5db'} 1px, transparent 1px)`,
           backgroundColor: isNightMode ? '#010103' : '#f3f4f6',
           backgroundSize: '40px 40px'
        }}
        onPointerUp={(e) => {
           // Handle placement on "empty" space if height lock is active
           if (e.button === 0 && shiftState.current.active && !isDrag(e)) {
              addBlock(ghostPosRef.current);
           }
        }}
        >
          <Canvas 
            shadows={{ type: THREE.PCFShadowMap }} 
            camera={{ position: [10, 10, 10], fov: 45 }} 
            gl={{ alpha: true, antialias: true, stencil: false, depth: true, toneMapping: THREE.ACESFilmicToneMapping }}
          >
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 1.8} minDistance={2} maxDistance={100} />
        
        <ambientLight 
          intensity={isNightMode ? 0.35 : 0.6} 
          color={isNightMode ? "#7788dd" : "#ffffff"} 
        />
        
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={isNightMode ? 0.35 : 1.5} 
          color={isNightMode ? "#5566aa" : "#fff4e5"}
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />

        {isNightMode ? (
           <group>
              <pointLight position={[-20, 10, -20]} intensity={0.5} color="#223366" />
              <pointLight position={[20, 10, 20]} intensity={0.2} color="#112244" />
              <pointLight position={[0, 15, 0]} intensity={0.3} color="#223388" distance={50} />
               {blocks.filter(b => COLOR_MAP.get(b.color)?.isGlow).slice(0, 30).map((b) => (
                  <pointLight 
                    key={`light-${b.id}`}
                    position={[b.position[0], b.position[1] + 0.4, b.position[2]]}
                    intensity={10.0}
                    distance={8}
                    color={COLOR_MAP.get(b.color)?.emissive}
                    decay={2}
                  />
               ))}
           </group>
        ) : (
           <Sky sunPosition={[10, 20, 10]} turbidity={0.1} rayleigh={0.5} />
        )}
        
        <Environment preset={isNightMode ? "night" : "city"} />
        <SceneSettings isNightMode={isNightMode} />

        {/* Baseplate / Floor */}
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, -0.5, 0]} 
          receiveShadow
          onPointerUp={(e) => {
            e.stopPropagation();
            if (isDrag(e)) return;
            if ((window as any)._shiftIsActive) return; // Managed globally when height locking
            if (e.button === 0) {
              const n = new THREE.Vector3(0, 1, 0);
              addBlock(getGridPos(e.point, n, currentPart.size, snapToGrid, currentRotation));
            }
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            const n = new THREE.Vector3(0, 1, 0);
            updateGhost(true, getGridPos(e.point, n, currentPart.size, snapToGrid, currentRotation));
          }}
          onPointerOut={() => {
            updateGhost(false);
          }}
          onContextMenu={(e) => e.stopPropagation()} // Prevent default context menu on floor
        >
          <planeGeometry args={[32, 32]} />
          <meshStandardMaterial 
            color={isNightMode ? "#2a2a35" : "#e5e7eb"} 
            roughness={isNightMode ? 0.3 : 0.7} 
            metalness={isNightMode ? 0.2 : 0.05} 
            opacity={showGrid ? 0.6 : 1.0} 
            transparent={showGrid} 
            side={THREE.DoubleSide} 
            depthWrite={true} 
          />
        </mesh>
        
        {/* Environmental Helpers */}
        {showGrid ? (
          <gridHelper args={[32, 64, isNightMode ? 0x4444ff : 0x000000, isNightMode ? 0x222266 : 0x000000]} position={[0, -0.49, 0]} material-opacity={isNightMode ? 0.2 : 0.1} material-transparent />
        ) : (
          <BaseplateStuds isNightMode={isNightMode} />
        )}

        {/* The World Content: Bricks being rendered using efficient instancing */}
        <InstancedBlocksGroup 
          blocks={blocks}
          geometries={geometries}
          addBlock={addBlock}
          removeBlock={removeBlock}
          updateGhost={updateGhost}
          snapToGrid={snapToGrid}
          currentPart={currentPart}
          currentRotation={currentRotation}
          isDrag={isDrag}
        />

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
                  roughness={0.2}
                  depthWrite={false}
                  emissive={isNightMode ? currentColor : '#000000'}
                  emissiveIntensity={isNightMode ? 0.8 : 0.2}
               />
               <lineSegments raycast={() => null}>
                  <edgesGeometry args={[geometries[currentPartId].visual]} />
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
        Position: {blocks.length > 0 ? blocks[blocks.length - 1].position.map((n: number) => n.toFixed(1)).join(', ') : '0, 0, 0'} &nbsp; | &nbsp; Bauteile: {blocks.length} &nbsp; | &nbsp; Raster: {snapToGrid ? '1' : 'Frei'}
      </div>
      
        </div>
      </main>
    </div>
  );
}
