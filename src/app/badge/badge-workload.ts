import {
  defineToolcraft,
  defineToolcraftDiscreteFixtureAdapter,
  defineToolcraftFixtureAdapter,
  deriveToolcraftPerformancePaths,
  type ToolcraftEnvelopePerformanceConfig,
  type ToolcraftPerformanceScenario,
} from "@/toolcraft/runtime";

import { appIdentity } from "../app-identity";

/** Default: 1920x1080 artboard x DPR 2. */
export const BADGE_DEFAULT_PREVIEW_PIXELS = 8_294_400;
/** Enforced preview ceiling (8192² backing, the runtime artifact limit). */
export const BADGE_MAX_INTERACTIVE_PIXELS = 67_108_864;
/** 8K long edge at 16:9 = 8192 x 4608. */
export const BADGE_MAX_EXPORT_PIXELS = 37_748_736;

export type BadgePreviewPixelFixture = Readonly<{
  backingHeight: number;
  backingWidth: number;
  canvasHeight: number;
  canvasWidth: number;
  renderScale: 2;
}>;

function createPreviewPixelFixture(value: number): BadgePreviewPixelFixture {
  const whole = Math.round(value);
  if (!Number.isSafeInteger(whole) || Math.abs(whole - value) > 1e-6 || whole <= 0) {
    throw new Error(`Preview pixels must be a positive whole count, received ${value}.`);
  }
  for (let backingWidth = 8_192; backingWidth >= 2; backingWidth -= 2) {
    const backingHeight = whole / backingWidth;
    if (Number.isSafeInteger(backingHeight) && backingHeight >= 2 && backingHeight <= 8_192 && backingHeight % 2 === 0) {
      return Object.freeze({
        backingHeight,
        backingWidth,
        canvasHeight: backingHeight / 2,
        canvasWidth: backingWidth / 2,
        renderScale: 2,
      });
    }
  }
  throw new Error(`Preview pixel count ${value} has no exact render-scale-2 canvas fixture.`);
}

const previewPixelFixture = defineToolcraftFixtureAdapter<BadgePreviewPixelFixture>({
  apply: createPreviewPixelFixture,
  dimensionId: "preview-pixels",
  observe: ({ backingHeight, backingWidth }) => backingHeight * backingWidth,
});

const exportLongEdgeFixture = defineToolcraftDiscreteFixtureAdapter({
  dimensionId: "export-long-edge",
  domain: { kind: "schema-options", optionValues: ["2k", "4k", "8k"], target: "export.image.resolution" },
  entries: [
    { appliedValue: "2k", value: 2_048 },
    { appliedValue: "4k", value: 4_096 },
    { appliedValue: "8k", value: 8_192 },
  ],
});

const exportPixelFixture = defineToolcraftDiscreteFixtureAdapter({
  dimensionId: "export-pixels",
  domain: {
    attestation: "The three image resolutions on the default 16:9 camera frame exhaust the reachable exported pixel counts.",
    inputs: ["export-long-edge"],
    kind: "derived",
  },
  entries: [
    { appliedValue: "2k", value: 2_359_296 },
    { appliedValue: "4k", value: 9_437_184 },
    { appliedValue: "8k", value: BADGE_MAX_EXPORT_PIXELS },
  ],
});

export const badgeFixtureAdapters = {
  dimensions: {
    "export-long-edge": exportLongEdgeFixture,
    "export-pixels": exportPixelFixture,
    "preview-pixels": previewPixelFixture,
  },
};

export const badgeWorkloadEnvelope = {
  dimensions: [
    {
      defaultValue: BADGE_DEFAULT_PREVIEW_PIXELS,
      id: "preview-pixels",
      interactiveMax: BADGE_MAX_INTERACTIVE_PIXELS,
      mapping: "direct",
      source: { kind: "runtime-state", path: "canvas.previewBackingPixels" },
      unit: "pixels",
    },
    {
      batchMax: 8_192,
      customMappingReason: "The image resolution option maps to its exact numeric long edge.",
      defaultValue: 4_096,
      id: "export-long-edge",
      mapping: "custom",
      source: { kind: "schema-target", target: "export.image.resolution" },
      unit: "pixels",
    },
    {
      batchMax: BADGE_MAX_EXPORT_PIXELS,
      defaultValue: 9_437_184,
      id: "export-pixels",
      mapping: "direct",
      source: { inputs: ["export-long-edge"], kind: "derived" },
      unit: "pixels",
    },
  ],
} satisfies ToolcraftEnvelopePerformanceConfig["workloadEnvelope"];

const rendererPathSchema = defineToolcraft({
  base: {
    canvas: { enabled: true },
    identity: appIdentity,
    panels: { controls: { sections: [], title: "Controls" } },
  },
  modules: [],
});

export function deriveBadgePerformancePaths(performance: ToolcraftEnvelopePerformanceConfig) {
  return deriveToolcraftPerformancePaths(rendererPathSchema, performance);
}

function getBadgeScenarioLocator(path: Readonly<{ interaction: string }>): Readonly<Record<string, string>> {
  if (path.interaction === "control-drag") return { controlLabel: "Gravity" };
  if (path.interaction === "control-change") return { uiSelector: '[data-toolcraft-control-target="holder.firstName"]' };
  if (path.interaction === "animation-frame") return { uiSelector: "canvas[data-badge-canvas]" };
  return {};
}

export function createBadgePerformanceScenarios(
  performance: ToolcraftEnvelopePerformanceConfig,
): ToolcraftPerformanceScenario[] {
  return deriveBadgePerformancePaths(performance).map((path): ToolcraftPerformanceScenario => {
    const common = {
      automated: true,
      automatedTestName: `perf: badge ${path.id}`,
      browser: true,
      browserTestName: `browser perf: badge ${path.id}`,
      coversTargets: path.targets,
      expectedObservable: `The ${path.interaction} path keeps the badge preview live.`,
      fixture: "badge performance fixture",
      id: `badge-${path.id}`,
      pathId: path.id,
      ...(path.targets.length === 1 ? { target: path.targets[0] } : {}),
    };
    if (path.interaction === "export") {
      return { ...common, actionValue: "export.png", completionEvidence: "download", controlLabel: "Export PNG", interaction: "export" };
    }
    return { ...common, ...getBadgeScenarioLocator(path), interaction: path.interaction };
  });
}
