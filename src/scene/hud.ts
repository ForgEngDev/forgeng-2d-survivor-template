import type { UiDisposable, UiShellLike } from "@forgeng/ui-dom";
import { ACTIVE_CONTROLS, type UpgradeChoice } from "./controller";
import type { RunState } from "./mainScene";

export interface MetricsSource {
  getCanvasSize(): { width: number; height: number };
  getRunState(): RunState;
  getPlayerPosition(): readonly [number, number];
  getHealth(): number;
  getLevel(): number;
  getExperience(): number;
  getExperienceTarget(): number;
  getKills(): number;
  getElapsedSeconds(): number;
  getEnemyCount(): number;
  getAttackDamage(): number;
  getAttackCooldown(): number;
  getMoveSpeed(): number;
}

export interface GameStatus {
  readonly state: RunState;
  readonly health: number;
  readonly level: number;
  readonly experience: number;
  readonly experienceTarget: number;
  readonly kills: number;
  readonly elapsedSeconds: number;
}

export class Hud {
  private readonly disposers: UiDisposable[] = [];
  private ui: UiShellLike | null = null;
  private source: MetricsSource | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private healthEl: HTMLElement | null = null;
  private levelEl: HTMLElement | null = null;
  private xpFillEl: HTMLElement | null = null;
  private statsEl: HTMLElement | null = null;
  private modalEl: HTMLElement | null = null;
  private modalState: RunState | null = null;
  private toastEl: HTMLElement | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private advanced = false;
  private fps = 0;
  private frames = 0;
  private fpsTimer = 0;
  private onUpgrade: ((choice: UpgradeChoice) => void) | null = null;

  public setup(ui: UiShellLike, source: MetricsSource, onUpgrade: (choice: UpgradeChoice) => void): void {
    this.destroy();
    this.ui = ui;
    this.source = source;
    this.onUpgrade = onUpgrade;
    this.advanced = new URLSearchParams(window.location.search).has("advanced");
    this.installUiStyle(ui);
    this.applyAdvanced();
    this.ensureOverlay();
    this.disposers.push(ui.settings.register({ id: "template.controls", title: "Controls", fields: [
      { id: "status", label: "Status", kind: "status", read: () => `${formatState(this.source?.getRunState() ?? "playing")} · ${this.fps} FPS` },
      ...ACTIVE_CONTROLS.map((control) => ({ id: `ctrl-${control.id}`, label: control.label, kind: "status" as const, read: () => control.help })),
      { id: "advanced", label: "Advanced metrics", kind: "boolean", read: () => this.advanced, write: (value: string | number | boolean | null) => { this.advanced = value === true; this.applyAdvanced(); this.syncUrl(); ui.settings.refresh("template.controls"); } },
      { id: "tip", label: "Goal", kind: "status", read: () => "Survive, collect XP, and stack upgrades" },
    ] }));
    this.disposers.push(ui.contributions.register({ id: "template.controls.panel", title: "Controls", slot: "side-panel", order: 10, settingsSchemaId: "template.controls" }));
    this.disposers.push(ui.settings.register({ id: "template.metrics", title: "Metrics", fields: [
      { id: "fps", label: "FPS", kind: "status", read: () => String(this.fps) },
      { id: "player", label: "Player XY", kind: "status", read: () => { const p = this.source?.getPlayerPosition(); return p ? `${p[0].toFixed(0)}, ${p[1].toFixed(0)}` : "—"; } },
      { id: "enemies", label: "Active enemies", kind: "status", read: () => String(this.source?.getEnemyCount() ?? 0) },
      { id: "damage", label: "Attack damage", kind: "status", read: () => String(this.source?.getAttackDamage() ?? 0) },
      { id: "cooldown", label: "Attack cooldown", kind: "status", read: () => `${this.source?.getAttackCooldown() ?? 0} ticks` },
      { id: "move", label: "Move speed", kind: "status", read: () => (this.source?.getMoveSpeed() ?? 0).toFixed(2) },
      { id: "resolution", label: "Resolution", kind: "status", read: () => { const s = this.source?.getCanvasSize(); return s ? `${s.width}×${s.height}` : "—"; } },
    ] }));
    this.disposers.push(ui.contributions.register({ id: "template.metrics.panel", title: "Metrics", slot: "side-panel", order: 20, settingsSchemaId: "template.metrics" }));
  }

