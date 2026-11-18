import type { BadgeArt } from "./badge-art";
import type { BadgeCamera } from "./badge-camera";
import type { BadgeParams } from "./badge-params";
import type { BadgePhysicsSnapshot, Vec3 } from "./badge-physics";

export type BadgeSceneOptions = Readonly<{
  antialias: boolean;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Keeps the last preview frame readable for pixel sampling (QA). */
  preserveDrawingBuffer?: boolean;
}>;

export type BadgeHit = Readonly<{
  /** Which badge was hit (0 = front badge, 1 = back badge). */
  index: number;
  /** Card-space spot: u from left (0) to right (1), v from bottom (0) to top (1). */
  u: number;
  v: number;
  point: Vec3;
}>;

/** Three.js badge scene: glossy rounded card, metal clip and swivel, fabric lanyard. */
export declare class BadgeScene {
  constructor(options: BadgeSceneOptions);
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly maxTextureSize: number;
  /** Draws one badge per pose (one or two). */
  update(params: BadgeParams, art: BadgeArt, poses: readonly BadgePhysicsSnapshot[]): void;
  render(width: number, height: number, camera: BadgeCamera): void;
  /** Ray-casts the card from normalised device coordinates; null on a miss. */
  hitCard(ndcX: number, ndcY: number): BadgeHit | null;
  /** Point under the pointer on the camera-facing plane through `through`. */
  pointerOnPlane(ndcX: number, ndcY: number, through: Vec3): Vec3 | null;
  dispose(): void;
}
