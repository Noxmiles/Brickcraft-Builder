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

export type PartCategory = 'tower' | 'spawner' | 'objective' | 'logic' | 'brick';

export interface PartDef {
  id: string;
  label: string;
  size: number[];
  type: string;
  category: PartCategory;
  cost?: number;
}

export const SPECIAL_PARTS: PartDef[] = [
  { id: 'slope1x2', label: '1x2 Dach', size: [1, 2, BRICK_HEIGHT], type: 'slope', category: 'brick' },
  { id: 'slope2x2', label: '2x2 Dach', size: [2, 2, BRICK_HEIGHT], type: 'slope', category: 'brick' },
  { id: 'slope_1x1_plate', label: '1x1 Dach Platte', size: [1, 1, PLATE_HEIGHT], type: 'slope', category: 'brick' },
  { id: 'slope_2x2_2studs', label: '2x2 Dach (2 Noppen)', size: [2, 2, BRICK_HEIGHT], type: 'slope_2studs', category: 'brick' },
  { id: 'slope2x4', label: '2x4 Dach', size: [2, 4, BRICK_HEIGHT], type: 'slope', category: 'brick' },
  { id: 'wedge_3x3_plate', label: '3x3 Keilplatte', size: [3, 3, PLATE_HEIGHT], type: 'wedge_plate', category: 'brick' },
  { id: 'tile1x1', label: '1x1 Fliese', size: [1, 1, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'tile1x2', label: '1x2 Fliese', size: [1, 2, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'tile1x4', label: '1x4 Fliese', size: [1, 4, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'tile2x2', label: '2x2 Fliese', size: [2, 2, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'tile2x4', label: '2x4 Fliese', size: [2, 4, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'tile4x4', label: '4x4 Fliese', size: [4, 4, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'corner2x2', label: '2x2 Winkelplatte', size: [2, 2, PLATE_HEIGHT], type: 'corner', category: 'brick' },
  // Round Parts
  { id: 'round_1x1_brick', label: '1x1 Rundstein', size: [1, 1, BRICK_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'round_1x1_plate', label: '1x1 Rundplatte', size: [1, 1, PLATE_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'round_1x1_tile', label: '1x1 Rundfliese', size: [1, 1, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'round_2x2_brick', label: '2x2 Rundstein', size: [2, 2, BRICK_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'round_2x2_plate', label: '2x2 Rundplatte', size: [2, 2, PLATE_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'round_2x2_tile', label: '2x2 Rundfliese', size: [2, 2, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'round_3x3_plate', label: '3x3 Rundplatte', size: [3, 3, PLATE_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'round_3x3_tile', label: '3x3 Rundfliese', size: [3, 3, PLATE_HEIGHT], type: 'tile', category: 'brick' },
  { id: 'dish_3x3_inv', label: '3x3 Radar (inv)', size: [3, 3, PLATE_HEIGHT], type: 'dish_inverted', category: 'brick' },
  { id: 'dish_3x3_test', label: '3x3 Radar TEST', size: [3, 3, PLATE_HEIGHT], type: 'dish_test', category: 'brick' },
  { id: 'round_4x4_brick', label: '4x4 Rundstein', size: [4, 4, BRICK_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'round_4x4_plate', label: '4x4 Rundplatte', size: [4, 4, PLATE_HEIGHT], type: 'cylinder', category: 'brick' },
  { id: 'cone_1x1', label: '1x1 Kegelstein', size: [1, 1, BRICK_HEIGHT], type: 'cone', category: 'brick' },
  { id: 'cone_2x2', label: '2x2 Kegelstein', size: [2, 2, BRICK_HEIGHT * 2], type: 'cone', category: 'brick' },
  { id: 'jumper_1x2', label: '1x2 Jumper-Platte', size: [1, 2, PLATE_HEIGHT], type: 'jumper', category: 'brick' },
  { id: 'jumper_round_2x2', label: '2x2 Rund-Jumper', size: [2, 2, PLATE_HEIGHT], type: 'jumper_round', category: 'brick' },
  { id: 'slope_inv_1x2', label: '1x2 Dach Invers', size: [1, 2, BRICK_HEIGHT], type: 'slope_inv', category: 'brick' },
  { id: 'logic_wire', label: 'Redstone Kabel', size: [1, 1, PLATE_HEIGHT], type: 'tile', category: 'logic' },
  { id: 'logic_battery', label: 'Batterieblock', size: [2, 2, BRICK_HEIGHT], type: 'brick', category: 'logic' },
  { id: 'logic_led', label: 'LED Block 2x2', size: [2, 2, BRICK_HEIGHT], type: 'brick', category: 'logic' },
  { id: 'logic_td_spawn', label: 'Gegner-Spawn', type: 'box', size: [4, 4, 1], category: 'spawner' },
  { id: 'logic_td_crystal', label: 'Energie-Kristall', type: 'crystal', size: [2, 2, 6], category: 'objective' },
  { id: 'logic_td_crystal_v2', label: 'Kristall v2', type: 'crystal_v2', size: [1, 1, 6], category: 'objective' },
  { id: 'logic_td_tower_rapid', label: 'Paragraph-Kanone', type: 'cone', size: [2, 2, 3], cost: 50, category: 'tower' },
  { id: 'logic_td_tower_heavy', label: 'Aktienschredder', type: 'box', size: [2, 2, 4], cost: 150, category: 'tower' },
];

export const PARTS: PartDef[] = [
  // 1. STANDARD BRICKS
  ...BRICK_SIZES.map(s => ({ id: `brick_${s.id}`, label: `${s.label} Stein`, size: [s.size[0], s.size[1], BRICK_HEIGHT], type: 'brick', category: 'brick' as PartCategory })),
  // 2. STANDARD PLATES
  ...BRICK_SIZES.map(s => ({ id: `plate_${s.id}`, label: `${s.label} Platte`, size: [s.size[0], s.size[1], PLATE_HEIGHT], type: 'plate', category: 'brick' as PartCategory })),
  // 3. SPECIAL PARTS
  ...SPECIAL_PARTS
];

export const PART_MAP = new Map(PARTS.map(p => [p.id, p]));

export function getCategory(partId: string): PartCategory {
  return PART_MAP.get(partId)?.category || 'brick';
}
