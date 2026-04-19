/**
 * Pre-defined building templates for the Brickcraft Simulator.
 */
export const TEMPLATES = [
  {
    id: 'bauernhof',
    name: 'Bauernhof-Ensemble',
    description: 'Massive Scheune & Nutztiere',
    blocks: [
      // --- ROTE SCHEUNE (Volumetrisch) ---
      { position: [-4, 0, -4], partId: 'brick_2x10', color: '#C91A09', rotation: 0 },
      { position: [-4, 0, -2], partId: 'brick_2x10', color: '#C91A09', rotation: 0 },
      { position: [-4, 1, -4], partId: 'brick_2x10', color: '#C91A09', rotation: 0 },
      { position: [-4, 1, -2], partId: 'brick_2x10', color: '#C91A09', rotation: 0 },
      { position: [-4, 2, -3], partId: 'brick_2x10', color: '#582A12', rotation: 0 },
      { position: [-3, 3, -3], partId: 'slope2x4', color: '#582A12', rotation: 0 },
      { position: [-5, 3, -3], partId: 'slope2x4', color: '#582A12', rotation: 2 },
      
      // --- KUH (Dreidimensional) ---
      { position: [2, 0, 2], partId: 'brick_1x2', color: '#FFFFFF', rotation: 0 },
      { position: [4, 0, 2], partId: 'brick_1x2', color: '#FFFFFF', rotation: 0 },
      { position: [2, 0, 4], partId: 'brick_1x2', color: '#FFFFFF', rotation: 0 },
      { position: [4, 0, 4], partId: 'brick_1x2', color: '#FFFFFF', rotation: 0 },
      { position: [3, 1, 3], partId: 'brick_2x10', color: '#FFFFFF', rotation: 1 },
      { position: [3, 2, 3], partId: 'brick_2x6', color: '#FFFFFF', rotation: 1 },
      { position: [3, 2, 6], partId: 'brick_2x4', color: '#FFFFFF', rotation: 1 },
      { position: [3.5, 2.333, 5], partId: 'plate_2x2', color: '#111111', rotation: 0 },
      { position: [3, 2, 8], partId: 'plate_2x4', color: '#FE8A18', rotation: 1 },
      
      // --- SCHWEIN (Solide) ---
      { position: [7, 0, -3], partId: 'brick_2x4', color: '#FE8A18', rotation: 0 },
      { position: [7, 1, -3], partId: 'brick_2x4', color: '#FE8A18', rotation: 0 },
      { position: [9, 0.5, -3], partId: 'brick_1x2', color: '#FE8A18', rotation: 0 },
    ]
  },
  {
    id: 'haus',
    name: 'Modernes Wohnhaus',
    description: 'Mehrschichtiger Quaderbau',
    blocks: [
      { position: [0, 0, 0], partId: 'brick_2x10', color: '#FFFFFF', rotation: 0 },
      { position: [0, 0, 1.5], partId: 'brick_2x10', color: '#FFFFFF', rotation: 0 },
      { position: [0, 1, 0.75], partId: 'brick_2x10', color: '#FFFFFF', rotation: 0 },
      { position: [0, 2, 0.75], partId: 'brick_2x10', color: '#FFFFFF', rotation: 0 },
      { position: [0, -0.333, 3], partId: 'plate_2x10', color: '#A0A5A9', rotation: 0 },
      { position: [-2, 1.333, 1], partId: 'plate_2x6', color: '#5A93DB', rotation: 1 },
      { position: [2, 1.333, 1], partId: 'plate_2x6', color: '#5A93DB', rotation: 1 },
      { position: [0, 2.666, 0.75], partId: 'plate_2x10', color: '#6C6E68', rotation: 0 },
    ]
  },
  {
    id: 'ritterburg',
    name: 'Festungsburg',
    description: '3D Wehrlage mit Turm',
    blocks: [
      { position: [-5, 0, -3], partId: 'brick_2x10', color: '#A0A5A9', rotation: 0 },
      { position: [-9, 0, -1], partId: 'brick_2x6', color: '#A0A5A9', rotation: 1 },
      { position: [-1, 0, -1], partId: 'brick_2x6', color: '#A0A5A9', rotation: 1 },
      { position: [-5, 1, -3], partId: 'brick_2x10', color: '#A0A5A9', rotation: 0 },
      { position: [-5, 0, -6], partId: 'round_4x4_brick', color: '#6C6E68', rotation: 0 },
      { position: [-5, 1, -6], partId: 'round_4x4_brick', color: '#6C6E68', rotation: 0 },
      { position: [-5, 2, -6], partId: 'round_4x4_brick', color: '#6C6E68', rotation: 0 },
      { position: [-5, 3, -6], partId: 'brick_2x2', color: '#C91A09', rotation: 0 },
      { position: [-5, 4, -6], partId: 'slope2x2', color: '#C91A09', rotation: 0 },
    ]
  },
  {
    id: 'raumschiff',
    name: 'Interceptor MK-II',
    description: 'Volumetrisches Raumschiff',
    blocks: [
      { position: [5, 0, 0], partId: 'brick_2x10', color: '#FFFFFF', rotation: 1 },
      { position: [5, 1, 0], partId: 'brick_2x6', color: '#A0A5A9', rotation: 1 },
      { position: [5, 0.5, -2], partId: 'slope_inv_1x2', color: '#0055BF', rotation: 0 },
      { position: [5, 0.5, 2], partId: 'slope_inv_1x2', color: '#0055BF', rotation: 2 },
      { position: [4, 0, -3.5], partId: 'plate_2x6', color: '#111111', rotation: 1 },
      { position: [4, 0, 3.5], partId: 'plate_2x6', color: '#111111', rotation: 1 },
      { position: [11, 0.5, 0], partId: 'round_2x2_plate', color: '#FE8A18', rotation: 0 },
      { position: [11.5, 0.5, 0], partId: 'round_1x1_brick', color: '#FE8A18', rotation: 0 },
    ]
  },
  {
    id: 'dino',
    name: 'Titan-Rex 3D',
    description: 'Massiver Saurierbau',
    blocks: [
      { position: [0, 0.5, 6], partId: 'brick_2x4', color: '#237841', rotation: 0 },
      { position: [0, 0.5, 9], partId: 'brick_2x4', color: '#237841', rotation: 0 },
      { position: [3, 1.5, 7.5], partId: 'brick_2x10', color: '#237841', rotation: 1 },
      { position: [3, 2.5, 7.5], partId: 'brick_2x6', color: '#237841', rotation: 1 },
      { position: [-3, 1, 7.5], partId: 'brick_2x4', color: '#237841', rotation: 1 },
      { position: [-5.5, 1, 7.5], partId: 'slope2x4', color: '#237841', rotation: 1 },
      { position: [7, 3, 7.5], partId: 'brick_2x4', color: '#237841', rotation: 1 },
      { position: [9, 3, 7.5], partId: 'brick_2x2', color: '#237841', rotation: 0 },
      { position: [9, 4, 7.5], partId: 'plate_2x2', color: '#111111', rotation: 0 },
    ]
  }
];
