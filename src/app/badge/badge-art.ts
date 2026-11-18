/**
 * 2D artwork for the card faces and the lanyard, drawn into offscreen
 * canvases that the Three.js scene uploads as textures. Shared by preview
 * and export so both always show the same design.
 *
 * Faces reproduce the Figma designs: "Card / Front — 1280×1800" (node
 * 215:1342: theme background, large person cut-out, staggered name boxes,
 * centred role box) and "Card / Back — 1280×1800" (node 226:831: FLUX
 * wordmark, large ferrofluid shape, "presented by Spotify" badge).
 */
import type { BadgeParams } from "./badge-params";
import { BADGE_FLUX_BOX, BADGE_FLUX_PATHS, BADGE_SPOTIFY_PATHS } from "./badge-vectors";

/** Card face artwork size (32:45, the card ratio). */
export const BADGE_FACE_WIDTH = 1280;
export const BADGE_FACE_HEIGHT = 1800;
/** Minimum lanyard tile width; longer lanyard text widens the tile. */
export const BADGE_STRAP_TILE_WIDTH = 768;
export const BADGE_STRAP_TILE_HEIGHT = 256;

/** Slot cut into the card near the top, in card-face pixels (matches the 3D hole). */
export const BADGE_SLOT = Object.freeze({
  centerY: 112,
  height: 52,
  width: 260,
});

/** Layout from the Figma design, in card-face pixels. */
export const BADGE_LAYOUT = Object.freeze({
  margin: 96,
  top: 220,
  contentWidth: 1088,
  // Front
  person: { cx: 640, cy: 65 + 1435 / 2, height: 1435, width: 1156 },
  name: { size: 163.81, top: 1156, stagger: 1.44, lineStep: 0.9457 },
  role: { size: 87.79, top: 1590 },
  // Back
  flux: { x: 96, y: 220 },
  ferro: { cx: 640, cy: 372.1 + 1271 / 2, height: 1271, width: 1240 },
  /** Presented-by badge at 1x (208.33 x 88); the back uses it at `scale`, bottom-right on the margins. */
  presented: { height: 88, width: 208.33, pad: 6.66, labelSize: 16.42, logoY: 27.31, scale: 1.7046 },
  /** Box padding as a share of the font size (18.56 / 130.28 in the design). */
  boxPad: 0.1425,
});

export type BadgeImage = Readonly<{
  /** Changes whenever the decoded source changes. */
  key: string;
  source: ImageBitmap | OffscreenCanvas;
  width: number;
  height: number;
}>;

export type BadgeArtImages = Readonly<{
  /** Selected ferrofluid shape. */
  ferro: BadgeImage | null;
  /** Uploaded photo; replaces the preset person when present. */
  photo: BadgeImage | null;
  /** Selected preset person. */
  person: BadgeImage | null;
}>;

export type BadgeArt = Readonly<{
  back: OffscreenCanvas;
  front: OffscreenCanvas;
  key: string;
  strap: OffscreenCanvas;
  strapKey: string;
}>;

/** Neue Haas Grotesk Display Pro 75 Bold (installed locally), with close fallbacks. */
export const BADGE_DISPLAY_FONT = '"Neue Haas Grotesk Display Pro", "Helvetica Neue", Helvetica, Arial, sans-serif';

type Context = OffscreenCanvasRenderingContext2D;

function createContext(width: number, height: number): [OffscreenCanvas, Context] {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Badge artwork needs a 2D canvas context.");
  return [canvas, context];
}

function setFont(context: Context, size: number): void {
  context.font = `700 ${size}px ${BADGE_DISPLAY_FONT}`;
}

/** Draws `image` contained in a box centred on (cx, cy), scaled and rotated about its centre. */
function drawContained(
  context: Context,
  image: BadgeImage,
  box: Readonly<{ cx: number; cy: number; height: number; width: number }>,
  scale: number,
  rotationDeg = 0,
): void {
  const fit = Math.min(box.width / image.width, box.height / image.height) * scale;
  const w = image.width * fit;
  const h = image.height * fit;
  context.save();
  context.translate(box.cx, box.cy);
  if (rotationDeg) context.rotate((rotationDeg * Math.PI) / 180);
  context.drawImage(image.source, -w / 2, -h / 2, w, h);
  context.restore();
}

/** Cap height of the display font at `size` (box height excludes ascenders and descenders, as in Figma). */
function capHeight(context: Context, size: number): number {
  setFont(context, size);
  const measured = context.measureText("H").actualBoundingBoxAscent;
  return measured > 0 ? measured : size * 0.714;
}

type TypeBox = Readonly<{ height: number; pad: number; size: number; text: string; textWidth: number; width: number; cap: number }>;

function measureTypeBox(context: Context, text: string, size: number): TypeBox {
  const pad = size * BADGE_LAYOUT.boxPad;
  const cap = capHeight(context, size);
  setFont(context, size);
  const textWidth = context.measureText(text).width;
  return { cap, height: cap + pad * 2, pad, size, text, textWidth, width: textWidth + pad * 2 };
}

