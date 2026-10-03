import type { Forge2dGame, Forge2dSceneDefinition, Forge2dSceneFacade } from "forgeng/presets/2d";
import type { UiShellLike } from "@forgeng/ui-dom";
import { Arena } from "./arena";
import { Controller, PlayerControls, type UpgradeChoice } from "./controller";
import { Hud } from "./hud";
import { PLAYER_ENTITY, SCENE_ID } from "./ids";
import { Player } from "./player";
import { createRenderDefinition } from "./render";

export type RunState = "playing" | "level-up" | "game-over";

/** Survivor loop: move, auto-attack, earn XP, choose upgrades, and outlast the swarm. */
export class MainScene {
  private readonly player = new Player();
  private readonly arena = new Arena();
  private readonly controller = new Controller();
  private readonly hud = new Hud();
  private game: Forge2dGame | null = null;
  private scene: Forge2dSceneFacade | null = null;
  private state: RunState = "playing";
  private health = 5;
  private level = 1;
  private experience = 0;
  private experienceTarget = 5;
  private kills = 0;
  private lastFrame = performance.now();
  private raf = 0;

  public definition(): Forge2dSceneDefinition {
    return {
      id: SCENE_ID,
      render: createRenderDefinition(this.player, this.arena),
      colliders: [],
      setup: (scene) => this.setup(scene),
      fixedUpdate: (scene) => this.fixedUpdate(scene),
    };
  }

  public bindGame(game: Forge2dGame): void {
    this.game = game;
    const ui = game.ui as UiShellLike | null;
    if (ui) {
      this.hud.setup(ui, {
        getCanvasSize: () => ({ width: game.canvas.width, height: game.canvas.height }),
        getRunState: () => this.state,
        getPlayerPosition: () => this.player.getPosition(),
        getHealth: () => this.health,
        getLevel: () => this.level,
        getExperience: () => this.experience,
        getExperienceTarget: () => this.experienceTarget,
        getKills: () => this.kills,
        getElapsedSeconds: () => this.arena.getElapsedSeconds(),
        getEnemyCount: () => this.arena.getActiveEnemyCount(),
        getAttackDamage: () => this.player.getAttackDamage(),
        getAttackCooldown: () => this.player.getAttackCooldown(),
        getMoveSpeed: () => this.player.getMoveSpeed(),
      }, (choice) => this.chooseUpgrade(choice));
    }
    this.controller.setup({
      onUpgrade: (choice) => this.chooseUpgrade(choice),
      onRestart: () => { if (this.state === "game-over") this.reset(); },
    });
    this.hud.notify("Move with WASD or the arrow keys. Attacks are automatic.", 4200);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.hud.update(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  public destroy(): void {
    cancelAnimationFrame(this.raf);
    this.controller.destroy();
    this.hud.destroy();
    this.scene = null;
    this.game = null;
  }

  private setup(scene: Forge2dSceneFacade): void {
    this.scene = scene;
    this.sync(scene);
  }

  private fixedUpdate(scene: Forge2dSceneFacade): void {
    if (!this.game || this.state !== "playing") {
      this.sync(scene);
      return;
    }
    const move = this.game.actions.value(PlayerControls.move) as readonly [number, number];
    if (move[0] !== 0 || move[1] !== 0) {
      const position = this.player.move(move[0], -move[1]);
      scene.setTransform(PLAYER_ENTITY, { position, rotation: Math.PI / 4, scale: [1, 1] });
    }
    const step = this.arena.step(this.player.getPosition(), this.player.getAttackDamage(), this.player.getAttackCooldown());
    this.health = Math.max(0, this.health - step.damage);
    this.kills += step.kills;
    this.experience += step.experience;
    if (this.health === 0) {
      this.state = "game-over";
      this.hud.notify(`Run over — ${this.kills} enemies defeated.`, 5000);
    } else if (this.experience >= this.experienceTarget) {
      this.experience -= this.experienceTarget;
      this.level += 1;
      this.experienceTarget = Math.floor(this.experienceTarget * 1.42) + 2;
      this.state = "level-up";
    }
    this.sync(scene);
  }

  private chooseUpgrade(choice: UpgradeChoice): void {
    if (this.state !== "level-up") return;
    if (choice === "power") this.player.upgradePower();
    else if (choice === "haste") this.player.upgradeHaste();
    else this.player.upgradeSpeed();
    this.state = "playing";
    this.hud.notify(choice === "power" ? "Power increased" : choice === "haste" ? "Attack speed increased" : "Movement speed increased", 1800);
    if (this.scene) this.sync(this.scene);
  }

  private reset(): void {
    this.state = "playing";
    this.health = 5;
    this.level = 1;
    this.experience = 0;
    this.experienceTarget = 5;
    this.kills = 0;
    const position = this.player.reset();
    this.arena.reset(position);
    this.scene?.setTransform(PLAYER_ENTITY, { position, rotation: Math.PI / 4, scale: [1, 1] });
    if (this.scene) this.sync(this.scene);
    this.hud.notify("New run started", 1800);
  }

  private sync(scene: Forge2dSceneFacade): void {
    this.arena.sync((entityId, transform) => scene.setTransform(entityId, transform));
    scene.hud.set("hud/status", Object.freeze({ state: this.state, health: this.health, level: this.level, experience: this.experience, kills: this.kills }));
    this.hud.setGameStatus({
      state: this.state,
      health: this.health,
      level: this.level,
      experience: this.experience,
      experienceTarget: this.experienceTarget,
      kills: this.kills,
      elapsedSeconds: this.arena.getElapsedSeconds(),
    });
  }
}
