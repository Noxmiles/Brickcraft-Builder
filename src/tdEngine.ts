import { PathNode } from './tdPathfinding';

export type TickCallback = (tickCount: number) => void;

/**
 * Represents the state of an enemy in the game.
 * Enemies move along a pre-calculated path.
 */
export interface EnemyState {
    id: number;
    pathIndex: number;
    lastPos: [number, number, number];
    nextPos: [number, number, number];
    hp: number;
    active: boolean;
    lastDamageTick?: number;
}

/**
 * Represents the state of a defense tower.
 * Towers shoot projectiles at enemies within range.
 */
export interface TowerState {
    id: string;
    pos: [number, number, number];
    rangeSq: number;
    damage: number;
    cooldown: number;
    cooldownTimer: number;
    splashRadiusSq?: number;
}

/**
 * Represents the state of an active projectile fired by a tower.
 * Tracks position progress, speed, and damage type.
 */
export interface ProjectileState {
    id: number;
    type: 'rapid' | 'heavy';
    startX: number;
    startY: number;
    startZ: number;
    targetEnemyId: number;
    progress: number;
    speed: number;
    damage: number;
    splashRadiusSq?: number;
    active: boolean;
}

/**
 * The core logical engine for the Tower Defense game.
 * 
 * This class operates ENTIRELY independently of React, Three.js, or the DOM.
 * It strictly computes abstract logical state (health, paths, collisions).
 * This "zero-allocation" architectural design prevents garbage collection stutters
 * during gameplay, which is critical for smooth 60 FPS rendering.
 */
export const MAX_PROJECTILES = 1500;

class TDEngine {
  private subscribers: Set<TickCallback> = new Set();
  private tickCount: number = 0;
  
  public timeAccumulator: number = 0;

  private activeEnemies: EnemyState[] = [];
  private currentPath: PathNode[] = [];
  private totalSpawned: number = 0;

  private activeTowers: TowerState[] = [];
  public activeProjectiles: ProjectileState[] = [];
  private nextProjectileId: number = 0;

  public crystalHp: number = 20;

  public earnedBudget: number = 0;
  public wave: number = 1;
  public onWaveComplete: (() => void) | null = null;
  public onBudgetChange: (() => void) | null = null;

  constructor() {
    for (let i = 0; i < 500; i++) {
        this.activeEnemies.push({
            id: i,
            pathIndex: 0,
            lastPos: [0, 0, 0],
            nextPos: [0, 0, 0],
            hp: 100,
            active: false
        });
    }

    for (let i = 0; i < MAX_PROJECTILES; i++) {
        this.activeProjectiles.push({
            id: i,
            type: 'rapid',
            startX: 0, startY: 0, startZ: 0,
            targetEnemyId: -1,
            progress: 0,
            speed: 0,
            damage: 0,
            active: false
        });
    }
  }

  public reset() {
    this.hardReset();
  }

  public softReset() {
    this.activeTowers = [];
    this.activeEnemies.forEach(e => e.active = false);
    this.activeEnemies = [];
    for (let i = 0; i < MAX_PROJECTILES; i++) {
        this.activeProjectiles[i].active = false;
    }
    this.tickCount = 0;
    this.totalSpawned = 0;
  }

  public hardReset() {
    this.softReset();
    this.crystalHp = 20;
    this.earnedBudget = 0;
    this.wave = 1;
    if (this.onBudgetChange) this.onBudgetChange();
  }

  public setTowers(blocks: any[], normalizePosFunc: (pos: any, partId: string) => any) {
      this.activeTowers = [];
      for (const b of blocks) {
          if (b.partId === 'logic_td_tower_rapid') {
              const worldPos = normalizePosFunc(b.position, b.partId);
              this.activeTowers.push({
                  id: b.id,
                  pos: [worldPos.x, worldPos.y, worldPos.z],
                  rangeSq: 6 * 6,
                  damage: 2,
                  cooldown: 0.2,
                  cooldownTimer: 0
              });
          } else if (b.partId === 'logic_td_tower_heavy') {
              const worldPos = normalizePosFunc(b.position, b.partId);
              this.activeTowers.push({
                  id: b.id,
                  pos: [worldPos.x, worldPos.y, worldPos.z],
                  rangeSq: 8 * 8,
                  damage: 15,
                  cooldown: 1.5,
                  cooldownTimer: 0,
                  splashRadiusSq: 1.5 * 1.5
              });
          }
      }
  }

