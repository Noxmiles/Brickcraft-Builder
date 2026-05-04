export const TD_CONFIG = {
    MAX_ENEMIES: 500,
    MAX_PROJECTILES: 1500,
    TICK_RATE: 2, // Engine ticks two times per second
    GAME_TICK_INTERVAL: 0.5, // 1.0 / TICK_RATE
    CRYSTAL_HP: 20,
    SPAWN_INTERVAL_TICKS: 15,
    SCALE_FACTOR_X: 0.5,
    SCALE_FACTOR_Y: 0.2,
    SCALE_FACTOR_Z: 0.5,
    OFFSET_Y: -0.4,
};

export const voxelToWorld = (vx: number, vy: number, vz: number): [number, number, number] => {
  return [vx * 0.5 + 0.25, vy * 0.2 - 0.5, vz * 0.5 + 0.25];
};

export const LAWYER_VOXELS = [
    { color: '#444444', offset: [0, 0.1, 0] }, // Beine
    { color: '#111111', offset: [0, 0.3, 0] }, // Torso
    { color: '#ffccaa', offset: [0, 0.5, 0] }, // Kopf
    { color: '#663300', offset: [0.2, 0.2, 0] }, // Aktenkoffer
];
