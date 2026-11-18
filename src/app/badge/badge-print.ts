/**
 * Print pack: one ZIP with the 3D preview PNG plus the flat front and back
 * card artwork (full rectangle, no rounded corners, no slot hole).
 *
 * Deliberate exception to the Toolcraft product boundary (user request:
 * "two separate images of just artwork ... packaged in a zip"). The runtime
 * image export writes exactly one file, so this action renders, encodes and
 * zips in product code; the download itself lives in badge-print-download.js.
 * See docs/toolcraft/agent-worklog.md (pass-011).
 */
import { zipSync } from "fflate";

import {
  evaluateToolcraftTimelineValues,
  getToolcraftImageExportSize,
  toolcraftImageExportResolutionTarget,
} from "@/toolcraft/runtime";

import { drawBadgeBack, drawBadgeFront, getBadgeArt } from "./badge-art";
import { getBadgeCamera } from "./badge-camera";
import { getBadgeExportSupersample } from "./badge-export";
import { getBadgeSceneRect } from "./badge-frame";
import { getBadgeRigLayouts } from "./badge-layout";
import { getBadgeLivePoses } from "./badge-live";
import { getBadgeUploadsForState, loadBadgePresets } from "./badge-media";
import { BADGE_DEFAULTS, BADGE_TARGETS, readBadgeParams } from "./badge-params";
import { getBadgeRestSnapshot } from "./badge-physics";
import { BadgeScene } from "./badge-scene";

/** Print faces are drawn at 2x the 1280 x 1800 design (2560 x 3600). */
export const BADGE_PRINT_SCALE = 2;

type PrintState = Parameters<typeof evaluateToolcraftTimelineValues>[0];

export type BadgePrintPack = Readonly<{ blob: Blob; fileName: string; files: readonly string[] }>;

/** `flux-pass-john-smith` style base name from the holder's name. */
export function getBadgePrintBaseName(firstName: string, lastName: string): string {
  const slug = `${firstName} ${lastName}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `flux-pass-${slug}` : "flux-pass";
}

async function toPng(canvas: OffscreenCanvas): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Uint8Array(await blob.arrayBuffer());
}

/** The badges as they hang right now (or at rest), like Export PNG, at the chosen resolution. */
function renderPreview(state: PrintState, params: ReturnType<typeof readBadgeParams>, art: ReturnType<typeof getBadgeArt>): OffscreenCanvas {
  const rect = getBadgeSceneRect(state.canvas.size.width, state.canvas.size.height);
  const size = getToolcraftImageExportSize({
    frame: rect,
    resolution: String(state.values[toolcraftImageExportResolutionTarget] ?? "4k"),
    state,
  });
  const settings = { drag: params.drag, gravity: params.gravity, strapLength: params.strapLength };
  const rigs = getBadgeRigLayouts(params.layout);
  const live = getBadgeLivePoses();
  const poses = live && live.length === rigs.length ? live : rigs.map((rig) => getBadgeRestSnapshot(settings, rig));

  const scene = new BadgeScene({ antialias: false, canvas: new OffscreenCanvas(1, 1) });
  try {
    const supersample = getBadgeExportSupersample(size.width, size.height, scene.maxTextureSize);
    scene.update(params, art, poses);
    scene.render(size.width * supersample, size.height * supersample, getBadgeCamera(params, rect.width / rect.height));
    const output = new OffscreenCanvas(size.width, size.height);
    const context = output.getContext("2d");
    if (!context) throw new Error("Print pack needs a 2D canvas context.");
    if (params.includeBackground) {
      const background = state.values[BADGE_TARGETS.background];
      context.fillStyle = typeof background === "string" ? background : BADGE_DEFAULTS.background;
      context.fillRect(0, 0, size.width, size.height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(scene.canvas, 0, 0, size.width, size.height);
    return output;
  } finally {
    scene.dispose();
  }
}

/** Builds the ZIP: preview, front and back PNGs. */
export async function buildBadgePrintPack(
  state: PrintState,
  reportProgress: (progress: number) => void = () => undefined,
): Promise<BadgePrintPack> {
  const params = readBadgeParams(evaluateToolcraftTimelineValues(state));
  const images = { ...getBadgeUploadsForState(state.mediaAssets), ...(await loadBadgePresets(params.person, params.ferroShape)) };
  reportProgress(0.1);

  const front = await toPng(drawBadgeFront(params, images, BADGE_PRINT_SCALE));
  reportProgress(0.3);
  const back = await toPng(drawBadgeBack(params, images, BADGE_PRINT_SCALE));
  reportProgress(0.5);
  const preview = await toPng(renderPreview(state, params, getBadgeArt(params, images)));
  reportProgress(0.9);

  const base = getBadgePrintBaseName(params.firstName, params.lastName);
  const entries: Record<string, Uint8Array> = {
    [`${base}-preview.png`]: preview,
    [`${base}-front.png`]: front,
    [`${base}-back.png`]: back,
  };
  // PNGs are already compressed; store them as they are.
  const zip = zipSync(entries, { level: 0 });
  reportProgress(1);
  return {
    blob: new Blob([zip], { type: "application/zip" }),
    fileName: `${base}-print-pack.zip`,
    files: Object.keys(entries),
  };
}