  public update(dt: number): void {
    this.frames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer < 0.5) return;
    this.fps = Math.round(this.frames / this.fpsTimer);
    this.frames = 0;
    this.fpsTimer = 0;
    this.ui?.settings.refresh("template.controls");
    if (this.advanced) this.ui?.settings.refresh("template.metrics");
  }

  public setGameStatus(status: GameStatus): void {
    this.ensureOverlay();
    if (this.healthEl) this.healthEl.textContent = `HP ${"◆".repeat(status.health)}${"◇".repeat(Math.max(0, 5 - status.health))}`;
    if (this.levelEl) this.levelEl.textContent = `LEVEL ${status.level}`;
    if (this.xpFillEl) this.xpFillEl.style.width = `${Math.min(100, status.experience / status.experienceTarget * 100)}%`;
    if (this.statsEl) this.statsEl.textContent = `${formatTime(status.elapsedSeconds)}  ·  ${status.kills} KILLS`;
    if (!this.modalEl) return;
    if (status.state === "playing") {
      this.modalEl.hidden = true;
      this.modalState = status.state;
      return;
    }
    this.modalEl.hidden = false;
    if (this.modalState === status.state) return;
    this.modalState = status.state;
    if (status.state === "level-up") {
      this.modalEl.innerHTML = `
        <strong>LEVEL UP</strong><span>Choose one upgrade</span>
        <div class="template-upgrade-grid">
          <button type="button" data-upgrade="power"><b>1 · POWER</b><small>+1 projectile damage</small></button>
          <button type="button" data-upgrade="haste"><b>2 · HASTE</b><small>Faster automatic attacks</small></button>
          <button type="button" data-upgrade="speed"><b>3 · SPEED</b><small>Move faster through the swarm</small></button>
        </div>`;
      this.modalEl.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach((button) => {
        button.addEventListener("click", () => this.onUpgrade?.(button.dataset.upgrade as UpgradeChoice), { once: true });
      });
    } else if (status.state === "game-over") {
      this.modalEl.innerHTML = `<strong>RUN OVER</strong><span>${status.kills} enemies defeated in ${formatTime(status.elapsedSeconds)}</span><em>Press R or Space to restart</em>`;
    }
  }

  public notify(message: string, durationMs = 2500): void {
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    const toast = this.ensureToast();
    toast.innerHTML = `<strong>2D Survivor</strong><span>${message}</span>`;
    toast.hidden = false;
    this.notifyTimer = setTimeout(() => { toast.hidden = true; this.notifyTimer = null; }, durationMs);
  }

  public destroy(): void {
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.toastEl?.remove();
    this.overlayEl?.remove();
    this.styleEl?.remove();
    this.toastEl = null;
    this.overlayEl = null;
    this.healthEl = null;
    this.levelEl = null;
    this.xpFillEl = null;
    this.statsEl = null;
    this.modalEl = null;
    this.modalState = null;
    this.styleEl = null;
    for (const disposer of this.disposers.splice(0).reverse()) void disposer.dispose();
    delete document.body.dataset.templateAdvanced;
    this.ui = null;
    this.source = null;
    this.onUpgrade = null;
  }

  private ensureOverlay(): void {
    if (this.overlayEl) return;
    const overlay = document.createElement("div");
    overlay.className = "template-survivor-overlay";
    overlay.innerHTML = `
      <div class="template-health"></div>
      <div class="template-progress"><b class="template-level"></b><div class="template-xp"><i></i></div></div>
      <div class="template-run-stats"></div>
      <div class="template-survivor-modal" hidden></div>`;
    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.healthEl = overlay.querySelector(".template-health");
    this.levelEl = overlay.querySelector(".template-level");
    this.xpFillEl = overlay.querySelector(".template-xp i");
    this.statsEl = overlay.querySelector(".template-run-stats");
    this.modalEl = overlay.querySelector(".template-survivor-modal");
  }

  private ensureToast(): HTMLElement {
    if (this.toastEl) return this.toastEl;
    const toast = document.createElement("div");
    toast.className = "template-toast";
    toast.hidden = true;
    document.body.appendChild(toast);
    this.toastEl = toast;
    return toast;
  }

  private applyAdvanced(): void { document.body.dataset.templateAdvanced = this.advanced ? "1" : "0"; }
  private syncUrl(): void { const url = new URL(location.href); if (this.advanced) url.searchParams.set("advanced", "1"); else url.searchParams.delete("advanced"); history.replaceState({}, "", url); }
  private installUiStyle(ui: UiShellLike): void {
    ui.preferences.update({ layout: { sidePanelWidth: 340, sidePanelCollapsed: false, hiddenSlots: ["top-bar", "bottom-status"] } });
    this.styleEl = document.createElement("style");
    this.styleEl.id = "template-ui-focus";
    this.styleEl.textContent = `
      .forgeng-ui-surface[data-surface-id$=".chrome"],.forgeng-ui-surface[data-surface-id$=".menu"],.forgeng-ui-slot[data-slot="top-bar"]{display:none!important}
      .forgeng-ui-card[data-contribution-id="forgeng.renderer.webgpu.debug"],.forgeng-ui-card[data-contribution-id="forgeng.audio.webaudio.panel"],.forgeng-ui-card[data-contribution-id="forgeng.assets.health.panel"],body[data-template-advanced="0"] .forgeng-ui-card[data-contribution-id="template.metrics.panel"]{display:none!important}
      .forgeng-ui-shell{--fg-side-width:340px}.forgeng-ui-slot[data-slot="side-panel"]{top:12px;bottom:12px}
      @media(max-width:700px){.forgeng-ui-slot[data-slot="side-panel"]{display:none!important}}
    `;
    document.head.appendChild(this.styleEl);
  }
}

function formatState(state: RunState): string { return state === "level-up" ? "Level up" : state === "game-over" ? "Game over" : "Surviving"; }
function formatTime(seconds: number): string { const whole = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`; }
