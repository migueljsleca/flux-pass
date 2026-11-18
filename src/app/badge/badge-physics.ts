/**
 * Position-based (Verlet) physics for the lanyard and card.
 *
 * The lanyard is a chain of light particles hanging from a fixed anchor above
 * the frame. Its last particle is the clip point of the card. The card is five
 * heavy particles (clip point + four corners) held rigid by distance
 * constraints between every pair, so it swings, twists and spins naturally
 * on the strap. A grab is a soft point constraint on the card surface, so
 * dragging pivots the card around the grabbed spot and releasing keeps the
 * velocity (throw with inertia). Pure TypeScript: no Three.js, no DOM.
 */

export type Vec3 = readonly [number, number, number];

/** Card size in world units (640 x 900 artwork ratio). */
export const BADGE_CARD_WIDTH = 0.8;
export const BADGE_CARD_HEIGHT = 1.125;
export const BADGE_CARD_THICKNESS = 0.018;
/** Distance from the card's top edge to the clip point on the strap. */
export const BADGE_CLIP_OFFSET = 0.16;
/** Fixed strap anchor (just above the default frame). */
export const BADGE_ANCHOR_Y = 1.75;
/** Strap length at Strap length = 1. */
export const BADGE_BASE_STRAP_LENGTH = 1.35;
export const BADGE_STRAP_SEGMENTS = 14;
/** Fixed simulation step. */
export const BADGE_STEP_SECONDS = 1 / 120;
const SOLVER_ITERATIONS = 14;
const DROP_HEIGHT = 3.2;
const DROP_SECONDS = 0.5;
const ROPE_INV_MASS = 50;
const CARD_INV_MASS = 12.5;
const GRAB_STIFFNESS = 0.35;
/** Strap torsion: turns the card back to face the camera (per-step share of the twist angle). */
const TWIST_STIFFNESS = 0.0022;
/** Twist damping per second, so spins settle instead of ringing. */
const TWIST_DAMPING = 2.2;
/** Card contact: plates keep this far apart (card thickness plus a hair). */
const CONTACT_DISTANCE = BADGE_CARD_THICKNESS + 0.006;
const CONTACT_MARGIN = 0.004;
const CONTACT_STIFFNESS = 0.8;
/** 5 x 5 sample grid over each card (corners and edges included). */
const CONTACT_SAMPLES: ReadonlyArray<readonly [number, number]> = [0, 0.25, 0.5, 0.75, 1].flatMap((u) =>
  [0, 0.25, 0.5, 0.75, 1].map((v) => [u, v] as const),
);
/** Below this per-step travel for ~0.5 s the simulation sleeps. */
const SLEEP_TRAVEL = 2e-5;
const SLEEP_STEPS = 60;

export type BadgePhysicsSettings = Readonly<{
  /** Air drag: fraction of velocity lost per second. */
  drag: number;
  gravity: number;
  strapLength: number;
}>;

export type BadgePhysicsOptions = Readonly<{
  /** Horizontal position of the strap anchor (world units). */
  anchorX?: number;
  /** Start above the frame and drop in. */
  drop: boolean;
  /** Yaw the strap untwists to: 0 shows the front, PI shows the back. */
  restYaw?: number;
  /** Random source for the drop-in variation (defaults to Math.random). */
  random?: () => number;
}>;

/** One drop-in: every badge gets its own, so drops never look the same. */
export type BadgeDropVariation = Readonly<{
  /** Seconds before this badge starts falling. */
  delay: number;
  /** Seconds the anchor takes to ease down. */
  duration: number;
  /** Height above the resting anchor the drop starts from. */
  height: number;
  /** Extra spin around the strap at the start (radians, either way). */
  twist: number;
  /** In-plane tilt of the card at the start (radians). */
  roll: number;
  /** Sideways and depth lean of the strap at its bottom end (world units). */
  swayX: number;
  swayZ: number;
}>;

