/**
 * Schema targets, defaults, ranges and the typed reader for the Flux Pass
 * badge. Every renderer, the export and the physics read values through
 * `readBadgeParams` so one canonical representation is used everywhere.
 */
import { BADGE_FERRO_IDS, BADGE_PERSON_IDS } from "./badge-presets";
import { BADGE_INK, BADGE_THEMES, isBadgeThemeId, type BadgeThemeId } from "./badge-theme";

export const BADGE_TARGETS = {
  theme: "card.theme",
  presentedBy: "card.presentedBy",
  role: "holder.role",
  roleCustom: "holder.roleCustom",
  firstName: "holder.firstName",
  lastName: "holder.lastName",
  nameLayout: "name.layout",
  nameSize: "name.size",
  nameY: "name.y",
  person: "person.preset",
  photo: "photo.image",
  personScale: "person.scale",
  personX: "person.x",
  personY: "person.y",
  ferroShape: "ferro.shape",
  ferroScale: "ferro.scale",
  ferroRotation: "ferro.rotation",
  ferroX: "ferro.x",
  ferroY: "ferro.y",
  frontArt: "art.front",
  backArt: "art.back",
  strapStyle: "strap.style",
  strapText: "strap.text",
  strapColor: "strap.color",
  strapInk: "strap.ink",
  clipColor: "strap.clipColor",
  strapLength: "strap.length",
  gravity: "physics.gravity",
  drag: "physics.drag",
  drop: "physics.drop",
  layout: "view.layout",
  zoom: "view.zoom",
  cameraY: "view.cameraY",
  includeBackground: "export.includeBackground",
  background: "appearance.background",
} as const;

export const BADGE_ROLES = [
  { label: "Media", value: "media" },
  { label: "Artist", value: "artist" },
  { label: "Speaker", value: "speaker" },
  { label: "Press", value: "press" },
  { label: "Guest", value: "guest" },
  { label: "VIP", value: "vip" },
  { label: "Crew", value: "crew" },
  { label: "Custom…", value: "custom" },
] as const;

export type BadgeRole = (typeof BADGE_ROLES)[number]["value"];
export type BadgeNameLayout = "two" | "one";
export type BadgeStrapStyle = "theme" | "custom";
export type BadgeLayout = "one" | "two";

export type BadgeParams = Readonly<{
  theme: BadgeThemeId;
  /** Theme colours resolved for the renderers. */
  cardColor: string;
  boxColor: string;
  inkColor: string;
  presentedBy: boolean;
  role: BadgeRole;
  roleCustom: string;
  /** Text printed in the role box (custom text or the role label). */
  roleText: string;
  firstName: string;
  lastName: string;
  nameLayout: BadgeNameLayout;
  nameSize: number;
  nameY: number;
  person: string;
  personScale: number;
  personX: number;
  personY: number;
  ferroShape: string;
  ferroScale: number;
  ferroRotation: number;
  ferroX: number;
  ferroY: number;
  strapStyle: BadgeStrapStyle;
  strapText: string;
  strapColor: string;
  strapInk: string;
  clipColor: string;
  strapLength: number;
  gravity: number;
  drag: number;
  layout: BadgeLayout;
  zoom: number;
  cameraY: number;
  includeBackground: boolean;
}>;

export const BADGE_DEFAULTS = {
  theme: "mode3" as BadgeThemeId,
  presentedBy: true,
  role: "media" as BadgeRole,
  roleCustom: "",
  firstName: "John",
  lastName: "Smith",
  nameLayout: "two" as BadgeNameLayout,
  nameSize: 1,
  nameY: 0,
  person: "07",
  personScale: 1,
  personX: 0,
  personY: 0,
  ferroShape: "01",
  ferroScale: 1,
  ferroRotation: 0,
  ferroX: 0,
  ferroY: 0,
  strapStyle: "theme" as BadgeStrapStyle,
  strapText: "SEE WHAT YOU HEAR",
  strapColor: "#01161E",
  strapInk: "#ADBDFF",
  clipColor: "#01161E",
  strapLength: 1,
  gravity: 12,
  drag: 0.6,
  layout: "two" as BadgeLayout,
  zoom: 1,
  cameraY: 0,
  includeBackground: false,
  background: "#E9E7E3",
} as const;

