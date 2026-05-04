import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { normalizePos } from '../../builder/grid';
import { COLOR_MAP } from '../../builder/partsData';

const dummy = new THREE.Object3D();
const s0 = new THREE.Matrix4().makeScale(0, 0, 0);
const tempColor = new THREE.Color();

export const TowerRenderer = ({ blocks, geometries, getPointerEvents }: { blocks: any[], geometries: any, getPointerEvents: any }) => {
  const towerMetadata = useRef(new Map<string, { type: string, recoilValue: number }>());
  const rapidTowerMeshRef = useRef<THREE.InstancedMesh>(null);
  const heavyTowerMeshRef = useRef<THREE.InstancedMesh>(null);
  
  const rapidTowers = useMemo(() => blocks.filter(b => b.partId === 'logic_td_tower_rapid'), [blocks]);
  const heavyTowers = useMemo(() => blocks.filter(b => b.partId === 'logic_td_tower_heavy'), [blocks]);

  useEffect(() => {
    return () => {
      [rapidTowerMeshRef, heavyTowerMeshRef].forEach(ref => {
        if (ref.current) {
          // Do NOT dispose geometry here as it is shared from App.tsx
          if (Array.isArray(ref.current.material)) {
              ref.current.material.forEach(m => m.dispose());
          } else {
              ref.current.material?.dispose();
          }
        }
      });
    };
  }, []);

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

  useFrame((state, delta) => {
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
             dummy.rotation.set(0, (b.rotation || 0) * (Math.PI / 2), 0);
             if (recoil > 0) {
                 dummy.translateZ(recoil * -0.2); 
             }
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             rapidTowerMeshRef.current!.setMatrixAt(i, dummy.matrix);
             
             const baseColMeta = COLOR_MAP.get(b.color) || { value: b.color || '#ffffff' };
             tempColor.set(baseColMeta.value);
             rapidTowerMeshRef.current!.setColorAt(i, tempColor);
        });
        rapidTowerMeshRef.current.instanceMatrix.needsUpdate = true;
        if (rapidTowerMeshRef.current.instanceColor) rapidTowerMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (heavyTowerMeshRef.current) {
        heavyTowers.forEach((b, i) => {
             const p = normalizePos(b.position);
             const key = `${Math.floor(p[0])},${Math.floor(p[2])}`;
             const meta = towerMetadata.current.get(key);
             const recoil = meta ? meta.recoilValue : 0;
             
             dummy.position.set(p[0], p[1], p[2]);
             dummy.rotation.set(0, (b.rotation || 0) * (Math.PI / 2), 0);
             if (recoil > 0) {
                 dummy.rotation.x -= recoil * Math.PI / 8;
             }
             dummy.scale.set(1, 1, 1);
             dummy.updateMatrix();
             heavyTowerMeshRef.current!.setMatrixAt(i, dummy.matrix);
             
             const baseColMeta = COLOR_MAP.get(b.color) || { value: b.color || '#ffffff' };
             tempColor.set(baseColMeta.value);
             heavyTowerMeshRef.current!.setColorAt(i, tempColor);
        });
        heavyTowerMeshRef.current.instanceMatrix.needsUpdate = true;
        if (heavyTowerMeshRef.current.instanceColor) heavyTowerMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
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
