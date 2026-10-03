import { builtinSpriteMaterial2d, defineLayer2d, defineRender2d } from "forgeng/2d";
import { Arena } from "./arena";
import { createCamera } from "./camera";
import { MATERIAL, WORLD } from "./ids";
import { Player } from "./player";

export function createRenderDefinition(player: Player, arena: Arena) {
  return defineRender2d({
    contractVersion: 1,
    id: "template.2d:survivor-render",
    layers: [defineLayer2d({ id: WORLD })],
    cameras: [createCamera()],
    materials: [builtinSpriteMaterial2d({ id: MATERIAL })],
    sprites: [...arena.createSprites(), player.createSprite()],
    animations: [],
  });
}
