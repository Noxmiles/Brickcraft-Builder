import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { tdEngine } from './tdEngine';
import { PART_MAP, normalizePos, COLOR_MAP } from './parts';
import { CrystalGeometry } from './CrystalGeometry';
import { CrystalGeometryV2 } from './CrystalGeometryV2';

const MAX_ENEMIES = 500;
const MAX_PROJECTILES = 1500;

const LAWYER_VOXELS = [
    { color: '#444444', offset: [0, 0.1, 0] }, // Beine
    { color: '#111111', offset: [0, 0.3, 0] }, // Torso
    { color: '#ffccaa', offset: [0, 0.5, 0] }, // Kopf
    { color: '#663300', offset: [0.2, 0.2, 0] }, // Aktenkoffer
];

const dummy = new THREE.Object3D();
const vDummy = new THREE.Object3D();
const pDummy = new THREE.Object3D();
const tempColor = new THREE.Color();
const colorRapid = new THREE.Color('#ff8800');
const colorHeavy = new THREE.Color('#00ccff');
const fMatrix = new THREE.Matrix4();
const s0 = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * World coordinates conversion logic:
 * Translates abstract engine voxel units into continuous Three.js rendering units.
 * Transforms:
 * X: voxel_x * 0.5 (Grid width)
 * Y: voxel_y * 0.2 - 0.5 (Grid height, adjusted for floor level base)
 * Z: voxel_z * 0.5 (Grid width)
 */
const voxelToWorld = (vx: number, vy: number, vz: number): [number, number, number] => {
  return [vx * 0.5, vy * 0.2 - 0.4, vz * 0.5]; // Y offset slightly so it stands on the block
};

/**
 * Highly optimized React-Three-Fiber component for visualizing the Tower Defense engine state.
 * Uses `THREE.InstancedMesh` extensively to render thousands of enemies and projectiles without
 * incurring React reconciliation overhead.
 * 
 * @param gameMode Whether currently in "build" or "play" state
 * @param blocks The array of placed objects in the world
 * @param geometries Pre-computed Three.js BufferGeometries for the different block types
 * @param removeBlock Function to delete a block on right-click
 * @param isDrag Callback to determine if user just clicked or dragged (prevents accidental deletes)
 * @param pointerDownPos Ref tracking the start location of a click for drag detection
 */
