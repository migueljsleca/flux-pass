import {
  composeToolcraftApp,
  type ToolcraftPanelActionContext,
} from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { BadgeCanvas } from "./badge/badge-canvas";
import { badgeExportRenderer } from "./badge/badge-export";
import { getBadgeSceneRect } from "./badge/badge-frame";
import { requestBadgeDrop } from "./badge/badge-live";
import { BADGE_DROP_ACTION, BADGE_PRINT_ACTION } from "./badge/badge-params";
import { badgePipelineRegistration } from "./badge/badge-pipeline";
import { buildBadgePrintPack } from "./badge/badge-print";
import { downloadBadgeFile } from "./badge/badge-print-download";

export function handleBadgePanelAction({ action, reportProgress, state }: ToolcraftPanelActionContext): Promise<void> | void {
  if (action.value === BADGE_DROP_ACTION.value) requestBadgeDrop();
  if (action.value === BADGE_PRINT_ACTION.value) {
    return buildBadgePrintPack(state, reportProgress).then((pack) => downloadBadgeFile(pack.blob, pack.fileName));
  }
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