/** Random drop-in within ranges that always read well; `outward` biases the sideways lean away from centre. */
export function createBadgeDropVariation(random: () => number, outward = 0): BadgeDropVariation {
  const signed = () => (random() < 0.5 ? -1 : 1);
  const sideways = outward !== 0 ? Math.sign(outward) : signed();
  return {
    delay: random() * 0.28,
    duration: 0.38 + random() * 0.3,
    height: DROP_HEIGHT * (0.85 + random() * 0.4),
    twist: signed() * (0.3 + random() * 1.1),
    roll: signed() * random() * 0.5,
    swayX: sideways * (0.1 + random() * 0.35),
    swayZ: (random() - 0.5) * 0.5,
  };
}

export type BadgeGrab = Readonly<{
  /** Grabbed spot in card space: u from left (0) to right (1), v from bottom (0) to top (1). */
  u: number;
  v: number;
  target: Vec3;
}>;

export type BadgeCardFrame = Readonly<{
  center: Vec3;
  x: Vec3;
  y: Vec3;
  z: Vec3;
}>;

export type BadgePhysicsSnapshot = Readonly<{
  card: BadgeCardFrame;
  /** Strap points from the anchor to the clip point (inclusive). */
  strap: readonly Vec3[];
}>;

/** Particle layout: 0 = anchor, 1..N-1 = strap, N = clip, N+1..N+4 = TL, TR, BR, BL. */
const N = BADGE_STRAP_SEGMENTS;
const CLIP = N;
const TL = N + 1;
const TR = N + 2;
const BR = N + 3;
const BL = N + 4;
const COUNT = N + 5;

const CARD_LOCAL: ReadonlyArray<readonly [number, number]> = [
  [0, BADGE_CARD_HEIGHT / 2 + BADGE_CLIP_OFFSET],
  [-BADGE_CARD_WIDTH / 2, BADGE_CARD_HEIGHT / 2],
  [BADGE_CARD_WIDTH / 2, BADGE_CARD_HEIGHT / 2],
  [BADGE_CARD_WIDTH / 2, -BADGE_CARD_HEIGHT / 2],
  [-BADGE_CARD_WIDTH / 2, -BADGE_CARD_HEIGHT / 2],
];

type Constraint = { a: number; b: number; rest: number };
type PlateFrame = Readonly<{ c: Vec3; n: Vec3; x: Vec3; y: Vec3 }>;

const CORNERS = [TL, TR, BR, BL] as const;

