# ForgEng 2D Survivor Template

**Live demo:** [play.forgeng.dev/forgeng-2d-survivor-template/current/](https://play.forgeng.dev/forgeng-2d-survivor-template/current/)

A beginner-friendly survivor-like arena game built with **ForgeNG 3.4.2**, TypeScript, WebGPU, and Vite. Move through an escalating swarm while your weapon automatically targets enemies, collect XP gems, and choose an upgrade every time you level up.

## Quick start

```bash
git clone https://github.com/ForgEngDev/forgeng-2d-survivor-template.git
cd forgeng-2d-survivor-template
npm install
npm run dev
```

Open the local URL printed by Vite in a WebGPU-capable browser.

## Included

- ForgeNG `Forge2d.create` scene setup
- full-viewport 400×225 arena camera
- WASD and arrow-key movement
- automatic nearest-enemy targeting
- fixed enemy, projectile, and XP-gem pools
- escalating enemy count, speed, and health
- health, kills, survival timer, XP, and level progression
- Power, Haste, and Speed level-up choices
- keyboard and touch-friendly upgrade selection
- game-over and restart flow without reloading
- English controls panel and optional metrics (`?advanced=1`)
- vendored ForgeNG 3.4.2 browser runtime

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move the survivor |
| 1 / 2 / 3 | Choose a level-up upgrade |
| Click an upgrade | Touch/pointer upgrade selection |
| R / Space | Restart after game over |

Attacks are automatic and target the nearest active enemy.

## Project layout

```text
src/
  main.ts
  scene/
    mainScene.ts       # run state, health, XP, levels, and restart
    arena.ts           # pooled enemies, projectiles, gems, and collisions
    player.ts          # movement and upgradeable player stats
    controller.ts      # movement, upgrade, and restart input
    render.ts          # layer, camera, material, and sprites
    hud.ts             # compact HUD, controls, metrics, and upgrade modal
  vendor/forgeng/      # ForgeNG 3.4.2 runtime
css/style.css
```

## Build

```bash
npm run build
npm run preview
```

## More ForgEng templates

- [Top-Down 2D](https://github.com/ForgEngDev/forgeng-2d-top-down-template)
- [2D Platformer](https://github.com/ForgEngDev/forgeng-2d-platformer-template)
- [2D Endless Flyer](https://github.com/ForgEngDev/forgeng-2d-endless-flyer-template)
- [2D Top-Down Racing](https://github.com/ForgEngDev/forgeng-2d-top-down-racing-template)
- [2D Space Shooter](https://github.com/ForgEngDev/forgeng-2d-space-shooter-template)
- [3D Platformer](https://github.com/ForgEngDev/forgeng-3d-template)

Documentation: [forgeng.dev](https://forgeng.dev)

## License

See [LICENSE](./LICENSE). Template/game code is available for client-side game projects. The vendored ForgEng engine remains subject to the ForgeNG license; commercial engine use or installing the engine/SDK on other computers is not permitted without authorization.

## Public API and AI coding assistants

See the [ForgeNG public API repository](https://github.com/ForgEngDev/forgeng-api) for versioned TypeScript signatures, an API entry map, and [instructions for AI assistants](https://github.com/ForgEngDev/forgeng-api/blob/main/AGENTS.md). Give your assistant that link together with this game project. This template's pinned runtime and vendored declarations take precedence over a newer API snapshot. Start with one change and run `npm run build`, then check the game in a WebGPU browser.
