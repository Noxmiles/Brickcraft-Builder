import { GRID_UNIT_WIDTH, GRID_UNIT_HEIGHT } from './partsData';
import { normalizePos } from './grid';

/**
 * Computes the 3D collision bounding boxes for a placed block.
 * Uses object rotation and part type to calculate accurately.
 * 
 * @param posRaw The raw block position (can be object or array)
 * @param part The part definition from PARTS (contains dimensions)
 * @param rot Rotation index
 * @returns Array of collision bounding boxes '{minX, maxX, minY, ...}'
 */
export function getCollisionBoxes(posRaw: any, part: any, rot: number) {
  const pos = normalizePos(posRaw);
  const isRot = rot % 2 !== 0;
  const sx = (isRot ? part.size[1] : part.size[0]) * GRID_UNIT_WIDTH;
  const sz = (isRot ? part.size[0] : part.size[1]) * GRID_UNIT_WIDTH;
  const sy = part.size[2] * GRID_UNIT_HEIGHT;

  if (part.type === 'corner') {
    const wActual = part.size[0] * GRID_UNIT_WIDTH;
    const dActual = part.size[1] * GRID_UNIT_WIDTH;
    
    const boxes = [
      { minX: -wActual/2, maxX: wActual/2, minY: -sy/2, maxY: sy/2, minZ: -dActual/2, maxZ: 0 },
      { minX: -wActual/2, maxX: 0, minY: -sy/2, maxY: sy/2, minZ: 0, maxZ: dActual/2 }
    ];

    return boxes.map(b => {
      let minX = b.minX, maxX = b.maxX, minZ = b.minZ, maxZ = b.maxZ;
      for (let i = 0; i < (rot % 4); i++) {
        const p1x = minX, p1z = minZ;
        const p2x = maxX, p2z = maxZ;
        minX = p1z; minZ = -p2x;
        maxX = p2z; maxZ = -p1x;
      }

      return {
        minX: pos[0] + Math.min(minX, maxX),
        maxX: pos[0] + Math.max(minX, maxX),
        minY: pos[1] + b.minY,
        maxY: pos[1] + b.maxY,
        minZ: pos[2] + Math.min(minZ, maxZ),
        maxZ: pos[2] + Math.max(minZ, maxZ),
      };
    });
  }

  return [{
    minX: pos[0] - sx / 2,
    maxX: pos[0] + sx / 2,
    minY: pos[1] - sy / 2,
    maxY: pos[1] + sy / 2,
    minZ: pos[2] - sz / 2,
    maxZ: pos[2] + sz / 2,
  }];
}

/**
 * Verifies if two blocks intersect each other physically in 3D space.
 * Prevents user from building intersecting block structures.
 */
export function checkCollision(posA: number[], partA: any, rotA: number, posB: number[], partB: any, rotB: number) {
  const boxesA = getCollisionBoxes(posA, partA, rotA);
  const boxesB = getCollisionBoxes(posB, partB, rotB);
  
  const EPSILON = 0.05;
  
  for (const a of boxesA) {
    for (const b of boxesB) {
      if (
        a.minX < b.maxX - EPSILON && 
        a.maxX > b.minX + EPSILON && 
        a.minY < b.maxY - EPSILON && 
        a.maxY > b.minY + EPSILON && 
        a.minZ < b.maxZ - EPSILON && 
        a.maxZ > b.minZ + EPSILON
      ) {
        return true;
      }
    }
  }
  return false;
}

export class CoordinateLookup {
    private grid: Map<string, Array<{minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number}>> = new Map();

    public clear() {
        this.grid.clear();
    }

    public addBlock(posRaw: any, part: any, rot: number) {
        if (!part) return;
        const boxes = getCollisionBoxes(posRaw, part, rot);
        for (const b of boxes) {
            const minCx = Math.floor(b.minX);
            const maxCx = Math.floor(b.maxX);
            const minCy = Math.floor(b.minY);
            const maxCy = Math.floor(b.maxY);
            const minCz = Math.floor(b.minZ);
            const maxCz = Math.floor(b.maxZ);

            for (let cx = minCx; cx <= maxCx; cx++) {
                for (let cy = minCy; cy <= maxCy; cy++) {
                    for (let cz = minCz; cz <= maxCz; cz++) {
                        const key = `${cx},${cy},${cz}`;
                        let list = this.grid.get(key);
                        if (!list) {
                            list = [];
                            this.grid.set(key, list);
                        }
                        list.push(b);
                    }
                }
            }
        }
    }

    public hasCollision(posRaw: any, part: any, rot: number): boolean {
        if (!part) return false;
        const boxes = getCollisionBoxes(posRaw, part, rot);
        const EPSILON = 0.05;

        for (const a of boxes) {
            const minCx = Math.floor(a.minX);
            const maxCx = Math.floor(a.maxX);
            const minCy = Math.floor(a.minY);
            const maxCy = Math.floor(a.maxY);
            const minCz = Math.floor(a.minZ);
            const maxCz = Math.floor(a.maxZ);

            for (let cx = minCx; cx <= maxCx; cx++) {
                for (let cy = minCy; cy <= maxCy; cy++) {
                    for (let cz = minCz; cz <= maxCz; cz++) {
                        const key = `${cx},${cy},${cz}`;
                        const list = this.grid.get(key);
                        if (list) {
                            for (const b of list) {
                                if (
                                    a.minX < b.maxX - EPSILON && 
                                    a.maxX > b.minX + EPSILON && 
                                    a.minY < b.maxY - EPSILON && 
                                    a.maxY > b.minY + EPSILON && 
                                    a.minZ < b.maxZ - EPSILON && 
                                    a.maxZ > b.minZ + EPSILON
                                ) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }
}
