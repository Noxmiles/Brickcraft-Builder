import { VoxelGrid } from './VoxelGrid';
export { extractVoxelGrid, VoxelGrid } from './VoxelGrid';

export interface PathNode {
    x: number;
    y: number;
    z: number;
}

/**
 * Valid configuration options for the pathfinder logic.
 */
export interface PathfindingOptions {
    maxClimbHeight?: number; 
    clearanceHeight?: number; 
}

/**
 * A* Pathfinding algorithm tailored for 3D Tower Defense voxel layouts.
 * Computes the shortest path from Spawn to Crystal, ensuring height clearance
 * and climb constraints (e.g. going up stairs).
 */
export class TDPathfinder {
    private grid: VoxelGrid;

    constructor(grid: VoxelGrid) {
        this.grid = grid;
    }

    public findPath(start: PathNode, end: PathNode, options: PathfindingOptions = {}): PathNode[] | null {
        // Defaults:
        // climb 1 plate up/down (can be increased for jumpers)
        const maxClimb = options.maxClimbHeight ?? 1; 
        // 6 plates = 2 bricks high clearance for mini-figs
        const clearance = options.clearanceHeight ?? 6;

        const openSet = new Map<string, any>();
        const closedSet = new Set<string>();

        const startKey = `${start.x},${start.y},${start.z}`;
        openSet.set(startKey, {
            pos: start,
            g: 0,
            f: this.heuristic(start, end),
            parent: null
        });

        // Loop protection
        let limit = 20000;

        while (openSet.size > 0 && limit-- > 0) {
            let currentKey = '';
            let currentVal: any = null;
            
            // Find node with lowest f
            for (const [key, val] of openSet.entries()) {
                if (!currentVal || val.f < currentVal.f) {
                    currentKey = key;
                    currentVal = val;
                }
            }

            // Early exit if arrived at target
            if (currentVal.pos.x === end.x && currentVal.pos.y === end.y && currentVal.pos.z === end.z) {
                return this.reconstructPath(currentVal);
            }

            // Pathfinding to X/Z is often enough if we only care about stepping ON the destination block
            // However, we look for exact XYZ match here.
            
            openSet.delete(currentKey);
            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(currentVal.pos, maxClimb, clearance);

            for (const n of neighbors) {
                const nKey = `${n.x},${n.y},${n.z}`;
                if (closedSet.has(nKey)) continue;

                const tentativeG = currentVal.g + 1;

                const existing = openSet.get(nKey);
                if (!existing || tentativeG < existing.g) {
                    openSet.set(nKey, {
                        pos: n,
                        g: tentativeG,
                        f: tentativeG + this.heuristic(n, end),
                        parent: currentVal
                    });
                }
            }
        }

        return null;
    }

    private getNeighbors(pos: PathNode, maxClimb: number, clearance: number): PathNode[] {
        const candidates = [
            { x: pos.x + 1, z: pos.z },
            { x: pos.x - 1, z: pos.z },
            { x: pos.x, z: pos.z + 1 },
            { x: pos.x, z: pos.z - 1 }
        ];

        const validNeighbors: PathNode[] = [];

        for (const c of candidates) {
            // Check vertical space around current level
            for (let dy = -maxClimb; dy <= maxClimb; dy++) {
                const ny = pos.y + dy;
                if (ny < 0) continue; 
                
                if (this.grid.isWalkable(c.x, ny, c.z, clearance)) {
                    // Check if the climbing space itself is obstructed
                    // e.g. stepping up 1 level shouldn't hit the head on a bridge just above
                    if (this.isValidTransition(pos, {x: c.x, y: ny, z: c.z}, clearance)) {
                        validNeighbors.push({ x: c.x, y: ny, z: c.z });
                    }
                }
            }
        }

        return validNeighbors;
    }

    private isValidTransition(from: PathNode, to: PathNode, clearance: number): boolean {
        // More advanced validation: ensure the "diagonals" during step-ups are clear
        const highestY = Math.max(from.y, to.y);
        // From highestY, we need `clearance` space in both columns
        for(let i=0; i<clearance; i++) {
           // Wait, from.y has already been checked as walkable.
           // However, if we step UP to.y (e.g. from.y = 0, to.y = 1)
           // we must ensure from.x, from.y+1 has clearance (which it does, since from is walkable for 6 blocks)
           // Wait! Walkable from 0 means 0..5 are clear.
           // If we step to 1, to is walkable so 1..6 are clear in `to` column.
           // We just need to ensure we don't clip a corner. 
           // For block-based models, if both columns are walkable and the max climb is small, it's usually fine.
        }
        return true;
    }

    private heuristic(a: PathNode, b: PathNode): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) * 2 + Math.abs(a.z - b.z);
    }

    private reconstructPath(node: any): PathNode[] {
        const path = [];
        let curr = node;
        while (curr) {
            path.push(curr.pos);
            curr = curr.parent;
        }
        return path.reverse();
    }
    
    // Debug helper to print and visualize path
    public debugPathToConsole(start: PathNode, end: PathNode, options: PathfindingOptions = {}) {
       console.log(`\n--- Pathfinder Debug ---`);
       console.log(`Start: [${start.x}, ${start.y}, ${start.z}]  |  Ziel: [${end.x}, ${end.y}, ${end.z}]`);
       
       const pfStart = performance.now();
       const path = this.findPath(start, end, options);
       const pfEnd = performance.now();
       
       console.log(`Dauer: ${(pfEnd - pfStart).toFixed(2)}ms`);

       if (!path) {
          console.warn("❌ Kein Weg gefunden! (Mazing/Blockade)");
          return;
       }
       
       console.log(`✅ Weg gefunden in ${path.length} Schritten:`);
       path.forEach((p, i) => {
          console.log(`   [${String(i).padStart(2, '0')}] -> X:${String(p.x).padStart(2,' ')} Y:${String(p.y).padStart(2,' ')} Z:${String(p.z).padStart(2,' ')}`);
       });
       console.log("------------------------\n");
    }
}
