export interface Block {
    id: string;
    partId: string;
    position: number[] | [number, number, number];
    rotation?: number;
    color?: string;
    material?: string;
    meta?: any;
}

export interface EnemyState {
    id: number;
    pathIndex: number;
    lastPos: [number, number, number]; // Interpolation Start (Continuous Voxel Space)
    nextPos: [number, number, number]; // Target Physical Pos (Continuous Voxel Space)
    hp: number;
    active: boolean;
    lastDamageTick?: number;
    // Neu für AABB Kollision (Voxel-Einheiten)
    width?: number; // z.B. 0.8
    depth?: number; // z.B. 0.8
}

export interface TowerState {
    id: string;
    partId: string;
    pos: [number, number, number];
    rangeSq: number;
    damage: number;
    cooldown: number;
    cooldownTimer: number;
    splashRadiusSq?: number;
}

export interface ProjectileState {
    id: number;
    type: 'rapid' | 'heavy';
    startX: number;
    startY: number;
    startZ: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    targetEnemyId: number;
    progress: number;
    speed: number;
    damage: number;
    splashRadiusSq?: number;
    active: boolean;
}
