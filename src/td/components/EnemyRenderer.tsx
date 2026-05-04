import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { tdEngine } from '../tdEngine';
import { TD_CONFIG, LAWYER_VOXELS, voxelToWorld } from '../../core/config';

const dummy = new THREE.Object3D();
const vDummy = new THREE.Object3D();
const fMatrix = new THREE.Matrix4();
const s0 = new THREE.Matrix4().makeScale(0, 0, 0);

export const EnemyRenderer = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.geometry?.dispose();
        if (Array.isArray(meshRef.current.material)) {
            meshRef.current.material.forEach(m => m.dispose());
        } else {
            meshRef.current.material?.dispose();
        }
      }
    };
  }, []);

  useEffect(() => {
    if (meshRef.current) {
        const tempColor = new THREE.Color();
        const total = TD_CONFIG.MAX_ENEMIES * LAWYER_VOXELS.length;
        for (let i = 0; i < total; i++) {
            const voxel = LAWYER_VOXELS[i % LAWYER_VOXELS.length];
            tempColor.set(voxel.color);
            meshRef.current.setColorAt(i, tempColor);
        }
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    }
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const progress = Math.min(tdEngine.timeAccumulator / TD_CONFIG.GAME_TICK_INTERVAL, 1.0);
    const enemies = tdEngine.getEnemies();
    let iIdx = 0;

    for (let i = 0; i < TD_CONFIG.MAX_ENEMIES; i++) {
      const enemy = enemies[i];

      if (enemy && enemy.active) {
        const [lx, ly, lz] = voxelToWorld(enemy.lastPos[0], enemy.lastPos[1], enemy.lastPos[2]);
        const [nx, ny, nz] = voxelToWorld(enemy.nextPos[0], enemy.nextPos[1], enemy.nextPos[2]);

        const dx = nx - lx;
        const dy = ny - ly;
        const dz = nz - lz;

        const x = lx + dx * progress;
        const y = ly + dy * progress;
        const z = lz + dz * progress;

        dummy.position.set(x, y, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);

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
      }
    }

    const totalCount = TD_CONFIG.MAX_ENEMIES * LAWYER_VOXELS.length;
    while (iIdx < totalCount) {
        meshRef.current.setMatrixAt(iIdx++, s0);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
      <instancedMesh ref={meshRef} args={[undefined, undefined, TD_CONFIG.MAX_ENEMIES * LAWYER_VOXELS.length]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
  );
};
