/**
 * Pre-made people cut-outs and ferrofluid shapes exported from the Figma
 * "assets" section (people/01-08, ferrofluid/01-16) at 0.3x into
 * public/badge, with 200px thumbnails for the image pickers.
 */
import type { BadgeImage } from "./badge-art";

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, "0"));
}

export const BADGE_PERSON_IDS = ids(8);
export const BADGE_FERRO_IDS = ids(16);

const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export function getBadgePresetUrl(kind: "people" | "ferrofluid", id: string): string {
  return `${base}badge/${kind}/${id}.png`;
}

export function getBadgePresetThumb(kind: "people" | "ferrofluid", id: string): string {
  return `${base}badge/thumbs/${kind}/${id}.png`;
}

export const BADGE_PERSON_ITEMS = BADGE_PERSON_IDS.map((id) => ({
  alt: `Person ${id}`,
  src: getBadgePresetThumb("people", id),
  value: id,
}));

export const BADGE_FERRO_ITEMS = BADGE_FERRO_IDS.map((id) => ({
  alt: `Ferrofluid ${id}`,
  src: getBadgePresetThumb("ferrofluid", id),
  value: id,
}));

const ready: { [url: string]: BadgeImage | undefined } = {};
const pending: { [url: string]: Promise<BadgeImage> | undefined } = {};

/** The decoded preset, when it has been loaded. */
export function getReadyBadgePreset(url: string): BadgeImage | null {
  return ready[url] ?? null;
}

/** Fetches and decodes a preset once; shared by preview and export. */
export function loadBadgePreset(url: string): Promise<BadgeImage> {
  const existing = ready[url];
  if (existing) return Promise.resolve(existing);
  const inFlight = pending[url];
  if (inFlight) return inFlight;
  const job = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Preset ${url} failed to load (${response.status}).`);
      return response.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .then((bitmap) => {
      const image: BadgeImage = { height: bitmap.height, key: url, source: bitmap, width: bitmap.width };
      ready[url] = image;
      return image;
    })
    .finally(() => {
      delete pending[url];
    });
  pending[url] = job;
  return job;
}
