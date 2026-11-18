import type { ToolcraftMediaAsset } from "@/toolcraft/runtime";

import type { BadgeArtImages, BadgeImage } from "./badge-art";
import { getBadgePresetUrl, getReadyBadgePreset, loadBadgePreset } from "./badge-presets";
import { BADGE_TARGETS } from "./badge-params";

/** Upload targets that feed the card artwork (just the person photo). */
export const BADGE_IMAGE_TARGETS = [BADGE_TARGETS.photo] as const;
export type BadgeImageTarget = (typeof BADGE_IMAGE_TARGETS)[number];

/** Longest edge of a decoded upload (keeps texture memory modest). */
export const BADGE_IMAGE_MAX_EDGE = 2048;

export type BadgeImageAsset = Readonly<{
  fileName: string;
  id: string;
  resourceRef: string;
  target: BadgeImageTarget;
  transform: Readonly<{ flipHorizontal: boolean; flipVertical: boolean; rotationDeg: 0 | 90 | 180 | 270 }>;
}>;

/** The newest ready image uploaded to `target`, with its runtime rotate/flip transform. */
export function getBadgeImageAsset(
  mediaAssets: readonly ToolcraftMediaAsset[] | undefined,
  target: BadgeImageTarget,
): BadgeImageAsset | null {
  for (const asset of [...(mediaAssets ?? [])].reverse()) {
    if (
      asset.assetKind === "image" &&
      asset.sourceTarget === target &&
      "resourceRef" in asset &&
      asset.lifecycle === "ready"
    ) {
      return {
        fileName: asset.fileName,
        id: asset.id,
        resourceRef: asset.resourceRef,
        target,
        transform: {
          flipHorizontal: asset.transform?.flipHorizontal ?? false,
          flipVertical: asset.transform?.flipVertical ?? false,
          rotationDeg: asset.transform?.rotationDeg ?? 0,
        },
      };
    }
  }
  return null;
}

export function getBadgeImageKey(asset: BadgeImageAsset): string {
  const { flipHorizontal, flipVertical, rotationDeg } = asset.transform;
  return `${asset.target}|${asset.resourceRef}|r${rotationDeg}|${flipHorizontal ? "h" : ""}${flipVertical ? "v" : ""}`;
}

/** Short observable label ("none" when empty). */
export function describeBadgeImage(asset: BadgeImageAsset | null): string {
  if (!asset) return "none";
  const { flipHorizontal, flipVertical, rotationDeg } = asset.transform;
  return `${asset.fileName}:r${rotationDeg}${flipHorizontal ? ":h" : ""}${flipVertical ? ":v" : ""}`;
}

/** Output size after a quarter-turn rotation, capped to the max edge. */
export function getBadgeImageSize(
  width: number,
  height: number,
  rotationDeg: number,
): Readonly<{ height: number; width: number }> {
  const quarter = rotationDeg === 90 || rotationDeg === 270;
  const w = quarter ? height : width;
  const h = quarter ? width : height;
  const scale = Math.min(1, BADGE_IMAGE_MAX_EDGE / Math.max(w, h, 1));
  return { height: Math.max(1, Math.round(h * scale)), width: Math.max(1, Math.round(w * scale)) };
}

/** Decoded images by target; only the newest per target is kept. */
const ready = new Map<BadgeImageTarget, BadgeImage>();
const pending = new Map<string, Promise<BadgeImage>>();

/** The decoded image for this asset + transform, when ready. */
export function getReadyBadgeImage(asset: BadgeImageAsset | null): BadgeImage | null {
  if (!asset) return null;
  const image = ready.get(asset.target);
  return image && image.key.startsWith(`${getBadgeImageKey(asset)}@`) ? image : null;
}

/**
 * Decodes the upload once and bakes the runtime rotate/flip transform into a
 * canvas shared by preview and export. Keyed by URL as well so a replaced
 * upload never keeps the previous picture.
 */
export function loadBadgeImage(
  asset: BadgeImageAsset,
  url: string,
  fetchBlob: () => Promise<Blob>,
): Promise<BadgeImage> {
  const key = `${getBadgeImageKey(asset)}@${url}`;
  const existing = ready.get(asset.target);
  if (existing && existing.key === key) return Promise.resolve(existing);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const job = fetchBlob()
    .then((blob) => createImageBitmap(blob))
    .then((bitmap) => {
      const { rotationDeg, flipHorizontal, flipVertical } = asset.transform;
      const size = getBadgeImageSize(bitmap.width, bitmap.height, rotationDeg);
      const canvas = new OffscreenCanvas(size.width, size.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Badge image canvas has no 2D context.");
      context.translate(size.width / 2, size.height / 2);
      context.rotate((rotationDeg * Math.PI) / 180);
      context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
      const quarter = rotationDeg === 90 || rotationDeg === 270;
      const drawW = quarter ? size.height : size.width;
      const drawH = quarter ? size.width : size.height;
      context.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
      bitmap.close();
      const image: BadgeImage = { height: size.height, key, source: canvas, width: size.width };
      ready.set(asset.target, image);
      return image;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, job);
  return job;
}

/** Decoded uploads for a runtime state (never decodes, only reads the cache). */
export function getBadgeUploadsForState(
  mediaAssets: readonly ToolcraftMediaAsset[] | undefined,
): Pick<BadgeArtImages, "photo"> {
  const read = (target: BadgeImageTarget) => getReadyBadgeImage(getBadgeImageAsset(mediaAssets, target));
  return {
    photo: read(BADGE_TARGETS.photo),
  };
}

/** Preset person and ferrofluid shape when already decoded (preview path). */
export function getReadyBadgePresets(person: string, ferroShape: string): Pick<BadgeArtImages, "ferro" | "person"> {
  return {
    ferro: getReadyBadgePreset(getBadgePresetUrl("ferrofluid", ferroShape)),
    person: getReadyBadgePreset(getBadgePresetUrl("people", person)),
  };
}

/** Preset person and ferrofluid shape, loading them if needed (export path). */
export async function loadBadgePresets(person: string, ferroShape: string): Promise<Pick<BadgeArtImages, "ferro" | "person">> {
  const [ferro, personImage] = await Promise.all([
    loadBadgePreset(getBadgePresetUrl("ferrofluid", ferroShape)),
    loadBadgePreset(getBadgePresetUrl("people", person)),
  ]);
  return { ferro, person: personImage };
}
