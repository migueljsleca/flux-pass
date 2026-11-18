/**
 * Colour themes from the Figma "Theme" variable collection (modes 1-3), which
 * alias the FLUX V2 palette. `background` fills the card, `boxes` fills the
 * type boxes, and ink is FLUX V2 Ink Black in every mode.
 */

export const BADGE_INK = "#01161E";

export const BADGE_THEMES = {
  mode1: { background: "#3772FF", boxes: "#D7FB41", label: "Blue" },
  mode2: { background: "#F037A4", boxes: "#C5FFFD", label: "Rose" },
  mode3: { background: "#FF4401", boxes: "#ADBDFF", label: "Carrot" },
} as const;

export type BadgeThemeId = keyof typeof BADGE_THEMES;
export const BADGE_THEME_IDS = Object.keys(BADGE_THEMES) as BadgeThemeId[];

export function isBadgeThemeId(value: unknown): value is BadgeThemeId {
  return typeof value === "string" && value in BADGE_THEMES;
}
