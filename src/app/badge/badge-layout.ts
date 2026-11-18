/**
 * Badges on screen: one badge, or two side by side where the right one rests
 * showing its back so front and back are visible at the same time.
 */
import type { BadgeLayout } from "./badge-params";
import type { BadgePhysicsOptions } from "./badge-physics";

export type BadgeRigLayout = Readonly<Required<Pick<BadgePhysicsOptions, "anchorX" | "restYaw">>>;

/** Strap anchors sit this far either side of centre in the two-badge layout. */
export const BADGE_PAIR_OFFSET = 0.62;

export function getBadgeRigLayouts(layout: BadgeLayout): readonly BadgeRigLayout[] {
  if (layout === "one") return [{ anchorX: 0, restYaw: 0 }];
  return [
    { anchorX: -BADGE_PAIR_OFFSET, restYaw: 0 },
    { anchorX: BADGE_PAIR_OFFSET, restYaw: Math.PI },
  ];
}

/** Half the width the camera must keep visible (badge half-width plus swing room, plus the pair offset). */
export function getBadgeLayoutHalfWidth(layout: BadgeLayout): number {
  return 0.95 + (layout === "two" ? BADGE_PAIR_OFFSET : 0);
}
