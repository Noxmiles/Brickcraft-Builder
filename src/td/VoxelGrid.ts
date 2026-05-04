import { getCollisionBoxes } from '../builder/collision';

/**
 * Represents a discrete 3D grid mapping the physical voxel world.
 * This class abstracts the continuous 3D world into discrete logic voxels
 * that enemies can evaluate for pathfinding.
 */
export class VoxelGrid {
  private solid: Set<string> = new Set();
  public minBounds: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 };
  public maxBounds: { x: number, y: number, z: number } = { x: 0, y: 0, z: 0 };

  public add(x: number, y: number, z: number) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (this.solid.size === 0) {
      this.minBounds = { x, y, z };
      this.maxBounds = { x, y, z };
    } else {
      this.minBounds.x = Math.min(this.minBounds.x, x);
      this.minBounds.y = Math.min(this.minBounds.y, y);
      this.minBounds.z = Math.min(this.minBounds.z, z);
      this.maxBounds.x = Math.max(this.maxBounds.x, x);
      this.maxBounds.y = Math.max(this.maxBounds.y, y);
      this.maxBounds.z = Math.max(this.maxBounds.z, z);
    }
    this.solid.add(key);
  }

  public isSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true; // Ground floor is infinitely solid
    return this.solid.has(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`);
  }

  public isWalkable(x: number, y: number, z: number, clearanceHeight: number): boolean {
    // Must have ground to stand on (the voxel BELOW the feet)
    if (!this.isSolid(x, y - 1, z)) return false;

    // Must have clearance above (voxels from feet UPWARDS)
    for (let i = 0; i < clearanceHeight; i++) {
        if (this.isSolid(x, y + i, z)) return false;
    }

    return true;
  }
}

const EPSILON = 0.001;

/**
 * Evaluates the React block state and constructs an optimized 3D voxel grid
 * by calculating the boolean "solid" spaces.
 * 
 * @param blocks The array of placed block objects
 * @param partMap The part definitions map to lookup sizes
 * @returns A computed VoxelGrid instance ready for pathfinding
 */
export function extractVoxelGrid(blocks: any[], partMap: Map<string, any>): VoxelGrid {
  const grid = new VoxelGrid();
  
  for (const block of blocks) {
    if (block.partId === 'logic_td_spawn' || block.partId === 'logic_td_crystal') {
      continue;
    }
    const part = partMap.get(block.partId);
    if (!part) continue;
    
    // getCollisionBoxes returns world coordinate boundaries
    const boxes = getCollisionBoxes(block.position, part, block.rotation);
    
    for (const box of boxes) {
      // Map world space to integer voxel space
      // X and Z: 1 voxel = 0.5 world units
      // Y: 1 voxel = 0.2 world units (1 Plate height)
      // Floor base is at world Y = -0.5 (Voxel Y = 0 starts exactly there)
      
      const vx_min = Math.floor((box.minX + EPSILON) / 0.5);
      const vx_max = Math.floor((box.maxX - EPSILON) / 0.5);
      
      const vy_min = Math.floor((box.minY - (-0.5) + EPSILON) / 0.2);
      const vy_max = Math.floor((box.maxY - (-0.5) - EPSILON) / 0.2);
      
      const vz_min = Math.floor((box.minZ + EPSILON) / 0.5);
      const vz_max = Math.floor((box.maxZ - EPSILON) / 0.5);

      for (let x = vx_min; x <= vx_max; x++) {
        for (let y = vy_min; y <= vy_max; y++) {
          for (let z = vz_min; z <= vz_max; z++) {
            grid.add(x, y, z);
          }
        }
      }
    }
  }
  return grid;
}
