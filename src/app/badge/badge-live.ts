/**
 * Live physics pose shared between the preview simulation and the export.
 * The pose is transient simulation state (where the badge swings right now),
 * not a product setting, so it lives outside the persisted schema values:
 * PNG export captures exactly what the viewer sees at that moment.
 */
import type { BadgePhysicsSnapshot } from "./badge-physics";

let livePoses: readonly BadgePhysicsSnapshot[] | null = null;
const dropListeners = new Set<() => void>();

export function setBadgeLivePoses(poses: readonly BadgePhysicsSnapshot[] | null): void {
  livePoses = poses;
}

/** The poses on screen (one per badge), or null when no preview is running. */
export function getBadgeLivePoses(): readonly BadgePhysicsSnapshot[] | null {
  return livePoses;
}

/** Asks the running preview to replay the drop-in. */
export function requestBadgeDrop(): void {
  for (const listener of dropListeners) listener();
}

export function onBadgeDropRequest(listener: () => void): () => void {
  dropListeners.add(listener);
  return () => {
    dropListeners.delete(listener);
  };
}
