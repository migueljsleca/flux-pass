import type { ToolcraftSceneRect } from "@/toolcraft/runtime";

/** The fixed camera frame: centred on the saved artboard size. */
export function getBadgeSceneRect(width: number, height: number): ToolcraftSceneRect {
  return { height, width, x: -width / 2, y: -height / 2 };
}
