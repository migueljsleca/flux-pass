import { describe, expect, it } from "vitest";

import { layoutBadgeName } from "./badge-art";
import { getBadgeCamera } from "./badge-camera";
import { getBadgeRigLayouts } from "./badge-layout";
import { getBadgeExportSupersample } from "./badge-export";
import { getBadgeImageSize } from "./badge-media";
import { getBadgeCoverZoom } from "./badge-viewport";
import { BADGE_DEFAULTS, BADGE_TARGETS, readBadgeParams } from "./badge-params";
import {
  BADGE_ANCHOR_Y,
  BADGE_BASE_STRAP_LENGTH,
  BADGE_CARD_HEIGHT,
  BADGE_CLIP_OFFSET,
  BadgePhysics,
  BadgeWorld,
  createBadgeDropVariation,
  getBadgeRestSnapshot,
} from "./badge-physics";

const settings = { drag: BADGE_DEFAULTS.drag, gravity: BADGE_DEFAULTS.gravity, strapLength: 1 };

function length(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe("badge physics", () => {
  it("hangs the card straight below the anchor at rest", () => {
    const pose = getBadgeRestSnapshot(settings);
    const { card } = pose;
    expect(Math.abs(card.center[0])).toBeLessThan(0.01);
    expect(Math.abs(card.center[2])).toBeLessThan(0.01);
    const expectedY = BADGE_ANCHOR_Y - BADGE_BASE_STRAP_LENGTH - BADGE_CLIP_OFFSET - BADGE_CARD_HEIGHT / 2;
    expect(card.center[1]).toBeCloseTo(expectedY, 1);
    // Card is upright: its y axis points up.
    expect(card.y[1]).toBeGreaterThan(0.99);
  });

  it("drops in from above the frame and comes to rest", () => {
    const physics = new BadgePhysics(settings);
    const start = physics.snapshot().card.center[1];
    expect(start).toBeGreaterThan(BADGE_ANCHOR_Y);
    let steps = 0;
    while (physics.awake && steps < 120 * 30) {
      physics.step();
      steps += 1;
    }
    expect(physics.awake).toBe(false);
    const rest = physics.snapshot();
    expect(rest.card.center[1]).toBeLessThan(0);
    // Rigid card: corners keep their size.
    expect(length(rest.card.x, [0, 0, 0])).toBeCloseTo(1, 5);
  });

  it("follows a grab and keeps momentum when thrown", () => {
    const physics = new BadgePhysics(settings, { drop: false });
    physics.settle();
    const grabbed = physics.cardPoint(0.5, 0.5);
    const target = [grabbed[0] + 0.8, grabbed[1] + 0.3, grabbed[2]] as const;
    physics.setGrab({ target, u: 0.5, v: 0.5 });
    for (let i = 0; i < 120; i += 1) physics.step();
    expect(length(physics.cardPoint(0.5, 0.5), target)).toBeLessThan(0.05);
    // Throw: move fast, then release.
    for (let i = 0; i < 6; i += 1) {
      physics.setGrab({ target: [target[0] - 0.3 * (i + 1), target[1], target[2]], u: 0.5, v: 0.5 });
      physics.step();
    }
    const before = physics.cardPoint(0.5, 0.5)[0];
    physics.setGrab(null);
    for (let i = 0; i < 4; i += 1) physics.step();
    expect(physics.cardPoint(0.5, 0.5)[0]).toBeLessThan(before);
    expect(physics.awake).toBe(true);
  });

  it("untwists back to face the camera after a spin", () => {
    const physics = new BadgePhysics(settings, { drop: false });
    physics.settle();
    // Grab the right edge and swing it behind, then let go.
    const edge = physics.cardPoint(1, 0.5);
    physics.setGrab({ target: [edge[0] - 0.6, edge[1], edge[2] - 0.6], u: 1, v: 0.5 });
    for (let i = 0; i < 60; i += 1) physics.step();
    expect(physics.snapshot().card.z[2]).toBeLessThan(0.9);
    physics.setGrab(null);
    let steps = 0;
    while (physics.awake && steps < 120 * 30) {
      physics.step();
      steps += 1;
    }
    expect(physics.awake).toBe(false);
    expect(physics.snapshot().card.z[2]).toBeGreaterThan(0.98);
  });

  it("hangs the second badge beside the first, resting on its back", () => {
    const [front, back] = getBadgeRigLayouts("two");
    const physics = new BadgePhysics(settings, { ...back, drop: true });
    let steps = 0;
    while (physics.awake && steps < 120 * 30) {
      physics.step();
      steps += 1;
    }
    const pose = physics.snapshot();
    expect(pose.card.z[2]).toBeLessThan(-0.98);
    expect(pose.card.center[0]).toBeCloseTo(back.anchorX, 1);
    expect(front.restYaw).toBe(0);
    expect(getBadgeRigLayouts("one")).toHaveLength(1);
  });

  it("knocks the other badge away instead of passing through it", () => {
    const world = new BadgeWorld(getBadgeRigLayouts("two").map((rig) => new BadgePhysics(settings, { ...rig, drop: false })));
    for (let i = 0; i < 2400 && world.awake; i += 1) world.step();
    const [left, right] = world.bodies;
    const leftBefore = left.snapshot().card.center;
    // Drag the right badge (slightly in front) across the left one.
    const start = right.cardPoint(0.5, 0.5);
    for (let i = 1; i <= 90; i += 1) {
      const t = i / 90;
      right.setGrab({ target: [start[0] - 1.6 * t, start[1], start[2] + 0.004], u: 0.5, v: 0.5 });
      world.step();
    }
    expect(world.contacts).toBeGreaterThan(0);
    const leftAfter = left.snapshot().card.center;
    const moved = Math.hypot(leftAfter[0] - leftBefore[0], leftAfter[2] - leftBefore[2]);
    expect(moved).toBeGreaterThan(0.05);
  });

  it("shoves the other badge sideways on an edge-on hit", () => {
    const world = new BadgeWorld(getBadgeRigLayouts("two").map((rig) => new BadgePhysics(settings, { ...rig, drop: false })));
    for (let i = 0; i < 2400 && world.awake; i += 1) world.step();
    const [left, right] = world.bodies;
    const leftBefore = left.snapshot().card.center;
    const start = right.cardPoint(0.5, 0.5);
    for (let i = 1; i <= 60; i += 1) {
      right.setGrab({ target: [start[0] - 0.9 * (i / 60), start[1], start[2]], u: 0.5, v: 0.5 });
      world.step();
    }
    const leftAfter = left.snapshot().card.center;
    expect(world.contacts).toBeGreaterThan(0);
    expect(leftAfter[0]).toBeLessThan(leftBefore[0] - 0.05);
    // Let go: both badges separate, settle on their resting sides and sleep.
    right.setGrab(null);
    let steps = 0;
    while (world.awake && steps < 120 * 40) {
      world.step();
      steps += 1;
    }
    expect(world.awake).toBe(false);
    expect(left.snapshot().card.z[2]).toBeGreaterThan(0.95);
    expect(right.snapshot().card.z[2]).toBeLessThan(-0.95);
  });

  it("gives each badge its own drop-in and still settles both", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const a = createBadgeDropVariation(random, -1);
    const b = createBadgeDropVariation(random, 1);
    expect(a).not.toEqual(b);
    expect(Math.sign(a.swayX)).toBe(-1);
    expect(Math.sign(b.swayX)).toBe(1);
    for (let run = 0; run < 5; run += 1) {
      const world = new BadgeWorld(
        getBadgeRigLayouts("two").map((rig) => new BadgePhysics(settings, { ...rig, drop: true, random })),
      );
      const starts = world.snapshots().map((pose) => pose.card.center);
      expect(starts[0][1]).not.toBeCloseTo(starts[1][1], 3);
      let steps = 0;
      while (world.awake && steps < 120 * 40) {
        world.step();
        steps += 1;
      }
      expect(world.awake).toBe(false);
      const [left, right] = world.snapshots();
      expect(left.card.z[2]).toBeGreaterThan(0.95);
      expect(right.card.z[2]).toBeLessThan(-0.95);
    }
  });

  it("keeps the strap length when the Length setting changes", () => {
    const physics = new BadgePhysics({ ...settings, strapLength: 1.5 }, { drop: false });
    physics.settle();
    const strap = physics.snapshot().strap;
    let total = 0;
    for (let i = 1; i < strap.length; i += 1) total += length(strap[i], strap[i - 1]);
    expect(total).toBeCloseTo(BADGE_BASE_STRAP_LENGTH * 1.5, 1);
  });
});

