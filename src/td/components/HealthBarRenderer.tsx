import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { tdEngine } from '../tdEngine';
import { TD_CONFIG, voxelToWorld } from '../../core/config';

const dummy = new THREE.Object3D();
const s0 = new THREE.Matrix4().makeScale(0, 0, 0);

export const HealthBarRenderer = () => {
  const hpBgMeshRef = useRef<THREE.InstancedMesh>(null);
  const hpFgMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    return () => {
      [hpBgMeshRef, hpFgMeshRef].forEach(ref => {
        if (ref.current) {
          ref.current.geometry?.dispose();
          if (Array.isArray(ref.current.material)) {
              ref.current.material.forEach(m => m.dispose());
          } else {
              ref.current.material?.dispose();
          }
        }
      });
    };
  }, []);

  useFrame((state) => {
    if (!hpBgMeshRef.current || !hpFgMeshRef.current) return;
    const progress = Math.min(tdEngine.timeAccumulator / TD_CONFIG.GAME_TICK_INTERVAL, 1.0);
    const enemies = tdEngine.getEnemies();

    for (let i = 0; i < TD_CONFIG.MAX_ENEMIES; i++) {
        const enemy = enemies[i];

        if (enemy && enemy.active) {
            const [lx, ly, lz] = voxelToWorld(enemy.lastPos[0], enemy.lastPos[1], enemy.lastPos[2]);
            const [nx, ny, nz] = voxelToWorld(enemy.nextPos[0], enemy.nextPos[1], enemy.nextPos[2]);

            const x = lx + (nx - lx) * progress;
            const y = ly + (ny - ly) * progress;
            const z = lz + (nz - lz) * progress;

            // HP Background (Red)
            dummy.position.set(x, y + 0.8, z);
            dummy.rotation.set(0, 0, 0);
            dummy.lookAt(state.camera.position);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            hpBgMeshRef.current.setMatrixAt(i, dummy.matrix);

            // HP Foreground (Green)
            dummy.position.set(x, y + 0.8, z);
            dummy.rotation.set(0, 0, 0);
            dummy.lookAt(state.camera.position);
            const hpRatio = Math.max(0, enemy.hp / 100);
            dummy.translateX(-0.2 * (1 - hpRatio)); // align left inside the bg
            dummy.translateZ(0.01); // slight forward
            dummy.scale.set(hpRatio, 1, 1);
            dummy.updateMatrix();
            hpFgMeshRef.current.setMatrixAt(i, dummy.matrix);
        } else {
            hpBgMeshRef.current.setMatrixAt(i, s0);
            hpFgMeshRef.current.setMatrixAt(i, s0);
        }
    }
    
    hpBgMeshRef.current.instanceMatrix.needsUpdate = true;
    hpFgMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={hpBgMeshRef} args={[undefined, undefined, TD_CONFIG.MAX_ENEMIES]}>
        <planeGeometry args={[0.4, 0.05]} />
        <meshBasicMaterial color="#ff0000" depthTest={false} transparent />
      </instancedMesh>

      <instancedMesh ref={hpFgMeshRef} args={[undefined, undefined, TD_CONFIG.MAX_ENEMIES]}>
        <planeGeometry args={[0.4, 0.05]} />
        <meshBasicMaterial color="#00ff00" depthTest={false} transparent />
      </instancedMesh>
    </>
  );
};
