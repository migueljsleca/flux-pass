import { getBadgeLayoutHalfWidth } from "./badge-layout";
import type { BadgeParams } from "./badge-params";

export const BADGE_CAMERA_FOV = 30;
/** Default visible height at the badge plane (anchor just above the top edge). */
const BASE_HALF_HEIGHT = 1.55;
const BASE_CENTER_Y = 0.15;

export type BadgeCamera = Readonly<{
  fov: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

/** Fixed framing: Zoom scales the visible area, Camera Y moves the frame up or down. */
export function getBadgeCamera(
  params: Pick<BadgeParams, "cameraY" | "zoom"> & Partial<Pick<BadgeParams, "layout">>,
  aspect: number,
): BadgeCamera {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  // Keep enough width visible either side so a swing is not cropped in tall frames.
  const minHalfWidth = getBadgeLayoutHalfWidth(params.layout ?? "one");
  const halfHeight = Math.max(BASE_HALF_HEIGHT, minHalfWidth / safeAspect) / params.zoom;
  const distance = halfHeight / Math.tan((BADGE_CAMERA_FOV * Math.PI) / 360);
  const y = BASE_CENTER_Y - params.cameraY * BASE_HALF_HEIGHT;
  return { fov: BADGE_CAMERA_FOV, position: [0, y, distance], target: [0, y, 0] };
}
