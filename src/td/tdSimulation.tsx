import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { tdEngine } from './tdEngine';
import { TD_CONFIG } from '../core/config';
import { PART_MAP, COLOR_MAP, getCategory } from '../builder/partsData';
import { normalizePos } from '../builder/grid';
import { CrystalGeometry } from './CrystalGeometry';
import { CrystalGeometryV2 } from './CrystalGeometryV2';
import { Block } from '../core/types';

import { EnemyRenderer } from './components/EnemyRenderer';
import { ProjectileRenderer } from './components/ProjectileRenderer';
import { TowerRenderer } from './components/TowerRenderer';
import { HealthBarRenderer } from './components/HealthBarRenderer';

const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();

export const TdSimulation = ({ gameMode, blocks = [], geometries = {}, removeBlock, isDrag, pointerDownPos }: { gameMode: string, blocks?: Block[], geometries?: any, removeBlock?: any, isDrag?: any, pointerDownPos?: any }) => {
  const crystals = useMemo(() => blocks.filter(b => getCategory(b.partId) === 'objective' && b.partId !== 'logic_td_crystal_v2'), [blocks]);
  const crystalsV2 = useMemo(() => blocks.filter(b => getCategory(b.partId) === 'objective' && b.partId === 'logic_td_crystal_v2'), [blocks]);
  const spawners = useMemo(() => blocks.filter(b => getCategory(b.partId) === 'spawner'), [blocks]);

  const spawnMeshRef = useRef<THREE.InstancedMesh>(null);

  useFrame((state, delta) => {
    if (gameMode === 'play') {
      tdEngine.timeAccumulator += delta;
      if (tdEngine.timeAccumulator >= TD_CONFIG.GAME_TICK_INTERVAL) {
        tdEngine.tick();
        tdEngine.timeAccumulator -= TD_CONFIG.GAME_TICK_INTERVAL;
      }
    }

    if (spawnMeshRef.current) {
        spawners.forEach((b, i) => {
             const p = normalizePos(b.position);
             dummy.position.set(p[0], p[1], p[2]);
             dummy.rotation.set(0, (b.rotation || 0) * (Math.PI / 2), 0);
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             spawnMeshRef.current!.setMatrixAt(i, dummy.matrix);
             
             const baseColMeta = COLOR_MAP.get(b.color) || { value: b.color || '#ffffff' };
             tempColor.set(baseColMeta.value);
             spawnMeshRef.current!.setColorAt(i, tempColor);
        });
        spawnMeshRef.current.instanceMatrix.needsUpdate = true;
        if (spawnMeshRef.current.instanceColor) {
            spawnMeshRef.current.instanceColor.needsUpdate = true;
        }
        
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
      <EnemyRenderer />
      <ProjectileRenderer />
      <HealthBarRenderer />
      <TowerRenderer blocks={blocks} geometries={geometries} getPointerEvents={getPointerEvents} />

      {crystals.map((c, i) => {
           const p = normalizePos(c.position);
           return (
               <group 
                  key={c.id}
                  position={[p[0], p[1], p[2]]}
                  rotation-y={(c.rotation || 0) * (Math.PI / 2)}
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
                  rotation-y={(c.rotation || 0) * (Math.PI / 2)}
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
    </>
  );
};
