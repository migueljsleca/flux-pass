import {
  composeToolcraftApp,
  type ToolcraftPanelActionContext,
} from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { BadgeCanvas } from "./badge/badge-canvas";
import { badgeExportRenderer } from "./badge/badge-export";
import { getBadgeSceneRect } from "./badge/badge-frame";
import { requestBadgeDrop } from "./badge/badge-live";
import { BADGE_DROP_ACTION } from "./badge/badge-params";
import { badgePipelineRegistration } from "./badge/badge-pipeline";

export function handleBadgePanelAction({ action }: ToolcraftPanelActionContext): void {
  if (action.value === BADGE_DROP_ACTION.value) requestBadgeDrop();
}

export const appComposition = composeToolcraftApp(appSchema, {
  actions: { onPanelAction: handleBadgePanelAction },
  renderer: { pipelineRegistration: badgePipelineRegistration },
  scene: {
    canvasContent: <BadgeCanvas />,
    rasterFrameRenderer: badgeExportRenderer,
    renderDefaultCanvasMedia: false,
    // The fixed camera frame, centred on the saved artboard size, in both modes.
    sceneBoundsProvider: ({ state }) => [getBadgeSceneRect(state.canvas.size.width, state.canvas.size.height)],
  },
});
