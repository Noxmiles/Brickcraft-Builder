import * as THREE from 'three';
import { PART_MAP } from './partsData';
import { getCollisionBoxes } from './collision';

export class Octree {
  nodes: Octree[] = [];
  objects: any[] = [];
  bounds: { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number };
  capacity = 8;
  depth: number;

  constructor(bounds: { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  subdivide() {
    const { minX, maxX, minY, maxY, minZ, maxZ } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;

    this.nodes = [
      new Octree({ minX, maxX: midX, minY, maxY: midY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY, maxY: midY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX, maxX: midX, minY: midY, maxY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY: midY, maxY, minZ, maxZ: midZ }, this.depth + 1),
      new Octree({ minX, maxX: midX, minY, maxY: midY, minZ: midZ, maxZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY, maxY: midY, minZ: midZ, maxZ }, this.depth + 1),
      new Octree({ minX, maxX: midX, minY: midY, maxY, minZ: midZ, maxZ }, this.depth + 1),
      new Octree({ minX: midX, maxX, minY: midY, maxY, minZ: midZ, maxZ }, this.depth + 1),
    ];
  }

  insert(obj: any) {
    if (!this.intersects(obj.bounds)) return false;

    if (this.nodes.length > 0) {
      let inserted = false;
      for (const node of this.nodes) {
        if (node.insert(obj)) inserted = true;
      }
      if (inserted) return true;
    }

    this.objects.push(obj);

    if (this.objects.length > this.capacity && this.depth < 8) {
      if (this.nodes.length === 0) this.subdivide();
      
      const newObjects = [];
      for (const o of this.objects) {
        let moved = false;
        for (const node of this.nodes) {
          if (node.insert(o)) {
            moved = true;
            break;
          }
        }
        if (!moved) newObjects.push(o);
      }
      this.objects = newObjects;
    }

    return true;
  }

  intersects(b: any) {
    return !(b.minX > this.bounds.maxX || 
             b.maxX < this.bounds.minX || 
             b.minY > this.bounds.maxY || 
             b.maxY < this.bounds.minY || 
             b.minZ > this.bounds.maxZ || 
             b.maxZ < this.bounds.minZ);
  }

  query(bounds: any, result: any[] = []) {
    if (!this.intersects(bounds)) return result;

    for (const obj of this.objects) {
      if (obj.bounds.minX <= bounds.maxX && obj.bounds.maxX >= bounds.minX &&
          obj.bounds.minY <= bounds.maxY && obj.bounds.maxY >= bounds.minY &&
          obj.bounds.minZ <= bounds.maxZ && obj.bounds.maxZ >= bounds.minZ) {
          result.push(obj);
      }
    }

    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        node.query(bounds, result);
      }
    }

    return result;
  }
}

export function performStabilityCheck(blocks: any[], parts: any) {
  const EPSILON = 0.05;
  const supported = new Set<string>();
  
  const blockData = blocks.map(b => {
    const part: any = PART_MAP.get(b.partId);
    if (!part) return null;
    const boxes = getCollisionBoxes(b.position, part, b.rotation);
    const bounds = {
      minX: Math.min(...boxes.map(bx => bx.minX)),
      maxX: Math.max(...boxes.map(bx => bx.maxX)),
      minY: Math.min(...boxes.map(bx => bx.minY)),
      maxY: Math.max(...boxes.map(bx => bx.maxY)),
      minZ: Math.min(...boxes.map(bx => bx.minZ)),
      maxZ: Math.max(...boxes.map(bx => bx.maxZ))
    };
    return { id: b.id, part, boxes, bounds };
  }).filter(Boolean) as any[];

  // 1. Find overall bounds for Octree
  if (blockData.length === 0) return { supportedIds: new Set(), fallingIds: new Set() };
  
  const worldBounds = {
    minX: Math.min(...blockData.map(d => d.bounds.minX)) - 1,
    maxX: Math.max(...blockData.map(d => d.bounds.maxX)) + 1,
    minY: Math.min(...blockData.map(d => d.bounds.minY)) - 1,
    maxY: Math.max(...blockData.map(d => d.bounds.maxY)) + 1,
    minZ: Math.min(...blockData.map(d => d.bounds.minZ)) - 1,
    maxZ: Math.max(...blockData.map(d => d.bounds.maxZ)) + 1
  };

  const tree = new Octree(worldBounds);
  for (const b of blockData) tree.insert(b);

  // 2. Identify grounded blocks
  for (const b of blockData) {
    if (b.part.type === 'slope_inv') continue;

    for (const box of b.boxes) {
      if (Math.abs(box.minY - (-0.5)) < EPSILON) {
        supported.add(b.id);
        break;
      }
    }
  }

  // 3. Connection mapping using Octree
  const edges = new Map<string, Set<string>>();
  for (const b of blockData) edges.set(b.id, new Set());

  const hasStudsOnTop = (type: string) => ['box', 'brick', 'plate', 'corner', 'cylinder', 'cone', 'slope_inv', 'jumper', 'jumper_round', 'slope_2studs'].includes(type);
  const hasHolesOnBottom = (type: string) => ['box', 'brick', 'plate', 'corner', 'cylinder', 'slope', 'tile', 'jumper', 'jumper_round', 'cone', 'slope_inv', 'wedge_plate', 'crystal'].includes(type);

  for (const b1 of blockData) {
    // Search area slightly larger than the block to find neighbors above/below
    const searchBounds = {
        minX: b1.bounds.minX - EPSILON, maxX: b1.bounds.maxX + EPSILON,
        minY: b1.bounds.minY - EPSILON - 0.2, maxY: b1.bounds.maxY + EPSILON + 0.2,
        minZ: b1.bounds.minZ - EPSILON, maxZ: b1.bounds.maxZ + EPSILON
    };

    const neighbors = tree.query(searchBounds);

    for (const b2 of neighbors) {
      if (b1.id === b2.id) continue;

      let touchesAbove = false;
      let touchesBelow = false;

      for (const box1 of b1.boxes) {
        for (const box2 of b2.boxes) {
          const overlapX = box1.maxX > box2.minX + EPSILON && box1.minX < box2.maxX - EPSILON;
          const overlapZ = box1.maxZ > box2.minZ + EPSILON && box1.minZ < box2.maxZ - EPSILON;

          if (overlapX && overlapZ) {
            if (Math.abs(box1.maxY - box2.minY) < EPSILON) touchesAbove = true;
            if (Math.abs(box1.minY - box2.maxY) < EPSILON) touchesBelow = true;
          }
        }
      }

      if (touchesAbove && hasStudsOnTop(b1.part.type) && hasHolesOnBottom(b2.part.type)) {
        edges.get(b1.id)!.add(b2.id);
        edges.get(b2.id)!.add(b1.id);
      }
      if (touchesBelow && hasHolesOnBottom(b1.part.type) && hasStudsOnTop(b2.part.type)) {
        edges.get(b1.id)!.add(b2.id);
        edges.get(b2.id)!.add(b1.id);
      }
    }
  }

  // 4. Propagate stability
  const queue = Array.from(supported);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const connections = edges.get(current);
    if (!connections) continue;
    
    for (const neighbor of connections) {
      if (!supported.has(neighbor)) {
        supported.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // 5. Collect falling blocks
  const fallingIds = new Set<string>();
  for (const b of blocks) {
    if (!supported.has(b.id)) {
      fallingIds.add(b.id);
    }
  }

  return { supportedIds: supported, fallingIds };
}