describe("badge params", () => {
  it("falls back to defaults and clamps ranges", () => {
    const params = readBadgeParams({
      [BADGE_TARGETS.gravity]: 999,
      [BADGE_TARGETS.theme]: "nope",
      [BADGE_TARGETS.person]: "99",
    });
    expect(params.gravity).toBe(30);
    expect(params.theme).toBe(BADGE_DEFAULTS.theme);
    expect(params.person).toBe(BADGE_DEFAULTS.person);
    expect(params.firstName).toBe(BADGE_DEFAULTS.firstName);
  });

  it("resolves the Figma theme modes", () => {
    expect(readBadgeParams({ [BADGE_TARGETS.theme]: "mode1" })).toMatchObject({ boxColor: "#D7FB41", cardColor: "#3772FF" });
    expect(readBadgeParams({ [BADGE_TARGETS.theme]: "mode2" })).toMatchObject({ boxColor: "#C5FFFD", cardColor: "#F037A4" });
    expect(readBadgeParams({ [BADGE_TARGETS.theme]: "mode3" })).toMatchObject({ boxColor: "#ADBDFF", cardColor: "#FF4401" });
  });

  it("uses the role label or the custom text", () => {
    expect(readBadgeParams({ [BADGE_TARGETS.role]: "artist" }).roleText).toBe("Artist");
    expect(
      readBadgeParams({ [BADGE_TARGETS.role]: "custom", [BADGE_TARGETS.roleCustom]: " Headliner " }).roleText,
    ).toBe("Headliner");
  });

  it("follows the theme on the strap unless custom colours are chosen", () => {
    const themed = readBadgeParams({ [BADGE_TARGETS.theme]: "mode1", [BADGE_TARGETS.strapColor]: "#FF0000" });
    expect(themed.strapInk).toBe("#D7FB41");
    expect(themed.strapColor).toBe("#01161E");
    const custom = readBadgeParams({ [BADGE_TARGETS.strapStyle]: "custom", [BADGE_TARGETS.strapColor]: { hex: "#ff0000" } });
    expect(custom.strapColor).toBe("#FF0000");
  });

  it("trims long text", () => {
    expect(readBadgeParams({ [BADGE_TARGETS.firstName]: "x".repeat(200) }).firstName.length).toBe(40);
  });
});

