import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import {
  BADGE_DEFAULTS as D,
  BADGE_DROP_ACTION,
  BADGE_PRINT_ACTION,
  BADGE_RANGES as R,
  BADGE_ROLES,
  BADGE_TARGETS as T,
} from "./badge-params";
import { BADGE_FERRO_ITEMS, BADGE_PERSON_ITEMS } from "./badge-presets";
import { BADGE_THEME_IDS, BADGE_THEMES } from "./badge-theme";

type Section = {
  controls: Record<string, ToolcraftControlSchema>;
  description?: string;
  id: string;
  layoutGroups?: readonly {
    columns: 2;
    controls: readonly string[];
    layout: "inline";
  }[];
  title: string;
};

const always = { mode: "always" } as const;
const customRole = { all: [{ equals: "custom", target: T.role }], mode: "conditional" } as const;
const customStrap = { all: [{ equals: "custom", target: T.strapStyle }], mode: "conditional" } as const;
const redraw = "Redraws the card artwork texture once per edit; the retained 3D scene and physics keep running.";
const live = "Feeds the running simulation or camera directly; the retained scene is reused.";

function text(
  target: string,
  label: string,
  defaultValue: string,
  extra: Partial<ToolcraftControlSchema> = {},
): ToolcraftControlSchema {
  return {
    applicability: always,
    commitMode: "content",
    defaultValue,
    label,
    performanceReason: redraw,
    performanceRole: "responsiveness",
    target,
    textValueKind: "single-line",
    type: "text",
    ...extra,
  } as ToolcraftControlSchema;
}

function color(target: string, label: string, defaultValue: string, extra: Partial<ToolcraftControlSchema> = {}): ToolcraftControlSchema {
  return {
    applicability: always,
    defaultValue,
    label,
    performanceReason: redraw,
    performanceRole: "responsiveness",
    target,
    type: "color",
    ...extra,
  } as ToolcraftControlSchema;
}

function slider(
  target: string,
  label: string,
  range: { min: number; max: number },
  defaultValue: number,
  step: number,
  description: string,
  performanceReason = live,
): ToolcraftControlSchema {
  return {
    applicability: always,
    defaultValue,
    description,
    label,
    max: range.max,
    min: range.min,
    performanceReason,
    performanceRole: "responsiveness",
    sliderValueKind: "continuous",
    step,
    target,
    type: "slider",
  } as ToolcraftControlSchema;
}

function upload(target: string, label: string | false, description: string): ToolcraftControlSchema {
  return {
    accept: "image/png,image/jpeg,image/webp,image/*",
    applicability: always,
    assetKind: "image",
    description,
    label,
    multiple: false,
    performanceReason: "Decoded once per image and transform, then drawn into the card texture.",
    performanceRole: "responsiveness",
    target,
    type: "fileDrop",
  } as ToolcraftControlSchema;
}

function picker(
  target: string,
  label: string,
  items: typeof BADGE_PERSON_ITEMS,
  defaultValue: string,
  description: string,
): ToolcraftControlSchema {
  return {
    applicability: always,
    defaultValue,
    description,
    items: items.map((item) => ({ ...item })),
    label,
    performanceReason: "Decodes the chosen preset image once, then redraws the card texture.",
    performanceRole: "responsiveness",
    target,
    type: "imagePicker",
  } as ToolcraftControlSchema;
}

export const badgeCardSection: Section = {
  controls: {
    theme: {
      applicability: always,
      defaultValue: D.theme,
      description: "Colour modes from the Figma Theme variables: card background and type boxes.",
      label: "Theme",
      options: BADGE_THEME_IDS.map((id) => ({ label: BADGE_THEMES[id].label, value: id })),
      performanceReason: redraw,
      performanceRole: "responsiveness",
      target: T.theme,
      type: "segmented",
    } as ToolcraftControlSchema,
    presentedBy: {
      applicability: always,
      defaultValue: D.presentedBy,
      description: "Shows the presented-by Spotify badge on the back of the card.",
      label: "Presented by Spotify",
      performanceReason: redraw,
      performanceRole: "responsiveness",
      target: T.presentedBy,
      type: "switch",
    } as ToolcraftControlSchema,
  },
  id: "card",
  title: "Card",
};

