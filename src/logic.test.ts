import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getGridPos } from './builder/grid';
import { getCollisionBoxes, checkCollision } from './builder/collision';
import { PARTS, PART_MAP } from './builder/partsData';
import { performStabilityCheck } from './builder/physics';

describe('Brickcraft Build Logic', () => {
  it('getGridPos should snap positions to the grid correctly with rotation', () => {
    // 2x4 block, height 1
    const size = [2, 4, 1]; 
    const point = new THREE.Vector3(1.1, 0.4, 2.8);
    const normal = new THREE.Vector3(0, 1, 0); // Adding on top
    
    // Test base case - unrotated block
    const pos = getGridPos(point, normal, size, true, 0);
    expect(pos[0]).toBe(1.0); // 1.1 snapped to 1.0 (with sx offset logic)
    
    // Rotated block (90 degrees, rot=1)
    const posRot = getGridPos(point, normal, size, true, 1);
    expect(posRot.length).toBe(3);
  });

  it('getCollisionBoxes should generate multiple boxes for L-corner parts', () => {
    const pos = [0, 0, 0];
    const part = { 
      id: 'corner_2x2', label: 'L-Form', size: [2, 2, 1], type: 'corner' 
    };
    
    const boxes = getCollisionBoxes(pos, part, 0);
    // A corner part returns 2 sub-boxes for the L-shape
    expect(boxes.length).toBe(2);
    
    // Let's verify the boxes overlap logic is intact
    // Corner sub-boxes should be contained within the 2x2 area
    expect(boxes[0].maxX - boxes[0].minX).toBeLessThanOrEqual(2);
    expect(boxes[1].maxZ - boxes[1].minZ).toBeLessThanOrEqual(2);
  });

  it('checkCollision should not collide when touching sides', () => {
    const partA = PART_MAP.get('brick_1x2'); // [1, 2, 1]
    const partB = PART_MAP.get('brick_1x2'); // [1, 2, 1]

    // Block A at center
    const posA = [0, 0, 0];
    // Block B shifted by 1 unit in X. 
    // Since width is 1.0, they should just touch their edges, not intersect.
    const posB = [1.0, 0, 0];
    
    expect(checkCollision(posA, partA, 0, posB, partB, 0)).toBe(false);
  });

  it('getCollisionBoxes should generate bounding boxes correctly based on size and rotation', () => {
    const pos = [0, 0, 0];
    const part = PART_MAP.get('brick_1x2');
    
    const boxes = getCollisionBoxes(pos, part, 0);
    expect(boxes.length).toBeGreaterThan(0);
    
    const rotatedBoxes = getCollisionBoxes(pos, part, 1);
    expect(rotatedBoxes[0].maxX - rotatedBoxes[0].minX).toBeCloseTo(1.0); 
    expect(rotatedBoxes[0].maxZ - rotatedBoxes[0].minZ).toBeCloseTo(0.5); 
  });

  it('checkCollision should detect intersecting blocks', () => {
    // 1x1 block
    const partA = PART_MAP.get('brick_1x1');
    const partB = PART_MAP.get('brick_1x1');
    
    // Exactly overlapping
    expect(checkCollision([0, 0, 0], partA, 0, [0, 0, 0], partB, 0)).toBe(true);
    
    // Touching but not intersecting
    expect(checkCollision([0, 0, 0], partA, 0, [1, 0, 0], partB, 0)).toBe(false);
    expect(checkCollision([0, 0, 0], partA, 0, [0, 1.0, 0], partB, 0)).toBe(false);
  });

  it('performStabilityCheck should correctly identify unsupported (falling) blocks', () => {
    // block 0 on ground (y ~ -0.2 so minY is -0.5)
    const blocks = [
      { id: 'b1', position: [0, -0.2, 0], partId: 'brick_2x4', rotation: 0 },
      // block 1 resting on block 0
      { id: 'b2', position: [0, 0.4, 0], partId: 'brick_2x4', rotation: 0 },
      // block 2 floating in air
      { id: 'b3', position: [10, 5, 10], partId: 'brick_2x4', rotation: 0 },
    ];
    
    const { supportedIds, fallingIds } = performStabilityCheck(blocks, PARTS);
    
    expect(supportedIds.has('b1')).toBe(true); // Base block
    expect(supportedIds.has('b2')).toBe(true); // Supported by b1
    
    expect(supportedIds.has('b3')).toBe(false); // Floating
    expect(fallingIds.has('b3')).toBe(true);
  });
});
