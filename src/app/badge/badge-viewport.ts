/**
 * Locked viewport: Flux Pass has one view. The fixed 1920x1080 artboard
 * always covers the window, centred; wheel / pinch over the badge never pans
 * or zooms, and anything else that moves the view snaps back.
 */
import * as React from "react";

import { useToolcraftDispatch, useToolcraftSelector } from "@/toolcraft/runtime/react";

import { blockBadgeViewportNavigation, watchBadgeWindowSize, type BadgeWindowSize } from "./badge-viewport-dom";

/** Fixed artboard size (the only canvas size of the app). */
export const BADGE_CANVAS_WIDTH = 1920;
export const BADGE_CANVAS_HEIGHT = 1080;

/** Zoom (percent) at which the artboard covers the whole window, centred. */
export function getBadgeCoverZoom(viewportWidth: number, viewportHeight: number, width: number, height: number): number {
  if (!(viewportWidth > 0 && viewportHeight > 0 && width > 0 && height > 0)) return 100;
  const zoom = 100 * Math.max(viewportWidth / width, viewportHeight / height);
  return Math.round(Math.min(400, Math.max(25, zoom)) * 100) / 100;
}

export function useBadgeViewportLock(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  const dispatch = useToolcraftDispatch();
  const zoom = useToolcraftSelector((state) => state.canvas.zoom);
  const offsetX = useToolcraftSelector((state) => state.canvas.offset.x);
  const offsetY = useToolcraftSelector((state) => state.canvas.offset.y);
  const width = useToolcraftSelector((state) => state.canvas.size.width);
  const height = useToolcraftSelector((state) => state.canvas.size.height);
  const [windowSize, setWindowSize] = React.useState<BadgeWindowSize>({
    height: BADGE_CANVAS_HEIGHT,
    width: BADGE_CANVAS_WIDTH,
  });

  React.useEffect(() => watchBadgeWindowSize(setWindowSize), []);

  const lockedZoom = getBadgeCoverZoom(windowSize.width, windowSize.height, width, height);

  // Snap back whenever the view differs from the locked framing.
  React.useEffect(() => {
    if (Math.abs(zoom - lockedZoom) < 0.01 && offsetX === 0 && offsetY === 0) return;
    dispatch({ offset: { x: 0, y: 0 }, type: "canvas.setViewport", zoom: lockedZoom });
  }, [dispatch, lockedZoom, offsetX, offsetY, zoom]);

  // Wheel and pinch over the badge never reach the canvas navigation.
  React.useEffect(() => blockBadgeViewportNavigation(() => canvasRef.current), [canvasRef]);
}