export const badgeRoleSection: Section = {
  controls: {
    role: {
      applicability: always,
      defaultValue: D.role,
      label: false,
      options: BADGE_ROLES.map(({ label, value }) => ({ label, value })),
      performanceReason: redraw,
      performanceRole: "responsiveness",
      target: T.role,
      type: "select",
    } as ToolcraftControlSchema,
    roleCustom: text(T.roleCustom, "Custom role", D.roleCustom, {
      applicability: customRole,
      description: "Shown in the role box when Role is Custom.",
    } as Partial<ToolcraftControlSchema>),
  },
  id: "role",
  title: "Role",
};

export const badgeNameSection: Section = {
  controls: {
    firstName: text(T.firstName, "First name", D.firstName),
    lastName: text(T.lastName, "Last name", D.lastName),
    nameLayout: {
      applicability: always,
      defaultValue: D.nameLayout,
      description: "Two lines staggers first and last name; one line keeps them together. Both are centred.",
      label: "Layout",
      options: [
        { label: "2 lines", value: "two" },
        { label: "1 line", value: "one" },
      ],
      performanceReason: redraw,
      performanceRole: "responsiveness",
      target: T.nameLayout,
      type: "segmented",
    } as ToolcraftControlSchema,
    nameSize: slider(T.nameSize, "Size", R.nameSize, D.nameSize, 0.01, "Scales the name boxes; long names shrink to fit the card.", redraw),
    nameY: slider(T.nameY, "Position Y", R.nameY, D.nameY, 1, "Moves the name up or down on the card.", redraw),
  },
  id: "name",
  title: "Name",
};

export const badgePersonSection: Section = {
  controls: {
    person: picker(T.person, "Choose person", BADGE_PERSON_ITEMS, D.person, "Pre-cut people from the Figma assets. An uploaded photo replaces them."),
  },
  id: "person",
  title: "Person",
};

export const badgePersonPlacementSection: Section = {
  controls: {
    personScale: slider(T.personScale, "Size", R.personScale, D.personScale, 0.01, "Scales the person.", redraw),
    personX: slider(T.personX, "Offset X", R.personX, D.personX, 1, "Moves the person left or right.", redraw),
    personY: slider(T.personY, "Offset Y", R.personY, D.personY, 1, "Moves the person up or down.", redraw),
  },
  id: "person-placement",
  title: "Person placement",
};

export const badgePhotoSection: Section = {
  controls: {
    photo: upload(T.photo, false, "Your own image (a cut-out PNG works best). Replaces the chosen person; remove it to go back."),
  },
  id: "photo",
  title: "Upload person",
};

export const badgeFerroSection: Section = {
  controls: {
    ferroShape: picker(T.ferroShape, "Choose shape", BADGE_FERRO_ITEMS, D.ferroShape, "Ferrofluid shapes from the Figma assets, shown large on the back of the card."),
  },
  id: "ferrofluid",
  title: "Ferrofluid",
};

export const badgeFerroPlacementSection: Section = {
  controls: {
    ferroScale: slider(T.ferroScale, "Size", R.ferroScale, D.ferroScale, 0.01, "Scales the ferrofluid shape on the back.", redraw),
    ferroRotation: slider(T.ferroRotation, "Rotation", R.ferroRotation, D.ferroRotation, 1, "Rotates the shape around its centre.", redraw),
    ferroX: slider(T.ferroX, "Offset X", R.ferroX, D.ferroX, 1, "Moves the shape left or right.", redraw),
    ferroY: slider(T.ferroY, "Offset Y", R.ferroY, D.ferroY, 1, "Moves the shape up or down.", redraw),
  },
  id: "ferrofluid-placement",
  title: "Ferrofluid placement",
};

