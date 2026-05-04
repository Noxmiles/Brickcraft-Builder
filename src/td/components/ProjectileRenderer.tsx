import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { tdEngine } from '../tdEngine';
import { TD_CONFIG, voxelToWorld } from '../../core/config';

const pDummy = new THREE.Object3D();
const s0 = new THREE.Matrix4().makeScale(0, 0, 0);
const colorRapid = new THREE.Color('#ff8800');
const colorHeavy = new THREE.Color('#00ccff');

export const ProjectileRenderer = () => {
  const projectileMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    return () => {
      if (projectileMeshRef.current) {
        projectileMeshRef.current.geometry?.dispose();
        if (Array.isArray(projectileMeshRef.current.material)) {
            projectileMeshRef.current.material.forEach(m => m.dispose());
        } else {
            projectileMeshRef.current.material?.dispose();
        }
      }
    };
  }, []);

  useEffect(() => {
    if (projectileMeshRef.current && projectileMeshRef.current.geometry) {
        projectileMeshRef.current.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(new Float32Array(TD_CONFIG.MAX_PROJECTILES * 3), 3));
    }
  }, []);

  useFrame(() => {
    if (!projectileMeshRef.current) return;
    const progress = Math.min(tdEngine.timeAccumulator / TD_CONFIG.GAME_TICK_INTERVAL, 1.0);
    const projectiles = tdEngine.activeProjectiles;
    const enemies = tdEngine.getEnemies();

    for (let i = 0; i < TD_CONFIG.MAX_PROJECTILES; i++) {
        const proj = projectiles[i];

        if (proj && proj.active) {
            let targetX = proj.targetX;
            let targetY = proj.targetY;
            let targetZ = proj.targetZ;

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
  });

  return (
      <instancedMesh ref={projectileMeshRef} args={[undefined, undefined, TD_CONFIG.MAX_PROJECTILES]} frustumCulled={false} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial roughness={0.2} metalness={0.1} />
      </instancedMesh>
  );
};