  public setPath(path: PathNode[]) {
      this.currentPath = path;
  }

  public getEnemies(): EnemyState[] {
      return this.activeEnemies;
  }

  public onGameOver: (() => void) | null = null;
  public onShotFired: ((damage: number, x: number, z: number) => void) | null = null;

  public subscribe(callback: TickCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public getEnemiesThisWave(): number {
      return 10 + (this.wave - 1) * 5;
  }

  public getTotalSpawned(): number {
      return this.totalSpawned;
  }

  public tick() {
    this.tickCount++;

    // Spawn logic
    const enemiesThisWave = this.getEnemiesThisWave();
    // Spawn slower, e.g. every 15 ticks (4 times a second at 60fps)
    if (this.currentPath.length > 0 && this.tickCount % 15 === 0 && this.totalSpawned < enemiesThisWave) {
        const startNode = this.currentPath[0];
        let nextPos: [number, number, number] = [startNode.x, startNode.y, startNode.z];
        if (this.currentPath.length > 1) {
            const nextNode = this.currentPath[1];
            nextPos = [nextNode.x, nextNode.y, nextNode.z];
        }

        this.activeEnemies.push({
            id: ++this.totalSpawned + (this.wave * 1000), // unique id
            pathIndex: 0,
            hp: 100,
            active: true,
            lastPos: [startNode.x, startNode.y, startNode.z],
            nextPos: nextPos
        });
    }

    // Move active enemies
    for (const enemy of this.activeEnemies) {
        if (!enemy.active) continue;

        if (enemy.pathIndex < this.currentPath.length - 1) {
            enemy.pathIndex++;
            if (enemy.pathIndex >= this.currentPath.length - 1) {
                // Reached goal
                enemy.pathIndex = this.currentPath.length - 1;
                const finalPos = this.currentPath[enemy.pathIndex];
                enemy.lastPos = [finalPos.x, finalPos.y, finalPos.z];
                enemy.nextPos = [finalPos.x, finalPos.y, finalPos.z];
                enemy.lastDamageTick = this.tickCount;
                this.crystalHp -= 1;
            } else {
                const currentPos = this.currentPath[enemy.pathIndex - 1];
                const nextPos = this.currentPath[enemy.pathIndex];
                enemy.lastPos = [currentPos.x, currentPos.y, currentPos.z];
                enemy.nextPos = [nextPos.x, nextPos.y, nextPos.z];
            }
        } else {
            // Already at goal, continuously damage the crystal
            if (!enemy.lastDamageTick || this.tickCount - enemy.lastDamageTick >= 4) {
                enemy.lastDamageTick = this.tickCount;
                this.crystalHp -= 1;
            }
        }
    }

    // Tower Combat
    for (const tower of this.activeTowers) {
        tower.cooldownTimer -= 0.5;

        while (tower.cooldownTimer <= 0) {
            let nearestEnemyIndex = -1;
            let minTargetDistSq = tower.rangeSq;
            let targetEx = 0, targetEy = 0, targetEz = 0;

            for (let i = 0; i < this.activeEnemies.length; i++) {
                const enemy = this.activeEnemies[i];
                if (!enemy.active) continue;

                // Simplified world coordinate calculation for range check
                // Voxel to world formula: lx = x*0.5, lz = z*0.5. Y can be approximated or zeroed out
                const ex = enemy.nextPos[0] * 0.5;
                const ey = enemy.nextPos[1] * 0.2 - 0.4;
                const ez = enemy.nextPos[2] * 0.5;

                const dx = ex - tower.pos[0];
                const dy = ey - tower.pos[1];
                const dz = ez - tower.pos[2];
                const distSq = dx*dx + dy*dy + dz*dz;

                if (distSq <= minTargetDistSq) {
                    minTargetDistSq = distSq;
                    nearestEnemyIndex = i;
                    targetEx = ex;
                    targetEy = ey;
                    targetEz = ez;
                }
            }

            if (nearestEnemyIndex !== -1) {
                const targetEnemy = this.activeEnemies[nearestEnemyIndex];
                
                let speed = tower.damage === 15 ? 0.5 : 1.0; // 1.0s and 0.5s respectively
                
                let freeProj = this.activeProjectiles.find(p => !p.active);
                if (freeProj) {
                    freeProj.id = this.nextProjectileId++;
                    freeProj.type = tower.damage === 15 ? 'heavy' : 'rapid';
                    freeProj.startX = tower.pos[0];
                    freeProj.startY = tower.pos[1] + 1.0;  // Schießt etwas über dem Turm
                    freeProj.startZ = tower.pos[2];
                    freeProj.targetEnemyId = targetEnemy.id;
                    freeProj.progress = -speed; // Offset to counter the update loop that runs immediately
                    freeProj.speed = speed;
                    freeProj.damage = tower.damage;
                    freeProj.splashRadiusSq = tower.splashRadiusSq;
                    freeProj.active = true;
                }

                if (this.onShotFired) this.onShotFired(tower.damage, tower.pos[0], tower.pos[2]);

                tower.cooldownTimer += tower.cooldown;
            } else {
                // No target, cancel remaining fast shots to prevent negative timer build up
                tower.cooldownTimer = 0;
                break;
            }
        }
    }

    // Update Projectiles
    for (const proj of this.activeProjectiles) {
        if (!proj.active) continue;
        
        proj.progress += proj.speed;
        
        if (proj.progress >= 1.0) {
            proj.active = false;
            
            const targetEnemy = this.activeEnemies.find(e => e.id === proj.targetEnemyId);
            
            if (targetEnemy && targetEnemy.active) {
                const ex = targetEnemy.nextPos[0] * 0.5;
                const ey = targetEnemy.nextPos[1] * 0.2 - 0.4;
                const ez = targetEnemy.nextPos[2] * 0.5;

                if (proj.splashRadiusSq !== undefined) {
                    for (let i = 0; i < this.activeEnemies.length; i++) {
                        const enemy = this.activeEnemies[i];
                        if (!enemy.active) continue;
                        const ex2 = enemy.nextPos[0] * 0.5;
                        const ey2 = enemy.nextPos[1] * 0.2 - 0.4;
                        const ez2 = enemy.nextPos[2] * 0.5;
                        const dx2 = ex2 - ex;
                        const dy2 = ey2 - ey;
                        const dz2 = ez2 - ez;
                        if (dx2*dx2 + dy2*dy2 + dz2*dz2 <= proj.splashRadiusSq) {
                            enemy.hp -= proj.damage;
                            if (enemy.hp <= 0 && enemy.active) {
                                enemy.active = false;
                                this.earnedBudget += 10;
                                if (this.onBudgetChange) this.onBudgetChange();
                            }
                        }
                    }
                } else {
                    targetEnemy.hp -= proj.damage;
                    if (targetEnemy.hp <= 0 && targetEnemy.active) {
                        targetEnemy.active = false;
                        this.earnedBudget += 10;
                        if (this.onBudgetChange) this.onBudgetChange();
                    }
                }
            }
        }
    }

    for (const callback of this.subscribers) {
      try {
        callback(this.tickCount);
      } catch (e) {
        console.error("Error in TD Engine subscriber:", e);
      }
    }

    this.activeEnemies = this.activeEnemies.filter(e => e.active);

    if (this.totalSpawned >= enemiesThisWave && this.activeEnemies.length === 0) {
        this.wave++;
        this.totalSpawned = 0;
        if (this.onWaveComplete) this.onWaveComplete();
    }

    if (this.crystalHp <= 0) {
        this.activeEnemies.forEach(e => e.active = false);
        if (this.onGameOver) this.onGameOver();
    }
  }
  
  public getTicks(): number {
    return this.tickCount;
  }
}

// Singleton pattern: Export a single persistent engine instance 
// to be shared across the entire application lifecycle.
export const tdEngine = new TDEngine();