/** A filled type box with ink text, like the Figma auto-layout boxes. */
function drawTypeBox(context: Context, box: TypeBox, x: number, y: number, fill: string, ink: string): void {
  context.fillStyle = fill;
  context.fillRect(x, y, box.width, box.height);
  setFont(context, box.size);
  context.fillStyle = ink;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(box.text, x + box.pad, y + box.pad + box.cap);
}

/** Largest size (down from `size`) whose box fits `maxWidth`. */
function fitTypeBox(context: Context, text: string, size: number, maxWidth: number): TypeBox {
  let box = measureTypeBox(context, text, size);
  if (box.width > maxWidth) box = measureTypeBox(context, text, size * (maxWidth / box.width));
  return box;
}

function fillPaths(context: Context, paths: readonly string[], color: string, x: number, y: number, scale = 1): void {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = color;
  for (const d of paths) context.fill(new Path2D(d));
  context.restore();
}

function drawFlux(context: Context, params: BadgeParams): void {
  const { x, y } = BADGE_LAYOUT.flux;
  context.fillStyle = params.boxColor;
  context.fillRect(x, y, BADGE_FLUX_BOX.width, BADGE_FLUX_BOX.height);
  fillPaths(context, BADGE_FLUX_PATHS, params.inkColor, x, y);
}

/** The presented-by Spotify badge with its top-left at (x, y), drawn at `scale`. */
function drawPresentedBy(context: Context, params: BadgeParams, x: number, y: number, scale: number): void {
  const p = BADGE_LAYOUT.presented;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = params.boxColor;
  context.fillRect(0, 0, p.width, p.height);
  const cap = capHeight(context, p.labelSize);
  setFont(context, p.labelSize);
  context.fillStyle = params.inkColor;
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.fillText("PRESENTED BY", p.width - p.pad, p.pad + cap);
  context.textAlign = "left";
  fillPaths(context, BADGE_SPOTIFY_PATHS, params.inkColor, p.pad, p.logoY);
  context.restore();
}

/** Name boxes: two staggered lines (first left, second right) or one line, centred as a group. */
export function layoutBadgeName(
  context: Context,
  params: Pick<BadgeParams, "firstName" | "lastName" | "nameLayout" | "nameSize" | "nameY">,
): readonly Readonly<{ box: TypeBox; x: number; y: number }>[] {
  const n = BADGE_LAYOUT.name;
  const first = params.firstName.trim();
  const last = params.lastName.trim();
  const lines = params.nameLayout === "one" || !first || !last ? [[first, last].filter(Boolean).join(" ")] : [first, last];
  if (!lines[0]) return [];
  const maxWidth = BADGE_LAYOUT.contentWidth;
  let size = n.size * params.nameSize;
  const build = (fontSize: number) => {
    const boxes = lines.map((line) => measureTypeBox(context, line, fontSize));
    const stagger = boxes.length === 2 ? n.stagger * fontSize : 0;
    const width = boxes.length === 2 ? Math.max(boxes[0].width, stagger + boxes[1].width) : boxes[0].width;
    return { boxes, width };
  };
  let built = build(size);
  if (built.width > maxWidth) {
    size *= maxWidth / built.width;
    built = build(size);
  }
  const left = BADGE_FACE_WIDTH / 2 - built.width / 2;
  const step = n.lineStep * size;
  // One line sits where the second line of the two-line layout sits (just above FLUX).
  const top = n.top + params.nameY + (built.boxes.length === 1 ? n.lineStep * n.size * params.nameSize : 0);
  return built.boxes.map((box, index) => ({
    box,
    x: index === 0 ? left : left + built.width - box.width,
    y: top + index * step,
  }));
}

function drawPerson(context: Context, params: BadgeParams, images: BadgeArtImages): void {
  const image = images.photo ?? images.person;
  if (!image) return;
  const box = { ...BADGE_LAYOUT.person, cx: BADGE_LAYOUT.person.cx + params.personX, cy: BADGE_LAYOUT.person.cy + params.personY };
  drawContained(context, image, box, params.personScale);
}

function drawFerro(context: Context, params: BadgeParams, images: BadgeArtImages): void {
  if (!images.ferro) return;
  const box = { ...BADGE_LAYOUT.ferro, cx: BADGE_LAYOUT.ferro.cx + params.ferroX, cy: BADGE_LAYOUT.ferro.cy + params.ferroY };
  drawContained(context, images.ferro, box, params.ferroScale, params.ferroRotation);
}

