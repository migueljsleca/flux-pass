import {
  defineToolcraftPerformance,
  type ToolcraftEnvelopePerformanceConfig,
} from "@/toolcraft/runtime";

import { badgePipelineRegistration } from "./badge/badge-pipeline";
import {
  badgeFixtureAdapters,
  badgeWorkloadEnvelope,
  createBadgePerformanceScenarios,
  deriveBadgePerformancePaths,
} from "./badge/badge-workload";

const threeSurface = { backend: "webgl", provider: "three" } as const;

const basePerformance = defineToolcraftPerformance({
  fixtureAdapters: badgeFixtureAdapters,
  rendererPipeline: badgePipelineRegistration,
  rendererStrategy: "webgl",
  rendererTechnique: {
    exportRenderer: "webgl",
    fidelityRisks: [
      "The lanyard is a flat ribbon without fabric thickness; very tight folds can show the strap edge-on.",
      "PNG export captures the live physics pose at the moment of export; with no live preview it uses the rest pose.",
    ],
    gpu: { export: threeSurface, preview: threeSurface },
    intentionalRasterizationReason:
      "The product is a lit 3D render of a glossy card, metal clip and fabric strap; reflections and shading only exist as raster output.",
    layers: [
      {
        content: ["shader"],
        exportMode: "included",
        id: "badge",
        kind: "product-foreground",
        primitiveCount: "medium",
        renderer: "webgl",
        uiSelector: "canvas[data-badge-canvas]",
      },
    ],
    performanceRisks: [
      "Retina backing at 2x multiplies fragment shading of the clearcoat card material.",
      "The simulation runs every frame while the badge moves; it sleeps once the badge is at rest.",
    ],
    previewExportDifferenceReason:
      "Preview renders into the live canvas every physics frame; export renders the same scene and pose into a retained offscreen Three renderer at the artifact size (2x supersampled within budget) and draws it into the runtime context.",
    previewRenderer: "webgl",
    productRepresentation: "pixel",
    rendererStrategy: "webgl",
    sourceRepresentation: "procedural-data",
    whyNotAlternativeStrategies: [
      "Canvas 2D cannot shade a rotating 3D card with thickness and a twisting strap.",
      "SVG cannot represent lit, perspective 3D geometry.",
      "WebGPU/VGPU is not needed: every pass is a stateless render pass with no compute, storage or feedback; physics runs on the CPU.",
    ],
  },
  scenarios: [],
  usesCustomRenderer: true,
  workloadEnvelope: badgeWorkloadEnvelope,
} satisfies ToolcraftEnvelopePerformanceConfig);

export const appPerformance = defineToolcraftPerformance({
  ...basePerformance,
  scenarios: createBadgePerformanceScenarios(basePerformance),
});

export const appPerformancePaths = deriveBadgePerformancePaths(appPerformance);
export { badgePipelineRegistration as appRendererPipelineRegistration };
