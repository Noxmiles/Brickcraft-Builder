import React, { forwardRef } from 'react';
import * as THREE from 'three';

interface CrystalGeometryV2Props {
    color?: string;
    material?: any;
}

/**
 * `CrystalGeometryV2` provides the updated v2 3D geometry for the Energy Crystal.
 * Built with a classic block-based toy aesthetic (faceted edges, 4 outer spikes, 1 center spike),
 * precisely sitting on a 1x1 footprint base.
 */
export const CrystalGeometryV2 = forwardRef<THREE.Group, CrystalGeometryV2Props>(({ color = '#AEE9EF', material }, ref) => {
    // Determine the base Y position.
    const baseY = -1.8; 
    const baseHeight = 0.15; // Small 1x1 base
    const centerRadius = 0.24; // 1x1 stud footprint is 0.5 world unit
    const centerHeight = 2.4; // Taller spike
    
    // Outer spikes
    const outerRadius = 0.12;
    const outerHeight = 1.4;

    const createMaterial = () => {
        if (material) return material;
        return (
            <meshPhysicalMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                transmission={0.9}
                opacity={1}
                metalness={0.1}
                roughness={0.1}
                ior={1.5}
                thickness={2.0}
                transparent={true}
            />
        );
    };

    const getMaterial = () => typeof material === 'object' ? undefined : createMaterial();

    return (
        <group ref={ref}>
            {/* The base 1x1 flat box */}
            <mesh position={[0, baseY + baseHeight / 2, 0]} material={typeof material === 'object' ? material : undefined}>
                <boxGeometry args={[0.48, baseHeight, 0.48]} />
                {getMaterial()}
            </mesh>

            {/* Center spike - 4-sided pyramid / cone */}
            <mesh position={[0, baseY + baseHeight + centerHeight / 2, 0]} material={typeof material === 'object' ? material : undefined}>
                <cylinderGeometry args={[0, centerRadius, centerHeight, 4]} />
                {getMaterial()}
            </mesh>

            {/* Outer spikes */}
            {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => {
                const tiltAngle = 15 * (Math.PI / 180); // tilt slightly outward
                const outDist = 0.14;

                return (
                    <group key={i} rotation={[0, angle + Math.PI / 4, 0]}> 
                        <group position={[0, 0, outDist]}>
                            <mesh 
                                rotation={[tiltAngle, 0, 0]}
                                position={[0, baseY + baseHeight + outerHeight / 2 - 0.1, 0]}
                                material={typeof material === 'object' ? material : undefined}>
                                <cylinderGeometry args={[0, outerRadius, outerHeight, 4]} />
                                {getMaterial()}
                            </mesh>
                        </group>
                    </group>
                );
            })}
        </group>
    );
});