/** Front (Figma 215:1342): person, staggered name, centred role. */
export function drawBadgeFront(params: BadgeParams, images: BadgeArtImages): OffscreenCanvas {
  const W = BADGE_FACE_WIDTH;
  const H = BADGE_FACE_HEIGHT;
  const [canvas, context] = createContext(W, H);
  context.fillStyle = params.cardColor;
  context.fillRect(0, 0, W, H);
  // Layer order follows the Figma frame (bottom to top).
  drawPerson(context, params, images);
  if (params.roleText) {
    const role = fitTypeBox(context, params.roleText, BADGE_LAYOUT.role.size, BADGE_LAYOUT.contentWidth);
    drawTypeBox(context, role, W / 2 - role.width / 2, BADGE_LAYOUT.role.top, params.boxColor, params.inkColor);
  }
  for (const { box, x, y } of layoutBadgeName(context, params)) {
    drawTypeBox(context, box, x, y, params.boxColor, params.inkColor);
  }
  return canvas;
}

/** Back (Figma 226:831): FLUX at the top, the chosen ferrofluid large over it, presented-by bottom right. */
export function drawBadgeBack(params: BadgeParams, images: BadgeArtImages): OffscreenCanvas {
  const W = BADGE_FACE_WIDTH;
  const H = BADGE_FACE_HEIGHT;
  const [canvas, context] = createContext(W, H);
  context.fillStyle = params.cardColor;
  context.fillRect(0, 0, W, H);
  drawFlux(context, params);
  drawFerro(context, params, images);
  if (params.presentedBy) {
    const p = BADGE_LAYOUT.presented;
    const { margin } = BADGE_LAYOUT;
    drawPresentedBy(context, params, W - margin - p.width * p.scale, H - margin - p.height * p.scale, p.scale);
  }
  return canvas;
}

/** Spotify icon (first path of the logo, a 53.4 px circle in the logo's coordinates). */
const SPOTIFY_ICON_SIZE = 53.43;

function drawSpotifyIcon(context: Context, cx: number, cy: number, size: number, color: string): void {
  const scale = size / SPOTIFY_ICON_SIZE;
  fillPaths(context, [BADGE_SPOTIFY_PATHS[0]], color, cx - size / 2, cy - size / 2, scale);
}

/** One horizontal tile of the lanyard: the Spotify icon, then the text, sized so the text fills the strap height. */
export function drawBadgeStrapTile(params: BadgeParams): OffscreenCanvas {
  const H = BADGE_STRAP_TILE_HEIGHT;
  const text = params.strapText.trim();
  const fontSize = Math.round(H * 0.5);
  const [, measure] = createContext(1, 1);
  setFont(measure, fontSize);
  const markSpace = H * 0.95;
  const gap = H * 0.35;
  const textWidth = text ? measure.measureText(text).width : 0;
  const W = Math.max(BADGE_STRAP_TILE_WIDTH, Math.min(8192, Math.ceil(markSpace + textWidth + gap)));
  const [canvas, context] = createContext(W, H);
  context.fillStyle = params.strapColor;
  context.fillRect(0, 0, W, H);
  context.fillStyle = params.strapInk;
  context.textAlign = "left";
  context.textBaseline = "middle";
  if (text) {
    setFont(context, fontSize);
    context.fillText(text, markSpace, H / 2 + fontSize * 0.04);
  }
  drawSpotifyIcon(context, markSpace / 2, H / 2, H * 0.5, params.strapInk);
  return canvas;
}

function imageKey(image: BadgeImage | null): string {
  return image ? image.key : "none";
}

export function getBadgeFaceKey(params: BadgeParams, images: BadgeArtImages): string {
  return JSON.stringify([
    params.theme,
    params.presentedBy,
    params.roleText,
    params.firstName,
    params.lastName,
    params.nameLayout,
    params.nameSize,
    params.nameY,
    params.personScale,
    params.personX,
    params.personY,
    params.ferroScale,
    params.ferroRotation,
    params.ferroX,
    params.ferroY,
    imageKey(images.photo),
    imageKey(images.person),
    imageKey(images.ferro),
  ]);
}

export function getBadgeStrapKey(params: BadgeParams): string {
  return [params.strapText, params.strapColor, params.strapInk].join("|");
}

/** Builds (or reuses) the artwork for this state. Only the newest set is kept. */
let cached: BadgeArt | null = null;
export function getBadgeArt(params: BadgeParams, images: BadgeArtImages): BadgeArt {
  const key = getBadgeFaceKey(params, images);
  const strapKey = getBadgeStrapKey(params);
  if (cached && cached.key === key && cached.strapKey === strapKey) return cached;
  const reuseFaces = cached && cached.key === key;
  const reuseStrap = cached && cached.strapKey === strapKey;
  const next: BadgeArt = {
    back: reuseFaces && cached ? cached.back : drawBadgeBack(params, images),
    front: reuseFaces && cached ? cached.front : drawBadgeFront(params, images),
    key,
    strap: reuseStrap && cached ? cached.strap : drawBadgeStrapTile(params),
    strapKey,
  };
  cached = next;
  return next;
}