describe("badge name layout", () => {
  // Fixed-width stand-in for the 2D context: every glyph is 0.6 em wide, cap height 0.714 em.
  const state = { font: "700 100px x" };
  const fake = {
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 100);
      return { actualBoundingBoxAscent: size * 0.714, width: text.length * size * 0.6 };
    },
  } as unknown as OffscreenCanvasRenderingContext2D;
  const base = { firstName: "John", lastName: "Smith", nameLayout: "two", nameSize: 1, nameY: 0 } as const;

  it("staggers two lines and centres the group", () => {
    const lines = layoutBadgeName(fake, base);
    expect(lines).toHaveLength(2);
    expect(lines[1].x).toBeGreaterThan(lines[0].x);
    const left = lines[0].x;
    const right = lines[1].x + lines[1].box.width;
    expect((left + right) / 2).toBeCloseTo(640, 5);
    expect(lines[0].y).toBeCloseTo(1156, 1);
    expect(lines[1].y - lines[0].y).toBeCloseTo(154.9, 0);
  });

  it("puts one line where the second line sits, centred", () => {
    const [line] = layoutBadgeName(fake, { ...base, nameLayout: "one" });
    expect(line.box.text).toBe("John Smith");
    expect(line.x + line.box.width / 2).toBeCloseTo(640, 5);
    expect(line.y).toBeCloseTo(1156 + 0.9457 * 163.81, 1);
  });

  it("shrinks long names to the content width", () => {
    const lines = layoutBadgeName(fake, { ...base, firstName: "Bartholomew-Alexander", lastName: "Featherstonehaugh" });
    const left = Math.min(...lines.map((line) => line.x));
    const right = Math.max(...lines.map((line) => line.x + line.box.width));
    expect(right - left).toBeLessThanOrEqual(1088 + 1e-6);
  });
});

describe("badge framing and export", () => {
  it("keeps enough width visible in tall frames and zooms in", () => {
    const wide = getBadgeCamera({ cameraY: 0, zoom: 1 }, 16 / 9);
    const tall = getBadgeCamera({ cameraY: 0, zoom: 1 }, 9 / 16);
    const zoomed = getBadgeCamera({ cameraY: 0, zoom: 2 }, 16 / 9);
    expect(tall.position[2]).toBeGreaterThan(wide.position[2]);
    expect(zoomed.position[2]).toBeCloseTo(wide.position[2] / 2, 5);
    expect(getBadgeCamera({ cameraY: 1, zoom: 1 }, 1).position[1]).toBeLessThan(wide.position[1]);
  });

  it("locks the zoom so the artboard covers the window", () => {
    expect(getBadgeCoverZoom(1920, 1080, 1920, 1080)).toBe(100);
    expect(getBadgeCoverZoom(1630, 1019, 1920, 1080)).toBeCloseTo(94.35, 1);
    expect(getBadgeCoverZoom(800, 1200, 1920, 1080)).toBeCloseTo(111.11, 1);
  });

  it("supersamples within the drawing-buffer budget", () => {
    expect(getBadgeExportSupersample(1000, 1000, 16384)).toBe(2);
    expect(getBadgeExportSupersample(8192, 4608, 16384)).toBe(1);
  });

  it("caps decoded upload size and swaps sides on quarter turns", () => {
    expect(getBadgeImageSize(4000, 2000, 0)).toEqual({ height: 1024, width: 2048 });
    expect(getBadgeImageSize(400, 200, 90)).toEqual({ height: 400, width: 200 });
  });
});
