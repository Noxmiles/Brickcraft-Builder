import * as THREE from 'three';

export interface ColorDef {
  name: string;
  value: string;
  isTranslucent?: boolean;
  isGlow?: boolean;
  opacity?: number;
  emissive?: string;
}

export const COLORS: ColorDef[] = [
  { name: 'White', value: '#F4F4F4' },
  { name: 'Sand Yellow', value: '#897D62' },
  { name: 'Red', value: '#C91A09' },
  { name: 'Bright Blue', value: '#1E5AA8' },
  { name: 'Bright Yellow', value: '#FAC80A' },
  { name: 'Black', value: '#262626' },
  { name: 'Dark Green', value: '#00852B' },
  { name: 'Bright Orange', value: '#D67923' },
  { name: 'Reddish Brown', value: '#9B4F35' },
  { name: 'Light Bluish Grey', value: '#A0A5A9' },
  { name: 'Dark Bluish Grey', value: '#6C6E68' },
  { name: 'Medium Lilac', value: '#441A91' },
  { name: 'Bright Yellowish Green', value: '#A5CA18' },
  { name: 'Medium Azur', value: '#68C3E2' },
  { name: 'Bright Green', value: '#58AB41' },
  // Translucent colors
  { name: 'Trans-Light Blue', value: '#AEE9EF', isTranslucent: true, opacity: 0.6 },
  { name: 'Trans-Red', value: '#C91A09', isTranslucent: true, opacity: 0.6 },
  { name: 'Trans-Neon Green', value: '#D0FE1D', isTranslucent: true, opacity: 0.6 },
  // Glow colors
  { name: 'Glow White', value: '#D9D9D9', isGlow: true, emissive: '#FFFFFF' },
  { name: 'Glow Orange', value: '#FF8000', isGlow: true, emissive: '#FF8000' },
  { name: 'Glow Red', value: '#FF0000', isGlow: true, emissive: '#FF0000' }
];

export const COLOR_MAP = new Map<string, ColorDef>(COLORS.map(c => [c.value, c]));

// Definition of logical units for grid snapping and dimensions
export const BRICK_HEIGHT = 1.0;
export const PLATE_HEIGHT = 1.0 / 3.0;

// World scale: 1.0 world unit = 16.0mm
// Logical Grid Width Unit = 1 stud = 8.0mm = 0.5 world units
// Logical Grid Height Unit = 1 brick = 9.6mm = 0.6 world units
export const GRID_UNIT_WIDTH = 0.5;
export const GRID_UNIT_HEIGHT = 0.6;

export const STUD_HEIGHT = 1.8 / 16.0; // 0.1125 world units
export const STUD_RADIUS = (4.8 / 2.0) / 16.0; // 0.15 world units (4.8mm diameter)

export const BRICK_SIZES = [
  { id: '1x1', label: '1x1', size: [1, 1] },
  { id: '1x2', label: '1x2', size: [1, 2] },
  { id: '1x3', label: '1x3', size: [1, 3] },
  { id: '1x4', label: '1x4', size: [1, 4] },
  { id: '1x6', label: '1x6', size: [1, 6] },
  { id: '1x8', label: '1x8', size: [1, 8] },
  { id: '1x10', label: '1x10', size: [1, 10] },
  { id: '2x2', label: '2x2', size: [2, 2] },
  { id: '2x3', label: '2x3', size: [2, 3] },
  { id: '2x4', label: '2x4', size: [2, 4] },
  { id: '2x6', label: '2x6', size: [2, 6] },
  { id: '2x8', label: '2x8', size: [2, 8] },
  { id: '2x10', label: '2x10', size: [2, 10] },
  { id: '4x4', label: '4x4', size: [4, 4] },
  { id: '6x6', label: '6x6', size: [6, 6] },
];