export const BADGE_RANGES = {
  nameSize: { min: 0.5, max: 1.5 },
  nameY: { min: -600, max: 300 },
  personScale: { min: 0.4, max: 1.6 },
  personX: { min: -500, max: 500 },
  personY: { min: -500, max: 500 },
  ferroScale: { min: 0.4, max: 1.6 },
  ferroRotation: { min: -180, max: 180 },
  ferroX: { min: -500, max: 500 },
  ferroY: { min: -500, max: 500 },
  strapLength: { min: 0.6, max: 1.6 },
  gravity: { min: 2, max: 30 },
  drag: { min: 0, max: 3 },
  zoom: { min: 0.5, max: 2 },
  cameraY: { min: -1, max: 1 },
} as const;

/** Text fields are single-line badge copy; keep them short enough to fit the card. */
export const BADGE_TEXT_MAX_LENGTH = 40;

export const BADGE_DROP_ACTION = { label: "Drop badge", value: "physics.drop" } as const;

type NumericKey = keyof typeof BADGE_RANGES;

function readNumber(value: unknown, key: NumericKey): number {
  const { max, min } = BADGE_RANGES[key];
  const fallback = BADGE_DEFAULTS[key];
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function readText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, BADGE_TEXT_MAX_LENGTH);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readChoice<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function readBadgeColor(value: unknown, fallback: string): string {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "object" &&
          value !== null &&
          "hex" in value &&
          typeof (value as { hex: unknown }).hex === "string"
        ? (value as { hex: string }).hex
        : fallback;
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : fallback;
}

export function getBadgeRoleText(role: BadgeRole, custom: string): string {
  if (role === "custom") return custom.trim();
  return BADGE_ROLES.find((option) => option.value === role)?.label ?? "";
}

export function readBadgeParams(values: Readonly<Record<string, unknown>>): BadgeParams {
  const t = BADGE_TARGETS;
  const d = BADGE_DEFAULTS;
  const theme = isBadgeThemeId(values[t.theme]) ? values[t.theme] as BadgeThemeId : d.theme;
  const palette = BADGE_THEMES[theme];
  const role = readChoice(values[t.role], BADGE_ROLES.map((option) => option.value), d.role);
  const roleCustom = readText(values[t.roleCustom], d.roleCustom);
  const strapStyle = readChoice<BadgeStrapStyle>(values[t.strapStyle], ["theme", "custom"], d.strapStyle);
  const themed = strapStyle === "theme";
  return {
    theme,
    cardColor: palette.background,
    boxColor: palette.boxes,
    inkColor: BADGE_INK,
    presentedBy: readBoolean(values[t.presentedBy], d.presentedBy),
    role,
    roleCustom,
    roleText: getBadgeRoleText(role, roleCustom),
    firstName: readText(values[t.firstName], d.firstName),
    lastName: readText(values[t.lastName], d.lastName),
    nameLayout: readChoice<BadgeNameLayout>(values[t.nameLayout], ["two", "one"], d.nameLayout),
    nameSize: readNumber(values[t.nameSize], "nameSize"),
    nameY: readNumber(values[t.nameY], "nameY"),
    person: readChoice(values[t.person], BADGE_PERSON_IDS, d.person),
    personScale: readNumber(values[t.personScale], "personScale"),
    personX: readNumber(values[t.personX], "personX"),
    personY: readNumber(values[t.personY], "personY"),
    ferroShape: readChoice(values[t.ferroShape], BADGE_FERRO_IDS, d.ferroShape),
    ferroScale: readNumber(values[t.ferroScale], "ferroScale"),
    ferroRotation: readNumber(values[t.ferroRotation], "ferroRotation"),
    ferroX: readNumber(values[t.ferroX], "ferroX"),
    ferroY: readNumber(values[t.ferroY], "ferroY"),
    strapStyle,
    strapText: readText(values[t.strapText], d.strapText),
    strapColor: themed ? BADGE_INK : readBadgeColor(values[t.strapColor], d.strapColor),
    strapInk: themed ? palette.boxes : readBadgeColor(values[t.strapInk], d.strapInk),
    clipColor: themed ? palette.boxes : readBadgeColor(values[t.clipColor], d.clipColor),
    strapLength: readNumber(values[t.strapLength], "strapLength"),
    gravity: readNumber(values[t.gravity], "gravity"),
    drag: readNumber(values[t.drag], "drag"),
    layout: readChoice<BadgeLayout>(values[t.layout], ["one", "two"], d.layout),
    zoom: readNumber(values[t.zoom], "zoom"),
    cameraY: readNumber(values[t.cameraY], "cameraY"),
    includeBackground: readBoolean(values[t.includeBackground], d.includeBackground),
  };
}