export const badgeLanyardSection: Section = {
  controls: {
    strapStyle: {
      applicability: always,
      defaultValue: D.strapStyle,
      description: "Theme uses Ink Black with the theme's box colour for the print and clip.",
      label: "Colours",
      options: [
        { label: "Theme", value: "theme" },
        { label: "Custom", value: "custom" },
      ],
      performanceReason: redraw,
      performanceRole: "responsiveness",
      target: T.strapStyle,
      type: "segmented",
    } as ToolcraftControlSchema,
    strapText: text(T.strapText, "Text", D.strapText, { description: "Repeats along the strap." } as Partial<ToolcraftControlSchema>),
    strapColor: color(T.strapColor, "Strap", D.strapColor, { applicability: customStrap, semanticGroup: "strap" } as Partial<ToolcraftControlSchema>),
    strapInk: color(T.strapInk, "Strap ink", D.strapInk, { applicability: customStrap, semanticGroup: "strap" } as Partial<ToolcraftControlSchema>),
    clipColor: color(T.clipColor, "Clip", D.clipColor, {
      applicability: customStrap,
      performanceReason: "Changes one material colour on the retained clip mesh.",
      semanticGroup: "clip",
    } as Partial<ToolcraftControlSchema>),
    strapLength: slider(T.strapLength, "Length", R.strapLength, D.strapLength, 0.01, "How far the badge hangs below the top of the frame."),
  },
  id: "lanyard",
  title: "Lanyard",
};

export const badgePhysicsSection: Section = {
  controls: {
    gravity: slider(T.gravity, "Gravity", R.gravity, D.gravity, 0.1, "Higher swings faster and feels heavier."),
    drag: slider(T.drag, "Air drag", R.drag, D.drag, 0.01, "How quickly a swing or throw calms down."),
    drop: {
      actions: [{ ...BADGE_DROP_ACTION }],
      applicability: always,
      description: "Replays the drop-in from above the frame.",
      label: false,
      performanceReason: "Resets the simulation pose; the retained scene is reused.",
      performanceRole: "responsiveness",
      target: T.drop,
      type: "actions",
    } as ToolcraftControlSchema,
  },
  id: "physics",
  title: "Physics",
};

export const badgePrintSection: Section = {
  controls: {
    printPack: {
      actions: [{ ...BADGE_PRINT_ACTION }],
      applicability: always,
      description: "Downloads a ZIP with the 3D preview PNG and the flat front and back artwork (2560 x 3600, no rounded corners or slot).",
      label: false,
      performanceReason: "Renders the two card faces and one preview frame once per click.",
      performanceRole: "responsiveness",
      target: T.printPack,
      type: "panelActions",
    } as ToolcraftControlSchema,
  },
  id: "print-pack",
  title: "Print pack",
};

export const badgeCameraSection: Section = {
  controls: {
    layout: {
      applicability: always,
      defaultValue: D.layout,
      description: "Two hangs a second badge beside the first that rests showing the back of the card.",
      label: "Badges",
      options: [
        { label: "One", value: "one" },
        { label: "Two", value: "two" },
      ],
      performanceReason: "Shows or hides the second badge rig; the retained scene and textures are reused.",
      performanceRole: "responsiveness",
      target: T.layout,
      type: "segmented",
    } as ToolcraftControlSchema,
    zoom: slider(T.zoom, "Zoom", R.zoom, D.zoom, 0.01, "Moves the fixed camera closer to or further from the badge."),
    cameraY: slider(T.cameraY, "Camera Y", R.cameraY, D.cameraY, 0.01, "Moves the frame up or down to place the badge."),
  },
  id: "camera",
  title: "Camera",
};

export const badgeBackgroundSection: Section = {
  controls: {
    includeBackground: {
      applicability: always,
      defaultValue: D.includeBackground,
      description: "Turn off for a transparent PNG.",
      label: "Include",
      performanceReason: "Runtime background fill only.",
      performanceRole: "responsiveness",
      target: T.includeBackground,
      type: "switch",
    },
    background: {
      applicability: always,
      defaultValue: D.background,
      label: false,
      performanceReason: "Runtime background fill only.",
      performanceRole: "responsiveness",
      target: T.background,
      type: "color",
    },
  },
  id: "background",
  layoutGroups: [{ columns: 2, controls: ["includeBackground", "background"], layout: "inline" }],
  title: "Background",
};
