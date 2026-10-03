import { sprite2d } from "forgeng/2d";
import { FALLBACK_TEXTURE, MATERIAL, WORLD } from "./ids";

const ENEMY_COUNT = 48;
const PROJECTILE_COUNT = 32;
const OFFSCREEN: readonly [number, number] = [-900, -900];

interface EnemyState {
  readonly index: number;
  x: number;
  y: number;
  hp: number;
  active: boolean;
  revealTicks: number;
}

interface ProjectileState {
  readonly index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  ttl: number;
  active: boolean;
  revealTicks: number;
}

export interface ArenaStep {
  readonly damage: number;
  readonly experience: number;
  readonly kills: number;
}

/** Pooled enemies, auto-aim projectiles, direct XP rewards, and escalating spawn pressure. */
export class Arena {
  private readonly enemies: EnemyState[] = [];
  private readonly projectiles: ProjectileState[] = [];
  private randomState = 0x51a71e2d;
  private ticks = 0;
  private spawnTimer = 0;
  private fireTimer = 0;
  private damageCooldown = 0;

  public constructor() {
    for (let index = 0; index < ENEMY_COUNT; index += 1) {
      this.enemies.push({ index, x: OFFSCREEN[0], y: OFFSCREEN[1], hp: 1, active: false, revealTicks: 0 });
    }
    for (let index = 0; index < PROJECTILE_COUNT; index += 1) {
      this.projectiles.push({ index, x: OFFSCREEN[0], y: OFFSCREEN[1], vx: 0, vy: 0, damage: 1, ttl: 0, active: false, revealTicks: 0 });
    }
    this.reset([0, 0]);
  }

  public createSprites() {
    return [
      ...createArenaBackground(),
      ...this.projectiles.map((projectile) => sprite2d({
        id: `template.2d:projectile-${projectile.index}`,
        entity: projectileEntityId(projectile.index),
        layer: WORLD,
        texture: FALLBACK_TEXTURE,
        material: MATERIAL,
        size: [5, 5],
        tint: [1, 0.84, 0.24, 1],
        transform: { position: OFFSCREEN, rotation: Math.PI / 4, scale: [0, 0] },
      })),
      ...this.enemies.map((enemy) => sprite2d({
        id: `template.2d:enemy-${enemy.index}`,
        entity: enemyEntityId(enemy.index),
        layer: WORLD,
        texture: FALLBACK_TEXTURE,
        material: MATERIAL,
        size: enemy.index % 3 === 0 ? [15, 15] : [12, 12],
        tint: enemy.index % 3 === 0 ? [0.96, 0.26, 0.38, 1] : [0.67, 0.31, 0.94, 1],
        transform: { position: OFFSCREEN, rotation: enemy.index % 3 === 0 ? Math.PI / 4 : 0, scale: [0, 0] },
      })),
    ];
  }

