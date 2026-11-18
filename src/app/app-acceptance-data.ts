import type {
  ToolcraftComponentAcceptance,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";
import { BADGE_DROP_ACTION, BADGE_ROLES, BADGE_TARGETS as T } from "./badge/badge-params";
import { BADGE_FERRO_IDS, BADGE_PERSON_IDS } from "./badge/badge-presets";
import { BADGE_THEME_IDS } from "./badge/badge-theme";
import { BADGE_PHYSICS_TARGET } from "./badge/badge-pipeline";

export { appControlSectionInventory } from "./app-control-inventory";

const persistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

const dragRequest =
  "yeah bro basically something 3d, and that we can play with the mouse, physics like dragging etc for something like this";

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: {
    behaviorCoverage: [
      "no-user-facing-transport",
      "no-play-pause",
      "no-scrub",
      "no-duration-control",
      "no-loop-control",
      "no-export-at-time",
    ],
    mode: "autonomous",
    reason:
      "The badge moves only through real-time physics: it drops in, swings and reacts to being dragged and thrown on the canvas. There is no authored animation, loop, transport or video export; PNG captures the pose on screen.",
  },
  mode: "new-toolcraft-app",
  referenceInputs: [],
};

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: { mode: "not-requested" },
  },
  interactionOwnership: [
    {
      alternative: {
        reason: "Canvas handles for names, colours and physics settings would clutter the badge the user is playing with.",
        surface: "canvas",
      },
      capability: "property-edit",
      evidence: {
        detail: "The user wants to switch the name, image and similar card details.",
        source: "user-request",
      },
      id: "badge-properties",
      reason: "The controls panel owns every card text, image, colour, lanyard, physics and camera setting.",
      selectionScope: { mode: "global" },
      surface: "panel",
      target: T.firstName,
    },
  ],
  mode: "product",
  productName: "Flux Pass",
  productSummary:
    "A 3D event badge on a fabric lanyard: it drops in, swings with real physics and can be grabbed and thrown with the mouse or touch, with editable holder details, ferrofluid shape, colours and lanyard print.",
  requestedBehavior:
    "Show a 3D ID badge hanging from a lanyard, let people play with it by dragging and throwing it, switch the name, photo and ferrofluid shape, and export the pose as a PNG.",
  viewInteraction: {
    authority: { kind: "explicit-user-request", requestQuote: dragRequest },
    mode: "fixed-camera",
  },
};

const spec = "e2e/product-badge.spec.ts" as const;

function controlRow(
  id: string,
  target: string,
  componentType: string,
  expectedObservable: string,
  extra: Partial<ToolcraftComponentAcceptance> = {},
): ToolcraftComponentAcceptance {
  return {
    automated: true,
    automatedTestName: `badge control maps ${target} into the rendered badge`,
    browser: { budget: "standard", file: spec, testName: `browser acceptance: ${id}` },
    componentType,
    evidence: "rendered-pixels",
    expectedObservable,
    fixture: "badge at rest after the drop-in",
    id,
    kind: "control",
    target,
    userAction: `Change ${componentType} ${target} through the real control and compare the canvas before and after.`,
    ...extra,
  };
}

const textRows: readonly [string, string][] = [
  [T.firstName, "The first name box on the card front changes."],
  [T.lastName, "The last name box on the card front changes."],
  [T.roleCustom, "With Role on Custom, the role box shows the typed text."],
  [T.strapText, "The text printed along the lanyard changes."],
];

const colorRows: readonly [string, string][] = [
  [T.strapColor, "With custom colours, the lanyard takes the selected colour."],
  [T.strapInk, "With custom colours, the lanyard print takes the selected colour."],
  [T.clipColor, "With custom colours, the swivel clip takes the selected colour."],
];

