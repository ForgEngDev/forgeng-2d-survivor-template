import { binding, controls, defineActionMap } from "forgeng/contracts/actions";

export type UpgradeChoice = "power" | "haste" | "speed";

export const ACTIVE_CONTROLS = [
  { id: "wasd", label: "Keyboard · WASD", help: "Move the survivor" },
  { id: "arrows", label: "Keyboard · Arrow keys", help: "Same movement controls" },
  { id: "upgrades", label: "Keyboard · 1 / 2 / 3", help: "Choose a level-up upgrade" },
  { id: "restart", label: "Keyboard · R / Space", help: "Restart after game over" },
] as const;

export const PlayerControls = defineActionMap({
  id: "template.2d:player-controls",
  actions: {
    move: {
      kind: "vector2",
      bindings: [
        binding.vector2({ id: "wasd", up: controls.key("KeyW"), down: controls.key("KeyS"), left: controls.key("KeyA"), right: controls.key("KeyD") }),
        binding.vector2({ id: "arrows", up: controls.key("ArrowUp"), down: controls.key("ArrowDown"), left: controls.key("ArrowLeft"), right: controls.key("ArrowRight") }),
      ],
    },
  },
});

export interface ControllerHandlers {
  onUpgrade?: (choice: UpgradeChoice) => void;
  onRestart?: () => void;
}

export class Controller {
  private onKeyDown: ((event: KeyboardEvent) => void) | null = null;
  private handlers: ControllerHandlers = {};

  public setup(handlers: ControllerHandlers = {}): void {
    this.destroy();
    this.handlers = handlers;
    this.onKeyDown = (event) => {
      if (event.repeat) return;
      const upgrade = event.code === "Digit1" ? "power" : event.code === "Digit2" ? "haste" : event.code === "Digit3" ? "speed" : null;
      if (upgrade) {
        event.preventDefault();
        this.handlers.onUpgrade?.(upgrade);
      } else if (event.code === "KeyR" || event.code === "Space") {
        event.preventDefault();
        this.handlers.onRestart?.();
      }
    };
    window.addEventListener("keydown", this.onKeyDown);
  }

  public destroy(): void {
    if (this.onKeyDown) window.removeEventListener("keydown", this.onKeyDown);
    this.onKeyDown = null;
    this.handlers = {};
  }
}
