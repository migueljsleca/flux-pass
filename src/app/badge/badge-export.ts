import {
  evaluateToolcraftTimelineValues,
  type ToolcraftProductExportRenderer,
} from "@/toolcraft/runtime";

import { getBadgeArt } from "./badge-art";
import { getBadgeCamera } from "./badge-camera";
import { getBadgeRigLayouts } from "./badge-layout";
import { getBadgeLivePoses } from "./badge-live";
import { getBadgeUploadsForState, loadBadgePresets } from "./badge-media";
import { readBadgeParams } from "./badge-params";
import { getBadgeRestSnapshot } from "./badge-physics";
import { badgeExportRenderPass, badgeExportScenePass } from "./badge-pipeline";
import { BadgeScene } from "./badge-scene";

/**
 * Largest WebGL drawing buffer the export asks for. Browsers silently clamp a
 * larger buffer while the renderer keeps the requested viewport, which would
 * shift and scale the image.
 */
export const BADGE_EXPORT_MAX_PIXELS = 30_000_000;

/** Supersample up to 2x (antialiasing without MSAA memory) within the edge and area budget. */
export function getBadgeExportSupersample(pixelWidth: number, pixelHeight: number, maxRenderbuffer: number): number {
  const longEdge = Math.max(pixelWidth, pixelHeight, 1);
  const byEdge = Math.min(8192, maxRenderbuffer) / longEdge;
  const byArea = Math.sqrt(BADGE_EXPORT_MAX_PIXELS / Math.max(1, pixelWidth * pixelHeight));
  const factor = Math.min(2, byEdge, byArea);
  return factor >= 1 ? factor : 1;
}

/** PNG/JPG export: the badge exactly where it hangs in the preview at that moment. */
export const badgeExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "flux-pass",
  async renderFrame({ context, frame, pixelRatio, rendererPipeline, signal, state, timeSeconds }) {
    signal.throwIfAborted();
    if (!rendererPipeline) {
      throw new Error("Flux Pass export requires its registered renderer pipeline.");
    }
    const params = readBadgeParams(evaluateToolcraftTimelineValues(state, timeSeconds));
    const presets = await loadBadgePresets(params.person, params.ferroShape);
    signal.throwIfAborted();
    const art = getBadgeArt(params, { ...getBadgeUploadsForState(state.mediaAssets), ...presets });
    const settings = { drag: params.drag, gravity: params.gravity, strapLength: params.strapLength };
    const rigs = getBadgeRigLayouts(params.layout);
    const live = getBadgeLivePoses();
    const poses =
      live && live.length === rigs.length ? live : rigs.map((rig) => getBadgeRestSnapshot(settings, rig));
    const pixelWidth = Math.max(1, Math.round(frame.width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(frame.height * pixelRatio));

    await rendererPipeline.runPass(badgeExportRenderPass, undefined, async () => {
      const scene = await rendererPipeline.runPass(
        badgeExportScenePass,
        { "renderer.export-scene": "flux-pass-export" },
        (passContext) =>
          passContext.getOrCreateResource(
            ["flux-pass-export"],
            () => new BadgeScene({ antialias: false, canvas: new OffscreenCanvas(1, 1) }),
            (owned) => owned.dispose(),
          ),
      );
      signal.throwIfAborted();
      const supersample = getBadgeExportSupersample(pixelWidth, pixelHeight, scene.maxTextureSize);
      scene.update(params, art, poses);
      scene.render(pixelWidth * supersample, pixelHeight * supersample, getBadgeCamera(params, frame.width / frame.height));
      context.save();
      try {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(scene.canvas, frame.x, frame.y, frame.width, frame.height);
      } finally {
        context.restore();
      }
    });
  },
};