const sliderRows: readonly [string, string][] = [
  [T.nameSize, "The name boxes grow or shrink."],
  [T.nameY, "The name moves up or down."],
  [T.personScale, "The person grows or shrinks."],
  [T.personX, "The person moves left or right."],
  [T.personY, "The person moves up or down."],
  [T.ferroScale, "The ferrofluid shape grows or shrinks."],
  [T.ferroRotation, "The ferrofluid shape rotates."],
  [T.ferroX, "The ferrofluid shape moves left or right."],
  [T.ferroY, "The ferrofluid shape moves up or down."],
  [T.strapLength, "The badge hangs higher or lower."],
  [T.gravity, "The badge swings faster or slower."],
  [T.drag, "Swings settle faster or slower."],
  [T.zoom, "The camera moves closer or further."],
  [T.cameraY, "The frame moves up or down."],
];

const uploadRows: readonly [string, string][] = [
  [T.photo, "The uploaded image replaces the preset person; removing it brings the preset back."],
];

const badgeAcceptance: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName: "declares production reload coverage for the badge workspace",
    browser: {
      budget: "extended-io",
      file: "e2e/app-persistence.spec.ts",
      testName: "browser: app restores exact canvas, values, and panel workspace slices after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, badge values and the moved and collapsed Controls workspace restore after a real reload.",
    fixture: "badge persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices,
    target: "canvas.size.width",
    userAction: "Edit Canvas width and zoom, move and collapse Controls, wait for persistence, and reload.",
  },
  ...textRows.map(([target, observable]) =>
    controlRow(`badge.${target}`, target, "text", observable, target === T.firstName ? { interactionId: "badge-properties" } : {}),
  ),
  ...colorRows.map(([target, observable]) => controlRow(`badge.${target}`, target, "color", observable)),
  ...sliderRows.map(([target, observable]) => controlRow(`badge.${target}`, target, "slider", observable)),
  ...uploadRows.map(([target, observable]) =>
    controlRow(`badge.${target}`, target, "fileDrop", observable, {
      evidence: "media-lifecycle",
      mediaLifecycleCoverage: ["upload", "remove", "reset", "rotate", "flip", "transform-output"],
    }),
  ),
  controlRow("badge.theme", T.theme, "segmented", "Blue, Rose and Carrot switch the card background and type-box colours.", {
    optionCoverage: BADGE_THEME_IDS,
  }),
  controlRow("badge.presented-by", T.presentedBy, "switch", "The presented-by Spotify badge appears or disappears."),
  controlRow("badge.role", T.role, "select", "The role box shows the chosen role; Custom reveals the custom text field.", {
    optionCoverage: BADGE_ROLES.map(({ value }) => value),
  }),
  controlRow("badge.name-layout", T.nameLayout, "segmented", "The name switches between two staggered lines and one centred line.", {
    optionCoverage: ["two", "one"],
  }),
  controlRow("badge.person", T.person, "imagePicker", "The chosen pre-cut person is drawn on the card.", {
    optionCoverage: BADGE_PERSON_IDS,
  }),
  controlRow("badge.ferro-shape", T.ferroShape, "imagePicker", "The chosen ferrofluid shape is drawn behind the person.", {
    optionCoverage: BADGE_FERRO_IDS,
  }),
  controlRow("badge.strap-style", T.strapStyle, "segmented", "Theme colours the lanyard from the theme; Custom reveals the colour pickers.", {
    optionCoverage: ["theme", "custom"],
  }),
  controlRow("badge.layout", T.layout, "segmented", "Two hangs a second badge that rests showing the back; One shows a single badge.", {
    optionCoverage: ["one", "two"],
  }),
  controlRow("badge.drop", T.drop, "actions", "Drop badge replays the drop-in from above the frame.", {
    actionCoverage: [BADGE_DROP_ACTION.value],
  }),
  {
    automated: true,
    automatedTestName: "badge follows the pointer and keeps momentum when thrown",
    browser: { budget: "standard", file: spec, testName: "browser acceptance: stage.drag" },
    componentType: "canvas physics",
    evidence: "rendered-pixels",
    expectedObservable: "Dragging the card moves it under the pointer; releasing throws it and it swings back to rest.",
    fixture: "badge at rest after the drop-in",
    id: "stage.drag",
    kind: "runtime",
    target: BADGE_PHYSICS_TARGET,
    userAction: "Press on the card, drag sideways, release and watch it swing back.",
  },
  {
    automated: true,
    automatedTestName: "badge background inclusion controls preview and PNG transparency",
    backgroundOutputCoverage: "all-required-background-output",
    browser: { budget: "standard", file: spec, testName: "browser acceptance: export.includeBackground" },
    componentType: "switch",
    evidence: "rendered-pixels",
    expectedObservable: "Background off removes the preview fill and exports a transparent PNG.",
    fixture: "badge on #E9E7E3",
    id: "output.background-inclusion",
    kind: "control",
    target: T.includeBackground,
    userAction: "Toggle Background and compare preview, Infinity viewport and PNG alpha.",
  },
  {
    automated: true,
    automatedTestName: "badge background colour reaches export",
    browser: { budget: "standard", file: spec, testName: "browser acceptance: appearance.background" },
    componentType: "color",
    evidence: "exported-bytes",
    expectedObservable: "The selected Background colour fills the exported PNG corners.",
    fixture: "badge at rest",
    id: "output.background-color",
    kind: "control",
    target: T.background,
    userAction: "Change Background colour and inspect decoded export corners.",
  },
  {
    automated: true,
    automatedTestName: "badge image format options remain selectable",
    browser: { budget: "standard", file: spec, testName: "browser acceptance: export.image.format" },
    componentType: "select",
    evidence: "product-output",
    expectedObservable: "PNG and JPG remain available image formats.",
    fixture: "image export settings",
    id: "output.image-format",
    kind: "control",
    optionCoverage: ["png", "jpg"],
    target: "export.image.format",
    userAction: "Select PNG and JPG.",
  },
  {
    automated: true,
    automatedTestName: "badge image resolution options remain selectable",
    browser: { budget: "standard", file: spec, testName: "browser acceptance: export.image.resolution" },
    componentType: "select",
    evidence: "product-output",
    expectedObservable: "2K, 4K and 8K remain available image resolutions.",
    fixture: "image export settings",
    id: "output.image-resolution",
    kind: "control",
    optionCoverage: ["2k", "4k", "8k"],
    target: "export.image.resolution",
    userAction: "Select 2K, 4K and 8K.",
  },
  {
    actionCoverage: ["export.png"],
    automated: true,
    automatedTestName: "badge image export renders the badge at the selected resolution",
    browser: { budget: "extended-io", file: spec, testName: "browser acceptance: export image" },
    componentType: "panelActions",
    evidence: "exported-bytes",
    exportArtifactCoverage: "all-required-image-export-behavior",
    expectedObservable: "PNG and JPG exports decode at the selected size with the badge where it hangs in the preview.",
    fixture: "badge at rest export",
    id: "output.image-export",
    kind: "control",
    target: "actions.output",
    userAction: "Export PNG and JPG at 2K and inspect decoded pixels.",
  },
];

const lockedViewAcceptance: ToolcraftComponentAcceptance = {
  automated: true,
  automatedTestName: "badge keeps one locked 1920x1080 view that covers the window",
  browser: { budget: "standard", file: spec, testName: "browser acceptance: stage.locked-view" },
  canvasSizingCoverage: "fixed-output-size",
  componentType: "canvas",
  evidence: "viewport-side-effect",
  expectedObservable:
    "The 1920x1080 artboard always covers the window, centred; wheel, pinch and Space-drag never pan or zoom it, there is no Infinity canvas or size control, and resizing the window refits it.",
  fixture: "badge at rest",
  id: "stage.locked-view",
  kind: "runtime",
  target: "canvas.size.width",
  userAction:
    "Scroll and Ctrl+wheel over the badge, Space-drag the canvas, resize the window. The user asked: \"fix it, break rules, this should be the only view of the app like this, locked viewport\".",
};

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [...badgeAcceptance, lockedViewAcceptance];
