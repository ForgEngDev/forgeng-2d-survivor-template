import { sprite2d } from "forgeng/2d";
import { FALLBACK_TEXTURE, MATERIAL, PLAYER, PLAYER_ENTITY, WORLD } from "./ids";

const ARENA_X = 174;
const ARENA_Y = 94;

/** Player movement and upgradeable survivor stats. */
export class Player {
  private position: readonly [number, number] = [0, 0];
  private moveSpeed = 1.45;
  private attackDamage = 1;
  private attackCooldown = 34;

  public createSprite() {
    return sprite2d({
      id: PLAYER,
      entity: PLAYER_ENTITY,
      layer: WORLD,
      texture: FALLBACK_TEXTURE,
      material: MATERIAL,
      size: [14, 14],
      tint: [0.2, 0.95, 0.72, 1],
      transform: { position: this.position, rotation: Math.PI / 4, scale: [1, 1] },
    });
  }

  public move(dx: number, dy: number): readonly [number, number] {
    const magnitude = Math.hypot(dx, dy) || 1;
    const normalizedX = magnitude > 1 ? dx / magnitude : dx;
    const normalizedY = magnitude > 1 ? dy / magnitude : dy;
    this.position = [
      clamp(this.position[0] + normalizedX * this.moveSpeed, -ARENA_X, ARENA_X),
      clamp(this.position[1] + normalizedY * this.moveSpeed, -ARENA_Y, ARENA_Y),
    ];
    return this.position;
  }

  public upgradePower(): void { this.attackDamage += 1; }
  public upgradeHaste(): void { this.attackCooldown = Math.max(10, this.attackCooldown - 5); }
  public upgradeSpeed(): void { this.moveSpeed = Math.min(2.7, this.moveSpeed + 0.22); }

  public getPosition(): readonly [number, number] { return this.position; }
  public getAttackDamage(): number { return this.attackDamage; }
  public getAttackCooldown(): number { return this.attackCooldown; }
  public getMoveSpeed(): number { return this.moveSpeed; }

  public reset(): readonly [number, number] {
    this.position = [0, 0];
    this.moveSpeed = 1.45;
    this.attackDamage = 1;
    this.attackCooldown = 34;
    return this.position;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