/** Bilinear weights of the TL, TR, BR, BL corners for card-space (u, v); v runs bottom (0) to top (1). */
function cornerWeights(u: number, v: number): readonly [number, number, number, number] {
  return [(1 - u) * v, u * v, u * (1 - v), (1 - u) * (1 - v)];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function easeOutCubic(t: number): number {
  const k = 1 - Math.min(1, Math.max(0, t));
  return 1 - k * k * k;
}

function normalize(v: [number, number, number]): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export class BadgePhysics {
  private readonly pos = new Float64Array(COUNT * 3);
  private readonly prev = new Float64Array(COUNT * 3);
  private readonly invMass = new Float64Array(COUNT);
  private readonly strapConstraints: Constraint[] = [];
  private readonly bendConstraints: Constraint[] = [];
  private readonly cardConstraints: Constraint[] = [];
  private settings: BadgePhysicsSettings;
  private grab: BadgeGrab | null = null;
  private dropClock = Number.POSITIVE_INFINITY;
  private drop: BadgeDropVariation | null = null;
  private accumulator = 0;
  private quietSteps = 0;
  private readonly anchorX: number;
  private readonly restYaw: number;
  private readonly random: () => number;

  constructor(settings: BadgePhysicsSettings, options: BadgePhysicsOptions = { drop: true }) {
    this.settings = settings;
    this.anchorX = options.anchorX ?? 0;
    this.restYaw = options.restYaw ?? 0;
    this.random = options.random ?? Math.random;
    for (let i = 1; i < COUNT; i += 1) this.invMass[i] = i < CLIP ? ROPE_INV_MASS : CARD_INV_MASS;
    for (let i = 0; i < N; i += 1) this.strapConstraints.push({ a: i, b: i + 1, rest: 0 });
    for (let i = 0; i + 2 <= N; i += 1) this.bendConstraints.push({ a: i, b: i + 2, rest: 0 });
    const card = [CLIP, TL, TR, BR, BL];
    for (let i = 0; i < card.length; i += 1) {
      for (let j = i + 1; j < card.length; j += 1) {
        const [ax, ay] = CARD_LOCAL[i];
        const [bx, by] = CARD_LOCAL[j];
        this.cardConstraints.push({ a: card[i], b: card[j], rest: Math.hypot(ax - bx, ay - by) });
      }
    }
    this.applyStrapLength();
    this.reset(options.drop);
  }

  /**
   * Lays the strap down from the anchor with the card hanging off it. With
   * `drop` the badge starts above the frame with its own random delay, height,
   * spin, tilt and lean, so every drop-in (and every badge) moves differently.
   */
  reset(drop: boolean, variation?: BadgeDropVariation): void {
    const v = drop ? (variation ?? createBadgeDropVariation(this.random, this.anchorX)) : null;
    this.drop = v;
    this.dropClock = v ? -v.delay : Number.POSITIVE_INFINITY;
    this.grab = null;
    this.accumulator = 0;
    this.quietSteps = 0;
    const segment = this.segmentLength();
    const lift = v ? v.height : 0;
    for (let i = 0; i <= N; i += 1) {
      const t = i / N;
      this.setPoint(i, [
        this.anchorX + 0.04 * Math.sin(i * 0.7) + (v ? v.swayX * t : 0),
        BADGE_ANCHOR_Y + lift - i * segment,
        v ? v.swayZ * t : 0,
      ]);
    }
    const clip = this.point(CLIP);
    // Resting side plus the drop's spin and tilt so the badge settles with life instead of dead straight.
    const yaw = this.restYaw + (v ? v.twist : 0);
    const roll = v ? v.roll : 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (let k = 1; k < 5; k += 1) {
      const [lx0, ly] = CARD_LOCAL[k];
      const dy0 = ly - CARD_LOCAL[0][1];
      const lx = lx0 * Math.cos(roll) - dy0 * Math.sin(roll);
      const dy = lx0 * Math.sin(roll) + dy0 * Math.cos(roll);
      this.setPoint(N + k, [clip[0] + lx * cos, clip[1] + dy, clip[2] - lx * sin]);
    }
    this.prev.set(this.pos);
  }

  private get dropSeconds(): number {
    return this.drop ? this.drop.duration : DROP_SECONDS;
  }

  private get dropHeight(): number {
    return this.drop ? this.drop.height : DROP_HEIGHT;
  }

  setSettings(settings: BadgePhysicsSettings): void {
    const lengthChanged = settings.strapLength !== this.settings.strapLength;
    this.settings = settings;
    if (lengthChanged) this.applyStrapLength();
    this.wake();
  }

  setGrab(grab: BadgeGrab | null): void {
    this.grab = grab;
    this.wake();
  }

  get grabbing(): boolean {
    return this.grab !== null;
  }

  /** True while the badge still moves (or is held / dropping). */
  get awake(): boolean {
    return this.grab !== null || this.dropClock < this.dropSeconds || this.quietSteps < SLEEP_STEPS;
  }

  wake(): void {
    this.quietSteps = 0;
  }

  /** Advances by wall-clock seconds in fixed steps (capped so a stall never explodes). */
  advance(seconds: number): number {
    this.accumulator = Math.min(this.accumulator + Math.max(0, seconds), BADGE_STEP_SECONDS * 8);
    let steps = 0;
    while (this.accumulator >= BADGE_STEP_SECONDS) {
      this.step();
      this.accumulator -= BADGE_STEP_SECONDS;
      steps += 1;
    }
    return steps;
  }

  /** Runs fixed steps until the badge rests (used for deterministic rest poses). */
  settle(maxSteps = 2400): void {
    for (let i = 0; i < maxSteps && this.awake; i += 1) this.step();
  }

  step(): void {
    this.beginStep();
    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) this.solveIteration();
    this.endStep();
  }

  /** Verlet integration and the kinematic anchor (first phase of a step). */
  beginStep(): void {
    const dt = BADGE_STEP_SECONDS;
    const damping = Math.max(0, 1 - this.settings.drag * dt);
    const gravity = -this.settings.gravity * dt * dt;
    for (let i = 1; i < COUNT; i += 1) {
      const o = i * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        const x = this.pos[o + axis];
        const velocity = (x - this.prev[o + axis]) * damping;
        this.prev[o + axis] = x;
        this.pos[o + axis] = x + velocity + (axis === 1 ? gravity : 0);
      }
    }
    // Kinematic anchor: eases down from above the frame during the drop-in.
    this.dropClock += dt;
    const lift = this.dropHeight * (1 - easeOutCubic(this.dropClock / this.dropSeconds));
    this.setPoint(0, [this.anchorX, BADGE_ANCHOR_Y + (Number.isFinite(lift) ? lift : 0), 0]);
    this.prev[0] = this.pos[0];
    this.prev[1] = this.pos[1];
    this.prev[2] = this.pos[2];
  }

  /** One solver pass over the strap, card and grab constraints. */
  solveIteration(): void {
    for (const c of this.strapConstraints) this.solveDistance(c, 1, false);
    for (const c of this.bendConstraints) this.solveDistance(c, 0.08, true);
    for (const c of this.cardConstraints) this.solveDistance(c, 1, false);
    if (this.grab) this.solveGrab(this.grab);
  }

  /** Strap torsion and sleep bookkeeping (last phase of a step). */
  endStep(): void {
    this.applyTwistSpring(BADGE_STEP_SECONDS);
    let travel = 0;
    for (let i = 1; i < COUNT; i += 1) {
      const o = i * 3;
      travel = Math.max(
        travel,
        Math.abs(this.pos[o] - this.prev[o]),
        Math.abs(this.pos[o + 1] - this.prev[o + 1]),
        Math.abs(this.pos[o + 2] - this.prev[o + 2]),
      );
    }
    this.quietSteps = travel < SLEEP_TRAVEL && !this.grab && this.dropClock >= this.dropSeconds ? this.quietSteps + 1 : 0;
  }

  /**
   * Card-to-card contact: sample points of each card that reach the other
   * card's plate are pushed back to the side they came from, and the plate is
   * pushed the other way, so thrown badges knock into each other.
   */
  collide(other: BadgePhysics): boolean {
    const a = this.pushPointsOutOf(other);
    const b = other.pushPointsOutOf(this);
    return a || b;
  }

  private plateFrame(buffer: Float64Array): PlateFrame {
    const at = (index: number): Vec3 => [buffer[index * 3], buffer[index * 3 + 1], buffer[index * 3 + 2]];
    const tl = at(TL);
    const tr = at(TR);
    const br = at(BR);
    const bl = at(BL);
    const c: Vec3 = [
      (tl[0] + tr[0] + br[0] + bl[0]) / 4,
      (tl[1] + tr[1] + br[1] + bl[1]) / 4,
      (tl[2] + tr[2] + br[2] + bl[2]) / 4,
    ];
    const x = normalize([tr[0] - tl[0] + br[0] - bl[0], tr[1] - tl[1] + br[1] - bl[1], tr[2] - tl[2] + br[2] - bl[2]]);
    const up: Vec3 = [tl[0] - bl[0] + tr[0] - br[0], tl[1] - bl[1] + tr[1] - br[1], tl[2] - bl[2] + tr[2] - br[2]];
    const n = normalize([...cross(x, up)] as [number, number, number]);
    return { c, n, x, y: cross(n, x) };
  }

  private bilinear(buffer: Float64Array, u: number, v: number): Vec3 {
    const w = cornerWeights(u, v);
    const out: [number, number, number] = [0, 0, 0];
    CORNERS.forEach((index, k) => {
      for (let axis = 0; axis < 3; axis += 1) out[axis] += w[k] * buffer[index * 3 + axis];
    });
    return out;
  }

  private pushPointsOutOf(plate: BadgePhysics): boolean {
    const now = plate.plateFrame(plate.pos);
    const before = plate.plateFrame(plate.prev);
    let touched = false;
    for (const [u, v] of CONTACT_SAMPLES) {
      const p = this.bilinear(this.pos, u, v);
      const rel: Vec3 = [p[0] - now.c[0], p[1] - now.c[1], p[2] - now.c[2]];
      const lx = dot(rel, now.x);
      const ly = dot(rel, now.y);
      if (Math.abs(lx) > BADGE_CARD_WIDTH / 2 + CONTACT_MARGIN) continue;
      if (Math.abs(ly) > BADGE_CARD_HEIGHT / 2 + CONTACT_MARGIN) continue;
      const d = dot(rel, now.n);
      // Where this point was at the start of the step (stops tunnelling).
      const p0 = this.bilinear(this.prev, u, v);
      const rel0: Vec3 = [p0[0] - before.c[0], p0[1] - before.c[1], p0[2] - before.c[2]];
      const d0 = dot(rel0, before.n);
      const lx0 = dot(rel0, before.x);
      const ly0 = dot(rel0, before.y);
      let axis: Vec3 = now.n;
      let side = d0 !== 0 ? Math.sign(d0) : d >= 0 ? 1 : -1;
      let depth = CONTACT_DISTANCE - side * d;
      // Edge-on hit: the point came in from beside the plate in (nearly) the same plane,
      // so knock it back out sideways instead of sliding it in front or behind.
      if (Math.abs(d0) < CONTACT_DISTANCE && Math.abs(d) < CONTACT_DISTANCE) {
        if (Math.abs(lx0) > BADGE_CARD_WIDTH / 2) {
          axis = now.x;
          side = Math.sign(lx0);
          depth = BADGE_CARD_WIDTH / 2 + CONTACT_DISTANCE / 2 - side * lx;
        } else if (Math.abs(ly0) > BADGE_CARD_HEIGHT / 2) {
          axis = now.y;
          side = Math.sign(ly0);
          depth = BADGE_CARD_HEIGHT / 2 + CONTACT_DISTANCE / 2 - side * ly;
        }
      }
      if (depth <= 0) continue;
      touched = true;
      const wa = cornerWeights(u, v);
      const wb = cornerWeights(
        Math.min(1, Math.max(0, lx / BADGE_CARD_WIDTH + 0.5)),
        Math.min(1, Math.max(0, ly / BADGE_CARD_HEIGHT + 0.5)),
      );
      let denominator = 0;
      CORNERS.forEach((index, k) => {
        denominator += wa[k] * wa[k] * this.invMass[index] + wb[k] * wb[k] * plate.invMass[index];
      });
      if (denominator <= 0) continue;
      const lambda = (depth * CONTACT_STIFFNESS) / denominator;
      CORNERS.forEach((index, k) => {
        const moveA = lambda * wa[k] * this.invMass[index] * side;
        const moveB = -lambda * wb[k] * plate.invMass[index] * side;
        for (let k3 = 0; k3 < 3; k3 += 1) {
          this.pos[index * 3 + k3] += moveA * axis[k3];
          plate.pos[index * 3 + k3] += moveB * axis[k3];
        }
      });
    }
    return touched;
  }

  snapshot(): BadgePhysicsSnapshot {
    const strap: Vec3[] = [];
    for (let i = 0; i <= N; i += 1) strap.push(this.point(i));
    return { card: this.cardFrame(), strap };
  }

  /** World position of a card-space spot (u, v in 0..1) for the current pose. */
  cardPoint(u: number, v: number): Vec3 {
    const tl = this.point(TL);
    const tr = this.point(TR);
    const br = this.point(BR);
    const bl = this.point(BL);
    const w = [(1 - u) * v, u * v, u * (1 - v), (1 - u) * (1 - v)];
    return [0, 1, 2].map(
      (axis) => w[0] * tl[axis] + w[1] * tr[axis] + w[2] * br[axis] + w[3] * bl[axis],
    ) as unknown as Vec3;
  }

  private cardFrame(): BadgeCardFrame {
    const tl = this.point(TL);
    const tr = this.point(TR);
    const br = this.point(BR);
    const bl = this.point(BL);
    const center: Vec3 = [
      (tl[0] + tr[0] + br[0] + bl[0]) / 4,
      (tl[1] + tr[1] + br[1] + bl[1]) / 4,
      (tl[2] + tr[2] + br[2] + bl[2]) / 4,
    ];
    const x = normalize([tr[0] - tl[0] + br[0] - bl[0], tr[1] - tl[1] + br[1] - bl[1], tr[2] - tl[2] + br[2] - bl[2]]);
    const up: Vec3 = [tl[0] - bl[0] + tr[0] - br[0], tl[1] - bl[1] + tr[1] - br[1], tl[2] - bl[2] + tr[2] - br[2]];
    const z = normalize([...cross(x, up)] as [number, number, number]);
    const y = cross(z, x);
    return { center, x, y, z };
  }

  /** Yaw of the card's width axis around the vertical, from world +X (radians). */
  private cardYaw(buffer: Float64Array): number {
    const x = buffer[TR * 3] - buffer[TL * 3] + buffer[BR * 3] - buffer[BL * 3];
    const z = buffer[TR * 3 + 2] - buffer[TL * 3 + 2] + buffer[BR * 3 + 2] - buffer[BL * 3 + 2];
    return Math.atan2(-z, x);
  }

  /** Rotates the card particles of `buffer` around the vertical axis through `center`. */
  private rotateCard(buffer: Float64Array, angle: number, cx: number, cz: number): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const index of [CLIP, TL, TR, BR, BL]) {
      const o = index * 3;
      const dx = buffer[o] - cx;
      const dz = buffer[o + 2] - cz;
      buffer[o] = cx + dx * cos + dz * sin;
      buffer[o + 2] = cz - dx * sin + dz * cos;
    }
  }

  /**
   * Lanyard torsion: a twisted strap untwists, so the card turns back to face
   * the camera; damping removes part of the spin each second.
   */
  private applyTwistSpring(dt: number): void {
    const yaw = this.cardYaw(this.pos);
    const previousYaw = this.cardYaw(this.prev);
    let spin = yaw - previousYaw;
    if (spin > Math.PI) spin -= Math.PI * 2;
    if (spin < -Math.PI) spin += Math.PI * 2;
    const cx = (this.pos[TL * 3] + this.pos[TR * 3] + this.pos[BR * 3] + this.pos[BL * 3]) / 4;
    const cz = (this.pos[TL * 3 + 2] + this.pos[TR * 3 + 2] + this.pos[BR * 3 + 2] + this.pos[BL * 3 + 2]) / 4;
    // Spring toward the resting side plus damping of this step's spin.
    let offset = yaw - this.restYaw;
    offset -= Math.PI * 2 * Math.round(offset / (Math.PI * 2));
    const correction = -offset * TWIST_STIFFNESS - spin * Math.min(1, TWIST_DAMPING * dt);
    // rotateCard(+a) increases the yaw by a.
    this.rotateCard(this.pos, correction, cx, cz);
  }

  private segmentLength(): number {
    return (BADGE_BASE_STRAP_LENGTH * this.settings.strapLength) / N;
  }

  private applyStrapLength(): void {
    const segment = this.segmentLength();
    for (const c of this.strapConstraints) c.rest = segment;
    // A fabric strap folds but never kinks to a point: keep i..i+2 at least this far apart.
    for (const c of this.bendConstraints) c.rest = segment * 1.2;
  }

  private solveDistance(c: Constraint, stiffness: number, minimumOnly: boolean): void {
    const wa = this.invMass[c.a];
    const wb = this.invMass[c.b];
    const total = wa + wb;
    if (total === 0) return;
    const a = c.a * 3;
    const b = c.b * 3;
    const dx = this.pos[b] - this.pos[a];
    const dy = this.pos[b + 1] - this.pos[a + 1];
    const dz = this.pos[b + 2] - this.pos[a + 2];
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-9) return;
    const error = length - c.rest;
    if (minimumOnly && error >= 0) return;
    const scale = (stiffness * error) / (length * total);
    this.pos[a] += dx * scale * wa;
    this.pos[a + 1] += dy * scale * wa;
    this.pos[a + 2] += dz * scale * wa;
    this.pos[b] -= dx * scale * wb;
    this.pos[b + 1] -= dy * scale * wb;
    this.pos[b + 2] -= dz * scale * wb;
  }

  private solveGrab(grab: BadgeGrab): void {
    const corners = [TL, TR, BR, BL];
    const weights = [(1 - grab.u) * grab.v, grab.u * grab.v, grab.u * (1 - grab.v), (1 - grab.u) * (1 - grab.v)];
    const current = this.cardPoint(grab.u, grab.v);
    let denominator = 0;
    for (let k = 0; k < 4; k += 1) denominator += weights[k] * weights[k] * this.invMass[corners[k]];
    if (denominator <= 0) return;
    for (let axis = 0; axis < 3; axis += 1) {
      const error = (grab.target[axis] - current[axis]) * GRAB_STIFFNESS;
      for (let k = 0; k < 4; k += 1) {
        this.pos[corners[k] * 3 + axis] += (error * weights[k] * this.invMass[corners[k]]) / denominator;
      }
    }
  }

  private point(index: number): Vec3 {
    const o = index * 3;
    return [this.pos[o], this.pos[o + 1], this.pos[o + 2]];
  }

  private setPoint(index: number, value: Vec3): void {
    const o = index * 3;
    this.pos[o] = value[0];
    this.pos[o + 1] = value[1];
    this.pos[o + 2] = value[2];
  }
}

