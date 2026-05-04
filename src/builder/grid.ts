import * as THREE from 'three';
import { GRID_UNIT_WIDTH, GRID_UNIT_HEIGHT, PLATE_HEIGHT } from './partsData';

export const normalizePos = (p: any): number[] => {
  if (Array.isArray(p)) return [isNaN(p[0]) ? 0 : p[0], isNaN(p[1]) ? 0 : p[1], isNaN(p[2]) ? 0 : p[2]];
  return [p?.x || 0, p?.y || 0, p?.z || 0];
};

/**
 * Calculates the exact world position for a part based on user cursor raycasting and alignment rules.
 * Automatically aligns and snaps blocks to grid units.
 * 
 * @param point The raw Raycast intersection coordinate
 * @param normal The normal vector of the face being intersected
 * @param size The array defining block size [width, depth, height]
 * @param snapToGrid Whether to force grid snapping
 * @param rotation Current rotation state (0-3)
 * @param allowHalfStud Used for special blocks e.g. Jumpers where half-stud logic applies
 * @returns Final calculated [X, Y, Z] world position
 */
export function getGridPos(point: THREE.Vector3, normal: THREE.Vector3, size: number[], snapToGrid: boolean, rotation: number, allowHalfStud: boolean = false): number[] {
  const isRotated = rotation % 2 !== 0;
  const sx = isRotated ? size[1] : size[0];
  const sz = isRotated ? size[0] : size[1];
  const sy = size[2];

  if (!snapToGrid) {
     return [
       point.x + normal.x * (sx * GRID_UNIT_WIDTH * 0.5), 
       point.y + normal.y * (sy * GRID_UNIT_HEIGHT * 0.5), 
       point.z + normal.z * (sz * GRID_UNIT_WIDTH * 0.5)
     ];
  }

  const gridSize = allowHalfStud ? (GRID_UNIT_WIDTH * 0.5) : GRID_UNIT_WIDTH;

  const offsetX = sx * GRID_UNIT_WIDTH * 0.5;
  const targetX = point.x + normal.x * offsetX;
  const snappedX = Math.round((targetX - offsetX) / gridSize) * gridSize + offsetX;

  const offsetZ = sz * GRID_UNIT_WIDTH * 0.5;
  const targetZ = point.z + normal.z * offsetZ;
  const snappedZ = Math.round((targetZ - offsetZ) / gridSize) * gridSize + offsetZ;

  const targetCenterY = point.y + normal.y * (sy * GRID_UNIT_HEIGHT * 0.5);
  const targetBottomY = targetCenterY - sy * GRID_UNIT_HEIGHT * 0.5;
  const worldPlateHeight = PLATE_HEIGHT * GRID_UNIT_HEIGHT;
  const stepsY = Math.round((targetBottomY - (-0.5)) / worldPlateHeight);
  const snappedBottomY = -0.5 + stepsY * worldPlateHeight;
  const snappedY = snappedBottomY + sy * GRID_UNIT_HEIGHT * 0.5;

  return [snappedX, snappedY, snappedZ];
}
