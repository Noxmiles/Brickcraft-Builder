import React, { forwardRef, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { tdEngine } from './tdEngine';

const CrystalRod = ({ radius, height, material, position, rotation }: any) => {
    // 6-sided rod with pointed tip
    const tipH = radius * 1.5;
    const bodyH = height - tipH;

    return (
        <group position={position} rotation={rotation}>
            <mesh position={[0, -tipH / 2, 0]} material={material}>
                <cylinderGeometry args={[radius, radius, bodyH, 6]} />
            </mesh>
            <mesh position={[0, bodyH / 2, 0]} material={material}>
                <cylinderGeometry args={[0, radius, tipH, 6]} />
            </mesh>
        </group>
    );
};

/**
 * `CrystalGeometry` provides the original stylized 3D geometry for the Energy Crystal (Objective).
 * Features a glowing core that pulses red when health gets low, and a complex
 * array of translucent rod primitives.
 */
export const CrystalGeometry = forwardRef<THREE.Group, { color?: string, material?: any }>(({ color = '#AEE9EF', material }, ref) => {
    const materialsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);

    useFrame(({ clock }) => {
        if (material) return; // Do not pulse if custom material is provided (e.g. Ghost)
        if (tdEngine.crystalHp < 10) {
            const pulse = Math.sin(clock.elapsedTime * 10) * 0.5 + 0.5;
            materialsRef.current.forEach(mat => {
                if (mat) {
                    mat.emissive.set('#00ff00').lerp(new THREE.Color('#ff0000'), pulse * 0.8);
                }
            });
        } else {
            materialsRef.current.forEach(mat => {
                if (mat) {
                    mat.emissive.set('#00ff00');
                }
            });
        }
    });

    const registerMat = (mat: THREE.MeshPhysicalMaterial | null) => {
        if (mat && !materialsRef.current.includes(mat)) {
            materialsRef.current.push(mat);
        }
    };

    const createMaterial = () => {
        if (material) return material;
        return (
            <meshPhysicalMaterial 
                ref={registerMat}
                color={color}
                roughness={0.1}
                transmission={0.9} // Glassy look
                thickness={0.5}
                opacity={1}
                transparent
                emissive="#00ff00"
                emissiveIntensity={0.2}
            />
        );
    };

    // Bounding volume is 2x2x6 array in App.tsx
    // Full height is 6 * 0.6 = 3.6.
    // Center Y is 0. Base of the block is at -1.8.
    const baseY = -1.8;
    const baseHeight = 0.4; // 2 * 0.2 (plate/tile doubled)
    const baseRadius = 0.4; // 2x2 base

    const crystalHeight = 3.6 - baseHeight; // The rest of the height
    const centerRadius = 0.24; // Original 0.12 doubled
    const sideRadius = 0.16; // Original 0.08 doubled
    const sideHeight = crystalHeight * 0.6; // Original 60%

    // Since we pass material down as a prop, we need primitive if `material` is an object.
    const getMaterial = () => typeof material === 'object' ? undefined : createMaterial();

    return (
        <group ref={ref}>
            {/* The base 2x2 round plate/tile */}
            <mesh position={[0, baseY + baseHeight / 2, 0]} material={typeof material === 'object' ? material : undefined}>
                <cylinderGeometry args={[baseRadius, baseRadius, baseHeight, 16]} />
                {getMaterial()}
            </mesh>

            {/* Central Crystal */}
            <CrystalRod 
                radius={centerRadius} 
                height={crystalHeight} 
                material={typeof material === 'object' ? material : undefined} 
                position={[0, baseY + baseHeight + crystalHeight / 2, 0]} 
                rotation={[0, 0, 0]} 
                {...(getMaterial() ? { children: getMaterial() } : {})}
            />

            {/* 4 Side Crystals */}
            {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => {
                // Offset sideways from the center, so they sprout from the base
                const tiltAngle = 20 * (Math.PI / 180); // ~70 deg from horizontal
                const outDist = 0.16; // original 0.08 doubled

                return (
                    <group key={i} rotation-y={angle}>
                        <CrystalRod 
                            radius={sideRadius} 
                            height={sideHeight} 
                            material={typeof material === 'object' ? material : undefined} 
                            position={[0, baseY + baseHeight + sideHeight / 2 - 0.2, outDist]} 
                            rotation={[tiltAngle, 0, 0]} 
                            {...(getMaterial() ? { children: getMaterial() } : {})}
                        />
                    </group>
                );
            })}
        </group>
    );
});