/** Deterministic resting pose (no drop) for export when no live simulation exists. */
export function getBadgeRestSnapshot(
  settings: BadgePhysicsSettings,
  options: Omit<BadgePhysicsOptions, "drop"> = {},
): BadgePhysicsSnapshot {
  const physics = new BadgePhysics(settings, { ...options, drop: false });
  physics.settle();
  return physics.snapshot();
}

/**
 * Several badges simulated in lockstep so their cards can collide: every
 * fixed step integrates all badges, then interleaves each badge's constraints
 * with card-to-card contacts, then finishes all badges.
 */
export class BadgeWorld {
  readonly bodies: readonly BadgePhysics[];
  private accumulator = 0;
  /** Contact steps since creation (useful for diagnostics). */
  contacts = 0;

  constructor(bodies: readonly BadgePhysics[]) {
    this.bodies = bodies;
  }

  get awake(): boolean {
    return this.bodies.some((body) => body.awake);
  }

  setSettings(settings: BadgePhysicsSettings): void {
    for (const body of this.bodies) body.setSettings(settings);
  }

  reset(drop: boolean): void {
    this.accumulator = 0;
    for (const body of this.bodies) body.reset(drop);
  }

  advance(seconds: number): number {
    this.accumulator = Math.min(this.accumulator + Math.max(0, seconds), BADGE_STEP_SECONDS * 8);
    let steps = 0;
    while (this.accumulator >= BADGE_STEP_SECONDS) {
      this.step();
      this.accumulator -= BADGE_STEP_SECONDS;
      steps += 1;
    }
    return steps;
  }

  step(): void {
    for (const body of this.bodies) body.beginStep();
    let touched = false;
    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
      for (const body of this.bodies) body.solveIteration();
      for (let i = 0; i < this.bodies.length; i += 1) {
        for (let j = i + 1; j < this.bodies.length; j += 1) {
          if (this.bodies[i].collide(this.bodies[j])) touched = true;
        }
      }
    }
    if (touched) this.contacts += 1;
    for (const body of this.bodies) body.endStep();
  }

  snapshots(): BadgePhysicsSnapshot[] {
    return this.bodies.map((body) => body.snapshot());
  }
}