  public step(playerPosition: readonly [number, number], attackDamage: number, attackCooldown: number): ArenaStep {
    this.ticks += 1;
    this.spawnTimer -= 1;
    this.fireTimer -= 1;
    this.damageCooldown = Math.max(0, this.damageCooldown - 1);
    let damage = 0;
    let experience = 0;
    let kills = 0;

    if (this.spawnTimer <= 0 && this.activeEnemyCount() < this.maximumEnemies()) {
      this.prepareEnemy(playerPosition);
      this.spawnTimer = Math.max(9, 34 - Math.floor(this.ticks / 600));
    }
    if (this.fireTimer <= 0) {
      const target = this.nearestEnemy(playerPosition);
      if (target) {
        this.fire(playerPosition, target, attackDamage);
        this.fireTimer = attackCooldown;
      }
    }

    const enemySpeed = 0.34 + Math.min(0.58, this.ticks / 9000);
    for (const enemy of this.enemies) {
      if (!enemy.active) {
        if (enemy.revealTicks > 0) {
          enemy.revealTicks -= 1;
          if (enemy.revealTicks === 0) enemy.active = true;
        }
        continue;
      }
      const dx = playerPosition[0] - enemy.x;
      const dy = playerPosition[1] - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / distance) * enemySpeed;
      enemy.y += (dy / distance) * enemySpeed;
      if (distance < 12) {
        this.hideEnemy(enemy);
        if (this.damageCooldown === 0) {
          damage = 1;
          this.damageCooldown = 48;
        }
      }
    }

    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      if (projectile.revealTicks > 0) {
        projectile.revealTicks -= 1;
        continue;
      }
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.ttl -= 1;
      if (projectile.ttl <= 0) {
        this.hideProjectile(projectile);
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.active || squaredDistance([projectile.x, projectile.y], [enemy.x, enemy.y]) > 10 * 10) continue;
        enemy.hp -= projectile.damage;
        this.hideProjectile(projectile);
        if (enemy.hp <= 0) {
          this.hideEnemy(enemy);
          kills += 1;
          experience += 1;
        }
        break;
      }
    }

    return Object.freeze({ damage, experience, kills });
  }

  public sync(setTransform: (entityId: string, transform: {
    position: readonly [number, number];
    rotation: number;
    scale: readonly [number, number];
  }) => void): void {
    for (const enemy of this.enemies) {
      const shown = enemy.active;
      setTransform(enemyEntityId(enemy.index), { position: [enemy.x, enemy.y], rotation: enemy.index % 3 === 0 ? Math.PI / 4 : 0, scale: shown ? [1, 1] : [0, 0] });
    }
    for (const projectile of this.projectiles) {
      const shown = projectile.active && projectile.revealTicks === 0;
      setTransform(projectileEntityId(projectile.index), { position: [projectile.x, projectile.y], rotation: Math.PI / 4, scale: shown ? [1, 1] : [0, 0] });
    }
  }

  public reset(playerPosition: readonly [number, number]): void {
    this.randomState = 0x51a71e2d;
    this.ticks = 0;
    this.spawnTimer = 22;
    this.fireTimer = 18;
    this.damageCooldown = 0;
    for (const enemy of this.enemies) this.hideEnemy(enemy);
    for (const projectile of this.projectiles) this.hideProjectile(projectile);
    for (let index = 0; index < 6; index += 1) this.prepareEnemy(playerPosition);
  }

  public getElapsedSeconds(): number { return this.ticks / 60; }
  public getActiveEnemyCount(): number { return this.activeEnemyCount(); }

  private prepareEnemy(playerPosition: readonly [number, number]): void {
    const enemy = this.enemies.find((candidate) => !candidate.active && candidate.revealTicks === 0);
    if (!enemy) return;
    const edge = Math.floor(this.nextRandom() * 4);
    if (edge === 0 || edge === 1) {
      enemy.x = -188 + this.nextRandom() * 376;
      enemy.y = edge === 0 ? -112 : 112;
    } else {
      enemy.x = edge === 2 ? -192 : 192;
      enemy.y = -100 + this.nextRandom() * 200;
    }
    if (squaredDistance([enemy.x, enemy.y], playerPosition) < 90 * 90) enemy.x += enemy.x < 0 ? -60 : 60;
    enemy.hp = 1 + Math.floor(this.ticks / 2400);
    enemy.revealTicks = 1;
  }

  private fire(playerPosition: readonly [number, number], target: EnemyState, damage: number): void {
    const projectile = this.projectiles.find((candidate) => !candidate.active);
    if (!projectile) return;
    const dx = target.x - playerPosition[0];
    const dy = target.y - playerPosition[1];
    const distance = Math.hypot(dx, dy) || 1;
    projectile.x = playerPosition[0];
    projectile.y = playerPosition[1];
    projectile.vx = (dx / distance) * 3.7;
    projectile.vy = (dy / distance) * 3.7;
    projectile.damage = damage;
    projectile.ttl = 75;
    projectile.active = true;
    projectile.revealTicks = 1;
  }

  private nearestEnemy(position: readonly [number, number]): EnemyState | null {
    let nearest: EnemyState | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const distance = squaredDistance(position, [enemy.x, enemy.y]);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private maximumEnemies(): number { return Math.min(ENEMY_COUNT, 10 + Math.floor(this.ticks / 240)); }
  private activeEnemyCount(): number { return this.enemies.reduce((count, enemy) => count + (enemy.active || enemy.revealTicks > 0 ? 1 : 0), 0); }
  private hideEnemy(enemy: EnemyState): void { enemy.active = false; enemy.revealTicks = 0; }
  private hideProjectile(projectile: ProjectileState): void { projectile.active = false; projectile.revealTicks = 0; projectile.x = OFFSCREEN[0]; projectile.y = OFFSCREEN[1]; }
  private nextRandom(): number { this.randomState = (1664525 * this.randomState + 1013904223) >>> 0; return this.randomState / 0xffffffff; }
}

export function enemyEntityId(index: number): string { return `template.2d:enemy-${index}-entity`; }
export function projectileEntityId(index: number): string { return `template.2d:projectile-${index}-entity`; }

function squaredDistance(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function createArenaBackground() {
  const sprites = [sprite2d({
    id: "template.2d:arena-background",
    entity: "template.2d:arena-background-entity",
    layer: WORLD,
    texture: FALLBACK_TEXTURE,
    material: MATERIAL,
    size: [640, 360],
    tint: [0.035, 0.075, 0.105, 1],
    transform: { position: [0, 0], rotation: 0, scale: [1, 1] },
  })];
  for (let x = -200; x <= 200; x += 25) {
    sprites.push(sprite2d({ id: `template.2d:grid-v-${x + 200}`, entity: `template.2d:grid-v-${x + 200}-entity`, layer: WORLD, texture: FALLBACK_TEXTURE, material: MATERIAL, size: [0.7, 230], tint: [0.1, 0.23, 0.28, 0.42], transform: { position: [x, 0], rotation: 0, scale: [1, 1] } }));
  }
  for (let y = -100; y <= 100; y += 25) {
    sprites.push(sprite2d({ id: `template.2d:grid-h-${y + 100}`, entity: `template.2d:grid-h-${y + 100}-entity`, layer: WORLD, texture: FALLBACK_TEXTURE, material: MATERIAL, size: [410, 0.7], tint: [0.1, 0.23, 0.28, 0.42], transform: { position: [0, y], rotation: 0, scale: [1, 1] } }));
  }
  return sprites;
}