export const SPECIAL_PARTS = [
  { id: 'slope1x2', label: '1x2 Dach', size: [1, 2, BRICK_HEIGHT], type: 'slope' },
  { id: 'slope2x2', label: '2x2 Dach', size: [2, 2, BRICK_HEIGHT], type: 'slope' },
  { id: 'slope_1x1_plate', label: '1x1 Dach Platte', size: [1, 1, PLATE_HEIGHT], type: 'slope' },
  { id: 'slope_2x2_2studs', label: '2x2 Dach (2 Noppen)', size: [2, 2, BRICK_HEIGHT], type: 'slope_2studs' },
  { id: 'slope2x4', label: '2x4 Dach', size: [2, 4, BRICK_HEIGHT], type: 'slope' },
  { id: 'wedge_3x3_plate', label: '3x3 Keilplatte', size: [3, 3, PLATE_HEIGHT], type: 'wedge_plate' },
  { id: 'tile1x1', label: '1x1 Fliese', size: [1, 1, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile1x2', label: '1x2 Fliese', size: [1, 2, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile1x4', label: '1x4 Fliese', size: [1, 4, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile2x2', label: '2x2 Fliese', size: [2, 2, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile2x4', label: '2x4 Fliese', size: [2, 4, PLATE_HEIGHT], type: 'tile' },
  { id: 'tile4x4', label: '4x4 Fliese', size: [4, 4, PLATE_HEIGHT], type: 'tile' },
  { id: 'corner2x2', label: '2x2 Winkelplatte', size: [2, 2, PLATE_HEIGHT], type: 'corner' },
  // Round Parts
  { id: 'round_1x1_brick', label: '1x1 Rundstein', size: [1, 1, BRICK_HEIGHT], type: 'cylinder' },
  { id: 'round_1x1_plate', label: '1x1 Rundplatte', size: [1, 1, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'round_1x1_tile', label: '1x1 Rundfliese', size: [1, 1, PLATE_HEIGHT], type: 'tile' },
  { id: 'round_2x2_brick', label: '2x2 Rundstein', size: [2, 2, BRICK_HEIGHT], type: 'cylinder' },
  { id: 'round_2x2_plate', label: '2x2 Rundplatte', size: [2, 2, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'round_2x2_tile', label: '2x2 Rundfliese', size: [2, 2, PLATE_HEIGHT], type: 'tile' },
  { id: 'round_3x3_plate', label: '3x3 Rundplatte', size: [3, 3, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'round_3x3_tile', label: '3x3 Rundfliese', size: [3, 3, PLATE_HEIGHT], type: 'tile' },
  { id: 'dish_3x3_inv', label: '3x3 Radar (inv)', size: [3, 3, PLATE_HEIGHT], type: 'dish_inverted' },
  { id: 'dish_3x3_test', label: '3x3 Radar TEST', size: [3, 3, PLATE_HEIGHT], type: 'dish_test' },
  { id: 'round_4x4_brick', label: '4x4 Rundstein', size: [4, 4, BRICK_HEIGHT], type: 'cylinder' },
  { id: 'round_4x4_plate', label: '4x4 Rundplatte', size: [4, 4, PLATE_HEIGHT], type: 'cylinder' },
  { id: 'cone_1x1', label: '1x1 Kegelstein', size: [1, 1, BRICK_HEIGHT], type: 'cone' },
  { id: 'cone_2x2', label: '2x2 Kegelstein', size: [2, 2, BRICK_HEIGHT * 2], type: 'cone' },
  { id: 'jumper_1x2', label: '1x2 Jumper-Platte', size: [1, 2, PLATE_HEIGHT], type: 'jumper' },
  { id: 'jumper_round_2x2', label: '2x2 Rund-Jumper', size: [2, 2, PLATE_HEIGHT], type: 'jumper_round' },
  { id: 'slope_inv_1x2', label: '1x2 Dach Invers', size: [1, 2, BRICK_HEIGHT], type: 'slope_inv' },
  { id: 'logic_wire', label: 'Redstone Kabel', size: [1, 1, PLATE_HEIGHT], type: 'tile' },
  { id: 'logic_battery', label: 'Batterieblock', size: [2, 2, BRICK_HEIGHT], type: 'brick' },
  { id: 'logic_led', label: 'LED Block 2x2', size: [2, 2, BRICK_HEIGHT], type: 'brick' },
  { id: 'logic_td_spawn', label: 'Gegner-Spawn', type: 'box', size: [4, 4, 1] },
  { id: 'logic_td_crystal', label: 'Energie-Kristall', type: 'crystal', size: [2, 2, 6] },
  { id: 'logic_td_crystal_v2', label: 'Kristall v2', type: 'crystal_v2', size: [1, 1, 6] },
  { id: 'logic_td_tower_rapid', label: 'Paragraph-Kanone', type: 'cone', size: [2, 2, 3], cost: 50 },
  { id: 'logic_td_tower_heavy', label: 'Aktienschredder', type: 'box', size: [2, 2, 4], cost: 150 },
];

export const PARTS = [
  // 1. STANDARD BRICKS
  ...BRICK_SIZES.map(s => ({ id: `brick_${s.id}`, label: `${s.label} Stein`, size: [s.size[0], s.size[1], BRICK_HEIGHT], type: 'brick' })),
  // 2. STANDARD PLATES
  ...BRICK_SIZES.map(s => ({ id: `plate_${s.id}`, label: `${s.label} Platte`, size: [s.size[0], s.size[1], PLATE_HEIGHT], type: 'plate' })),
  // 3. SPECIAL PARTS
  ...SPECIAL_PARTS
];

export const PART_MAP = new Map(PARTS.map(p => [p.id, p]));

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

export const normalizePos = (p: any): number[] => {
  if (Array.isArray(p)) return [isNaN(p[0]) ? 0 : p[0], isNaN(p[1]) ? 0 : p[1], isNaN(p[2]) ? 0 : p[2]];
  return [p?.x || 0, p?.y || 0, p?.z || 0];
};

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
