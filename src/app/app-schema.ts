import { defineToolcraft, imageExportModule, mediaSourceModule } from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import {
  badgeBackgroundSection,
  badgeCameraSection,
  badgeCardSection,
  badgeFerroPlacementSection,
  badgeFerroSection,
  badgeLanyardSection,
  badgeNameSection,
  badgePersonPlacementSection,
  badgePersonSection,
  badgePhotoSection,
  badgePhysicsSection,
  badgePrintSection,
  badgeRoleSection,
} from "./badge/badge-sections";
import { BADGE_CANVAS_HEIGHT, BADGE_CANVAS_WIDTH } from "./badge/badge-viewport";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    // Deliberate contract break (user request): one locked view. A fixed
    // artboard removes Infinity canvas and the size controls; panning is off
    // and badge-viewport.ts keeps the zoom locked to cover the window.
    canvas: {
      draggable: false,
      enabled: true,
      size: { height: BADGE_CANVAS_HEIGHT, unit: "px", width: BADGE_CANVAS_WIDTH },
      sizing: { mode: "fixed-output" },
      upload: false,
    },
    identity: appIdentity,
    persistence: { storage: "localStorage" },
    panels: {
      controls: {
        sections: [
          badgeCardSection,
          badgeRoleSection,
          badgeNameSection,
          badgePersonSection,
          badgePersonPlacementSection,
          badgePhotoSection,
          badgeFerroSection,
          badgeFerroPlacementSection,
          badgeLanyardSection,
          badgePhysicsSection,
          badgeCameraSection,
          badgeBackgroundSection,
          badgePrintSection,
        ],
        title: "Flux Pass",
      },
    },
    toolbar: {
      history: true,
      radar: false,
      theme: true,
      zoom: false,
    },
  },
  modules: [mediaSourceModule(), imageExportModule()],
});
