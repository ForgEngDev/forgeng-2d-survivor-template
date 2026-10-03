import { camera2d } from "forgeng/2d";
import { CAMERA, WORLD } from "./ids";

/** Full-viewport orthographic camera for the survivor arena. */
export function createCamera() {
  return camera2d({
    id: CAMERA,
    virtualSize: [400, 225],
    scaleMode: "fill",
    pixelSnap: "camera-and-items",
    sampling: "nearest",
    layers: [WORLD],
    clearColor: [0.03, 0.055, 0.11, 1],
  });
}
