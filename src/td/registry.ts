export interface TowerDef {
    range: number;
    damage: number;
    cooldown: number; // seconds per shot
    cost: number;
    color: string;
    splashRadius?: number;
    projectileSpeed: number;
}

export interface EnemyDef {
    hp: number;
    speed: number;
    reward: number;
    width: number;
    depth: number;
}

export const TowerRegistry: Record<string, TowerDef> = {
    'logic_td_tower_rapid': {
        range: 6,
        damage: 2,
        cooldown: 0.2,
        cost: 30,
        color: '#ff0000',
        projectileSpeed: 1.0,
    },
    'logic_td_tower_heavy': {
        range: 8,
        damage: 15,
        cooldown: 1.5,
        cost: 50,
        color: '#0000ff',
        splashRadius: 1.5,
        projectileSpeed: 0.5,
    }
};

export const EnemyRegistry: Record<string, EnemyDef> = {
    'lawyer': {
        hp: 10,
        speed: 1.0, 
        reward: 5,
        width: 0.8,
        depth: 0.8
    }
};