export const TdSimulation = ({ gameMode, blocks = [], geometries = {}, removeBlock, isDrag, pointerDownPos }: { gameMode: string, blocks?: any[], geometries?: any, removeBlock?: any, isDrag?: any, pointerDownPos?: any }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const projectileMeshRef = useRef<THREE.InstancedMesh>(null);
  const hpBgMeshRef = useRef<THREE.InstancedMesh>(null);
  const hpFgMeshRef = useRef<THREE.InstancedMesh>(null);
  
  const dummyShot = useMemo(() => new THREE.Object3D(), []);

  const towerMetadata = useRef(new Map<string, { type: string, recoilValue: number }>());
  const rapidTowerMeshRef = useRef<THREE.InstancedMesh>(null);
  const heavyTowerMeshRef = useRef<THREE.InstancedMesh>(null);
  
  const crystals = useMemo(() => blocks.filter(b => b.partId === 'logic_td_crystal'), [blocks]);
  const crystalsV2 = useMemo(() => blocks.filter(b => b.partId === 'logic_td_crystal_v2'), [blocks]);
  const spawners = useMemo(() => blocks.filter(b => b.partId === 'logic_td_spawn'), [blocks]);
  const rapidTowers = useMemo(() => blocks.filter(b => b.partId === 'logic_td_tower_rapid'), [blocks]);
  const heavyTowers = useMemo(() => blocks.filter(b => b.partId === 'logic_td_tower_heavy'), [blocks]);

  const spawnMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
      const newMap = new Map<string, { type: string, recoilValue: number }>();
      blocks.forEach(b => {
          if (b.partId === 'logic_td_tower_rapid' || b.partId === 'logic_td_tower_heavy') {
              const p = normalizePos(b.position);
              const x = Math.floor(p[0]);
              const z = Math.floor(p[2]);
              const key = `${x},${z}`;
              newMap.set(key, { type: b.partId, recoilValue: towerMetadata.current.get(key)?.recoilValue || 0 });
          }
      });
      towerMetadata.current = newMap;
  }, [blocks]);

  useEffect(() => {
      const handleRecoil = (e: any) => {
          const { x, z } = e.detail;
          const key = `${Math.floor(x)},${Math.floor(z)}`;
          const meta = towerMetadata.current.get(key);
          if (meta) {
              meta.recoilValue = 1.0;
          }
      };
      window.addEventListener('td-tower-recoil', handleRecoil);
      return () => window.removeEventListener('td-tower-recoil', handleRecoil);
  }, []);

  React.useEffect(() => {
    if (meshRef.current) {
        const tempColor = new THREE.Color();
        const total = MAX_ENEMIES * LAWYER_VOXELS.length;
        for (let i = 0; i < total; i++) {
            const voxel = LAWYER_VOXELS[i % LAWYER_VOXELS.length];
            tempColor.set(voxel.color);
            meshRef.current.setColorAt(i, tempColor);
        }
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    }
    
    // InstancedMesh Color-Puffer Fix
    if (projectileMeshRef.current && projectileMeshRef.current.geometry) {
        projectileMeshRef.current.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3));
    }
  }, []);

  useFrame((state, delta) => {
    if (gameMode === 'play') {
      tdEngine.timeAccumulator += delta;
      if (tdEngine.timeAccumulator >= 0.5) {
        tdEngine.tick();
        tdEngine.timeAccumulator -= 0.5;
      }
    }

    if (!meshRef.current || !projectileMeshRef.current) return;

    const enemies = tdEngine.getEnemies();
    const progress = Math.min(tdEngine.timeAccumulator / 0.5, 1.0);

    let iIdx = 0;

    for (let i = 0; i < MAX_ENEMIES; i++) {
      const enemy = enemies[i];

      if (enemy && enemy.active) {
        const [lx, ly, lz] = voxelToWorld(enemy.lastPos[0], enemy.lastPos[1], enemy.lastPos[2]);
        const [nx, ny, nz] = voxelToWorld(enemy.nextPos[0], enemy.nextPos[1], enemy.nextPos[2]);

        const dx = nx - lx;
        const dy = ny - ly;
        const dz = nz - lz;

        // Lerp position
        const x = lx + dx * progress;
        const y = ly + dy * progress;
        const z = lz + dz * progress;

        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);

        // Rotation
        const distSq = dx * dx + dz * dz;
        if (distSq > 0.0001) {
            dummy.rotation.y = Math.atan2(dx, dz);
        }
        dummy.updateMatrix();

        const w = Math.sin(state.clock.elapsedTime * 15 + enemy.id) * 0.05;

        for (let j = 0; j < LAWYER_VOXELS.length; j++) {
            const voxel = LAWYER_VOXELS[j];
            vDummy.position.set(voxel.offset[0], voxel.offset[1] + w, voxel.offset[2]);
            vDummy.rotation.set(0, 0, 0);
            vDummy.scale.set(1, 1, 1);
            vDummy.updateMatrix();
            
            fMatrix.multiplyMatrices(dummy.matrix, vDummy.matrix);
            meshRef.current.setMatrixAt(iIdx++, fMatrix);
        }

        // HP Background (Red)
        dummy.position.set(x, y + 0.8, z);
        dummy.rotation.set(0, 0, 0);
        dummy.lookAt(state.camera.position);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (hpBgMeshRef.current) hpBgMeshRef.current.setMatrixAt(i, dummy.matrix);

        // HP Foreground (Green)
        dummy.position.set(x, y + 0.8, z);
        dummy.rotation.set(0, 0, 0);
        dummy.lookAt(state.camera.position);
        const hpRatio = Math.max(0, enemy.hp / 100);
        dummy.translateX(-0.2 * (1 - hpRatio)); // align left inside the bg
        dummy.translateZ(0.01); // slight forward
        dummy.scale.set(hpRatio, 1, 1);
        dummy.updateMatrix();
        if (hpFgMeshRef.current) hpFgMeshRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        if (hpBgMeshRef.current) hpBgMeshRef.current.setMatrixAt(i, s0);
        if (hpFgMeshRef.current) hpFgMeshRef.current.setMatrixAt(i, s0);
      }
    }

    const totalCount = MAX_ENEMIES * LAWYER_VOXELS.length;
    while (iIdx < totalCount) {
        meshRef.current.setMatrixAt(iIdx++, s0);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (hpBgMeshRef.current) hpBgMeshRef.current.instanceMatrix.needsUpdate = true;
    if (hpFgMeshRef.current) hpFgMeshRef.current.instanceMatrix.needsUpdate = true;

    // Projectile simulation
    const projectiles = tdEngine.activeProjectiles;
    for (let i = 0; i < MAX_PROJECTILES; i++) {
        const proj = projectiles[i];

        if (proj && proj.active) {
            let targetX = proj.startX;
            let targetY = 0;
            let targetZ = proj.startZ;

            const targetEnemy = enemies.find(e => e.id === proj.targetEnemyId);
            
            if (targetEnemy && targetEnemy.active) {
                const [lx, ly, lz] = voxelToWorld(targetEnemy.lastPos[0], targetEnemy.lastPos[1], targetEnemy.lastPos[2]);
                const [nx, ny, nz] = voxelToWorld(targetEnemy.nextPos[0], targetEnemy.nextPos[1], targetEnemy.nextPos[2]);
                targetX = lx + (nx - lx) * progress;
                targetY = ly + (ny - ly) * progress;
                targetZ = lz + (nz - lz) * progress;
            }

            const visualProgress = Math.min(1.0, proj.progress + proj.speed * progress);
            const x = proj.startX + (targetX - proj.startX) * visualProgress;
            const y = proj.startY + (targetY - proj.startY) * visualProgress + Math.sin(visualProgress * Math.PI) * 0.5;
            const z = proj.startZ + (targetZ - proj.startZ) * visualProgress;
            
            pDummy.position.set(x, y, z);
            
            const dx = targetX - proj.startX;
            const dy = targetY - y;
            const dz = targetZ - proj.startZ;

            if (dx*dx + dz*dz > 0.001) {
                pDummy.lookAt(x + dx, y + dy, z + dz);
                pDummy.rotateX(Math.PI / 2);
            } else {
               pDummy.rotation.set(0, 0, 0);
            }

            pDummy.scale.set(1, 1, 1);
            pDummy.updateMatrix();
            projectileMeshRef.current.setMatrixAt(i, pDummy.matrix);
            projectileMeshRef.current.setColorAt(i, proj.type === 'heavy' ? colorHeavy : colorRapid);
        } else {
            projectileMeshRef.current.setMatrixAt(i, s0);
        }
    }
    
    projectileMeshRef.current.instanceMatrix.needsUpdate = true;
    if (projectileMeshRef.current.instanceColor) {
        projectileMeshRef.current.instanceColor.needsUpdate = true;
    }

    // Tower Recoil Update
    towerMetadata.current.forEach(meta => {
        if (meta.recoilValue > 0) {
            meta.recoilValue = Math.max(0, meta.recoilValue - delta * 5);
        }
    });

    if (rapidTowerMeshRef.current) {
        rapidTowers.forEach((b, i) => {
             const p = normalizePos(b.position);
             const key = `${Math.floor(p[0])},${Math.floor(p[2])}`;
             const meta = towerMetadata.current.get(key);
             const recoil = meta ? meta.recoilValue : 0;
             
             dummy.position.set(p[0], p[1], p[2]);
             dummy.rotation.set(0, b.rotation * (Math.PI / 2), 0);
             if (recoil > 0) {
                 dummy.translateZ(recoil * -0.2); 
             }
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             rapidTowerMeshRef.current!.setMatrixAt(i, dummy.matrix);
             
             const baseColMeta = COLOR_MAP.get(b.color) || { value: b.color };
             tempColor.set(baseColMeta.value);
             rapidTowerMeshRef.current!.setColorAt(i, tempColor);
        });
        rapidTowerMeshRef.current.instanceMatrix.needsUpdate = true;
        rapidTowerMeshRef.current.instanceColor!.needsUpdate = true;
    }

    if (heavyTowerMeshRef.current) {
        heavyTowers.forEach((b, i) => {
             const p = normalizePos(b.position);
             const key = `${Math.floor(p[0])},${Math.floor(p[2])}`;
             const meta = towerMetadata.current.get(key);
             const recoil = meta ? meta.recoilValue : 0;
             
             dummy.position.set(p[0], p[1], p[2]);
             dummy.rotation.set(0, b.rotation * (Math.PI / 2), 0);
             if (recoil > 0) {
                 dummy.rotation.x -= recoil * Math.PI / 8;
             }
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             heavyTowerMeshRef.current!.setMatrixAt(i, dummy.matrix);
             
             const baseColMeta = COLOR_MAP.get(b.color) || { value: b.color };
             tempColor.set(baseColMeta.value);
             heavyTowerMeshRef.current!.setColorAt(i, tempColor);
        });
        heavyTowerMeshRef.current.instanceMatrix.needsUpdate = true;
        heavyTowerMeshRef.current.instanceColor!.needsUpdate = true;
    }

    if (spawnMeshRef.current) {
        spawners.forEach((b, i) => {
             const p = normalizePos(b.position);
             dummy.position.set(p[0], p[1], p[2]);
             dummy.rotation.set(0, b.rotation * (Math.PI / 2), 0);
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             spawnMeshRef.current!.setMatrixAt(i, dummy.matrix);
             
             const baseColMeta = COLOR_MAP.get(b.color) || { value: b.color };
             tempColor.set(baseColMeta.value);
             spawnMeshRef.current!.setColorAt(i, tempColor);
        });
        spawnMeshRef.current.instanceMatrix.needsUpdate = true;
        spawnMeshRef.current.instanceColor!.needsUpdate = true;
        
        const mat = spawnMeshRef.current.material as THREE.MeshStandardMaterial;
        if (mat) {
             const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.5 + 0.5;
             mat.emissiveIntensity = 0.1 + pulse * 0.4;
        }
    }
  });

  const getPointerEvents = (list: any[]) => ({
     onPointerDown: (e: any) => {
        const cx = e.nativeEvent?.clientX ?? e.clientX ?? 0;
        const cy = e.nativeEvent?.clientY ?? e.clientY ?? 0;
        if (pointerDownPos) {
           pointerDownPos.current = { x: cx, y: cy };
        }
     },
     onPointerUp: (e: any) => {
        e.stopPropagation();
        if (isDrag && isDrag(e)) return;
        if (gameMode !== 'build') return;
        if (e.button === 2 && removeBlock) {
           const instanceId = e.instanceId;
           if (instanceId !== undefined && list[instanceId]) {
              removeBlock(list[instanceId].id);
           }
        }
     }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_ENEMIES * LAWYER_VOXELS.length]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      
      <instancedMesh ref={projectileMeshRef} args={[undefined, undefined, MAX_PROJECTILES]} frustumCulled={false} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshPhysicalMaterial roughness={0.1} transmission={0} thickness={0} emissive="#000" />
      </instancedMesh>

      <instancedMesh ref={hpBgMeshRef} args={[undefined, undefined, MAX_ENEMIES]}>
        <planeGeometry args={[0.4, 0.05]} />
        <meshBasicMaterial color="#ff0000" depthTest={false} transparent />
      </instancedMesh>

      <instancedMesh ref={hpFgMeshRef} args={[undefined, undefined, MAX_ENEMIES]}>
        <planeGeometry args={[0.4, 0.05]} />
        <meshBasicMaterial color="#00ff00" depthTest={false} transparent />
      </instancedMesh>

      {crystals.map((c, i) => {
           const p = normalizePos(c.position);
           return (
               <group 
                  key={c.id}
                  position={[p[0], p[1], p[2]]}
                  rotation-y={c.rotation * (Math.PI / 2)}
                  onPointerDown={(e) => getPointerEvents(crystals).onPointerDown(e)}
                  onPointerUp={(e) => {
                      e.stopPropagation();
                      e.instanceId = i;
                      getPointerEvents(crystals).onPointerUp(e);
                  }}
               >
                   <CrystalGeometry color={COLOR_MAP.get(c.color)?.value || c.color} />
               </group>
           )
      })}

      {crystalsV2.map((c, i) => {
           const p = normalizePos(c.position);
           return (
               <group 
                  key={c.id}
                  position={[p[0], p[1], p[2]]}
                  rotation-y={c.rotation * (Math.PI / 2)}
                  onPointerDown={(e) => getPointerEvents(crystalsV2).onPointerDown(e)}
                  onPointerUp={(e) => {
                      e.stopPropagation();
                      e.instanceId = i;
                      getPointerEvents(crystalsV2).onPointerUp(e);
                  }}
               >
                   <CrystalGeometryV2 color={COLOR_MAP.get(c.color)?.value || c.color} />
               </group>
           )
      })}

      {spawners.length > 0 && geometries['logic_td_spawn']?.visual && (
          <instancedMesh ref={spawnMeshRef} args={[geometries['logic_td_spawn'].visual, undefined, spawners.length]} castShadow receiveShadow {...getPointerEvents(spawners)}>
              <meshStandardMaterial color="#ffffff" emissive="#ff0000" emissiveIntensity={0.2} roughness={0.25} />
          </instancedMesh>
      )}

      {rapidTowers.length > 0 && geometries['logic_td_tower_rapid']?.visual && (
          <instancedMesh ref={rapidTowerMeshRef} args={[geometries['logic_td_tower_rapid'].visual, undefined, rapidTowers.length]} castShadow receiveShadow {...getPointerEvents(rapidTowers)}>
              <meshStandardMaterial color="#ffffff" roughness={0.25} />
          </instancedMesh>
      )}
      
      {heavyTowers.length > 0 && geometries['logic_td_tower_heavy']?.visual && (
          <instancedMesh ref={heavyTowerMeshRef} args={[geometries['logic_td_tower_heavy'].visual, undefined, heavyTowers.length]} castShadow receiveShadow {...getPointerEvents(heavyTowers)}>
              <meshStandardMaterial color="#ffffff" roughness={0.25} />
          </instancedMesh>
      )}
    </>
  );
};
