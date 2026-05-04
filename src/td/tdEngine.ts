import { PathNode } from './tdPathfinding';
import { EnemyState, TowerState, ProjectileState, Block } from '../core/types';
import { TD_CONFIG } from '../core/config';
import { VoxelGrid } from './VoxelGrid';
import { TowerRegistry, EnemyRegistry } from './registry';
import { getCategory } from '../builder/partsData';
import { globalEvents } from '../core/events';

export type TickCallback = (tickCount: number) => void;

/**
 * The core logical engine for the Tower Defense game.
 * 
 * This class operates ENTIRELY independently of React, Three.js, or the DOM.
 * It strictly computes abstract logical state (health, paths, collisions).
 * This "zero-allocation" architectural design prevents garbage collection stutters
 * during gameplay, which is critical for smooth 60 FPS rendering.
 */
export const MAX_PROJECTILES = TD_CONFIG.MAX_PROJECTILES;

class TDEngine {
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
  public onCrystalHit: (() => void) | null = null;

  public voxelGrid: VoxelGrid | null = null;

  public isPaused: boolean = false;

  // Spatial Grid
  public spatialGrid: Map<string, EnemyState[]> = new Map();

  constructor() {
    globalEvents.on('SIMULATION_PAUSE', () => {
         this.isPaused = true;
    });
    globalEvents.on('SIMULATION_RESUME', () => {
         this.isPaused = false;
    });

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
            targetX: 0, targetY: 0, targetZ: 0,
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

  public setGrid(grid: VoxelGrid) {
    this.voxelGrid = grid;
  }

  public setTowers(blocks: Block[], normalizePosFunc: (pos: number[] | [number, number, number], partId: string) => any) {
      this.activeTowers = [];
      for (const b of blocks) {
          if (getCategory(b.partId) === 'tower') {
              const towerDef = TowerRegistry[b.partId];
              if (towerDef) {
                  const worldPos = normalizePosFunc(b.position, b.partId);
                  this.activeTowers.push({
                      id: b.id,
                      pos: [worldPos.x, worldPos.y, worldPos.z],
                      partId: b.partId,
                      rangeSq: towerDef.range * towerDef.range,
                      damage: towerDef.damage,
                      cooldown: towerDef.cooldown,
                      cooldownTimer: 0,
                      splashRadiusSq: towerDef.splashRadius ? towerDef.splashRadius * towerDef.splashRadius : undefined
                  });
              }
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

  public getEnemiesThisWave(): number {
      return 10 + (this.wave - 1) * 5;
  }

  public getTotalSpawned(): number {
      return this.totalSpawned;
  }

  public tick() {
    if (this.isPaused) return;
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

        const lawyerDef = EnemyRegistry['lawyer'];
        this.activeEnemies.push({
            id: ++this.totalSpawned + (this.wave * 1000), // unique id
            pathIndex: 0,
            hp: lawyerDef.hp * Math.max(1, this.wave * 0.8), // scale HP by wave
            active: true,
            lastPos: [startNode.x, startNode.y, startNode.z],
            nextPos: nextPos,
            width: lawyerDef.width,
            depth: lawyerDef.depth
        });
    }

    // Move active enemies
    for (const enemy of this.activeEnemies) {
        if (!enemy.active) continue;

        enemy.lastPos = [...enemy.nextPos];

        const targetNode = this.currentPath[enemy.pathIndex];
        let dx = targetNode.x - enemy.nextPos[0];
        let dy = targetNode.y - enemy.nextPos[1];
        let dz = targetNode.z - enemy.nextPos[2];
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Advance path index if close to target node
        if (dist < 0.2 && enemy.pathIndex < this.currentPath.length - 1) {
            enemy.pathIndex++;
            const nextTarget = this.currentPath[enemy.pathIndex];
            dx = nextTarget.x - enemy.nextPos[0];
            dy = nextTarget.y - enemy.nextPos[1];
            dz = nextTarget.z - enemy.nextPos[2];
            dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        // Damage crystal if near the end
        const finalNode = this.currentPath[this.currentPath.length - 1];
        const distToGoal = Math.abs(finalNode.x - enemy.nextPos[0]) + Math.abs(finalNode.z - enemy.nextPos[2]);

        if (distToGoal <= 1.5) {
            if (!enemy.lastDamageTick || this.tickCount - enemy.lastDamageTick >= 4) {
                enemy.lastDamageTick = this.tickCount;
                this.crystalHp -= 1;
                if (this.onCrystalHit) this.onCrystalHit();
            }
        } else {
            // Apply physical movement with AABB clipping
            const speed = EnemyRegistry['lawyer'].speed; // Restored to 1.0 (or whatever registry has) for normal movement
            const moveDist = Math.min(speed, dist);
            
            if (dist > 0.0001) {
                dx /= dist;
                dy /= dist;
                dz /= dist;
            }

            let wantedX = enemy.nextPos[0] + dx * moveDist;
            let wantedZ = enemy.nextPos[2] + dz * moveDist;
            const wantedY = enemy.nextPos[1] + dy * moveDist; // Assume Y always works for now

            if (this.voxelGrid) {
                // width and depth are in physical units. Convert to voxel units (1 voxel = 0.5 physical units)
                const halfW = enemy.width !== undefined ? (enemy.width / 2.0) / 0.5 : 0.4;
                const halfD = enemy.depth !== undefined ? (enemy.depth / 2.0) / 0.5 : 0.4;
                
                const isClear = (cx: number, cy: number, cz: number) => {
                    const p1 = this.voxelGrid!.isSolid(cx - halfW, cy, cz - halfD);
                    const p2 = this.voxelGrid!.isSolid(cx + halfW, cy, cz - halfD);
                    const p3 = this.voxelGrid!.isSolid(cx - halfW, cy, cz + halfD);
                    const p4 = this.voxelGrid!.isSolid(cx + halfW, cy, cz + halfD);
                    return !(p1 || p2 || p3 || p4);
                };

                if (!isClear(wantedX, wantedY, wantedZ)) {
                    // Try sliding along X
                    if (isClear(wantedX, wantedY, enemy.nextPos[2])) {
                        wantedZ = enemy.nextPos[2];
                    } 
                    // Try sliding along Z
                    else if (isClear(enemy.nextPos[0], wantedY, wantedZ)) {
                        wantedX = enemy.nextPos[0];
                    } 
                    // Blocked entirely
                    else {
                        wantedX = enemy.nextPos[0];
                        wantedZ = enemy.nextPos[2];
                    }
                }
            }

            enemy.nextPos[0] = wantedX;
            enemy.nextPos[1] = wantedY;
            enemy.nextPos[2] = wantedZ;
        }
    }

    // Populate Spatial Grid (World Space, Cell Size 2.0)
    for (const list of this.spatialGrid.values()) {
        list.length = 0;
    }
    for (const enemy of this.activeEnemies) {
        if (!enemy.active) continue;
        const wx = enemy.nextPos[0] * 0.5 + 0.25;
        const wy = enemy.nextPos[1] * 0.2 - 0.5;
        const wz = enemy.nextPos[2] * 0.5 + 0.25;
        const cx = Math.floor(wx / 2.0);
        const cy = Math.floor(wy / 2.0);
        const cz = Math.floor(wz / 2.0);
        const key = `${cx},${cy},${cz}`;
        let list = this.spatialGrid.get(key);
        if (!list) {
            list = [];
            this.spatialGrid.set(key, list);
        }
        list.push(enemy);
    }

    // Tower Combat
    for (const tower of this.activeTowers) {
        tower.cooldownTimer -= TD_CONFIG.GAME_TICK_INTERVAL;

        while (tower.cooldownTimer <= 0) {
            let nearestEnemyIndex = -1;
            let nearestEnemy: EnemyState | null = null;
            let minTargetDistSq = tower.rangeSq;
            let targetEx = 0, targetEy = 0, targetEz = 0;

            const tcx = Math.floor(tower.pos[0] / 2.0);
            const tcy = Math.floor(tower.pos[1] / 2.0);
            const tcz = Math.floor(tower.pos[2] / 2.0);
            const cellRadius = Math.ceil(Math.sqrt(tower.rangeSq) / 2.0);

            for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                    for (let dz = -cellRadius; dz <= cellRadius; dz++) {
                        const cellKey = `${tcx + dx},${tcy + dy},${tcz + dz}`;
                        const enemiesInCell = this.spatialGrid.get(cellKey);
                        if (!enemiesInCell) continue;

                        for (let i = 0; i < enemiesInCell.length; i++) {
                            const enemy = enemiesInCell[i];
                            const ex = enemy.nextPos[0] * 0.5;
                            const ey = enemy.nextPos[1] * 0.2 - 0.4;
                            const ez = enemy.nextPos[2] * 0.5;

                            const diffX = ex - tower.pos[0];
                            const diffY = ey - tower.pos[1];
                            const diffZ = ez - tower.pos[2];
                            const distSq = diffX*diffX + diffY*diffY + diffZ*diffZ;

                            if (distSq <= minTargetDistSq) {
                                minTargetDistSq = distSq;
                                nearestEnemy = enemy;
                                targetEx = ex;
                                targetEy = ey;
                                targetEz = ez;
                            }
                        }
                    }
                }
            }

            if (nearestEnemy) {
                const targetEnemy = nearestEnemy;
                const towerDef = TowerRegistry[tower.partId];
                
                let speed = towerDef?.projectileSpeed || 1.0; 
                
                let freeProj = this.activeProjectiles.find(p => !p.active);
                if (freeProj) {
                    freeProj.id = this.nextProjectileId++;
                    freeProj.type = tower.partId === 'logic_td_tower_heavy' ? 'heavy' : 'rapid';
                    freeProj.startX = tower.pos[0];
                    freeProj.startY = tower.pos[1] + 1.0;  // Schießt etwas über dem Turm
                    freeProj.startZ = tower.pos[2];
                    freeProj.targetX = targetEx;
                    freeProj.targetY = targetEy;
                    freeProj.targetZ = targetEz;
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
        
        const targetEnemy = this.activeEnemies.find(e => e.id === proj.targetEnemyId);
        if (targetEnemy && targetEnemy.active) {
            proj.targetX = targetEnemy.nextPos[0] * 0.5;
            proj.targetY = targetEnemy.nextPos[1] * 0.2 - 0.4;
            proj.targetZ = targetEnemy.nextPos[2] * 0.5;
        }

        proj.progress += proj.speed;
        
        if (proj.progress >= 1.0) {
            proj.active = false;
            
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
