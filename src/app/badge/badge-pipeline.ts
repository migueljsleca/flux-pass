import {
  registerToolcraftRendererPipeline,
  type ToolcraftRendererPipelinePassContract,
} from "@/toolcraft/runtime";

import type { BadgeScene } from "./badge-scene";
import { BADGE_TARGETS as T } from "./badge-params";

type BadgePasses = {
  "export-render": ToolcraftRendererPipelinePassContract<void>;
  "export-scene": ToolcraftRendererPipelinePassContract<BadgeScene, BadgeScene, readonly [string]>;
  "preview-render": ToolcraftRendererPipelinePassContract<void>;
  "preview-scene": ToolcraftRendererPipelinePassContract<BadgeScene, BadgeScene, readonly [string]>;
};

/** Continuous settings edited by dragging sliders. */
export const BADGE_DRAG_TARGETS = [
  T.strapLength,
  T.gravity,
  T.drag,
  T.zoom,
  T.cameraY,
  T.nameSize,
  T.nameY,
  T.personScale,
  T.personX,
  T.personY,
  T.ferroScale,
  T.ferroRotation,
  T.ferroX,
  T.ferroY,
] as const;

/** Discrete edits: text, colours, uploads, actions and runtime canvas settings. */
export const BADGE_CHANGE_TARGETS = [
  T.theme,
  T.presentedBy,
  T.role,
  T.roleCustom,
  T.firstName,
  T.lastName,
  T.nameLayout,
  T.person,
  T.photo,
  T.ferroShape,
  T.frontArt,
  T.backArt,
  T.strapStyle,
  T.strapText,
  T.strapColor,
  T.strapInk,
  T.clipColor,
  T.drop,
  T.layout,
  T.includeBackground,
  T.background,
] as const;

/** Simulation frames while the badge swings, drops or is dragged on the canvas. */
export const BADGE_PHYSICS_TARGET = "physics.frame";

const sceneBounds = {
  kind: "intrinsic",
  reason:
    "The fixed perspective camera frustum defines the rendered frame: the product is the camera image of the 3D badge, so nothing exists outside the frame rectangle.",
} as const;

const previewGpu = {
  resources: "sampled-textures",
  stage: "render",
  state: "stateless",
  surfaces: ["preview"],
} as const;

const exportGpu = { ...previewGpu, surfaces: ["export"] } as const;

export const badgePipelineRegistration = registerToolcraftRendererPipeline<BadgePasses>()({
  interactionInvalidation: [
    {
      interaction: "initial-render",
      invalidates: ["preview-scene", "preview-render"],
      targets: ["canvas.initial-render"],
    },
    {
      interaction: "animation-frame",
      invalidates: ["preview-render"],
      mustNotInvalidate: ["preview-scene"],
      retainedAccesses: ["preview-scene"],
      targets: [BADGE_PHYSICS_TARGET],
    },
    {
      interaction: "control-drag",
      invalidates: ["preview-render"],
      mustNotInvalidate: ["preview-scene"],
      retainedAccesses: ["preview-scene"],
      targets: BADGE_DRAG_TARGETS,
    },
    {
      interaction: "control-change",
      invalidates: ["preview-render"],
      mustNotInvalidate: ["preview-scene"],
      retainedAccesses: ["preview-scene"],
      targets: BADGE_CHANGE_TARGETS,
    },
    {
      interaction: "viewport-drag",
      invalidates: [],
      mustNotInvalidate: ["preview-scene", "preview-render"],
      targets: ["canvas.viewport.offset"],
    },
    {
      interaction: "viewport-zoom",
      invalidates: [],
      mustNotInvalidate: ["preview-scene", "preview-render"],
      targets: ["canvas.viewport.zoom"],
    },
    {
      interaction: "export",
      invalidates: ["export-render"],
      mustNotInvalidate: ["preview-scene"],
      retainedAccesses: ["export-scene"],
      targets: ["actions.output"],
    },
  ],
  passes: [
    {
      cacheKey: ["renderer.preview-scene"],
      cost: { dimensions: [], frequency: "once", relationship: "constant" },
      gpu: previewGpu,
      id: "preview-scene",
      inputs: ["renderer.preview-scene"],
      invalidatedBy: ["renderer.preview-scene"],
      kind: "preprocess",
      lifecycle: { cache: "retained-resource", resourceScope: "renderer" },
      output: "intermediate",
      quality: "full",
      runsOn: "gpu",
      sceneBounds,
    },
    {
      cost: { dimensions: ["preview-pixels"], frequency: "frame", relationship: "linear" },
      gpu: previewGpu,
      id: "preview-render",
      inputs: ["preview-scene", "product.values", "canvas.backing.width", "canvas.backing.height"],
      invalidatedBy: ["product.values", "canvas.backing.width", "canvas.backing.height"],
      kind: "composite",
      lifecycle: { cache: "none", resourceScope: "call" },
      output: "preview",
      quality: "retina",
      runsOn: "gpu",
      sceneBounds,
    },
    {
      cacheKey: ["renderer.export-scene"],
      cost: { dimensions: [], frequency: "once", relationship: "constant" },
      gpu: exportGpu,
      id: "export-scene",
      inputs: ["renderer.export-scene"],
      invalidatedBy: ["renderer.export-scene"],
      kind: "preprocess",
      lifecycle: { cache: "retained-resource", resourceScope: "renderer" },
      output: "intermediate",
      quality: "full",
      runsOn: "gpu",
      sceneBounds,
    },
    {
      cost: { dimensions: ["export-pixels"], frequency: "batch", relationship: "linear" },
      gpu: exportGpu,
      id: "export-render",
      inputs: ["export-scene", "product.values", "export.frame"],
      invalidatedBy: ["product.values", "export.frame"],
      kind: "export",
      lifecycle: { cache: "none", resourceScope: "call" },
      output: "export",
      quality: "export",
      runsOn: "gpu",
    },
  ],
  runtimeId: "flux-pass-three-v1",
});

export const badgePreviewScenePass = badgePipelineRegistration.getPass("preview-scene");
export const badgePreviewRenderPass = badgePipelineRegistration.getPass("preview-render");
export const badgeExportScenePass = badgePipelineRegistration.getPass("export-scene");
export const badgeExportRenderPass = badgePipelineRegistration.getPass("export-render");
